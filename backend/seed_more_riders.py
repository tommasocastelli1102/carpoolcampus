"""One-off: add 10 more demo riders to the database (feedback: "generate and
add some riders to the db (10 riders)" so there's more to browse/test
against, especially for the driver-side dashboards and the balances page).

Usage (from backend/, with your venv active and .env configured):
    python seed_more_riders.py
"""
from datetime import date

from app.database import Base, SessionLocal, engine
from app.models import User, UserRole
from app.security import hash_password

DEMO_PASSWORD = "password123"

NEW_RIDERS = [
    dict(first_name="Ethan", last_name="Park", email="ethan.park@ucla.edu", sex="Male",
         address="10982 Roebling Ave, Los Angeles, CA 90024"),
    dict(first_name="Aisha", last_name="Bello", email="aisha.bello@ucla.edu", sex="Female",
         address="3660 Motor Ave, Los Angeles, CA 90034"),
    dict(first_name="Ravi", last_name="Mehta", email="ravi.mehta@ucla.edu", sex="Male",
         address="10850 Wilshire Blvd, Los Angeles, CA 90024"),
    dict(first_name="Sophia", last_name="Petrov", email="sophia.petrov@ucla.edu", sex="Female",
         address="4111 Sepulveda Blvd, Culver City, CA 90230"),
    dict(first_name="Malik", last_name="Jefferson", email="malik.jefferson@ucla.edu", sex="Male",
         address="11500 San Vicente Blvd, Los Angeles, CA 90049"),
    dict(first_name="Emma", last_name="Wallace", email="emma.wallace@ucla.edu", sex="Female",
         address="12244 Venice Blvd, Los Angeles, CA 90066"),
    dict(first_name="Carlos", last_name="Mendoza", email="carlos.mendoza@ucla.edu", sex="Male",
         address="2001 S Barrington Ave, Los Angeles, CA 90025"),
    dict(first_name="Hannah", last_name="Kessler", email="hannah.kessler@ucla.edu", sex="Female",
         address="1450 Federal Ave, Los Angeles, CA 90025"),
    dict(first_name="Tyler", last_name="Brennan", email="tyler.brennan@ucla.edu", sex="Male",
         address="10820 W Pico Blvd, Los Angeles, CA 90064"),
    dict(first_name="Nadia", last_name="Farouk", email="nadia.farouk@ucla.edu", sex="Female",
         address="3849 Grand View Blvd, Los Angeles, CA 90066"),
]

SCHEDULE_NOTES = [
    "Weekday mornings 8-9am, evenings 5-6pm",
    "Tue/Thu classes, flexible on timing",
    "Every weekday morning, back around 6pm",
    "MWF only, mornings",
    "Need rides most weekdays, mornings preferred",
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    created = 0
    try:
        for i, r in enumerate(NEW_RIDERS):
            existing = db.query(User).filter(User.email == r["email"]).first()
            if existing:
                print(f"skip (exists): {r['email']}")
                continue
            db.add(
                User(
                    first_name=r["first_name"],
                    last_name=r["last_name"],
                    email=r["email"],
                    password_hash=hash_password(DEMO_PASSWORD),
                    birthday=date(2002, 3, 10),
                    sex=r["sex"],
                    role=UserRole.rider,
                    phone_number="555-010-01" + str(10 + i),
                    address=r["address"],
                    university="UCLA",
                    schedule_note=SCHEDULE_NOTES[i % len(SCHEDULE_NOTES)],
                )
            )
            created += 1
        db.commit()
        print(f"Created {created} new riders (skipped {len(NEW_RIDERS) - created} already present).")
        print(f"Demo login for any of them: <email> / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
