import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { geocodeAddress, geocodeMany } from "../api/geocode";
import { haversineMiles, formatMiles } from "../lib/geo";
import { useAuth } from "../context/AuthContext";
import { StarDisplay } from "../components/StarRating";
import CampusMap, { MapLegend } from "../components/CampusMap";
import MapModal from "../components/MapModal";
import RouteSearchBar from "../components/RouteSearchBar";
import AddAvailabilityForm from "../components/AddAvailabilityForm";
import ComingSoonModal from "../components/ComingSoonModal";
import { addressForUniversity } from "../lib/universities";
import { isCampusText, CAMPUS_SEARCH_TEXT } from "../lib/campus";
import { CarIcon } from "../components/Icons";
import { PAYMENT_LABELS } from "../lib/paymentMethods";
import { getSearchRadius, onSearchRadiusChange } from "../lib/searchRadius";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function requestSortKey(r) {
  if (r.custom_time) return new Date(r.custom_time).getTime();
  if (r.availability?.start_time) {
    // Approximate: sort by time-of-day only, since recurring slots aren't tied to one date.
    const [h, m] = r.availability.start_time.split(":");
    return Number(h) * 60 + Number(m);
  }
  return new Date(r.created_at).getTime();
}

/** Is this ride happening today? Custom-time rides compare calendar
 * dates directly; recurring availability slots only carry a day of the
 * week, so today's own weekday (converted from JS's Sun=0 to this app's
 * Mon=0 encoding) is compared instead. */
function isRideToday(ride) {
  if (ride.custom_time) {
    return new Date(ride.custom_time).toDateString() === new Date().toDateString();
  }
  if (ride.availability?.day_of_week != null) {
    const jsDay = new Date().getDay(); // 0=Sun..6=Sat
    const ourDay = (jsDay + 6) % 7; // 0=Mon..6=Sun
    return ride.availability.day_of_week === ourDay;
  }
  return false;
}

