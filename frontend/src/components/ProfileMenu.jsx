import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import client, { apiErrorMessage } from "../api/client";
import { geocodeMany } from "../api/geocode";
import { haversineMiles, milesToKm, co2SavedKg } from "../lib/geo";
import { useAuth } from "../context/AuthContext";
import { UserIcon } from "./Icons";
import { StarDisplay } from "./StarRating";
import { getSearchRadius, setSearchRadius, SEARCH_RADIUS_OPTIONS } from "../lib/searchRadius";

const REVIEW_STAR_KEYS = ["stars_drive_safety", "stars_clean_car", "stars_punctuality", "stars_good_company"];

/** Every completed ride's endpoints. Prefers the two parties' actual
 * addresses — always a full "street, city, state" string that geocodes
 * reliably — over the availability slot's route_from/route_to, which is
 * often just a bare neighborhood name ("Palms Apartments") with no city
 * or state qualifier and can geocode to a same-named place hundreds of
 * miles away. Only falls back to the slot's route text (or a custom
 * meeting place) when one party's address isn't on file. */
function rideEndpoints(ride) {
  if (ride.driver?.address && ride.rider?.address) {
    return [ride.driver.address, ride.rider.address];
  }
  if (ride.availability) {
    return [ride.availability.route_from, ride.availability.route_to];
  }
  return [ride.driver?.address, ride.custom_place || ride.rider?.address];
}

export default function ProfileMenu() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null); // { kmTravelled, co2Kg, rating, reviewCount }
  const [enablingDriving, setEnablingDriving] = useState(false);
  const [enableError, setEnableError] = useState("");
  const [radius, setRadius] = useState(getSearchRadius());
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const loadStats = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const [{ data: rides }, { data: reviews }] = await Promise.all([
        client.get("/rides/my"),
        client.get(`/users/${user.id}/reviews`),
      ]);

      const completed = rides.filter((r) => r.status === "completed");
      const addressPairs = completed.map(rideEndpoints);
      const addresses = addressPairs.flat().filter(Boolean);
      const coords = await geocodeMany(addresses);

      let totalMiles = 0;
      addressPairs.forEach(([from, to]) => {
        const a = from ? coords.get(from) : null;
        const b = to ? coords.get(to) : null;
        const d = haversineMiles(a, b);
        if (d != null) totalMiles += d;
      });
      const kmTravelled = milesToKm(totalMiles) || 0;

      const starValues = reviews.flatMap((r) => REVIEW_STAR_KEYS.map((k) => r[k]).filter((v) => v != null));
      const rating = starValues.length ? starValues.reduce((a, b) => a + b, 0) / starValues.length : null;

      setStats({ kmTravelled, co2Kg: co2SavedKg(kmTravelled), rating, reviewCount: reviews.length });
    } catch {
      setStats({ kmTravelled: 0, co2Kg: 0, rating: null, reviewCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const positionMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 300;
    setMenuPos({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      width,
    });
  };

  const toggleOpen = () => {
    if (!open) {
      positionMenu();
      loadStats();
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onReposition = () => positionMenu();
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  if (!user) return null;

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/home");
  };

  const handleRadiusChange = (e) => {
    const miles = Number(e.target.value);
    setRadius(miles);
    setSearchRadius(miles);
  };

  const handleEnableDriving = async () => {
    setEnableError("");
    setEnablingDriving(true);
    try {
      const { data } = await client.post("/auth/enable-driving", {});
      setUser(data);
      setOpen(false);
      navigate("/rider");
    } catch (err) {
      setEnableError(apiErrorMessage(err, "Couldn't turn on driving. Try again."));
    } finally {
      setEnablingDriving(false);
    }
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label="Profile"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          color: "var(--text)",
        }}
      >
        {user.profile_photo_url ? (
          <img src={user.profile_photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <UserIcon size={18} />
        )}
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="card"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxWidth: "calc(100vw - 24px)",
              padding: 0,
              zIndex: 200,
              isolation: "isolate",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 18px 14px" }}>
              <div className="row" style={{ gap: 12, marginBottom: 2 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
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
                  {user.profile_photo_url ? (
                    <img src={user.profile_photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <UserIcon size={22} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="muted" style={{ fontSize: 12, textTransform: "capitalize" }}>{user.role}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: "0 18px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <StatTile label="km travelled" value={loading || !stats ? "…" : stats.kmTravelled.toFixed(1)} />
              <StatTile label="CO2 saved" value={loading || !stats ? "…" : `${stats.co2Kg.toFixed(1)}kg`} />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Your rating</div>
                {loading || !stats ? (
                  <span style={{ fontSize: 13 }}>…</span>
                ) : stats.rating != null ? (
                  <StarDisplay value={stats.rating} size={14} />
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>No ratings yet</span>
                )}
              </div>
            </div>

            <div style={{ padding: "0 18px 14px", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div className="row-between" style={{ alignItems: "center" }}>
                <label style={{ fontSize: 13, marginBottom: 0 }}>Search range</label>
                <select
                  value={radius}
                  onChange={handleRadiusChange}
                  style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
                >
                  {SEARCH_RADIUS_OPTIONS.map((mi) => (
                    <option key={mi} value={mi}>{mi} mi</option>
                  ))}
                </select>
              </div>
              <p className="helper-text" style={{ marginBottom: 0 }}>
                How far from your starting point "Choose a ride" looks for rides.
              </p>
            </div>

            {user.role === "rider" && (
              <div style={{ padding: "0 18px 14px", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={handleEnableDriving}
                  disabled={enablingDriving}
                  className="btn btn-sm btn-ghost"
                  style={{ width: "100%" }}
                >
                  {enablingDriving ? "Turning on…" : "🚗 I have a car — start driving"}
                </button>
                <p className="helper-text" style={{ marginBottom: 0 }}>
                  Driving is per-ride, not permanent — you'll still see rider options too.
                </p>
                {enableError && <p className="error-text" style={{ marginTop: 6, marginBottom: 0 }}>{enableError}</p>}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="row"
              style={{
                width: "100%",
                gap: 8,
                padding: "12px 18px",
                background: "transparent",
                border: "none",
                borderTop: "1px solid var(--border)",
                cursor: "pointer",
                color: "var(--danger)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Log out
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
