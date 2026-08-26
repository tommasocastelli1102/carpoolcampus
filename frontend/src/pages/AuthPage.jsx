import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/client";
import ComingSoonModal from "../components/ComingSoonModal";

const PAYMENT_OPTIONS = [
  { value: "venmo", label: "Venmo" },
  { value: "cash", label: "Cash" },
  { value: "beer", label: "Beer" },
  { value: "aux_cord", label: "Aux cord / set the music" },
  { value: "coffee", label: "Coffee" },
];

const emptyForm = {
  first_name: "",
  last_name: "",
  birthday: "",
  sex: "",
  address: "",
  email: "",
  password: "",
  phone_number: "",
  schedule_note: "",
  payment_methods: [],
  payment_method_other: "",
  bio: "",
};

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "driver" ? "driver" : "rider";

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState(emptyForm);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBruinModal, setShowBruinModal] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const goToDashboard = (user) => {
    navigate(user.role === "driver" ? "/driver" : "/rider");
  };

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

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
        schedule_note: form.schedule_note || null,
      };
      if (role === "driver" || role === "both") {
        payload.payment_methods = form.payment_methods;
        payload.payment_method_other = form.payment_method_other || null;
        payload.bio = form.bio || null;
      }
      const user = await register(payload);
      goToDashboard(user);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't create your account."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 620, padding: "56px 24px" }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 24, gap: 8 }}>
          <TabButton active={mode === "login"} onClick={() => setMode("login")}>
            Log In
          </TabButton>
          <TabButton active={mode === "register"} onClick={() => setMode("register")}>
            Register
          </TabButton>
        </div>

        {mode === "register" && (
          <div className="row" style={{ marginBottom: 26, gap: 8 }}>
            <RoleButton active={role === "rider"} onClick={() => setRole("rider")}>
              🎒 I'm a Rider
            </RoleButton>
            <RoleButton active={role === "driver"} onClick={() => setRole("driver")}>
              🚗 I'm a Driver
            </RoleButton>
            <RoleButton active={role === "both"} onClick={() => setRole("both")}>
              Both
            </RoleButton>
          </div>
        )}

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
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Logging in…" : "Log In"}
            </button>
            <p className="helper-text" style={{ textAlign: "center", marginTop: 10 }}>
              Demo accounts: any seeded user, e.g. maya.driver@ucla.edu / password123
            </p>
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
              <label>Address</label>
              <input value={form.address} onChange={handleField("address")} placeholder="Neighborhood or street address" />
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

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={handleField("password")}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="field">
              <label>{role === "driver" ? "When are you usually free to drive?" : "When do you typically need rides?"}</label>
              <input
                value={form.schedule_note}
                onChange={handleField("schedule_note")}
                placeholder="e.g. Weekday mornings 8–9am, evenings 5–6pm"
              />
            </div>

            {(role === "driver" || role === "both") && (
              <>
                <div className="field">
                  <label>Preferred payment methods</label>
                  <div className="checkbox-grid">
                    {PAYMENT_OPTIONS.map((opt) => (
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

function RoleButton({ active, onClick, children }) {
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
