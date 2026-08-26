"""Address -> lat/lng lookup, used to place pins on the map.

Backed by OpenStreetMap's free Nominatim geocoder (no API key needed).
Nominatim's usage policy caps automated use at ~1 request/second and asks
for a descriptive User-Agent, so this keeps a simple in-memory cache and a
process-wide throttle. That's enough for an MVP demo on a single backend
process; a real deployment would want a persistent cache table instead.
"""
import json
import threading
import time
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/geocode", tags=["geocode"])

# Known campus addresses skip the network call entirely.
KNOWN_ADDRESSES = {
    "110 Westwood Plaza, Los Angeles, CA 90095": (34.0716, -118.4437),  # UCLA Anderson
    "405 Hilgard Ave, Los Angeles, CA 90095": (34.0707, -118.4436),  # UCLA (main campus / Ackerman area)
}

_cache: dict[str, Optional[tuple[float, float]]] = {}
_lock = threading.Lock()
_last_call = 0.0
_MIN_INTERVAL = 1.1  # seconds, stays under Nominatim's 1 req/sec policy


class GeocodeOut(BaseModel):
    address: str
    lat: float
    lng: float


@router.get("", response_model=GeocodeOut)
def geocode(address: str = Query(min_length=2, max_length=500)):
    key = address.strip().lower()
    if key in _cache:
        cached = _cache[key]
        if cached is None:
            raise HTTPException(status_code=404, detail="Address not found")
        return GeocodeOut(address=address, lat=cached[0], lng=cached[1])

    if address.strip() in KNOWN_ADDRESSES:
        lat, lng = KNOWN_ADDRESSES[address.strip()]
        _cache[key] = (lat, lng)
        return GeocodeOut(address=address, lat=lat, lng=lng)

    result = _nominatim_lookup(address)
    _cache[key] = result
    if result is None:
        raise HTTPException(status_code=404, detail="Address not found")
    return GeocodeOut(address=address, lat=result[0], lng=result[1])


def _nominatim_lookup(address: str) -> Optional[tuple[float, float]]:
    global _last_call
    with _lock:
        wait = _MIN_INTERVAL - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()

        params = urllib.parse.urlencode({"q": address, "format": "json", "limit": 1})
        url = f"https://nominatim.openstreetmap.org/search?{params}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CarpoolCampus-MVP/0.1 (local dev demo; contact: dev@carpoolcampus.local)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read())
        except Exception:
            return None

    if not data:
        return None
    try:
        return float(data[0]["lat"]), float(data[0]["lon"])
    except (KeyError, ValueError, IndexError):
        return None
