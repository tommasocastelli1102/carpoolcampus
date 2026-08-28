"""Register the same 10 new demo riders (from seed_more_riders.py) against
the LIVE production backend, via the public /auth/register endpoint —
there's no direct DB access to Render's managed Postgres, so this mirrors
what seed_more_riders.py did locally.

Usage:
    python scripts/register_riders_prod.py
"""
import json
import urllib.request
import urllib.error

BASE_URL = "https://carpoolcampus-backend.onrender.com"
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
            "phone_number": "555-010-01" + str(10 + i),
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
