"""Every production user should have somewhere between 3 and 10 received
reviews so profile pages/rating breakdowns look real instead of empty.
This tops anyone under 3 up to a random target in [3, 10] — nobody's
existing reviews are touched or removed.

Goes through the live API (like seed_prod_availability.py) rather than
writing to the DB directly, so it exercises the same create -> confirm ->
complete -> review flow the app itself uses, and the driver's avg_rating
gets recomputed by the /reviews endpoint automatically.

Each new review is backed by a real (synthetic) completed ride_request:
  - target is a driver (has a driver_profile): a random other logged-in
    user creates the ride as the rider (driver_id=target) and reviews
    them. The target's own password is never needed.
  - target is a pure rider: only the target can create a ride_request as
    themselves (the API always makes the caller the rider), so the target
    has to log in too. If that fails (a real, non-demo password), the
    user is skipped and reported at the end.

All demo/seed accounts in this app use DEMO_PASSWORD; anyone with a
different password simply can't be used as an "actor" (creator/reviewer),
and pure riders among them can't be topped up at all.

Usage:
    python scripts/seed_reviews_prod.py --dry-run   # just print the plan
    python scripts/seed_reviews_prod.py             # actually seed
"""
import argparse
import json
import random
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE_URL = "https://carpoolcampus-backend.onrender.com"
DEMO_PASSWORD = "password123"

MIN_REVIEWS = 3
MAX_REVIEWS = 10

FEEDBACK_POOL = [
    "Great ride, very punctual!",
    "Super friendly and easy to talk to.",
    "Would definitely ride together again.",
    "Car was clean and comfortable.",
    "Always on time, no complaints.",
    "Good communication throughout the ride.",
    "Chill vibe, nice playlist.",
    "Very reliable, texted ahead about timing.",
    "Smooth ride, no issues at all.",
    "Friendly and respectful of the schedule.",
    "Made the commute way less painful, thanks!",
    "Easygoing and considerate.",
    None, None, None, None, None,  # roughly a third left blank, like real reviews
]

PAYMENT_METHODS = ["venmo", "zelle", "revolut", "cash"]


def _request(method, path, token=None, payload=None, retries=2):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.URLError:
            if attempt == retries:
                raise
            time.sleep(3)  # Render free tier can be cold-starting


_tokens = {}


def login(email):
    if email in _tokens:
        return _tokens[email]
    try:
        _, data = _request("POST", "/auth/login", payload={"email": email, "password": DEMO_PASSWORD})
        _tokens[email] = data["access_token"]
    except urllib.error.HTTPError:
        _tokens[email] = None
    return _tokens[email]


def random_stars():
    def one():
        if random.random() < 0.08:  # occasionally leave a category blank
            return None
        return random.choices([3, 4, 5], weights=[15, 35, 50])[0]

    return one(), one(), one(), one()


def random_past_time():
    dt = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 90))
    hour = random.choice([7, 8, 8, 9, 16, 17, 17, 18])
    minute = random.choice([0, 15, 30, 45])
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


def create_completed_ride(rider_token, driver_id):
    """Creates a ride_request (as `rider_token`'s user, riding with
    `driver_id`) and walks it straight to completed. Returns its id, or
    None on failure."""
    try:
        _, req = _request(
            "POST",
            "/rides/request",
            token=rider_token,
            payload={
                "driver_id": driver_id,
                "pickup_type": random.choice(["pickup", "meet_outside"]),
                "custom_time": random_past_time(),
                "suggested_payment_amount": 4,
                "payment_method_chosen": random.choice(PAYMENT_METHODS),
            },
        )
        rid = req["id"]
        _request("PATCH", f"/rides/request/{rid}", token=rider_token, payload={"status": "confirmed"})
        _request("PATCH", f"/rides/request/{rid}", token=rider_token, payload={"status": "completed"})
        return rid
    except urllib.error.HTTPError as e:
        print(f"      create/complete FAILED: {e.code} {e.read()[:200]}")
        return None


