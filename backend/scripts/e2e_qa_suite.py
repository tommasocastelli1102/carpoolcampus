"""Comprehensive end-to-end / integration test suite against the live
production API. Registers two brand-new, disposable accounts (so every
assertion starts from known-zero state instead of fighting pre-existing
seed data), then walks the full lifecycle plus edge cases:

  auth (register/login/dupe-email/wrong-password/me)
  availability (create/list/delete, non-driver forbidden)
  enable-driving (rider -> both)
  ride search
  ride request lifecycle (request/confirm/seat-decrement/decline/complete)
  authorization (3rd party can't accept/decline someone else's request)
  reviews (blocked pre-completion, self-review blocked, wrong reviewee
    blocked, success + avg_rating recompute)
  balances (unpaid after completion, cleared after paid review, the
    "Mark as paid" bare-review path from the Balance page)
  messages/chat (blocked pre-confirmation, success, 3rd-party forbidden)
  users listing
  404s for nonexistent ids

Each check is a plain assert with a message; failures are collected and
printed as a report at the end rather than stopping the run, so one
broken thing doesn't hide everything else.

Usage:
    python scripts/e2e_qa_suite.py
"""
import json
import random
import string
import time
import urllib.error
import urllib.request

BASE_URL = "https://carpoolcampus-backend.onrender.com"

results = []  # (name, passed: bool, detail: str)


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail and not condition else ""))


