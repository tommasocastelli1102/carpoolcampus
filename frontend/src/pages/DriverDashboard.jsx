import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ComingSoonModal from "../components/ComingSoonModal";
import CampusMap, { MapLegend } from "../components/CampusMap";
import MapModal from "../components/MapModal";
import { addressForUniversity } from "../lib/universities";

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
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [editRequest, setEditRequest] = useState(null);
  const [riders, setRiders] = useState([]);
  const [mapExpanded, setMapExpanded] = useState(false);

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

  const mapProps = {
    homeAddress: user.address,
    destinationAddress: addressForUniversity(user.university),
    others: riderPins,
    emptyHint: "Add your home address (see your profile) to see the map.",
  };

  return (
    <div className="container" style={{ paddingTop: 36 }}>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ fontSize: 30 }} aria-hidden>🚗</span>
          <h1 style={{ fontSize: 30 }}>Driver dashboard</h1>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddSlot(true)}>
          + Add availability
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>Incoming ride requests, soonest first.</p>

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

      {showAddSlot && <AddSlotModal onClose={() => setShowAddSlot(false)} onSaved={() => { setShowAddSlot(false); load(); }} />}
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

function AddSlotModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    day_of_week: "0",
    start_time: "08:00",
    end_time: "09:00",
    route_from: "",
    route_to: "",
    seats_available: 3,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await client.post("/availability", {
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        route_from: form.route_from,
        route_to: form.route_to,
        seats_available: Number(form.seats_available),
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save that slot."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 18 }}>Add availability</h3>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className="field-row">
            <div className="field">
              <label>From</label>
              <input required value={form.route_from} onChange={(e) => setForm((f) => ({ ...f, route_from: e.target.value }))} placeholder="Palms" />
            </div>
            <div className="field">
              <label>To</label>
              <input required value={form.route_to} onChange={(e) => setForm((f) => ({ ...f, route_to: e.target.value }))} placeholder="UCLA Anderson" />
            </div>
          </div>
          <div className="field">
            <label>Recurring day</label>
            <select value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value }))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Start time</label>
              <input type="time" required value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div className="field">
              <label>End time</label>
              <input type="time" required value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Seats available</label>
            <input type="number" min={1} max={8} value={form.seats_available} onChange={(e) => setForm((f) => ({ ...f, seats_available: e.target.value }))} />
          </div>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
              {submitting ? "Saving…" : "Save slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