const TIME_OPTIONS = [
  { value: "", label: "Time" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

function timeBucket(startTime) {
  const hour = Number((startTime || "").slice(0, 2));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function slotLabel(slot) {
  const when = slot.date ? slot.date : slot.day_of_week != null ? `Every ${DAYS[slot.day_of_week]}` : "One-off";
  return `${when} · ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}

/** Minutes from `now` until this slot's next occurrence — a one-off date
 * compares directly, a recurring day/time rolls forward to the closest
 * upcoming weekday (today included, if its time hasn't passed yet). Used
 * to sort "Choose a ride" so the very next ride you could catch is the
 * one on top. `now` is passed in (rather than read fresh here) so every
 * slot in the same list is compared against the exact same instant —
 * otherwise same-time slots would "tie" by a few stray milliseconds and
 * the distance tiebreaker below would never actually apply. */
function minutesUntilNext(slot, now = new Date()) {
  const [h, m] = slot.start_time.split(":").map(Number);
  if (slot.date) {
    const target = new Date(`${slot.date}T00:00:00`);
    target.setHours(h, m, 0, 0);
    return (target - now) / 60000;
  }
  if (slot.day_of_week != null) {
    const jsDay = now.getDay(); // 0=Sun..6=Sat
    const ourDay = (jsDay + 6) % 7; // 0=Mon..6=Sun, matching day_of_week
    let dayDiff = slot.day_of_week - ourDay;
    if (dayDiff < 0) dayDiff += 7;
    const target = new Date(now);
    target.setDate(now.getDate() + dayDiff);
    target.setHours(h, m, 0, 0);
    if (dayDiff === 0 && target < now) target.setDate(target.getDate() + 7);
    return (target - now) / 60000;
  }
  return Infinity;
}

/** "in 40m", "in 3h", "in 2d" — how far off a slot's next occurrence is. */
function formatTimeUntil(minutes) {
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return `in ${Math.max(1, Math.round(minutes))}m`;
  if (minutes < 60 * 24) return `in ${Math.round(minutes / 60)}h`;
  return `in ${Math.round(minutes / (60 * 24))}d`;
}

const REVIEW_CATEGORIES = [
  { key: "stars_drive_safety", label: "Drive safety" },
  { key: "stars_clean_car", label: "Clean car" },
  { key: "stars_punctuality", label: "Punctuality" },
  { key: "stars_good_company", label: "Good company" },
];

/** Per-category averages across every review left for this driver, so
 * "click on a driver" shows the full breakdown, not just the overall
 * avg_rating. Categories nobody has rated yet are omitted. */
function categoryAverages(reviews) {
  return REVIEW_CATEGORIES.map(({ key, label }) => {
    const values = reviews.map((r) => r[key]).filter((v) => v != null);
    if (values.length === 0) return null;
    return { key, label, avg: values.reduce((a, b) => a + b, 0) / values.length, count: values.length };
  }).filter(Boolean);
}

/** Small round avatar. Always shows the car icon — uploaded photos aren't
 * displayed here (the profile_photo_url field and its upload still work
 * fine elsewhere, this just doesn't render it in ride listings). */
function PersonAvatar({ size = 40 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CarIcon size={Math.round(size * 0.6)} />
    </div>
  );
}


export default function RiderDashboard() {
  const { user, setUser } = useAuth();
  const hasCar = user.role !== "rider";
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // slot whose request modal is open
  const [selectedSlotId, setSelectedSlotId] = useState(null); // which ride is highlighted in the list, like tapping a ride in Uber
  const [myRides, setMyRides] = useState([]);
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState(CAMPUS_SEARCH_TEXT); // defaults to "headed to campus"
  const [drivers, setDrivers] = useState([]);
  const [bookedStops, setBookedStops] = useState([]); // addresses of other riders already confirmed on "my" driver's route
  const [mapExpanded, setMapExpanded] = useState(false);
  const [riderCoord, setRiderCoord] = useState(null); // geocoded from the profile address, the fallback origin
  const [originCoord, setOriginCoord] = useState(null); // geocoded from the typed starting point, when there is one
  const [driverCoords, setDriverCoords] = useState(new Map());
  const [enablingDriving, setEnablingDriving] = useState(false);
  const [searchRadius, setSearchRadiusState] = useState(getSearchRadius());

  // Driver-side state — only meaningful (and only fetched) once the
  // account has a car. Same page for everyone; this is just the part
  // that's conditional on that.
  const [driverRequests, setDriverRequests] = useState([]);
  const [driverSlots, setDriverSlots] = useState([]);
  const [driverLoading, setDriverLoading] = useState(true);
  const [editRequest, setEditRequest] = useState(null);
  const [showAddAvailability, setShowAddAvailability] = useState(false);
  const [showLaterModal, setShowLaterModal] = useState(false);

  const loadDriverData = async () => {
    setDriverLoading(true);
    try {
      const [{ data: allRides }, { data: mySlots }] = await Promise.all([
        client.get("/rides/my"),
        client.get("/availability", { params: { driver_id: user.id } }),
      ]);
      setDriverRequests(allRides.filter((r) => r.driver_id === user.id));
      setDriverSlots(mySlots);
    } finally {
      setDriverLoading(false);
    }
  };

  useEffect(() => {
    if (hasCar) loadDriverData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCar]);

  const pendingDriverRequests = [...driverRequests.filter((r) => r.status === "pending")].sort(
    (a, b) => requestSortKey(a) - requestSortKey(b)
  );
  const otherDriverRequests = driverRequests.filter((r) => r.status !== "pending");
  const acceptedDriverCount = driverRequests.filter((r) => r.status === "confirmed").length;

  const actOnRequest = async (id, status) => {
    await client.patch(`/rides/request/${id}`, { status });
    loadDriverData();
  };

  // Which way are you headed? Derived straight from the From/To text —
  // orients the map's home/destination pins and narrows the list below to
  // rides going that way. No separate "other destination" state: typing
  // anything else into From/To already covers it.
  const direction = isCampusText(toText) ? "to_campus" : isCampusText(fromText) ? "to_home" : "custom";

  // Day/Time filters — set via the "Later" picker, applied client-side.
  const [dayFilter, setDayFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const RESULTS_PAGE_SIZE = 5;
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE);

  const loadSlots = async (overrides = {}) => {
    setLoading(true);
    try {
      const from = overrides.from ?? fromText;
      const to = overrides.to ?? toText;
      const params = {};
      if (from) params.route_from = from;
      if (to) params.route_to = to;
      const { data } = await client.get("/rides/search", { params });
      setSlots(data);
    } finally {
      setLoading(false);
    }
  };

  const loadMyRides = async () => {
    const { data } = await client.get("/rides/my");
    setMyRides(data.filter((r) => r.rider_id === user.id));
  };

  const loadDrivers = async () => {
    const { data } = await client.get("/users", { params: { role: "driver" } });
    setDrivers(data);
  };

  useEffect(() => {
    // Load the full list on first render regardless of the "UCLA" default
    // shown in the To field — direction-based filtering (below) already
    // narrows what's visible without also narrowing what the map knows
    // about (e.g. which drivers currently have an open seat at all).
    loadSlots({ from: "", to: "" });
    loadMyRides();
    loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadSlots();
  };

  // Home/Campus fill whichever field was last focused (From or To) —
  // RouteSearchBar already updated that field's text; this just re-runs
  // the search with the new From/To together.
  const handleFieldFilled = (field, value, merged) => {
    loadSlots(merged);
  };

  // Riders who don't have a car on file yet get flipped to role "both"
  // on the fly — having a car isn't a permanent choice, so there's no
  // reason to make someone register separately to post a route. Either
  // way this just reveals the posting form in place — it stays hidden
  // until asked for, rather than always taking up space on the page.
  const handleAddAvailabilityClick = async () => {
    if (user.role === "rider") {
      setEnablingDriving(true);
      try {
        const { data } = await client.post("/auth/enable-driving", {});
        setUser(data);
      } catch {
        // Non-fatal — the form below still lets them try; worst case
        // posting a route fails and they see that error instead.
      } finally {
        setEnablingDriving(false);
      }
    }
    setShowAddAvailability((v) => !v);
  };

  // Geocode "my apartment" once, and every distinct driver address in the
  // current slot list, so we can show/sort by distance.
  useEffect(() => {
    if (!user.address) return;
    geocodeAddress(user.address).then(setRiderCoord);
  }, [user.address]);

  // Also geocode whatever's actually typed as the starting point, so
  // "Choose a ride" can search around that instead of always defaulting
  // to the home address — this is what the mile radius below is measured
  // from once it's set.
  useEffect(() => {
    const from = fromText.trim();
    if (!from) {
      setOriginCoord(null);
      return;
    }
    let cancelled = false;
    geocodeAddress(from).then((coord) => {
      if (!cancelled) setOriginCoord(coord);
    });
    return () => {
      cancelled = true;
    };
  }, [fromText]);

  // Pick up range changes made from the profile menu while this page is
  // already open.
  useEffect(() => onSearchRadiusChange(() => setSearchRadiusState(getSearchRadius())), []);

  useEffect(() => {
    const addresses = slots.map((s) => s.driver?.address).filter(Boolean);
    geocodeMany(addresses).then(setDriverCoords);
  }, [slots]);

  // Which driver (if any) does this rider currently have an active
  // relationship with? Used both for the "+min / distance" badge and to
  // draw that driver's already-booked stops on the route line.
  const activeRide = useMemo(
    () => myRides.find((r) => r.status === "confirmed" || r.status === "pending"),
    [myRides]
  );

  // A confirmed ride (as a passenger) happening today gets its own card
  // up top, before the requests/add-availability buttons.
  const todaysRide = useMemo(() => myRides.find((r) => r.status === "confirmed" && isRideToday(r)), [myRides]);

  useEffect(() => {
    if (!activeRide) {
      setBookedStops([]);
      return;
    }
    client
      .get(`/rides/driver/${activeRide.driver_id}/stops`, { params: { exclude_ride_request_id: activeRide.id } })
      .then(({ data }) => setBookedStops(data.map((s) => s.address).filter(Boolean)))
      .catch(() => setBookedStops([]));
  }, [activeRide]);

  // A driver "matches" if they currently have an open seat on any slot.
  const driverHasOpenSeat = useMemo(() => {
    const openByDriver = new Set();
    slots.forEach((s) => {
      if (s.seats_available > 0) openByDriver.add(s.driver_id);
    });
    return openByDriver;
  }, [slots]);

  // The map only ever shows drivers who currently have an open seat — per
  // spec, unavailable drivers don't get a car icon on the map at all.
  const driverPins = useMemo(
    () =>
      drivers
        .filter((d) => d.address && driverHasOpenSeat.has(d.id))
        .map((d) => {
          const myRequestToThisDriver = myRides.find((r) => r.driver_id === d.id);
          const driverSlots = slots.filter((s) => s.driver_id === d.id);
          return {
            id: d.id,
            address: d.address,
            kind: "driver",
            name: `${d.first_name} ${d.last_name}`,
            rating: d.driver_profile?.avg_rating,
            photoUrl: d.profile_photo_url,
            matching: true,
            availabilityText: driverSlots.length ? `Free ${driverSlots.map(slotLabel).join(", ")}` : null,
            badge: myRequestToThisDriver
              ? { kind: myRequestToThisDriver.pickup_type, meetOutsideDisplay: "distance" }
              : null,
          };
        }),
    [drivers, myRides, driverHasOpenSeat, slots]
  );

  // Clicking a driver's icon on the (expanded, interactive) map selects
  // that ride below, same as tapping its row — it doesn't jump straight
  // into the request flow.
  const handlePersonClick = (person) => {
    const slot = slots.find((s) => s.driver_id === person.id && s.seats_available > 0) || slots.find((s) => s.driver_id === person.id);
    if (slot) {
      setSelectedSlotId(slot.id);
      setMapExpanded(false);
    }
  };

  const campusAddress = addressForUniversity(user.university);
  // "custom" (free-typed text that isn't campus/home) falls back to the
  // campus orientation for the map — arbitrary route text isn't a safe
  // geocoding target, only real profile/campus addresses are.
  const orientedHomeAddress = direction === "to_home" ? campusAddress : user.address;
  const orientedDestinationAddress = direction === "to_home" ? user.address : campusAddress;

  const mapProps = {
    homeAddress: orientedHomeAddress,
    destinationAddress: orientedDestinationAddress,
    others: driverPins,
    routeStops: bookedStops,
    onPersonClick: handlePersonClick,
    emptyHint: "Add your home address (see your profile) to see the map.",
  };

  // The starting point you typed, if it geocoded — otherwise your profile
  // address is the fallback origin "Choose a ride" measures distance from.
  const origin = originCoord || riderCoord;

  const visibleSlots = useMemo(() => {
    let list = slots.map((s) => {
      const coord = s.driver?.address ? driverCoords.get(s.driver.address) : null;
      const distance = origin && coord ? haversineMiles(origin, coord) : null;
      return { ...s, _distance: distance };
    });

    // Which way are you headed? "To campus" keeps rides ending near
    // campus, "Going home" keeps rides starting from campus, otherwise
    // whatever's typed in From/To is matched directly.
    if (direction === "to_campus") list = list.filter((s) => isCampusText(s.route_to));
    else if (direction === "to_home") list = list.filter((s) => isCampusText(s.route_from));
    else {
      const fromNeedle = fromText.trim().toLowerCase();
      const toNeedle = toText.trim().toLowerCase();
      if (fromNeedle) list = list.filter((s) => s.route_from.toLowerCase().includes(fromNeedle));
      if (toNeedle) list = list.filter((s) => s.route_to.toLowerCase().includes(toNeedle));
    }

    if (dayFilter !== "") list = list.filter((s) => String(s.day_of_week) === dayFilter);
    if (timeFilter) list = list.filter((s) => timeBucket(s.start_time) === timeFilter);

    // Only rides within the configured range of the starting point —
    // slots whose distance couldn't be computed (address didn't geocode)
    // are kept rather than hidden, so a geocoding gap never silently
    // drops a real result.
    if (origin) list = list.filter((s) => s._distance == null || s._distance <= searchRadius);

    // Soonest next occurrence first — the top of "Choose a ride" is
    // always the next ride you could actually catch, not just the
    // closest one. Distance breaks ties.
    const now = new Date();
    list = list.map((s) => ({ ...s, _minutesUntil: minutesUntilNext(s, now) }));
    list.sort((a, b) => a._minutesUntil - b._minutesUntil || (a._distance ?? Infinity) - (b._distance ?? Infinity));
    return list;
  }, [slots, driverCoords, origin, direction, fromText, toText, dayFilter, timeFilter, searchRadius]);

  // The soonest ride that actually has an open seat — badged in the list
  // below, separately from just "first in the sorted list" (which could
  // be a soonest-but-full slot).
  const nextAvailableSlot = visibleSlots.find((s) => s.seats_available > 0);

  // Start back at the first page, and clear any selected ride, whenever
  // the filters/direction/range change the result set out from under it.
  useEffect(() => {
    setVisibleCount(RESULTS_PAGE_SIZE);
    setSelectedSlotId(null);
  }, [direction, fromText, toText, dayFilter, timeFilter, searchRadius]);

  return (
    <div className="container" style={{ paddingTop: 36 }}>
      {todaysRide && <TodaysRideCard ride={todaysRide} />}

      {hasCar && (
        <RequestsButton pendingCount={pendingDriverRequests.length} acceptedCount={acceptedDriverCount} />
      )}

      <button
        className="btn btn-primary btn-block"
        onClick={handleAddAvailabilityClick}
        disabled={enablingDriving}
        style={{ marginBottom: 20 }}
      >
        {enablingDriving ? "One sec…" : showAddAvailability ? "✕ Close" : "+ Add availability"}
      </button>

      {showAddAvailability && (
        <AddAvailabilityForm user={user} onSaved={() => { setShowAddAvailability(false); loadDriverData(); }} />
      )}

      <h2 style={{ fontSize: 20, marginTop: 8, marginBottom: 14 }}>Find a ride</h2>

      <RouteSearchBar
        from={fromText}
        to={toText}
        onFromChange={setFromText}
        onToChange={setToText}
        homeValue={user.address || "Home"}
        onFilled={handleFieldFilled}
        onLater={() => setShowLaterModal(true)}
        onSubmit={handleSearch}
        submitLabel="Search"
      />

      <CampusMap {...mapProps} variant="compact" onExpandRequest={() => setMapExpanded(true)} />
      <MapLegend />

      <div className="card" style={{ marginTop: 28, marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>Choose a ride</h2>

        {loading ? (
          <div className="spinner" />
        ) : visibleSlots.length === 0 ? (
          <p className="muted">
            {origin
              ? `No driver routes within ${searchRadius} mi of your starting point — try a wider range (profile menu) or a different starting point.`
              : "No driver routes match yet — try clearing some filters."}
          </p>
        ) : (
          <div className="stack">
            {visibleSlots.slice(0, visibleCount).map((slot) => (
              <RideOptionRow
                key={slot.id}
                slot={slot}
                isNext={slot.id === nextAvailableSlot?.id}
                active={selectedSlotId === slot.id}
                onClick={() => setSelectedSlotId(slot.id)}
              />
            ))}
            {visibleCount < visibleSlots.length && (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => setVisibleCount((c) => c + RESULTS_PAGE_SIZE)}
              >
                Load more ({visibleSlots.length - visibleCount} more)
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!selectedSlotId}
              onClick={() => setSelected(visibleSlots.find((s) => s.id === selectedSlotId))}
              style={{ marginTop: 4 }}
            >
              {selectedSlotId ? "Request ride" : "Select a ride"}
            </button>
          </div>
        )}
      </div>

      {hasCar && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 id="incoming-requests" style={{ fontSize: 20, marginBottom: 14 }}>Incoming requests</h2>
            {driverLoading ? (
              <div className="spinner" />
            ) : pendingDriverRequests.length === 0 ? (
              <p className="muted">No pending requests right now.</p>
            ) : (
              <div className="stack">
                {pendingDriverRequests.map((r) => (
                  <div key={r.id} className="card-flat row-between">
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {r.rider?.first_name} {r.rider?.last_name}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {r.custom_time
                          ? new Date(r.custom_time).toLocaleString()
                          : r.availability
                          ? `${r.availability.start_time.slice(0, 5)}–${r.availability.end_time.slice(0, 5)}`
                          : "Time TBD"}
                        {" · "}
                        {r.pickup_type === "pickup" ? "Pickup" : "Meet outside their place"}
                        {r.custom_place ? ` at ${r.custom_place}` : r.availability ? ` near ${r.availability.route_from}` : ""}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditRequest(r)}>
                        Request Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => actOnRequest(r.id, "declined")}>
                        Decline
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={() => actOnRequest(r.id, "confirmed")}>
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {otherDriverRequests.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, marginTop: 24, marginBottom: 12 }}>Other requests</h3>
                <div className="stack">
                  {otherDriverRequests.map((r) => (
                    <div key={r.id} className="card-flat row-between">
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          {r.rider?.first_name} {r.rider?.last_name}
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {r.availability ? `${r.availability.route_from} → ${r.availability.route_to}` : r.custom_place}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 10 }}>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                        {r.status === "confirmed" && (
                          <>
                            <Link to={`/chat/${r.id}`}>
                              <button className="btn btn-sm btn-primary">Chat</button>
                            </Link>
                            <button className="btn btn-sm btn-ghost" onClick={() => actOnRequest(r.id, "completed")}>
                              Mark completed
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {editRequest && (
              <ComingSoonModal
                title="Request Edit"
                message="Suggesting a different time/place is available soon."
                onClose={() => setEditRequest(null)}
              />
            )}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>My availability</h2>
            {driverSlots.length === 0 ? (
              <p className="muted">You haven't posted any availability yet.</p>
            ) : (
              <div className="stack">
                {driverSlots.map((s) => (
                  <div key={s.id} className="card-flat">
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.route_from} → {s.route_to}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {s.date ? s.date : s.day_of_week != null ? `${DAYS_FULL[s.day_of_week]}s` : "One-off"} ·{" "}
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.seats_available} seat(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 28, marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14 }}>My last rides</h2>
        {myRides.length === 0 ? (
          <p className="muted">You haven't requested any rides yet.</p>
        ) : (
          <div className="stack">
            {myRides.map((r) => (
              <MyRideRow key={r.id} ride={r} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <RouteDetailModal
          slot={selected}
          onClose={() => setSelected(null)}
          onRequested={() => {
            setSelected(null);
            loadMyRides();
          }}
        />
      )}

      {mapExpanded && <MapModal {...mapProps} onClose={() => setMapExpanded(false)} />}

      {showLaterModal && (
        <div className="modal-backdrop" onClick={() => setShowLaterModal(false)}>
          <div className="modal" style={{ maxWidth: 380, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 18 }}>Pick a day &amp; time</h3>
            <div className="field">
              <label>Day</label>
              <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
                <option value="">Any day</option>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Time</label>
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                <option value="">Any time</option>
                {TIME_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => {
                  setDayFilter("");
                  setTimeFilter("");
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setShowLaterModal(false)}
              >
                Show rides
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** One selectable row in "Choose a ride" — tapping it highlights it
 * (Uber-style), it doesn't jump straight into the request flow. That
 * happens when the "Request ride" button below the list is pressed.
 * The list is sorted soonest-first, and `isNext` badges whichever row
 * is the next ride you could actually catch (i.e. still has a seat). */
function RideOptionRow({ slot, isNext, active, onClick }) {
  const timeUntil = formatTimeUntil(slot._minutesUntil);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-flat"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        border: active ? "2px solid var(--text)" : isNext ? "1px solid var(--primary)" : "1px solid var(--border)",
      }}
    >
      <div className="row" style={{ gap: 12, alignItems: "flex-start", minWidth: 0 }}>
        <PersonAvatar />
        <div style={{ minWidth: 0 }}>
          {isNext && (
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary-hover)", marginBottom: 3 }}>
              🕐 Next available
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <span
              title={slot.seats_available > 0 ? "Available at this time" : "No open seats"}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: slot.seats_available > 0 ? "#3FA66A" : "#5B6479",
                flexShrink: 0,
              }}
            />
            <div style={{ fontWeight: 700 }}>
              {slot.driver?.first_name} {slot.driver?.last_name}
            </div>
            <StarDisplay value={slot.driver?.driver_profile?.avg_rating} size={13} />
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {slot.route_from} → {slot.route_to}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {slotLabel(slot)}
            {timeUntil ? ` · ${timeUntil}` : ""}
            {slot._distance != null ? ` · ${formatMiles(slot._distance)} away` : ""}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>$4+</div>
        <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {slot.seats_available} seat{slot.seats_available === 1 ? "" : "s"}
        </div>
      </div>
    </button>
  );
}

/** Full-width button, same shape as "+ Add availability" right below
 * it — jumps to the incoming-requests list, with pending/accepted counts
 * as colored tags so the numbers are visible without opening it. */
function RequestsButton({ pendingCount, acceptedCount }) {
  return (
    <a
      href="#incoming-requests"
      className="btn btn-primary btn-block"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        textDecoration: "none",
        marginBottom: 10,
      }}
    >
      <span>Requests</span>
      <span className="row" style={{ gap: 8 }}>
        <CountTag count={pendingCount} label="pending" bg="var(--warning)" color="#1a1206" />
        {/* Green here (and only here, plus the map's match dot) is a
            deliberate, narrow exception to "no green anywhere" — it's the
            one place a plain accept/reject color pairing is clearer than
            the app's usual blue. */}
        <CountTag count={acceptedCount} label="accepted" bg="#3FA66A" color="#08150d" />
      </span>
    </a>
  );
}

function CountTag({ count, label, bg, color }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: bg,
        color,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {count} {label}
    </span>
  );
}

/** Dedicated card for a confirmed ride happening today (as a passenger)
 * — shown before the requests/add-availability buttons so it's the
 * first thing noticed, with just the basics: who, when, and how to
 * reach them. */
function TodaysRideCard({ ride }) {
  return (
    <div className="card" style={{ marginBottom: 16, border: "1px solid var(--primary)" }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Today's ride
      </div>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {ride.driver?.first_name} {ride.driver?.last_name}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {ride.custom_time
              ? new Date(ride.custom_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
              : ride.availability
              ? `${ride.availability.start_time.slice(0, 5)}–${ride.availability.end_time.slice(0, 5)}`
              : "Time TBD"}
            {" · "}
            {ride.pickup_type === "pickup" ? "Pickup" : "Meet outside their place"}
            {ride.custom_place ? ` at ${ride.custom_place}` : ""}
          </div>
        </div>
        <Link to={`/chat/${ride.id}`}>
          <button className="btn btn-sm btn-primary">Chat</button>
        </Link>
      </div>
    </div>
  );
}


function MyRideRow({ ride }) {
  const badgeClass = `badge badge-${ride.status}`;
  return (
    <div className="card-flat row-between">
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          {ride.driver?.first_name} {ride.driver?.last_name}
          {ride.availability ? ` · ${ride.availability.route_from} → ${ride.availability.route_to}` : ""}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {ride.pickup_type === "pickup" ? "Pickup" : "Meet outside your place"}
          {ride.custom_place ? ` · ${ride.custom_place}` : ""}
        </div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <span className={badgeClass}>{ride.status}</span>
        {ride.status === "confirmed" && (
          <Link to={`/chat/${ride.id}`}>
            <button className="btn btn-sm btn-primary">Chat</button>
          </Link>
        )}
        {ride.status === "completed" && (
          <Link to={`/review/${ride.id}`}>
            <button className="btn btn-sm btn-ghost">Leave review</button>
          </Link>
        )}
      </div>
    </div>
  );
}

function RouteDetailModal({ slot, onClose, onRequested }) {
  const driver = slot.driver;
  const profile = driver?.driver_profile;
  const [reviews, setReviews] = useState([]);
  const [pickupType, setPickupType] = useState("pickup");
  const [useCustom, setUseCustom] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [customPlace, setCustomPlace] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(profile?.payment_methods?.[0] || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const categoryBreakdown = useMemo(() => categoryAverages(reviews), [reviews]);

  useEffect(() => {
    if (driver) {
      client.get(`/users/${driver.id}/reviews`).then(({ data }) => setReviews(data));
    }
  }, [driver]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await client.post("/rides/request", {
        driver_id: driver.id,
        availability_id: useCustom ? null : slot.id,
        pickup_type: pickupType,
        custom_time: useCustom && customTime ? new Date(customTime).toISOString() : null,
        custom_place: useCustom ? customPlace : null,
        suggested_payment_amount: 4,
        payment_method_chosen: paymentMethod || null,
      });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send that request."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <h3 style={{ marginBottom: 8 }}>Request sent</h3>
            <p className="muted" style={{ marginBottom: 22 }}>
              Your request is <strong>pending</strong> — {driver.first_name} will accept or decline it soon.
            </p>
            <button className="btn btn-primary btn-block" onClick={onRequested}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: 12, marginBottom: 2 }}>
              <PersonAvatar size={48} />
              <h3>{driver.first_name} {driver.last_name}</h3>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <StarDisplay value={profile?.avg_rating} />
              <span className="muted" style={{ fontSize: 13 }}>{profile?.avg_rating ?? "No"} rating</span>
            </div>

            <div className="card-flat stack" style={{ gap: 6, marginBottom: 14 }}>
              {categoryBreakdown.length > 0 ? (
                categoryBreakdown.map((c) => (
                  <div key={c.key} className="row-between">
                    <span className="muted" style={{ fontSize: 13 }}>{c.label}</span>
                    <div className="row" style={{ gap: 6 }}>
                      <StarDisplay value={c.avg} size={13} />
                      <span className="muted" style={{ fontSize: 12 }}>{c.avg.toFixed(1)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>No ratings yet — be the first to review {driver.first_name} after your ride.</span>
              )}
            </div>

            {profile?.bio && <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{profile.bio}</p>}

            <div className="card-flat" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{slot.route_from} → {slot.route_to}</div>
              <div className="muted" style={{ fontSize: 13 }}>{slotLabel(slot)}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                Suggested payment: <strong style={{ color: "var(--text)" }}>$4+</strong>
                {profile?.payment_methods?.length ? ` · Accepts ${profile.payment_methods.map((m) => PAYMENT_LABELS[m] || m).join(", ")}` : ""}
                {profile?.payment_method_other ? ` · ${profile.payment_method_other}` : ""}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Recent reviews
              </div>
              {reviews.length > 0 ? (
                reviews.slice(0, 2).map((r) => (
                  <div key={r.id} className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                    "{r.free_text_feedback || "Great ride."}" — {r.reviewer?.first_name}
                  </div>
                ))
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>No written reviews yet.</span>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              {error && <p className="error-text">{error}</p>}
              <div className="field">
                <label>Pickup preference</label>
                <div className="row" style={{ gap: 8 }}>
                  <RadioPill active={pickupType === "pickup"} onClick={() => setPickupType("pickup")}>
                    Pickup at my door
                  </RadioPill>
                  <RadioPill active={pickupType === "meet_outside"} onClick={() => setPickupType("meet_outside")}>
                    Meet outside your place
                  </RadioPill>
                </div>
              </div>

              <label className="row" style={{ fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
                Request a custom time/place instead of this slot
              </label>

              {useCustom && (
                <div className="field-row">
                  <div className="field">
                    <label>Custom time</label>
                    <input type="datetime-local" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Custom place</label>
                    <input value={customPlace} onChange={(e) => setCustomPlace(e.target.value)} placeholder="e.g. Ackerman Union" />
                  </div>
                </div>
              )}

              {profile?.payment_methods?.length > 0 && (
                <div className="field">
                  <label>Payment method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {profile.payment_methods.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_LABELS[m] || m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="row" style={{ gap: 10, marginTop: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? "Sending…" : "Request ride"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function RadioPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-sm"
      style={{
        flex: 1,
        background: active ? "rgba(45,108,246,0.16)" : "transparent",
        color: active ? "var(--primary-hover)" : "var(--text-muted)",
        border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}
