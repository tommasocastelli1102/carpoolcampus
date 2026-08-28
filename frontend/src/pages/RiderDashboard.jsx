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

const DISTANCE_OPTIONS = [
  { value: "", label: "Distance" },
  { value: "1", label: "1 mi" },
  { value: "3", label: "3 mi" },
  { value: "5", label: "5 mi" },
  { value: "10", label: "10 mi" },
];
const SEX_OPTIONS = ["Sex", "Female", "Male", "Non-binary"];
const SEATS_OPTIONS = [
  { value: "", label: "Seats" },
  { value: "1", label: "1+ seat" },
  { value: "2", label: "2+ seats" },
  { value: "3", label: "3+ seats" },
];
const TIME_OPTIONS = [
  { value: "", label: "Time" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];
const SORT_OPTIONS = [
  { value: "distance", label: "Distance from me" },
  { value: "rating", label: "Driver rating" },
  { value: "seats", label: "Seats available" },
  { value: "newest", label: "Newest listed" },
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

/** Small round avatar: the driver/rider's uploaded photo, or the car icon as a fallback. */
function PersonAvatar({ photoUrl, size = 40 }) {
  const [failed, setFailed] = useState(false);
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
      {photoUrl && !failed ? (
        <img
          src={photoUrl}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <CarIcon size={Math.round(size * 0.6)} />
      )}
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
  const [riderCoord, setRiderCoord] = useState(null);
  const [driverCoords, setDriverCoords] = useState(new Map());
  const [enablingDriving, setEnablingDriving] = useState(false);

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
  const nextRide = [...driverRequests.filter((r) => r.status === "confirmed")].sort(
    (a, b) => requestSortKey(a) - requestSortKey(b)
  )[0];

  const actOnRequest = async (id, status) => {
    await client.patch(`/rides/request/${id}`, { status });
    loadDriverData();
  };

  // Which way are you headed? Derived straight from the From/To text —
  // orients the map's home/destination pins and narrows the list below to
  // rides going that way. No separate "other destination" state: typing
  // anything else into From/To already covers it.
  const direction = isCampusText(toText) ? "to_campus" : isCampusText(fromText) ? "to_home" : "custom";

  // Filters — applied client-side over the fetched slots.
  const [maxDistance, setMaxDistance] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [sexFilter, setSexFilter] = useState("");
  const [minSeats, setMinSeats] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sortBy, setSortBy] = useState("distance");
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

  const visibleSlots = useMemo(() => {
    let list = slots.map((s) => {
      const coord = s.driver?.address ? driverCoords.get(s.driver.address) : null;
      const distance = riderCoord && coord ? haversineMiles(riderCoord, coord) : null;
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
    if (sexFilter) list = list.filter((s) => s.driver?.sex === sexFilter);
    if (minSeats) list = list.filter((s) => s.seats_available >= Number(minSeats));
    if (paymentFilter) list = list.filter((s) => s.driver?.driver_profile?.payment_methods?.includes(paymentFilter));
    if (maxDistance) list = list.filter((s) => s._distance != null && s._distance <= Number(maxDistance));

    list.sort((a, b) => {
      if (sortBy === "distance") return (a._distance ?? Infinity) - (b._distance ?? Infinity);
      if (sortBy === "rating") return (b.driver?.driver_profile?.avg_rating ?? 0) - (a.driver?.driver_profile?.avg_rating ?? 0);
      if (sortBy === "seats") return b.seats_available - a.seats_available;
      return b.id - a.id; // newest listed
    });
    return list;
  }, [slots, driverCoords, riderCoord, direction, fromText, toText, dayFilter, timeFilter, sexFilter, minSeats, paymentFilter, maxDistance, sortBy]);

  // Start back at the first page, and clear any selected ride, whenever
  // the filters/direction/sort change the result set out from under it.
  useEffect(() => {
    setVisibleCount(RESULTS_PAGE_SIZE);
    setSelectedSlotId(null);
  }, [direction, fromText, toText, dayFilter, timeFilter, sexFilter, minSeats, paymentFilter, maxDistance, sortBy]);

  return (
    <div className="container" style={{ paddingTop: 36 }}>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={handleAddAvailabilityClick} disabled={enablingDriving}>
          {enablingDriving ? "One sec…" : showAddAvailability ? "✕ Close" : "+ Add availability"}
        </button>
      </div>

      {hasCar && <RequestsSummaryCard pending={pendingDriverRequests} nextRide={nextRide} />}

      {showAddAvailability && (
        <AddAvailabilityForm user={user} onSaved={() => { setShowAddAvailability(false); loadDriverData(); }} />
      )}

      {hasCar && (
        <>
          <h2 id="incoming-requests" style={{ fontSize: 20, marginTop: 8, marginBottom: 14 }}>Incoming requests</h2>
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
              <h2 style={{ fontSize: 20, marginTop: 28, marginBottom: 14 }}>Other requests</h2>
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

          <h2 style={{ fontSize: 20, marginTop: 28, marginBottom: 14 }}>My availability</h2>
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

          {editRequest && (
            <ComingSoonModal
              title="Request Edit"
              message="Suggesting a different time/place is available soon."
              onClose={() => setEditRequest(null)}
            />
          )}
        </>
      )}

      <h2 style={{ fontSize: 20, marginTop: hasCar ? 40 : 8, marginBottom: 14 }}>Find a ride</h2>

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

      <h2 style={{ fontSize: 20, marginTop: 28, marginBottom: 14 }}>Choose a ride</h2>

      <div id="ride-filters" className="card-flat" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "nowrap", gap: 6 }}>
          <FilterSelect label="Distance" value={maxDistance} onChange={setMaxDistance} options={DISTANCE_OPTIONS} />
          <FilterSelect
            label="Day"
            value={dayFilter}
            onChange={setDayFilter}
            options={[{ value: "", label: "Day" }, ...DAYS.map((d, i) => ({ value: String(i), label: d }))]}
          />
          <FilterSelect label="Time" value={timeFilter} onChange={setTimeFilter} options={TIME_OPTIONS} />
          <FilterSelect
            label="Sex"
            value={sexFilter}
            onChange={setSexFilter}
            options={SEX_OPTIONS.map((s) => (s === "Sex" ? { value: "", label: s } : { value: s, label: s }))}
          />
          <FilterSelect label="Seats" value={minSeats} onChange={setMinSeats} options={SEATS_OPTIONS} />
          <FilterSelect
            label="Payment"
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[{ value: "", label: "Payment" }, ...Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label }))]}
          />
          <FilterSelect label="Sort by" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : visibleSlots.length === 0 ? (
        <p className="muted">No driver routes match yet — try clearing some filters.</p>
      ) : (
        <div className="stack">
          {visibleSlots.slice(0, visibleCount).map((slot) => (
            <RideOptionRow
              key={slot.id}
              slot={slot}
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

      <h2 style={{ fontSize: 22, marginTop: 48, marginBottom: 16 }}>My requests</h2>
      {myRides.length === 0 ? (
        <p className="muted">You haven't requested any rides yet.</p>
      ) : (
        <div className="stack">
          {myRides.map((r) => (
            <MyRideRow key={r.id} ride={r} />
          ))}
        </div>
      )}

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
 * happens when the "Request ride" button below the list is pressed. */
function RideOptionRow({ slot, active, onClick }) {
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
        border: active ? "2px solid var(--text)" : "1px solid var(--border)",
      }}
    >
      <div className="row" style={{ gap: 12, alignItems: "flex-start", minWidth: 0 }}>
        <PersonAvatar photoUrl={slot.driver?.profile_photo_url} />
        <div style={{ minWidth: 0 }}>
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

/** The first card for anyone with a car: how many requests are waiting
 * on them, and what/who their next confirmed ride actually is — before
 * the route-posting form and the full request list. */
function RequestsSummaryCard({ pending, nextRide }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div>
          <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Requests
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {pending.length} pending {pending.length === 1 ? "request" : "requests"}
          </div>
        </div>
        {pending.length > 0 && (
          <a href="#incoming-requests" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
            Review
          </a>
        )}
      </div>

      <div className="card-flat">
        <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Next ride booked
        </div>
        {nextRide ? (
          <>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {nextRide.rider?.first_name} {nextRide.rider?.last_name}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {nextRide.custom_time
                ? new Date(nextRide.custom_time).toLocaleString()
                : nextRide.availability
                ? `${DAYS_FULL[nextRide.availability.day_of_week]}s · ${nextRide.availability.start_time.slice(0, 5)}–${nextRide.availability.end_time.slice(0, 5)}`
                : "Time TBD"}
              {" · "}
              {nextRide.pickup_type === "pickup" ? "Pickup" : "Meet outside their place"}
              {nextRide.custom_place
                ? ` at ${nextRide.custom_place}`
                : nextRide.availability
                ? ` near ${nextRide.availability.route_from}`
                : ""}
            </div>
          </>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>No rides booked yet.</span>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0 }}>
      <label style={{ fontSize: 10, marginBottom: 3 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", fontSize: 12, padding: "9px 8px" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
              <PersonAvatar photoUrl={driver.profile_photo_url} size={48} />
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
