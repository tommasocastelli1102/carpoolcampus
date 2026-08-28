import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ComingSoonModal from "../components/ComingSoonModal";
import CampusMap, { MapLegend } from "../components/CampusMap";
import MapModal from "../components/MapModal";
import RouteSearchBar from "../components/RouteSearchBar";
import { addressForUniversity } from "../lib/universities";
import { isCampusText, CAMPUS_SEARCH_TEXT } from "../lib/campus";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function requestSortKey(r) {
  if (r.custom_time) return new Date(r.custom_time).getTime();
  if (r.availability?.start_time) {
    // Approximate: sort by time-of-day only, since recurring slots aren't tied to one date.
    const [h, m] = r.availability.start_time.split(":");
    return Number(h) * 60 + Number(m);
  }
  return new Date(r.created_at).getTime();
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRequest, setEditRequest] = useState(null);
  const [riders, setRiders] = useState([]);
  const [mapExpanded, setMapExpanded] = useState(false);

  // The route being posted — same From/To + Campus/Home shortcut bar the
  // rider dashboard searches with; here it describes the route you're
  // offering instead of one you're looking for.
  const [fromText, setFromText] = useState(user.address || "");
  const [toText, setToText] = useState(CAMPUS_SEARCH_TEXT);
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [seats, setSeats] = useState(3);
  const [postError, setPostError] = useState("");
  const [posting, setPosting] = useState(false);

  const direction = isCampusText(toText) ? "to_campus" : isCampusText(fromText) ? "to_home" : "custom";

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: allRides }, { data: mySlots }, { data: allRiders }] = await Promise.all([
        client.get("/rides/my"),
        client.get("/availability", { params: { driver_id: user.id } }),
        client.get("/users", { params: { role: "rider" } }),
      ]);
      setRequests(allRides.filter((r) => r.driver_id === user.id));
      setSlots(mySlots);
      setRiders(allRiders);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = [...requests.filter((r) => r.status === "pending")].sort(
    (a, b) => requestSortKey(a) - requestSortKey(b)
  );
  const others = requests.filter((r) => r.status !== "pending");

  const act = async (id, status) => {
    await client.patch(`/rides/request/${id}`, { status });
    load();
  };

  const handlePostRoute = async (e) => {
    e.preventDefault();
    if (!fromText.trim() || !toText.trim()) {
      setPostError("Add both a from and to location.");
      return;
    }
    setPostError("");
    setPosting(true);
    try {
      await client.post("/availability", {
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        route_from: fromText.trim(),
        route_to: toText.trim(),
        seats_available: Number(seats),
      });
      setFromText("");
      setToText("");
      load();
    } catch (err) {
      setPostError(apiErrorMessage(err, "Couldn't save that route."));
    } finally {
      setPosting(false);
    }
  };

  const handleCampusClick = () => {
    setFromText(user.address || "Home");
    setToText(CAMPUS_SEARCH_TEXT);
  };

  const handleHomeClick = () => {
    setFromText(CAMPUS_SEARCH_TEXT);
    setToText(user.address || "Home");
  };

  // A rider "matches" this driver once they have any non-declined request
  // relationship — riders never see each other, and drivers don't see
  // rider names on the map, just where they'd need to go.
  const riderPins = useMemo(
    () =>
      riders
        .filter((r) => r.address)
        .map((r) => {
          const existingRequest = requests.find((req) => req.rider_id === r.id && req.status !== "declined");
          return {
            id: r.id,
            address: r.address,
            kind: "rider",
            matching: Boolean(existingRequest),
            badge: existingRequest ? { kind: existingRequest.pickup_type } : null,
          };
        }),
    [riders, requests]
  );

  const campusAddress = addressForUniversity(user.university);
  const orientedHomeAddress = direction === "to_home" ? campusAddress : user.address;
  const orientedDestinationAddress = direction === "to_home" ? user.address : campusAddress;

  const mapProps = {
    homeAddress: orientedHomeAddress,
    destinationAddress: orientedDestinationAddress,
    others: riderPins,
    emptyHint: "Add your home address (see your profile) to see the map.",
  };

  return (
    <div className="container" style={{ paddingTop: 36 }}>
      <div className="row" style={{ gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 30 }} aria-hidden>🚗</span>
        <h1 style={{ fontSize: 30 }}>Driver dashboard</h1>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>Post the route you're driving, then manage requests below.</p>

      <RouteSearchBar
        from={fromText}
        to={toText}
        onFromChange={setFromText}
        onToChange={setToText}
        onCampus={handleCampusClick}
        onHome={handleHomeClick}
        onSubmit={handlePostRoute}
        submitLabel={posting ? "Posting…" : "Post route"}
      >
        <div className="field-row" style={{ flexBasis: "100%", marginTop: 10, marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Day</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Seats</label>
            <input type="number" min={1} max={8} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </div>
        </div>
        {postError && <p className="error-text" style={{ flexBasis: "100%", marginTop: 8, marginBottom: 0 }}>{postError}</p>}
      </RouteSearchBar>

      <CampusMap {...mapProps} variant="compact" onExpandRequest={() => setMapExpanded(true)} />
      <MapLegend />

      <h2 style={{ fontSize: 22, marginTop: 32, marginBottom: 16 }}>Incoming requests</h2>
      {loading ? (
        <div className="spinner" />
      ) : pending.length === 0 ? (
        <p className="muted">No pending requests right now.</p>
      ) : (
        <div className="stack">
          {pending.map((r) => (
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
                <button className="btn btn-sm btn-danger" onClick={() => act(r.id, "declined")}>
                  Decline
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => act(r.id, "confirmed")}>
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <>
          <h2 style={{ fontSize: 22, marginTop: 44, marginBottom: 16 }}>Other requests</h2>
          <div className="stack">
            {others.map((r) => (
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
                      <button className="btn btn-sm btn-ghost" onClick={() => act(r.id, "completed")}>
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

      <h2 style={{ fontSize: 22, marginTop: 44, marginBottom: 16 }}>My availability</h2>
      {slots.length === 0 ? (
        <p className="muted">You haven't posted any availability yet.</p>
      ) : (
        <div className="stack">
          {slots.map((s) => (
            <div key={s.id} className="card-flat">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.route_from} → {s.route_to}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {s.date ? s.date : s.day_of_week != null ? `${DAYS[s.day_of_week]}s` : "One-off"} ·{" "}
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

      {mapExpanded && <MapModal {...mapProps} onClose={() => setMapExpanded(false)} />}
    </div>
  );
}
