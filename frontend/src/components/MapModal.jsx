import CampusMap from "./CampusMap";
import { StarDisplay } from "./StarRating";

function badgeLabel(badge) {
  if (!badge) return null;
  if (badge.kind === "pickup") return "Pickup requested";
  if (badge.kind === "meet_outside") return "Meet outside requested";
  return null;
}

function SidebarAvatar({ photoUrl, kind }) {
  return (
    <div
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
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: 16 }} aria-hidden>{kind === "driver" ? "🚗" : "🎒"}</span>
      )}
    </div>
  );
}

/**
 * Google-Maps-style layout for the expanded map: a scrollable results list
 * on the left, the interactive map filling the rest. The list is just
 * `others` (already passed to CampusMap) rendered as rows instead of pins
 * — same data, same click target (onPersonClick), no extra props needed.
 */
export default function MapModal({ onClose, ...mapProps }) {
  const others = mapProps.others || [];

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ padding: "clamp(0px, 3vw, 24px)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 1180,
          height: "min(88vh, 820px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          className="row-between"
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, width: "auto" }}>Map</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: "auto", flexShrink: 0 }}>
            Close ✕
          </button>
        </div>

        <div className="mapmodal-body" style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {others.length > 0 && (
            <div
              className="mapmodal-sidebar"
              style={{
                width: 300,
                flexShrink: 0,
                borderRight: "1px solid var(--border)",
                overflowY: "auto",
              }}
            >
              {others.map((o) => {
                const label = badgeLabel(o.badge);
                const clickable = Boolean(mapProps.onPersonClick);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={clickable ? () => mapProps.onPersonClick(o) : undefined}
                    className="row"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      gap: 10,
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      cursor: clickable ? "pointer" : "default",
                      color: "var(--text)",
                    }}
                  >
                    <span
                      title={o.matching ? "Matches your availability" : "No match"}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: o.matching ? "#3FA66A" : "#5B6479",
                        flexShrink: 0,
                      }}
                    />
                    <SidebarAvatar photoUrl={o.photoUrl} kind={o.kind} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {o.name || (o.kind === "driver" ? "Driver" : "Rider")}
                      </div>
                      {o.rating > 0 && (
                        <div className="row" style={{ gap: 4, marginTop: 2 }}>
                          <StarDisplay value={o.rating} size={11} />
                        </div>
                      )}
                      {o.availabilityText && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{o.availabilityText}</div>
                      )}
                      {label && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{label}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CampusMap {...mapProps} variant="expanded" />
          </div>
        </div>
      </div>
    </div>
  );
}