def submit_review(reviewer_token, ride_request_id, reviewee_id):
    s1, s2, s3, s4 = random_stars()
    try:
        _request(
            "POST",
            "/reviews",
            token=reviewer_token,
            payload={
                "ride_request_id": ride_request_id,
                "reviewee_id": reviewee_id,
                "stars_drive_safety": s1,
                "stars_clean_car": s2,
                "stars_punctuality": s3,
                "stars_good_company": s4,
                "free_text_feedback": random.choice(FEEDBACK_POOL),
                "paid": random.random() < 0.85,
                "paid_method": random.choice(PAYMENT_METHODS) if random.random() < 0.85 else None,
            },
        )
        return True
    except urllib.error.HTTPError as e:
        print(f"      review FAILED: {e.code} {e.read()[:200]}")
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print the plan without writing anything")
    args = parser.parse_args()

    _, users = _request("GET", "/users")
    print(f"{len(users)} users total\n")

    print("Logging in as everyone (demo password) to see who's usable as an actor...")
    for u in users:
        login(u["email"])
    usable_ids = {u["id"] for u in users if _tokens.get(u["email"])}
    driver_usable_ids = {u["id"] for u in users if u.get("driver_profile") is not None and u["id"] in usable_ids}
    print(f"  {len(usable_ids)}/{len(users)} logins worked ({len(driver_usable_ids)} of those are drivers)\n")

    print("Checking existing review counts...")
    counts = {}
    for u in users:
        _, reviews = _request("GET", f"/users/{u['id']}/reviews")
        counts[u["id"]] = len(reviews)

    by_id = {u["id"]: u for u in users}
    seeded_total = 0
    skipped_users = []

    for u in users:
        uid = u["id"]
        existing = counts[uid]
        if existing >= MIN_REVIEWS:
            continue
        target_total = random.randint(MIN_REVIEWS, MAX_REVIEWS)
        needed = target_total - existing
        is_driver = u.get("driver_profile") is not None
        label = f"{u['first_name']} {u['last_name']} (#{uid}, {'driver' if is_driver else 'rider'})"
        print(f"{label}: {existing} -> {target_total} ({needed} more)")

        if args.dry_run:
            continue

        if is_driver:
            pool = [i for i in usable_ids if i != uid]
            if not pool:
                print("    SKIPPED (no other usable accounts to act as reviewers)")
                skipped_users.append(u["email"])
                continue
            reviewers = (pool * ((needed // len(pool)) + 1))
            random.shuffle(reviewers)
            for counterpart_id in reviewers[:needed]:
                token = _tokens[by_id[counterpart_id]["email"]]
                rid = create_completed_ride(token, driver_id=uid)
                if rid and submit_review(token, rid, reviewee_id=uid):
                    seeded_total += 1
        else:
            if uid not in usable_ids:
                print(f"    SKIPPED ENTIRELY (login failed for {u['email']} — can't act as themselves)")
                skipped_users.append(u["email"])
                continue
            target_token = _tokens[u["email"]]
            pool = [i for i in driver_usable_ids if i != uid]
            if not pool:
                print("    SKIPPED (no usable drivers to pair with)")
                skipped_users.append(u["email"])
                continue
            reviewers = (pool * ((needed // len(pool)) + 1))
            random.shuffle(reviewers)
            for driver_id in reviewers[:needed]:
                driver_token = _tokens[by_id[driver_id]["email"]]
                rid = create_completed_ride(target_token, driver_id=driver_id)
                if rid and submit_review(driver_token, rid, reviewee_id=uid):
                    seeded_total += 1

    print(f"\nDone. Seeded {seeded_total} new reviews.")
    if skipped_users:
        print(f"\nCouldn't seed {len(skipped_users)} account(s) (non-demo password or no driver to pair with):")
        for e in skipped_users:
            print(f"  - {e}")


if __name__ == "__main__":
    main()
