from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/rides", tags=["rides"])

_REQUEST_LOAD_OPTIONS = (
    joinedload(models.RideRequest.rider),
    joinedload(models.RideRequest.driver).joinedload(models.User.driver_profile),
    joinedload(models.RideRequest.availability),
)


@router.get("/search", response_model=list[schemas.AvailabilityOut])
def search_rides(
    route_from: str | None = None,
    route_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Riders browse available driver routes/slots."""
    query = db.query(models.Availability).options(
        joinedload(models.Availability.driver).joinedload(models.User.driver_profile)
    )
    if route_from:
        query = query.filter(models.Availability.route_from.ilike(f"%{route_from}%"))
    if route_to:
        query = query.filter(models.Availability.route_to.ilike(f"%{route_to}%"))
    return query.order_by(models.Availability.id.desc()).all()


@router.post("/request", response_model=schemas.RideRequestOut, status_code=201)
def create_ride_request(
    payload: schemas.RideRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    driver = db.get(models.User, payload.driver_id)
    if not driver or driver.role not in (models.UserRole.driver, models.UserRole.both):
        raise HTTPException(status_code=404, detail="Driver not found")

    if payload.availability_id is not None:
        slot = db.get(models.Availability, payload.availability_id)
        if not slot or slot.driver_id != payload.driver_id:
            raise HTTPException(status_code=404, detail="Availability slot not found for this driver")

    ride_request = models.RideRequest(
        rider_id=current_user.id,
        driver_id=payload.driver_id,
        availability_id=payload.availability_id,
        pickup_type=payload.pickup_type,
        custom_time=payload.custom_time,
        custom_place=payload.custom_place,
        suggested_payment_amount=payload.suggested_payment_amount,
        payment_method_chosen=payload.payment_method_chosen,
        status=models.RideStatus.pending,
    )
    db.add(ride_request)
    db.commit()
    db.refresh(ride_request)
    return _reload(db, ride_request.id)


@router.patch("/request/{ride_request_id}", response_model=schemas.RideRequestOut)
def update_ride_request(
    ride_request_id: int,
    payload: schemas.RideRequestUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ride_request = db.get(models.RideRequest, ride_request_id)
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    if current_user.id not in (ride_request.rider_id, ride_request.driver_id):
        raise HTTPException(status_code=403, detail="Not part of this ride request")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(ride_request, field, value)

    db.add(ride_request)
    db.commit()
    return _reload(db, ride_request.id)


@router.get("/my", response_model=list[schemas.RideRequestOut])
def my_rides(
    status: models.RideStatus | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.RideRequest).options(*_REQUEST_LOAD_OPTIONS).filter(
        (models.RideRequest.rider_id == current_user.id) | (models.RideRequest.driver_id == current_user.id)
    )
    if status is not None:
        query = query.filter(models.RideRequest.status == status)
    return query.order_by(models.RideRequest.created_at.desc()).all()


def _reload(db: Session, ride_request_id: int) -> models.RideRequest:
    return (
        db.query(models.RideRequest)
        .options(*_REQUEST_LOAD_OPTIONS)
        .filter(models.RideRequest.id == ride_request_id)
        .one()
    )
