import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { StarInput } from "../components/StarRating";

const PAYMENT_LABELS = {
  venmo: "Venmo",
  cash: "Cash",
  beer: "Beer",
  aux_cord: "Aux cord",
  coffee: "Coffee",
  other: "Other",
};

export default function ReviewPage() {
  const { rideRequestId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [stars, setStars] = useState({ drive_safety: 0, clean_car: 0, punctuality: 0, good_company: 0 });
  const [feedback, setFeedback] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [paid, setPaid] = useState("yes");
  const [paidMethod, setPaidMethod] = useState("venmo");

  useEffect(() => {
    client
      .get("/rides/my")
      .then(({ data }) => {
        const current = data.find((r) => String(r.id) === String(rideRequestId));
        setRide(current || null);
      })
      .finally(() => setLoading(false));
  }, [rideRequestId]);

  const otherParty = useMemo(() => {
    if (!ride || !user) return null;
    return ride.rider_id === user.id ? ride.driver : ride.rider;
  }, [ride, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await client.post("/reviews", {
        ride_request_id: Number(rideRequestId),
        reviewee_id: otherParty.id,
        stars_drive_safety: stars.drive_safety || null,
        stars_clean_car: stars.clean_car || null,
        stars_punctuality: stars.punctuality || null,
        stars_good_company: stars.good_company || null,
        free_text_feedback: feedback || null,
        // MVP stub: we don't actually upload/transcribe audio, just note a file was attached.
        audio_url: audioFile ? `local-upload:${audioFile.name}` : null,
        paid: paid === "yes",
        paid_method: paid === "yes" ? paidMethod : null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't submit that review."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="row" style={{ justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <p className="error-text">Ride request not found.</p>
      </div>
    );
  }

  if (ride.status !== "completed") {
    return (
      <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
          <h3 style={{ marginBottom: 8 }}>Not ready to review yet</h3>
          <p className="muted">Reviews open once this ride is marked completed.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🌟</div>
          <h3 style={{ marginBottom: 8 }}>Thanks for the feedback!</h3>
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => navigate(user.role === "driver" ? "/driver" : "/rider")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Rate your ride</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        With {otherParty?.first_name} {otherParty?.last_name}
      </p>

      <form onSubmit={handleSubmit} className="card">
        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

        <StarInput label="Drive safety" value={stars.drive_safety} onChange={(n) => setStars((s) => ({ ...s, drive_safety: n }))} />
        <StarInput label="Clean car" value={stars.clean_car} onChange={(n) => setStars((s) => ({ ...s, clean_car: n }))} />
        <StarInput label="Punctuality" value={stars.punctuality} onChange={(n) => setStars((s) => ({ ...s, punctuality: n }))} />
        <StarInput label="Good company" value={stars.good_company} onChange={(n) => setStars((s) => ({ ...s, good_company: n }))} />

        <div className="field">
          <label>Other feedback</label>
          <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Anything else worth sharing?" />
        </div>

        <div className="field">
          <label>Or attach a voice note (optional)</label>
          <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
          <p className="helper-text">Demo only — not transcribed or processed.</p>
        </div>

        <div className="field">
          <label>Did you pay?</label>
          <div className="row" style={{ gap: 8 }}>
            <RadioPill active={paid === "yes"} onClick={() => setPaid("yes")}>Yes</RadioPill>
            <RadioPill active={paid === "no"} onClick={() => setPaid("no")}>No</RadioPill>
          </div>
        </div>

        {paid === "yes" && (
          <div className="field">
            <label>Payment method used</label>
            <select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)}>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 6 }}>
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </form>

      <Link to={user.role === "driver" ? "/driver" : "/rider"}>
        <button className="btn btn-ghost" style={{ marginTop: 14 }}>Skip for now</button>
      </Link>
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
