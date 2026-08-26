import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(10,14,26,0.85)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="container row-between" style={{ height: 68 }}>
        <Link to="/home" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Carpool<span style={{ color: "var(--primary-hover)" }}>Campus</span>
          </span>
        </Link>

        <nav className="row" style={{ gap: 20 }}>
          {user ? (
            <>
              {(user.role === "driver" || user.role === "both") && (
                <Link to="/driver" className="muted" style={{ textDecoration: "none", fontSize: 14 }}>
                  Driver
                </Link>
              )}
              {(user.role === "rider" || user.role === "both") && (
                <Link to="/rider" className="muted" style={{ textDecoration: "none", fontSize: 14 }}>
                  Rider
                </Link>
              )}
              <span className="muted" style={{ fontSize: 14 }}>
                Hi, {user.first_name}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
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
