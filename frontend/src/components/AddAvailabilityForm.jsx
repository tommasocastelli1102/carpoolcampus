import { useEffect, useState } from "react";
import client, { apiErrorMessage } from "../api/client";
import { CAMPUS_SEARCH_TEXT } from "../lib/campus";
import RouteSearchBar from "./RouteSearchBar";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The route-posting form — the same From/To + Campus/Home bar used to
 * search, just posting a route instead. Shared by the driver dashboard
 * (embedded inline) and the rider dashboard (inside a modal, for anyone
 * who wants to offer a ride without leaving the rider view). */
export default function AddAvailabilityForm({ user, onSaved, submitLabel = "Post route", onFieldsChange }) {
  const [fromText, setFromText] = useState(user.address || "");
  const [toText, setToText] = useState(CAMPUS_SEARCH_TEXT);
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [seats, setSeats] = useState(3);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lets a parent dashboard (e.g. for orienting its map) know what's
  // currently typed, without lifting the whole form's state up to it.
  useEffect(() => {
    onFieldsChange?.(fromText, toText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromText, toText]);

  const handleCampusClick = () => {
    setFromText(user.address || "Home");
    setToText(CAMPUS_SEARCH_TEXT);
  };

  const handleHomeClick = () => {
    setFromText(CAMPUS_SEARCH_TEXT);
    setToText(user.address || "Home");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromText.trim() || !toText.trim()) {
      setError("Add both a from and to location.");
      return;
    }
    setError("");
    setSubmitting(true);
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
      onSaved?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save that route."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteSearchBar
      from={fromText}
      to={toText}
      onFromChange={setFromText}
      onToChange={setToText}
      onCampus={handleCampusClick}
      onHome={handleHomeClick}
      onSubmit={handleSubmit}
      submitLabel={submitting ? "Posting…" : submitLabel}
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
      {error && <p className="error-text" style={{ flexBasis: "100%", marginTop: 8, marginBottom: 0 }}>{error}</p>}
    </RouteSearchBar>
  );
}
