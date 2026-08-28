import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client, { apiErrorMessage } from "../api/client";
import ComingSoonModal from "../components/ComingSoonModal";
import { EyeIcon, EyeOffIcon, PlusIcon, XIcon } from "../components/Icons";
import { UNIVERSITIES } from "../lib/universities";
import { PAYMENT_METHODS as PAYMENT_OPTIONS } from "../lib/paymentMethods";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const emptyForm = {
  first_name: "",
  last_name: "",
  birthday: "",
  sex: "",
  address: "",
  university: "",
  email: "",
  password: "",
  phone_number: "",
  schedule_note: "",
  calendar_link: "",
  profile_photo_url: "",
  payment_methods: [],
  payment_method_other: "",
  bio: "",
};

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  // "driver" here only ever means "has a car" — it maps to role "both" below
  // so car owners always keep rider access too. There's no driver-only
  // registration path: having a car is a profile trait, and which one you
  // are for a given trip is a per-ride choice, not something you lock in here.
  const initialRole = searchParams.get("role") === "driver" ? "both" : "rider";
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState(emptyForm);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBruinModal, setShowBruinModal] = useState(false);
  const [spots, setSpots] = useState([]); // driver "when free to drive" spots: {day_of_week, start_time, end_time}

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const goToDashboard = () => {
    navigate("/rider");
  };

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleUniversityChange = (e) => {
    const value = e.target.value;
    const preset = UNIVERSITIES.find((u) => u.value === value);
    setForm((f) => ({
      ...f,
      university: value,
      address: preset?.address ? preset.address : f.address,
    }));
  };

  const togglePaymentMethod = (value) => {
    setForm((f) => {
      const has = f.payment_methods.includes(value);
      return {
        ...f,
        payment_methods: has ? f.payment_methods.filter((v) => v !== value) : [...f.payment_methods, value],
      };
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(loginForm.email, loginForm.password);
      goToDashboard(user);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't log in. Check your email and password."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        birthday: form.birthday || null,
        sex: form.sex || null,
        role,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number || null,
        address: form.address || null,
        // form.university === "" is the unselected placeholder option itself
        // (it has value: "" so it'd otherwise match .find() below and save
        // its own "Select a university…" label as if it were a real choice).
        university: form.university ? UNIVERSITIES.find((u) => u.value === form.university)?.label || null : null,
        schedule_note: form.schedule_note || null,
        calendar_link: form.calendar_link || null,
        profile_photo_url: form.profile_photo_url || null,
      };
      if (role === "driver" || role === "both") {
        payload.payment_methods = form.payment_methods;
        payload.payment_method_other = form.payment_method_other || null;
        payload.bio = form.bio || null;
      }
      const user = await register(payload);

      // Turn any "+ spots" the driver added into real availability slots now
      // that we have an account (and token) to attach them to.
      if ((role === "driver" || role === "both") && spots.length > 0) {
        const universityPreset = UNIVERSITIES.find((u) => u.value === form.university);
        const routeFrom = form.address?.trim() || "Home";
        const routeTo = universityPreset?.address || universityPreset?.label || "Campus";
        await Promise.all(
          spots.map((spot) =>
            client.post("/availability", {
              day_of_week: spot.day_of_week,
              start_time: spot.start_time,
              end_time: spot.end_time,
              route_from: routeFrom,
              route_to: routeTo,
              seats_available: 3,
            })
          )
        ).catch(() => {
          // Non-fatal: the account is already created; slots can be added
          // later from the driver dashboard if this fails.
        });
      }

      goToDashboard(user);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't create your account."));
    } finally {
      setSubmitting(false);
    }
  };

  const showRoleSelector = mode === "register";
  const showDriverFields = mode === "register" && (role === "driver" || role === "both");

  return (
    <div className="container" style={{ maxWidth: 620, padding: "56px 24px" }}>
      <div className="card">
        {/* --- Fixed header: this part never changes shape when switching Log In / Register --- */}
        <div className="row" style={{ marginBottom: 24, gap: 8 }}>
          <TabButton active={mode === "login"} onClick={() => setMode("login")}>
            Log In
          </TabButton>
          <TabButton active={mode === "register"} onClick={() => setMode("register")}>
            Register
          </TabButton>
        </div>

        <div
          style={{
            marginBottom: showRoleSelector ? 26 : 0,
            maxHeight: showRoleSelector ? 280 : 0,
            opacity: showRoleSelector ? 1 : 0,
            overflow: "hidden",
            pointerEvents: showRoleSelector ? "auto" : "none",
            transition: "max-height 0.18s ease, opacity 0.15s ease, margin-bottom 0.18s ease",
          }}
          aria-hidden={!showRoleSelector}
        >
          <label style={{ marginBottom: 8, display: "block" }}>Do you have a car?</label>
          <div className="row" style={{ gap: 10 }}>
            <CarOptionCard
              active={role === "both"}
              icon="🚗"
              title="Yes, I have a car"
              onClick={() => setRole("both")}
            />
            <CarOptionCard
              active={role === "rider"}
              icon="🎒"
              title="No, I don't"
              onClick={() => setRole("rider")}
            />
          </div>
        </div>
        {/* --- End fixed header --- */}

        {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

        {mode === "login" ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@ucla.edu"
              />
            </div>
            <PasswordField
              label="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
            />
            <button className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Logging in…" : "Log In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="field-row">
              <div className="field">
                <label>First name</label>
                <input required value={form.first_name} onChange={handleField("first_name")} />
              </div>
              <div className="field">
                <label>Last name</label>
                <input required value={form.last_name} onChange={handleField("last_name")} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Birthday</label>
                <input type="date" value={form.birthday} onChange={handleField("birthday")} />
              </div>
              <div className="field">
                <label>Sex</label>
                <select value={form.sex} onChange={handleField("sex")}>
                  <option value="">Prefer not to say</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Non-binary</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>University</label>
              <select value={form.university} onChange={handleUniversityChange}>
                {UNIVERSITIES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Address</label>
              <input
                value={form.address}
                onChange={handleField("address")}
                placeholder="Neighborhood or street address"
              />
              <p className="helper-text">Pre-filled from your university choice above — edit it to your own address.</p>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Email</label>
                <input type="email" required value={form.email} onChange={handleField("email")} placeholder="you@ucla.edu" />
              </div>
              <div className="field">
                <label>Phone number</label>
                <input value={form.phone_number} onChange={handleField("phone_number")} placeholder="(555) 555-5555" />
              </div>
            </div>

            <PasswordField
              label="Password"
              value={form.password}
              onChange={handleField("password")}
              placeholder="At least 6 characters"
              minLength={6}
            />

            <div className="field">
              <label>{role === "driver" ? "When are you usually free to drive?" : "When do you typically need rides?"}</label>
              <input
                value={form.schedule_note}
                onChange={handleField("schedule_note")}
                placeholder="e.g. Weekday mornings 8–9am, evenings 5–6pm"
              />
            </div>

            <div className="field">
              <label>Calendar link (optional)</label>
              <input
                type="url"
                value={form.calendar_link}
                onChange={handleField("calendar_link")}
                placeholder="Paste a shareable Google Calendar (or similar) link"
              />
              <p className="helper-text">Lets the other side see your real availability at a glance.</p>
            </div>

            <div className="field">
              <label>Profile photo URL (optional)</label>
              <input
                type="url"
                value={form.profile_photo_url}
                onChange={handleField("profile_photo_url")}
                placeholder="Paste a link to your photo"
              />
              <p className="helper-text">Shown on the map and in ride listings instead of the car/backpack icon.</p>
            </div>

            {showDriverFields && (
              <>
                <SpotPicker spots={spots} setSpots={setSpots} />

                <div className="field">
                  <label>Preferred payment methods</label>
                  <div className="checkbox-grid">
                    {PAYMENT_OPTIONS.filter((opt) => opt.value !== "other").map((opt) => (
                      <label
                        key={opt.value}
                        className={`checkbox-pill ${form.payment_methods.includes(opt.value) ? "checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.payment_methods.includes(opt.value)}
                          onChange={() => togglePaymentMethod(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <input
                    style={{ marginTop: 10 }}
                    value={form.payment_method_other}
                    onChange={handleField("payment_method_other")}
                    placeholder="Other (free text)"
                  />
                </div>
                <div className="field">
                  <label>Driver bio</label>
                  <textarea rows={3} value={form.bio} onChange={handleField("bio")} placeholder="Tell riders a bit about your rides" />
                </div>
              </>
            )}

            <button className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 4 }}>
              {submitting ? "Creating account…" : "Create Account"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-ghost btn-block" onClick={() => setShowBruinModal(true)} type="button">
            🐻 Log in with Bruin Account
          </button>
        </div>
      </div>

      {showBruinModal && (
        <ComingSoonModal
          title="We're working on it!"
          message="Bruin Account login is available soon."
          onClose={() => setShowBruinModal(false)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      style={{
        flex: 1,
        background: active ? "var(--primary)" : "transparent",
        color: active ? "#fff" : "var(--text-muted)",
        border: active ? "none" : "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

function CarOptionCard({ active, icon, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        flex: 1,
        textAlign: "left",
        cursor: "pointer",
        padding: "14px 16px",
        background: active ? "rgba(45,108,246,0.12)" : "var(--surface)",
        border: active ? "1.5px solid var(--primary)" : "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: active ? "var(--primary-hover)" : "var(--text)" }}>
        {title}
      </div>
    </button>
  );
}

function PasswordField({ label, value, onChange, placeholder, minLength, required = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            padding: 8,
            cursor: "pointer",
            color: "var(--text-muted)",
            display: "flex",
          }}
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
    </div>
  );
}

function SpotPicker({ spots, setSpots }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ day_of_week: "0", start_time: "08:00", end_time: "09:00" });

  const addSpot = () => {
    setSpots((s) => [...s, { ...draft, day_of_week: Number(draft.day_of_week) }]);
    setAdding(false);
    setDraft({ day_of_week: "0", start_time: "08:00", end_time: "09:00" });
  };

  const removeSpot = (index) => {
    setSpots((s) => s.filter((_, i) => i !== index));
  };

  return (
    <div className="field">
      <label>Regular driving spots</label>

      {spots.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {spots.map((spot, i) => (
            <span
              key={i}
              className="row"
              style={{
                gap: 6,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "6px 6px 6px 12px",
                fontSize: 13,
              }}
            >
              {DAYS[spot.day_of_week]} · {spot.start_time}–{spot.end_time}
              <button
                type="button"
                onClick={() => removeSpot(i)}
                aria-label="Remove spot"
                style={{
                  background: "var(--surface-raised)",
                  border: "none",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <XIcon size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {adding ? (
        <div className="card-flat">
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Day</label>
              <select value={draft.day_of_week} onChange={(e) => setDraft((d) => ({ ...d, day_of_week: e.target.value }))}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }} />
          </div>
          <div className="field-row" style={{ marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Start time</label>
              <input type="time" value={draft.start_time} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>End time</label>
              <input type="time" value={draft.end_time} onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={addSpot}>
              Add spot
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
          <PlusIcon size={14} /> Add a spot
        </button>
      )}
      <p className="helper-text">
        Pick a day of the week and a time you're usually free to drive — you can add as many as you like, and add more later from your dashboard.
      </p>
    </div>
  );
}
