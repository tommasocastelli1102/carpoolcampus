import { useState } from "react";
import { CAMPUS_SEARCH_TEXT } from "../lib/campus";

/** The one shared "Uber-style" interaction surface for both dashboards: a
 * From/To field pair styled like a maps directions picker (hollow origin
 * dot, dotted connector, destination pin), plus one-tap shortcuts below
 * it for the two places everyone actually goes — home and campus.
 *
 * Home/Campus aren't tied to a fixed field: whichever field you tapped
 * into last (From or To — To by default) is the one that gets filled,
 * so picking one doesn't clear or override the other.
 *
 * Riders search existing routes with this; drivers use the identical bar
 * to describe the route they're offering. `submitLabel`, the
 * placeholders, and `homeValue` are the only things that differ between
 * the two.
 */
export default function RouteSearchBar({
  from,
  to,
  onFromChange,
  onToChange,
  homeValue = "Home",
  campusValue = CAMPUS_SEARCH_TEXT,
  onFilled, // (field, value, {from, to}) => void — fires after Home/Campus fills a field
  onLater,
  onSubmit,
  submitLabel = "Search",
  fromPlaceholder = "Choose starting point…",
  toPlaceholder = "Where to?",
  children, // optional extra fields (e.g. driver's day/time/seats row)
}) {
  const [activeField, setActiveField] = useState("to");

  const fillActiveField = (value) => {
    if (activeField === "from") {
      onFromChange(value);
      onFilled?.("from", value, { from: value, to });
    } else {
      onToChange(value);
      onFilled?.("to", value, { from, to: value });
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <form onSubmit={onSubmit}>
        <div className="route-fields">
          <div className="route-fields-connector" aria-hidden>
            <span className="route-dot" />
            <span className="route-dotted-line" />
            <span className="route-pin">📍</span>
          </div>

          <div className="route-field-row">
            <input
              placeholder={fromPlaceholder}
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              onFocus={() => setActiveField("from")}
              className="route-input"
            />
            <button type="submit" className="route-search-btn" aria-label={submitLabel}>
              🔍
            </button>
          </div>
          <div className="route-field-divider" />
          <div className="route-field-row">
            <input
              placeholder={toPlaceholder}
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              onFocus={() => setActiveField("to")}
              className="route-input"
            />
          </div>
        </div>

        <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "nowrap" }}>
          <ShortcutButton onClick={() => fillActiveField(homeValue)}>🏠 Home</ShortcutButton>
          <ShortcutButton onClick={() => fillActiveField(campusValue)}>🎓 Campus</ShortcutButton>
          {onLater && (
            <ShortcutButton onClick={onLater}>
              📅 Later
            </ShortcutButton>
          )}
          <button className="btn btn-primary btn-sm" style={{ flexShrink: 0, marginLeft: "auto", fontSize: 12, padding: "8px 12px" }}>
            {submitLabel}
          </button>
        </div>
        {children}
      </form>

      <style>{`
        .route-fields {
          position: relative;
          border: 1.5px solid var(--border);
          border-radius: 16px;
          background: var(--surface-raised);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .route-fields:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(45, 108, 246, 0.18);
        }
        .route-field-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px 12px 40px;
        }
        .route-field-divider {
          height: 1px;
          background: var(--border);
          margin: 0 14px;
        }
        .route-input {
          flex: 1;
          min-width: 0;
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .route-input:focus {
          border: none !important;
          box-shadow: none !important;
        }
        .route-search-btn {
          flex-shrink: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 15px;
          color: var(--text-muted);
          padding: 4px;
          display: flex;
        }
        .route-fields-connector {
          position: absolute;
          left: 14px;
          top: 0;
          bottom: 0;
          width: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .route-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid var(--primary);
          background: var(--surface-raised);
          margin-top: 24px;
          flex-shrink: 0;
        }
        .route-dotted-line {
          flex: 1;
          width: 0;
          border-left: 1.5px dotted var(--border);
          margin: 4px 0;
        }
        .route-pin {
          font-size: 16px;
          margin-bottom: 20px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

function ShortcutButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-sm"
      style={{
        flexShrink: 0,
        whiteSpace: "nowrap",
        fontSize: 12,
        padding: "8px 10px",
        background: "transparent",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

export { CAMPUS_SEARCH_TEXT };