def _request(method, path, token=None, payload=None, expect_status=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            status = resp.status
            data = json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            data = json.loads(e.read())
        except Exception:
            data = None
    if expect_status is not None and status != expect_status:
        return status, data, False
    return status, data, True


def rand_suffix():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def main():
    suffix = rand_suffix()
    driver_email = f"qa.driver.{suffix}@ucla.edu"
    rider_email = f"qa.rider.{suffix}@ucla.edu"
    password = "qaPassword123!"

    print(f"=== Section A: Auth & registration (suffix={suffix}) ===")

    status, data, ok = _request(
        "POST", "/auth/register",
        payload={
            "first_name": "QA", "last_name": "Driver", "role": "driver",
            "email": driver_email, "password": password,
            "address": "10945 Le Conte Ave, Los Angeles, CA 90024",
            "university": "ucla",
            "payment_methods": ["venmo"],
        },
        expect_status=201,
    )
    check("A1 register driver -> 201", ok, f"got {status}: {data}")
    driver_token = data["access_token"] if ok else None
    driver_id = data["user"]["id"] if ok else None
    check("A1b driver has driver_profile", ok and data["user"].get("driver_profile") is not None)

    status, data, ok = _request(
        "POST", "/auth/register",
        payload={
            "first_name": "QA", "last_name": "Rider", "role": "rider",
            "email": rider_email, "password": password,
            "address": "555 Westwood Plaza, Los Angeles, CA 90024",
            "university": "ucla",
        },
        expect_status=201,
    )
    check("A2 register rider -> 201", ok, f"got {status}: {data}")
    rider_token = data["access_token"] if ok else None
    rider_id = data["user"]["id"] if ok else None
    check("A2b rider has NO driver_profile", ok and data["user"].get("driver_profile") is None)

    status, data, ok = _request(
        "POST", "/auth/register",
        payload={"first_name": "Dup", "last_name": "Licate", "role": "rider", "email": driver_email, "password": password},
        expect_status=400,
    )
    check("A3 duplicate email -> 400", ok, f"got {status}: {data}")

    status, data, ok = _request("POST", "/auth/login", payload={"email": driver_email, "password": "wrong-password"}, expect_status=401)
    check("A4 wrong password -> 401", ok, f"got {status}: {data}")

    status, data, ok = _request("POST", "/auth/login", payload={"email": driver_email, "password": password}, expect_status=200)
    check("A5 correct login -> 200 + token", ok and "access_token" in (data or {}), f"got {status}")

    status, data, ok = _request("GET", "/auth/me", token=driver_token, expect_status=200)
    check("A6 GET /auth/me with token -> correct user", ok and data.get("email") == driver_email)

    status, data, ok = _request("GET", "/auth/me", expect_status=401)
    check("A7 GET /auth/me without token -> 401", ok, f"got {status}")

    if not (driver_token and rider_token):
        print("\nAborting: registration failed, can't continue.")
        print_report()
        return

    print("\n=== Section B: Availability ===")

    status, data, ok = _request(
        "POST", "/availability", token=driver_token,
        payload={"day_of_week": 0, "start_time": "08:00", "end_time": "09:00",
                 "route_from": "10945 Le Conte Ave, Los Angeles, CA 90024", "route_to": "UCLA", "seats_available": 2},
        expect_status=201,
    )
    check("B1 create availability -> 201", ok, f"got {status}: {data}")
    slot_id = data["id"] if ok else None

    status, data, ok = _request("GET", f"/availability?driver_id={driver_id}", expect_status=200)
    check("B2 list availability includes new slot", ok and any(s["id"] == slot_id for s in data))

    status, data, ok = _request(
        "POST", "/availability", token=rider_token,
        payload={"day_of_week": 0, "start_time": "08:00", "end_time": "09:00", "route_from": "A", "route_to": "B"},
        expect_status=403,
    )
    check("B3 pure rider can't post availability -> 403", ok, f"got {status}: {data}")

    status, data2, ok = _request(
        "POST", "/availability", token=driver_token,
        payload={"day_of_week": 1, "start_time": "10:00", "end_time": "11:00", "route_from": "X", "route_to": "Y"},
        expect_status=201,
    )
    throwaway_slot_id = data2["id"] if ok else None
    status, _, ok_del = _request("DELETE", f"/availability/{throwaway_slot_id}", token=driver_token, expect_status=204)
    check("B4 delete availability -> 204", ok and ok_del, f"got {status}")
    status, data3, _ = _request("GET", f"/availability?driver_id={driver_id}")
    check("B4b deleted slot no longer listed", not any(s["id"] == throwaway_slot_id for s in data3))

    print("\n=== Section C: enable-driving ===")
    status, data, ok = _request(
        "POST", "/auth/enable-driving", token=rider_token,
        payload={"payment_methods": ["cash"]}, expect_status=200,
    )
    check("C1 enable-driving -> role becomes both", ok and data.get("role") == "both", f"got {status}: {data}")
    check("C2 enable-driving -> driver_profile created", ok and data.get("driver_profile") is not None)

    print("\n=== Section D: ride search ===")
    status, data, ok = _request("GET", "/rides/search", expect_status=200)
    check("D1 search with no filters -> 200 list", ok and isinstance(data, list))
    status, data, ok = _request("GET", "/rides/search?route_to=UCLA", expect_status=200)
    check("D2 search route_to=UCLA -> 200, all match", ok and all("ucla" in s["route_to"].lower() for s in data))

    print("\n=== Section E: ride request lifecycle ===")
    status, data, ok = _request(
        "POST", "/rides/request", token=rider_token,
        payload={"driver_id": driver_id, "availability_id": slot_id, "pickup_type": "pickup"},
        expect_status=201,
    )
    check("E1 rider requests ride -> 201 pending", ok and data.get("status") == "pending", f"got {status}: {data}")
    ride_id = data["id"] if ok else None

    status, data, ok = _request(
        "PATCH", f"/rides/request/{ride_id}", token=driver_token, payload={"status": "confirmed"}, expect_status=200
    )
    check("E2 driver confirms -> 200 confirmed", ok and data.get("status") == "confirmed", f"got {status}: {data}")

    status, data, ok = _request("GET", f"/availability?driver_id={driver_id}", expect_status=200)
    slot_after = next((s for s in data if s["id"] == slot_id), None)
    check("E3 seat decremented on confirm (2 -> 1)", slot_after and slot_after["seats_available"] == 1,
          f"seats_available={slot_after and slot_after['seats_available']}")

    # 3rd party can't touch this ride
    status, data, ok = _request(
        "POST", "/auth/register",
        payload={"first_name": "QA", "last_name": "Stranger", "role": "rider", "email": f"qa.stranger.{suffix}@ucla.edu", "password": password},
        expect_status=201,
    )
    stranger_token = data["access_token"] if ok else None
    stranger_id = data["user"]["id"] if ok else None
    status, data, ok = _request(
        "PATCH", f"/rides/request/{ride_id}", token=stranger_token, payload={"status": "cancelled"}, expect_status=403
    )
    check("E4 unrelated user can't PATCH someone else's ride -> 403", ok, f"got {status}: {data}")

    status, data, ok = _request("GET", f"/rides/driver/{driver_id}/stops", token=driver_token, expect_status=200)
    check("E5 driver stops includes this confirmed pickup", ok and any(s["ride_request_id"] == ride_id for s in data))

    status, data, ok = _request(
        "PATCH", f"/rides/request/{ride_id}", token=driver_token, payload={"status": "completed"}, expect_status=200
    )
    check("E6 driver marks completed -> 200", ok and data.get("status") == "completed", f"got {status}: {data}")

    print("\n=== Section E-decline: separate ride, declined path ===")
    status, data, ok = _request(
        "POST", "/rides/request", token=rider_token,
        payload={"driver_id": driver_id, "pickup_type": "meet_outside", "custom_time": "2026-09-01T08:00:00Z", "custom_place": "Front gate"},
        expect_status=201,
    )
    decline_ride_id = data["id"] if ok else None
    check("E7 second (custom) request -> 201", ok)
    status, data, ok = _request(
        "PATCH", f"/rides/request/{decline_ride_id}", token=driver_token, payload={"status": "declined"}, expect_status=200
    )
    check("E8 driver declines -> 200 declined", ok and data.get("status") == "declined", f"got {status}: {data}")
    status, data, ok = _request("GET", f"/availability?driver_id={driver_id}")
    slot_after_decline = next((s for s in data if s["id"] == slot_id), None)
    check("E9 declining a never-confirmed request doesn't touch seats", slot_after_decline and slot_after_decline["seats_available"] == 1)

    print("\n=== Section F: reviews ===")
    status, data, ok = _request(
        "POST", "/reviews", token=rider_token,
        payload={"ride_request_id": decline_ride_id, "reviewee_id": driver_id, "stars_drive_safety": 5},
        expect_status=400,
    )
    check("F1 review a non-completed ride -> 400", ok, f"got {status}: {data}")

    status, data, ok = _request(
        "POST", "/reviews", token=rider_token,
        payload={"ride_request_id": ride_id, "reviewee_id": rider_id, "stars_drive_safety": 5},
        expect_status=400,
    )
    check("F2 reviewing yourself -> 400", ok, f"got {status}: {data}")

    status, data, ok = _request(
        "POST", "/reviews", token=rider_token,
        payload={"ride_request_id": ride_id, "reviewee_id": stranger_id, "stars_drive_safety": 5},
        expect_status=400,
    )
    check("F3 reviewee not party to the ride -> 400", ok, f"got {status}: {data}")

    status, data, ok = _request("GET", f"/users/{driver_id}", expect_status=200)
    rating_before = data["driver_profile"]["avg_rating"] if ok else None

    status, data, ok = _request(
        "POST", "/reviews", token=rider_token,
        payload={
            "ride_request_id": ride_id, "reviewee_id": driver_id,
            "stars_drive_safety": 5, "stars_clean_car": 5, "stars_punctuality": 5, "stars_good_company": 5,
            "free_text_feedback": "QA suite test review", "paid": True, "paid_method": "venmo",
        },
        expect_status=201,
    )
    check("F4 valid review -> 201", ok, f"got {status}: {data}")

    status, data, ok = _request("GET", f"/users/{driver_id}", expect_status=200)
    rating_after = data["driver_profile"]["avg_rating"] if ok else None
    check("F5 avg_rating recomputed (5.0 from first review)", ok and float(rating_after) == 5.0,
          f"before={rating_before} after={rating_after}")

    status, data, ok = _request("GET", f"/users/{driver_id}/reviews", expect_status=200)
    check("F6 GET reviews includes the new one", ok and any(r["free_text_feedback"] == "QA suite test review" for r in data))

    print("\n=== Section G: balances ===")
    # Fresh completed ride, left unpaid on purpose to test the "you owe" + mark-as-paid path.
    status, data, ok = _request(
        "POST", "/rides/request", token=rider_token,
        payload={"driver_id": driver_id, "pickup_type": "pickup", "custom_time": "2026-09-02T08:00:00Z", "suggested_payment_amount": 7},
        expect_status=201,
    )
    bal_ride_id = data["id"] if ok else None
    _request("PATCH", f"/rides/request/{bal_ride_id}", token=driver_token, payload={"status": "confirmed"})
    _request("PATCH", f"/rides/request/{bal_ride_id}", token=driver_token, payload={"status": "completed"})

    status, data, ok = _request("GET", "/balances", token=rider_token, expect_status=200)
    entry = next((b for b in data if b["counterparty_id"] == driver_id), None)
    check("G1 rider balance shows $7 owed to driver", ok and entry and entry["amount"] == -7.0, f"entry={entry}")

    status, data, ok = _request("GET", "/balances", token=driver_token, expect_status=200)
    entry = next((b for b in data if b["counterparty_id"] == rider_id), None)
    check("G2 driver balance shows $7 owed BY rider", ok and entry and entry["amount"] == 7.0, f"entry={entry}")

    # "Mark as paid" from the Balance page: a bare review carrying only paid=True.
    status, data, ok = _request(
        "POST", "/reviews", token=rider_token,
        payload={"ride_request_id": bal_ride_id, "reviewee_id": driver_id, "paid": True, "paid_method": "cash"},
        expect_status=201,
    )
    check("G3 bare mark-as-paid review -> 201", ok, f"got {status}: {data}")

    status, data, ok = _request("GET", "/balances", token=rider_token, expect_status=200)
    entry = next((b for b in data if b["counterparty_id"] == driver_id), None)
    check("G4 rider balance cleared after mark-as-paid", entry is None, f"entry={entry}")

    status, data, ok = _request("GET", "/balances", token=driver_token, expect_status=200)
    entry = next((b for b in data if b["counterparty_id"] == rider_id), None)
    check("G5 driver balance also cleared", entry is None, f"entry={entry}")

    print("\n=== Section H: messages / chat ===")
    status, data, ok = _request(
        "POST", "/rides/request", token=rider_token,
        payload={"driver_id": driver_id, "pickup_type": "pickup", "custom_time": "2026-09-03T08:00:00Z"},
        expect_status=201,
    )
    chat_ride_id = data["id"] if ok else None
    status, data, ok = _request("POST", f"/messages/{chat_ride_id}", token=rider_token, payload={"content": "hi"}, expect_status=400)
    check("H1 chat blocked before confirmation -> 400", ok, f"got {status}: {data}")

    _request("PATCH", f"/rides/request/{chat_ride_id}", token=driver_token, payload={"status": "confirmed"})

    status, data, ok = _request("POST", f"/messages/{chat_ride_id}", token=rider_token, payload={"content": "On my way!"}, expect_status=201)
    check("H2 rider sends message -> 201", ok, f"got {status}: {data}")
    status, data, ok = _request("POST", f"/messages/{chat_ride_id}", token=driver_token, payload={"content": "Sounds good"}, expect_status=201)
    check("H3 driver sends message -> 201", ok, f"got {status}: {data}")

    status, data, ok = _request("GET", f"/messages/{chat_ride_id}", token=rider_token, expect_status=200)
    check("H4 message list has both, in order", ok and len(data) == 2 and data[0]["content"] == "On my way!" and data[1]["content"] == "Sounds good")

    status, data, ok = _request("POST", f"/messages/{chat_ride_id}", token=stranger_token, payload={"content": "eavesdrop"}, expect_status=403)
    check("H5 unrelated user can't post to this chat -> 403", ok, f"got {status}: {data}")

    print("\n=== Section I: users listing & 404s ===")
    status, data, ok = _request("GET", "/users", expect_status=200)
    check("I1 GET /users public list -> 200", ok and isinstance(data, list))
    status, data, ok = _request("GET", "/users?role=driver", expect_status=200)
    check("I2 GET /users?role=driver -> all have driver_profile", ok and all(u.get("driver_profile") is not None for u in data))
    status, data, ok = _request("GET", "/users/999999999", expect_status=404)
    check("I3 GET nonexistent user -> 404", ok, f"got {status}: {data}")
    status, data, ok = _request("PATCH", "/rides/request/999999999", token=driver_token, payload={"status": "completed"}, expect_status=404)
    check("I4 PATCH nonexistent ride -> 404", ok, f"got {status}: {data}")
    status, data, ok = _request(
        "POST", "/rides/request", token=rider_token,
        payload={"driver_id": 999999999, "pickup_type": "pickup"}, expect_status=404,
    )
    check("I5 request ride from nonexistent driver -> 404", ok, f"got {status}: {data}")

    print_report()


def print_report():
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [name for name, ok, detail in results if not ok]
    print(f"\n{'=' * 60}\nRESULT: {passed}/{total} passed")
    if failed:
        print(f"FAILED ({len(failed)}):")
        for name in failed:
            detail = next(d for n, ok, d in results if n == name)
            print(f"  - {name}: {detail}")
    else:
        print("All checks passed.")


if __name__ == "__main__":
    main()
