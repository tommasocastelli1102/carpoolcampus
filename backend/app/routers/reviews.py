from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(tags=["reviews"])


@router.post("/reviews", response_model=schemas.ReviewOut, status_code=201)
def create_review(
    payload: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ride_request = db.get(models.RideRequest, payload.ride_request_id)
    if not ride_request:
        raise HTTPException(status_code=404, detail="Ride request not found")
    if current_user.id not in (ride_request.rider_id, ride_request.driver_id):
        raise HTTPException(status_code=403, detail="Not part of this ride request")
    if ride_request.status != models.RideStatus.completed:
        raise HTTPException(status_code=400, detail="You can only review completed rides")
    if payload.reviewee_id not in (ride_request.rider_id, ride_request.driver_id):
        raise HTTPException(status_code=400, detail="Reviewee must be the other party on this ride")
    if payload.reviewee_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't review yourself")

    review = models.Review(reviewer_id=current_user.id, **payload.model_dump())
    db.add(review)
    db.commit()

    # Keep the driver's average rating up to date (simple running average over
    # the four star categories, across all reviews they've received).
    driver_profile = db.get(models.DriverProfile, payload.reviewee_id)
    if driver_profile:
        all_reviews = db.query(models.Review).filter(models.Review.reviewee_id == payload.reviewee_id).all()
        scores = [
            s
            for r in all_reviews
            for s in (r.stars_driving_style, r.stars_speed, r.stars_cleanliness, r.stars_punctuality)
            if s is not None
        ]
        if scores:
            driver_profile.avg_rating = Decimal(sum(scores) / len(scores)).quantize(Decimal("0.01"))
            db.add(driver_profile)
            db.commit()

    db.refresh(review)
    return review


@router.get("/users/{user_id}/reviews", response_model=list[schemas.ReviewOut])
def get_user_reviews(user_id: int, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return (
        db.query(models.Review)
        .options(joinedload(models.Review.reviewer))
        .filter(models.Review.reviewee_id == user_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )
