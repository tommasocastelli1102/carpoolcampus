"""Register the second batch of demo riders (from seed_more_riders2.py)
against the LIVE production backend, via the public /auth/register
endpoint — there's no direct DB access to Render's managed Postgres.

Usage:
    python scripts/register_riders_prod2.py
"""
import json
import urllib.request
import urllib.error

BASE_URL = "https://carpoolcampus-backend.onrender.com"
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
    created, skipped = 0, 0
    for i, r in enumerate(NEW_RIDERS):
        payload = {
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "email": r["email"],
            "password": DEMO_PASSWORD,
            "sex": r["sex"],
            "role": "rider",
            "address": r["address"],
            "university": "UCLA",
            "schedule_note": SCHEDULE_NOTES[i % len(SCHEDULE_NOTES)],
            "phone_number": "555-010-02" + str(10 + i),
        }
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/auth/register",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status == 201:
                    created += 1
                    print(f"created: {r['email']}")
                else:
                    print(f"FAILED {r['email']}: {resp.status} {resp.read()}")
        except urllib.error.HTTPError as e:
            if e.code == 400:
                skipped += 1
                print(f"skip (exists): {r['email']}")
            else:
                print(f"FAILED {r['email']}: {e.code} {e.read()}")
    print(f"\nCreated {created}, skipped {skipped}.")


if __name__ == "__main__":
    main()
