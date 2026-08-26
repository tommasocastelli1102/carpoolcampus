from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import SessionLocal, get_db
from ..deps import get_current_user
from ..security import decode_access_token

router = APIRouter(prefix="/messages", tags=["messages"])


class ChatConnectionManager:
    """Tiny in-memory pub/sub so open chat tabs get new messages instantly.

    MVP-scoped: state lives in this process only, fine for local dev with a
    single backend instance. Polling (GET /messages/{id}) keeps working
    regardless, so this is a nice-to-have, not a dependency.
    """

    def __init__(self) -> None:
        self.rooms: dict[int, set[WebSocket]] = {}

    async def connect(self, ride_request_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(ride_request_id, set()).add(websocket)

    def disconnect(self, ride_request_id: int, websocket: WebSocket) -> None:
        self.rooms.get(ride_request_id, set()).discard(websocket)

    async def broadcast(self, ride_request_id: int, payload: dict) -> None:
        for ws in list(self.rooms.get(ride_request_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(ride_request_id, ws)


manager = ChatConnectionManager()


def _get_authorized_ride_request(db: Session, ride_request_id: int, current_user: models.User) -> models.RideRequest:
    ride_request = db.get(models.RideRequest, ride_request_id)
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    if current_user.id not in (ride_request.rider_id, ride_request.driver_id):
        raise HTTPException(status_code=403, detail="Not part of this ride request")
    if ride_request.status not in (models.RideStatus.confirmed, models.RideStatus.completed):
        raise HTTPException(status_code=400, detail="Chat is only available once the ride is confirmed")
    return ride_request


@router.get("/{ride_request_id}", response_model=list[schemas.MessageOut])
def list_messages(
    ride_request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_authorized_ride_request(db, ride_request_id, current_user)
    return (
        db.query(models.Message)
        .options(joinedload(models.Message.sender))
        .filter(models.Message.ride_request_id == ride_request_id)
        .order_by(models.Message.sent_at.asc())
        .all()
    )


@router.post("/{ride_request_id}", response_model=schemas.MessageOut, status_code=201)
async def send_message(
    ride_request_id: int,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_authorized_ride_request(db, ride_request_id, current_user)
    message = models.Message(ride_request_id=ride_request_id, sender_id=current_user.id, content=payload.content)
    db.add(message)
    db.commit()
    db.refresh(message)

    await manager.broadcast(
        ride_request_id,
        {
            "id": message.id,
            "ride_request_id": message.ride_request_id,
            "sender_id": message.sender_id,
            "content": message.content,
            "sent_at": message.sent_at.isoformat(),
        },
    )
    return message


@router.websocket("/ws/{ride_request_id}")
async def chat_websocket(websocket: WebSocket, ride_request_id: int, token: str):
    """Optional real-time channel. Falls back gracefully to polling if unused.

    Auth is passed as a query param (`?token=...`) since browsers can't set
    custom headers on a WebSocket handshake.
    """
    user_id = decode_access_token(token)
    db = SessionLocal()
    try:
        if user_id is None:
            await websocket.close(code=4401)
            return
        user = db.get(models.User, user_id)
        if user is None:
            await websocket.close(code=4401)
            return
        try:
            _get_authorized_ride_request(db, ride_request_id, user)
        except HTTPException:
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await manager.connect(ride_request_id, websocket)
    try:
        while True:
            # Clients send {"content": "..."} and we persist + rebroadcast.
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue
            db = SessionLocal()
            try:
                message = models.Message(ride_request_id=ride_request_id, sender_id=user_id, content=content)
                db.add(message)
                db.commit()
                db.refresh(message)
                await manager.broadcast(
                    ride_request_id,
                    {
                        "id": message.id,
                        "ride_request_id": message.ride_request_id,
                        "sender_id": message.sender_id,
                        "content": message.content,
                        "sent_at": message.sent_at.isoformat(),
                    },
                )
            finally:
                db.close()
    except WebSocketDisconnect:
        manager.disconnect(ride_request_id, websocket)
