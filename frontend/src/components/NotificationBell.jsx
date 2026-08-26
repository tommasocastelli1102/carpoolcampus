import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BellIcon } from "./Icons";
import { computeNotifications, markAllNotificationsSeen, markNotificationSeen } from "../lib/notifications";

const POLL_MS = 20000;

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const refresh = async () => {
    if (!user) return;
    try {
      const { data: myRides } = await client.get("/rides/my");
      setRides(myRides);

      const threadRides = myRides.filter((r) => r.status === "confirmed" || r.status === "completed");
      const lastMessagesByRide = new Map();
      await Promise.all(
        threadRides.map(async (r) => {
          try {
            const { data: msgs } = await client.get(`/messages/${r.id}`);
            lastMessagesByRide.set(r.id, msgs.length ? msgs[msgs.length - 1] : null);
          } catch {
            lastMessagesByRide.set(r.id, null);
          }
        })
      );

      setNotifications(computeNotifications(user, myRides, lastMessagesByRide));
    } catch {
      // network hiccup — keep showing whatever we already had
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const positionMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 320;
    setMenuPos({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      width,
    });
  };

  const toggleOpen = () => {
    if (!open) positionMenu();
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

  const handleSelect = (n) => {
    markNotificationSeen(user, n, rides);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    setOpen(false);
    navigate(n.path);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsSeen(user, notifications, rides);
    setNotifications([]);
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
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
          cursor: "pointer",
          color: "var(--text)",
          flexShrink: 0,
        }}
      >
        <BellIcon size={18} />
        {notifications.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
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
              maxHeight: 420,
              display: "flex",
              flexDirection: "column",
              isolation: "isolate",
            }}
          >
            <div className="row-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "4px 10px", fontSize: 12, width: "auto" }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, padding: 20, textAlign: "center" }}>
                  You're all caught up.
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelect(n)}
                    className="row"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      gap: 10,
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }} aria-hidden>{n.icon}</span>
                    <span style={{ fontSize: 13 }}>{n.text}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
