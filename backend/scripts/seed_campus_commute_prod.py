"""Posts a daily (Mon-Fri) campus commute pattern for a fixed set of
existing production drivers, via the live API:

  - 3 routes TO campus (home -> UCLA), one each in the morning, afternoon,
    and evening, so a rider searching any time of day finds a match.
  - 6 routes FROM campus (UCLA -> home), 2 per time-of-day, each driver
    going to their own distinct real address, so there's variety in both
    when and where.

Each slot is posted once per weekday (day_of_week 0-4) since this schema
has no "every day" flag on a single Availability row. Idempotent: skips
any (driver, day_of_week, start_time, route_from, route_to) combo that
already exists, so re-running is safe.

Usage:
    python scripts/seed_campus_commute_prod.py
"""
import json
import urllib.error
import urllib.request

BASE_URL = "https://carpoolcampus-backend.onrender.com"
DEMO_PASSWORD = "password123"
CAMPUS = "UCLA"
WEEKDAYS = [0, 1, 2, 3, 4]  # Mon-Fri
SEATS = 3

# (email, start, end, direction) — direction "to_campus" posts
# address->UCLA, "from_campus" posts UCLA->address. Address is read from
# the account's own profile at post time.
TO_CAMPUS = [
    ("ethan.park@ucla.edu", "08:00", "09:00"),   # morning
    ("aisha.bello@ucla.edu", "12:30", "13:30"),  # afternoon
    ("ravi.mehta@ucla.edu", "17:30", "18:30"),   # evening
]

FROM_CAMPUS = [
    ("malik.jefferson@ucla.edu", "08:30", "09:30"),  # morning
    ("tyler.brennan@ucla.edu", "09:00", "10:00"),    # morning
    ("julia.santos@ucla.edu", "12:00", "13:00"),     # afternoon
    ("kevin.nguyen@ucla.edu", "13:30", "14:30"),     # afternoon
    ("omar.haddad@ucla.edu", "17:00", "18:00"),      # evening
    ("anthony.russo@ucla.edu", "18:00", "19:00"),    # evening
]


def _request(method, path, token=None, payload=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, json.loads(resp.read())


def login(email):
    _, data = _request("POST", "/auth/login", payload={"email": email, "password": DEMO_PASSWORD})
    return data["access_token"], data["user"]


def post_daily_slot(token, existing, route_from, route_to, start, end):
    created = 0
    for day in WEEKDAYS:
        key = (day, start, route_from, route_to)
        if key in existing:
            continue
        _request(
            "POST",
            "/availability",
            token=token,
            payload={
                "day_of_week": day,
                "start_time": start,
                "end_time": end,
                "route_from": route_from,
                "route_to": route_to,
                "seats_available": SEATS,
            },
        )
        created += 1
    return created


def run(entries, direction):
    for email, start, end in entries:
        try:
            token, user = login(email)
        except urllib.error.HTTPError as e:
            print(f"  LOGIN FAILED for {email}: {e.code} {e.read()[:200]}")
            continue

        address = user.get("address")
        if not address:
            print(f"  SKIPPED {email} (no address on file)")
            continue

        route_from, route_to = (address, CAMPUS) if direction == "to_campus" else (CAMPUS, address)

        _, mine = _request("GET", f"/availability?driver_id={user['id']}")
        existing = {(s["day_of_week"], s["start_time"][:5], s["route_from"], s["route_to"]) for s in mine}

        created = post_daily_slot(token, existing, route_from, route_to, start, end)
        print(f"  {user['first_name']} {user['last_name']}: {route_from} -> {route_to} "
              f"{start}-{end}, Mon-Fri ({created} new, {len(WEEKDAYS) - created} already existed)")


def main():
    print("Posting TO-campus routes (morning / afternoon / evening):")
    run(TO_CAMPUS, "to_campus")
    print("\nPosting FROM-campus routes (2x morning, 2x afternoon, 2x evening, distinct homes):")
    run(FROM_CAMPUS, "from_campus")
    print("\nDone.")


if __name__ == "__main__":
    main()
