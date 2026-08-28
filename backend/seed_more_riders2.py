"""Second batch of demo riders (feedback: "generate some riders and add
them to the db to see the result").

Usage (from backend/, with your venv active and .env configured):
    python seed_more_riders2.py
"""
from datetime import date

from app.database import Base, SessionLocal, engine
from app.models import User, UserRole
from app.security import hash_password

DEMO_PASSWORD = "password123"

NEW_RIDERS = [
    dict(first_name="Julia", last_name="Santos", email="julia.santos@ucla.edu", sex="Female",
         address="1233 S Bundy Dr, Los Angeles, CA 90025"),
    dict(first_name="Kevin", last_name="Nguyen", email="kevin.nguyen@ucla.edu", sex="Male",
         address="11500 Olympic Blvd, Los Angeles, CA 90064"),
    dict(first_name="Rachel", last_name="Cohen", email="rachel.cohen@ucla.edu", sex="Female",
         address="1950 Sawtelle Blvd, Los Angeles, CA 90025"),
    dict(first_name="Derek", last_name="Osei", email="derek.osei@ucla.edu", sex="Male",
         address="10921 Kinross Ave, Los Angeles, CA 90024"),
    dict(first_name="Natalie", last_name="Fischer", email="natalie.fischer@ucla.edu", sex="Female",
         address="11661 San Vicente Blvd, Los Angeles, CA 90049"),
    dict(first_name="Omar", last_name="Haddad", email="omar.haddad@ucla.edu", sex="Male",
         address="12244 Santa Monica Blvd, Los Angeles, CA 90025"),
    dict(first_name="Grace", last_name="Kim", email="grace.kim2@ucla.edu", sex="Female",
         address="10850 Lindbrook Dr, Los Angeles, CA 90024"),
    dict(first_name="Anthony", last_name="Russo", email="anthony.russo@ucla.edu", sex="Male",
         address="3210 Motor Ave, Los Angeles, CA 90034"),
    dict(first_name="Priyanka", last_name="Shah", email="priyanka.shah@ucla.edu", sex="Female",
         address="1801 Colby Ave, Los Angeles, CA 90025"),
    dict(first_name="Marcus", last_name="Bailey", email="marcus.bailey@ucla.edu", sex="Male",
         address="10422 National Blvd, Los Angeles, CA 90034"),
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
                    birthday=date(2002, 5, 20),
                    sex=r["sex"],
                    role=UserRole.rider,
                    phone_number="555-010-02" + str(10 + i),
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
