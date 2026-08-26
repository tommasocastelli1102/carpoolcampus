import CampusMap from "./CampusMap";

export default function MapModal({ onClose, ...mapProps }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ padding: "clamp(0px, 3vw, 24px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 1000,
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
            // Explicit overrides: a title+close bar should stay one row even
            // on mobile, unlike the generic .row-between stacking behavior.
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, width: "auto" }}>Map</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: "auto", flexShrink: 0 }}>
            Close ✕
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CampusMap {...mapProps} variant="expanded" />
        </div>
      </div>
    </div>
  );
}
