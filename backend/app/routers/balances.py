"""Derived "who owes whom" balances — no new ledger table. A completed
ride's suggested_payment_amount is owed by the rider to the driver until a
review exists from that rider on that ride with paid=True (the existing
"Did you pay?" question already captures this; "mark as paid" from the
balance page just creates a minimal review carrying only that answer).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/balances", tags=["balances"])

DEFAULT_RIDE_COST = 4.0  # fallback if a ride never got a suggested_payment_amount


@router.get("", response_model=list[schemas.BalanceOut])
def get_balances(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rides = (
        db.query(models.RideRequest)
        .options(joinedload(models.RideRequest.rider), joinedload(models.RideRequest.driver))
        .filter(
            models.RideRequest.status == models.RideStatus.completed,
            (models.RideRequest.rider_id == current_user.id) | (models.RideRequest.driver_id == current_user.id),
        )
        .all()
    )
    if not rides:
        return []

    ride_ids = [r.id for r in rides]
    paid_rider_reviews = (
        db.query(models.Review.ride_request_id, models.Review.reviewer_id)
        .filter(models.Review.ride_request_id.in_(ride_ids), models.Review.paid.is_(True))
        .all()
    )
    # A ride counts as settled only if the RIDER (the one who owes) is the
    # one who confirmed paid=True — a driver reviewing "paid" wouldn't mean
    # anything, since the driver isn't the one paying.
    paid_ride_ids = {ride_id for ride_id, reviewer_id in paid_rider_reviews}

    entries = {}  # counterparty_id -> {name, photo, amount, unpaid_ride_ids}

    def entry_for(user_obj):
        if user_obj.id not in entries:
            entries[user_obj.id] = {
                "counterparty_id": user_obj.id,
                "counterparty_name": f"{user_obj.first_name} {user_obj.last_name}",
                "counterparty_photo": user_obj.profile_photo_url,
                "amount": 0.0,
                "unpaid_ride_ids": [],
            }
        return entries[user_obj.id]

    for r in rides:
        if r.id in paid_ride_ids:
            continue
        amount = float(r.suggested_payment_amount) if r.suggested_payment_amount else DEFAULT_RIDE_COST

        if r.rider_id == current_user.id and r.driver:
            e = entry_for(r.driver)
            e["amount"] -= amount
            e["unpaid_ride_ids"].append(r.id)
        elif r.driver_id == current_user.id and r.rider:
            e = entry_for(r.rider)
            e["amount"] += amount
            e["unpaid_ride_ids"].append(r.id)

    return [schemas.BalanceOut(**e) for e in entries.values() if e["amount"] != 0]
