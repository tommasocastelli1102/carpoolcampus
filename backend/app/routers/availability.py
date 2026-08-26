from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=list[schemas.AvailabilityOut])
def list_availability(
    driver_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Availability).options(
        joinedload(models.Availability.driver).joinedload(models.User.driver_profile)
    )
    if driver_id is not None:
        query = query.filter(models.Availability.driver_id == driver_id)
    return query.order_by(models.Availability.id.desc()).all()


@router.post("", response_model=schemas.AvailabilityOut, status_code=201)
def create_availability(
    payload: schemas.AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in (models.UserRole.driver, models.UserRole.both):
        raise HTTPException(status_code=403, detail="Only drivers can create availability slots")

    slot = models.Availability(driver_id=current_user.id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{availability_id}", status_code=204)
def delete_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    slot = db.get(models.Availability, availability_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Availability slot not found")
    if slot.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your availability slot")
    db.delete(slot)
    db.commit()
    return None
