"""Registers two dedicated "always available" drivers on production and
posts a full 7-day availability schedule for each — morning to campus,
evening back from campus, every single day, with the max seat count — so
a rider searching any day, either direction (to campus / to home), always
finds at least one of them as a match, however they search.

Idempotent: skips any (driver, day_of_week, start_time, route_from,
route_to) combo that already exists, matching the pattern in
seed_campus_commute_prod.py.

Usage:
    python scripts/seed_always_available_drivers_prod.py
"""
import json
import urllib.error
import urllib.request

BASE_URL = "https://carpoolcampus-backend.onrender.com"
DEMO_PASSWORD = "password123"
CAMPUS = "UCLA"
ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]  # Mon..Sun — every day, not just weekdays
SEATS = 8  # max allowed — these two should never show as full

DRIVERS = [
    {
        "first_name": "Sam",
        "last_name": "Rivera",
        "email": "sam.rivera.always@ucla.edu",
        "address": "1250 Westwood Blvd, Los Angeles, CA 90024",
        "morning": ("07:30", "08:30"),
        "evening": ("17:00", "18:00"),
    },
    {
        "first_name": "Jordan",
        "last_name": "Lee",
        "email": "jordan.lee.always@ucla.edu",
        "address": "10850 Kinross Ave, Los Angeles, CA 90024",
        "morning": ("08:30", "09:30"),
        "evening": ("18:30", "19:30"),
    },
]


def _request(method, path, token=None, payload=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, json.loads(resp.read())


def get_or_register(driver):
    try:
        _, data = _request(
            "POST",
            "/auth/register",
            payload={
                "first_name": driver["first_name"],
                "last_name": driver["last_name"],
                "role": "driver",
                "email": driver["email"],
                "password": DEMO_PASSWORD,
                "address": driver["address"],
                "university": "ucla",
                "payment_methods": ["venmo", "cash"],
                "bio": "Around every day — happy to grab you wherever works.",
            },
        )
        print(f"  registered {driver['email']}")
    except urllib.error.HTTPError as e:
        if e.code == 400:
            _, data = _request("POST", "/auth/login", payload={"email": driver["email"], "password": DEMO_PASSWORD})
            print(f"  already existed, logged in: {driver['email']}")
        else:
            raise
    return data["access_token"], data["user"]


def post_daily_slot(token, existing, route_from, route_to, start, end):
    created = 0
    for day in ALL_DAYS:
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


def main():
    for driver in DRIVERS:
        token, user = get_or_register(driver)
        address = user.get("address") or driver["address"]

        _, mine = _request("GET", f"/availability?driver_id={user['id']}")
        existing = {(s["day_of_week"], s["start_time"][:5], s["route_from"], s["route_to"]) for s in mine}

        m_start, m_end = driver["morning"]
        e_start, e_end = driver["evening"]

        created_to = post_daily_slot(token, existing, address, CAMPUS, m_start, m_end)
        created_from = post_daily_slot(token, existing, CAMPUS, address, e_start, e_end)

        print(
            f"  {user['first_name']} {user['last_name']} (#{user['id']}): "
            f"{address} <-> UCLA, every day, {m_start}-{m_end} in / {e_start}-{e_end} out "
            f"({created_to + created_from} new slots, {14 - created_to - created_from} already existed)"
        )

    print("\nDone.")


if __name__ == "__main__":
    main()
