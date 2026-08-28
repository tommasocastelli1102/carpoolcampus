import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";
import { HistogramIcon } from "./Icons";

export default function Navbar() {
  const { user, loading } = useAuth();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        isolation: "isolate",
        background: "rgba(10,14,26,0.85)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        className="container row-between navbar-row"
        style={{ minHeight: 60, padding: "10px 24px", flexWrap: "nowrap" }}
      >
        <Link to="/home" style={{ textDecoration: "none", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            Carpool<span style={{ color: "var(--primary-hover)" }}>Campus</span>
          </span>
        </Link>

        <nav className="row" style={{ gap: 10, flexShrink: 0, flexWrap: "nowrap" }}>
          {user ? (
            <>
              {/* Just the logo + three icons — no text links, nothing to scroll. */}
              <Link
                to="/balance"
                aria-label="Balances"
                style={{
                  position: "relative",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text)",
                  flexShrink: 0,
                }}
              >
                <HistogramIcon size={18} />
              </Link>
              <NotificationBell />
              <ProfileMenu />
            </>
          ) : loading ? (
            // A token exists and we're still confirming it (e.g. the backend
            // is waking up from a free-tier cold start) — show nothing
            // rather than a "Log In / Register" button, so an already
            // logged-in user can't click through to the login screen while
            // the session is still being restored.
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", flexShrink: 0 }} />
          ) : (
            <Link to="/auth">
              <button className="btn btn-primary btn-sm">Log In / Register</button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
