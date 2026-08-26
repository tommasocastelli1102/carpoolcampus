"""Seed the database with demo drivers, riders, availability, and a sample
confirmed ride + review, so the frontend has something to show immediately.

Usage (from backend/, with your venv active and .env configured):
    python seed.py
"""
from datetime import date, time, timedelta

from app.database import Base, SessionLocal, engine
from app.models import (
    Availability,
    DriverProfile,
    Message,
    Review,
    RideRequest,
    RideStatus,
    PickupType,
    User,
    UserRole,
)
from app.security import hash_password

DEMO_PASSWORD = "password123"

DRIVERS = [
    dict(
        first_name="Maya",
        last_name="Chen",
        email="maya.driver@ucla.edu",
        sex="Female",
        payment_methods=["venmo", "coffee"],
        bio="Anderson MBA1, drive a Civic, usually blasting podcasts. Happy to pick up on the way.",
    ),
    dict(
        first_name="Diego",
        last_name="Alvarez",
        email="diego.driver@ucla.edu",
        sex="Male",
        payment_methods=["cash", "aux_cord"],
        bio="Second-year, live near Palms. You control the aux, I control the AC.",
    ),
    dict(
        first_name="Priya",
        last_name="Nair",
        email="priya.driver@ucla.edu",
        sex="Female",
        payment_methods=["venmo"],
        bio="Commute from Culver City daily around the same times, quiet rides welcome.",
    ),
    dict(
        first_name="Sam",
        last_name="Okafor",
        email="sam.driver@ucla.edu",
        sex="Male",
        payment_methods=["beer", "venmo"],
        bio="Weekend warrior, mostly evening rides back from campus events.",
    ),
    dict(
        first_name="Wei",
        last_name="Zhang",
        email="wei.driver@ucla.edu",
        sex="Male",
        payment_methods=["other"],
        payment_method_other="Split gas on the app",
        bio="EV owner, silent and smooth. Flexible on pickup spots near Westwood.",
    ),
]

RIDERS = [
    dict(first_name="Alex", last_name="Kim", email="alex.rider@ucla.edu", sex="Male"),
    dict(first_name="Fatima", last_name="Hassan", email="fatima.rider@ucla.edu", sex="Female"),
    dict(first_name="Liam", last_name="O'Brien", email="liam.rider@ucla.edu", sex="Male"),
    dict(first_name="Noor", last_name="Ibrahim", email="noor.rider@ucla.edu", sex="Female"),
    dict(first_name="Jordan", last_name="Lee", email="jordan.rider@ucla.edu", sex="Non-binary"),
]

ROUTES = [
    ("Palms Apartments", "UCLA Anderson"),
    ("Culver City Station", "UCLA Campus"),
    ("Westwood Village", "UCLA Anderson"),
    ("Sawtelle", "UCLA Campus"),
    ("Mar Vista", "UCLA Anderson"),
]


def get_or_create_user(db, data: dict, role: UserRole) -> User:
    user = db.query(User).filter(User.email == data["email"]).first()
    if user:
        return user
    user = User(
        first_name=data["first_name"],
        last_name=data["last_name"],
        email=data["email"],
        password_hash=hash_password(DEMO_PASSWORD),
        birthday=date(2001, 6, 15),
        sex=data.get("sex"),
        role=role,
        phone_number="555-010-0000",
        address="Los Angeles, CA",
        schedule_note="Weekdays, mornings and evenings",
    )
    db.add(user)
    db.flush()
    return user


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        driver_users = []
        for i, d in enumerate(DRIVERS):
            user = get_or_create_user(db, d, UserRole.driver)
            driver_users.append(user)
            if not user.driver_profile:
                db.add(
                    DriverProfile(
                        user_id=user.id,
                        payment_methods=d["payment_methods"],
                        payment_method_other=d.get("payment_method_other"),
                        bio=d["bio"],
                    )
                )
            db.flush()

            route_from, route_to = ROUTES[i % len(ROUTES)]
            existing_slot = db.query(Availability).filter(Availability.driver_id == user.id).first()
            if not existing_slot:
                db.add(
                    Availability(
                        driver_id=user.id,
                        day_of_week=i % 5,  # Mon-Fri recurring slot
                        start_time=time(8, 0),
                        end_time=time(9, 0),
                        route_from=route_from,
                        route_to=route_to,
                        seats_available=3,
                    )
                )
                db.add(
                    Availability(
                        driver_id=user.id,
                        day_of_week=i % 5,
                        start_time=time(17, 30),
                        end_time=time(18, 30),
                        route_from=route_to,
                        route_to=route_from,
                        seats_available=3,
                    )
                )

        rider_users = []
        for r in RIDERS:
            rider_users.append(get_or_create_user(db, r, UserRole.rider))

        db.commit()

        # Sample confirmed ride + chat + review between the first rider/driver
        # so the demo has non-empty dashboards on first load.
        demo_driver = driver_users[0]
        demo_rider = rider_users[0]
        slot = db.query(Availability).filter(Availability.driver_id == demo_driver.id).first()

        existing_request = (
            db.query(RideRequest)
            .filter(RideRequest.rider_id == demo_rider.id, RideRequest.driver_id == demo_driver.id)
            .first()
        )
        if not existing_request:
            ride_request = RideRequest(
                rider_id=demo_rider.id,
                driver_id=demo_driver.id,
                availability_id=slot.id if slot else None,
                status=RideStatus.completed,
                pickup_type=PickupType.pickup,
                suggested_payment_amount=4,
                payment_method_chosen="venmo",
            )
            db.add(ride_request)
            db.flush()

            db.add_all(
                [
                    Message(
                        ride_request_id=ride_request.id,
                        sender_id=demo_rider.id,
                        content="Hey! Running 2 min late, that ok?",
                    ),
                    Message(
                        ride_request_id=ride_request.id,
                        sender_id=demo_driver.id,
                        content="No worries, I'll be out front!",
                    ),
                ]
            )
            db.add(
                Review(
                    ride_request_id=ride_request.id,
                    reviewer_id=demo_rider.id,
                    reviewee_id=demo_driver.id,
                    stars_driving_style=5,
                    stars_speed=4,
                    stars_cleanliness=5,
                    stars_punctuality=5,
                    free_text_feedback="Super chill ride, great music too.",
                    paid=True,
                    paid_method="venmo",
                )
            )
            db.commit()

            profile = demo_driver.driver_profile
            profile.avg_rating = 4.75
            db.add(profile)
            db.commit()

        # One pending request too, so the driver dashboard has something to act on.
        second_rider = rider_users[1]
        second_slot = db.query(Availability).filter(Availability.driver_id == driver_users[1].id).first()
        pending_exists = (
            db.query(RideRequest)
            .filter(RideRequest.rider_id == second_rider.id, RideRequest.driver_id == driver_users[1].id)
            .first()
        )
        if not pending_exists:
            db.add(
                RideRequest(
                    rider_id=second_rider.id,
                    driver_id=driver_users[1].id,
                    availability_id=second_slot.id if second_slot else None,
                    status=RideStatus.pending,
                    pickup_type=PickupType.meet_outside,
                    custom_place="In front of the library",
                    suggested_payment_amount=4,
                )
            )
            db.commit()

        print(f"Seeded {len(driver_users)} drivers and {len(rider_users)} riders.")
        print(f"Demo login for any seeded user: <email> / {DEMO_PASSWORD}")
        print("e.g. maya.driver@ucla.edu / " + DEMO_PASSWORD)
        print("e.g. alex.rider@ucla.edu / " + DEMO_PASSWORD)
    finally:
        db.close()


if __name__ == "__main__":
    main()
