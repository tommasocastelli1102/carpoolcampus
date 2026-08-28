"""Production has plenty of registered users but ZERO posted availability
(no one had ever driven a route through the live API) — that's why
"Choose a ride" was empty for every rider on the live site. This script
fixes that: it flips a batch of existing production riders to drivers
(via /auth/enable-driving, the same endpoint the "+ Add availability"
button uses) and posts a morning + evening route for each, using their
own real address <-> UCLA so distances are meaningful. It also posts a
route for driver_test, who already has a car but never posted one.

Usage:
    python scripts/seed_prod_availability.py
"""
import json
import urllib.error
import urllib.request

BASE_URL = "https://carpoolcampus-backend.onrender.com"
DEMO_PASSWORD = "password123"

# A few close to rider_test's own address (3400 Motor Ave, Palms, 90034)
# so their default 1.5 mi search radius actually finds something, plus a
# spread of others around campus-adjacent neighborhoods for variety.
RIDER_EMAILS_TO_MAKE_DRIVERS = [
    "anthony.russo@ucla.edu",   # 3210 Motor Ave — same street as rider_test
    "marcus.bailey@ucla.edu",   # 10422 National Blvd — also 90034
    "aisha.bello@ucla.edu",     # 3660 Motor Ave — also 90034
    "ethan.park@ucla.edu",
    "ravi.mehta@ucla.edu",
    "malik.jefferson@ucla.edu",
    "julia.santos@ucla.edu",
    "kevin.nguyen@ucla.edu",
    "omar.haddad@ucla.edu",
    "tyler.brennan@ucla.edu",
]

# Already a driver, just never posted a route.
EXISTING_DRIVER_EMAILS = ["driver_test@ucla.edu"]

PAYMENT_METHODS = ["venmo", "cash"]


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


def post_route(token, address):
    for day, start, end, route_from, route_to in [
        (0, "08:00", "09:00", address, "UCLA"),
        (0, "17:30", "18:30", "UCLA", address),
    ]:
        try:
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
                    "seats_available": 3,
                },
            )
        except urllib.error.HTTPError as e:
            print(f"    FAILED posting slot: {e.code} {e.read()}")


def main():
    for email in RIDER_EMAILS_TO_MAKE_DRIVERS:
        token, user = login(email)
        try:
            _request(
                "POST",
                "/auth/enable-driving",
                token=token,
                payload={"payment_methods": PAYMENT_METHODS, "bio": None},
            )
            print(f"enabled driving: {email}")
        except urllib.error.HTTPError as e:
            print(f"  enable-driving FAILED for {email}: {e.code} {e.read()}")
            continue
        if user.get("address"):
            post_route(token, user["address"])
            print(f"  posted routes for {email} ({user['address']})")
        else:
            print(f"  skipped route (no address on file): {email}")

    for email in EXISTING_DRIVER_EMAILS:
        token, user = login(email)
        if user.get("address"):
            post_route(token, user["address"])
            print(f"posted routes for existing driver {email} ({user['address']})")
        else:
            print(f"skipped route (no address on file): {email}")

    print("\nDone.")


if __name__ == "__main__":
    main()
