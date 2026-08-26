import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { StarDisplay } from "../components/StarRating";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAYMENT_LABELS = {
  venmo: "Venmo",
  cash: "Cash",
  beer: "Beer",
  aux_cord: "Aux cord",
  coffee: "Coffee",
  other: "Other",
};

function slotLabel(slot) {
  const when = slot.date ? slot.date : slot.day_of_week != null ? `Every ${DAYS[slot.day_of_week]}` : "One-off";
  return `${when} · ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}

export default function RiderDashboard() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [myRides, setMyRides] = useState([]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadSlots = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterFrom) params.route_from = filterFrom;
      if (filterTo) params.route_to = filterTo;
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

  useEffect(() => {
    loadSlots();
    loadMyRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadSlots();
  };

  return (
    <div className="container" style={{ paddingTop: 36 }}>
      <div className="row" style={{ gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 30 }} aria-hidden>🎒</span>
        <h1 style={{ fontSize: 30 }}>Rider dashboard</h1>
      </div>
      <p className="muted" style={{ marginBottom: 26 }}>Browse driver routes and time slots headed your way.</p>

      <form onSubmit={handleSearch} className="row" style={{ marginBottom: 28, gap: 10 }}>
        <input placeholder="From…" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        <input placeholder="To…" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        <button className="btn btn-primary" style={{ flexShrink: 0 }}>Search</button>
      </form>

      {loading ? (
        <div className="spinner" />
      ) : slots.length === 0 ? (
        <p className="muted">No driver routes match yet — try clearing your filters.</p>
      ) : (
        <div className="stack">
          {slots.map((slot) => (
            <div key={slot.id} className="card-flat row-between">
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {slot.route_from} → {slot.route_to}
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{slotLabel(slot)}</div>
                <div className="row" style={{ gap: 8 }}>
                  <StarDisplay value={slot.driver?.driver_profile?.avg_rating} />
                  <span className="muted" style={{ fontSize: 13 }}>
                    {slot.driver?.first_name} {slot.driver?.last_name} · {slot.seats_available} seat(s) left
                  </span>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setSelected(slot)}>
                View &amp; Request
              </button>
            </div>
          ))}
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
          {ride.pickup_type === "pickup" ? "Pickup" : "Meet outside"}
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
            <h3 style={{ marginBottom: 2 }}>{driver.first_name} {driver.last_name}</h3>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <StarDisplay value={profile?.avg_rating} />
              <span className="muted" style={{ fontSize: 13 }}>{profile?.avg_rating ?? "No"} rating</span>
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

            {reviews.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Recent reviews
                </div>
                {reviews.slice(0, 2).map((r) => (
                  <div key={r.id} className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                    "{r.free_text_feedback || "Great ride."}" — {r.reviewer?.first_name}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {error && <p className="error-text">{error}</p>}
              <div className="field">
                <label>Pickup preference</label>
                <div className="row" style={{ gap: 8 }}>
                  <RadioPill active={pickupType === "pickup"} onClick={() => setPickupType("pickup")}>
                    Pickup at my door
                  </RadioPill>
                  <RadioPill active={pickupType === "meet_outside"} onClick={() => setPickupType("meet_outside")}>
                    Meet outside
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
