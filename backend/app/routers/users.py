from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(role: models.UserRole | None = None, db: Session = Depends(get_db)):
    """Public profile listing, used to place pins on the map.

    Riders browsing the map get drivers (role=driver); drivers get riders
    (role=rider) so they can see who's nearby before anyone has requested
    anything. Same visibility level as GET /rides/search — no auth needed.
    """
    query = db.query(models.User).options(joinedload(models.User.driver_profile))
    if role == models.UserRole.driver:
        query = query.filter(models.User.role.in_([models.UserRole.driver, models.UserRole.both]))
    elif role == models.UserRole.rider:
        query = query.filter(models.User.role.in_([models.UserRole.rider, models.UserRole.both]))
    return query.order_by(models.User.id).all()


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .options(joinedload(models.User.driver_profile))
        .filter(models.User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
