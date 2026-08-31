import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { CAMPUS_SEARCH_TEXT } from "../lib/campus";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LOADER_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

// Biases (doesn't restrict) autocomplete predictions toward the LA area,
// since every real use of this app is a campus commute there — an exact
// street match anywhere else still works, this just ranks nearby ones
// first the way typing into Google Maps itself would.
const LA_BOUNDS = { north: 34.34, south: 33.7, east: -118.15, west: -118.67 };

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
  addressAutocomplete = false, // opt-in: Google-style address suggestions as you type (rider dashboard's search bar only, not the driver's post-a-route form)
  children, // optional extra fields (e.g. driver's day/time/seats row)
}) {
  const [activeField, setActiveField] = useState("to");
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  // Autocomplete fires its own 'place_changed' -> onFromChange/onToChange;
  // these track the latest values so that handler (attached once, on load)
  // always sees the current sibling field instead of a stale closure.
  const fromRef = useRef(from);
  const toRef = useRef(to);
  fromRef.current = from;
  toRef.current = to;

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: (addressAutocomplete && GOOGLE_MAPS_API_KEY) || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!addressAutocomplete || !mapsLoaded || !window.google?.maps?.places) return;

    const options = {
      fields: ["formatted_address"],
      bounds: LA_BOUNDS,
      componentRestrictions: { country: "us" },
    };

    const fromAutocomplete = new window.google.maps.places.Autocomplete(fromInputRef.current, options);
    const fromListener = fromAutocomplete.addListener("place_changed", () => {
      const place = fromAutocomplete.getPlace();
      if (place?.formatted_address) {
        onFromChange(place.formatted_address);
        onFilled?.("from", place.formatted_address, { from: place.formatted_address, to: toRef.current });
      }
    });

    const toAutocomplete = new window.google.maps.places.Autocomplete(toInputRef.current, options);
    const toListener = toAutocomplete.addListener("place_changed", () => {
      const place = toAutocomplete.getPlace();
      if (place?.formatted_address) {
        onToChange(place.formatted_address);
        onFilled?.("to", place.formatted_address, { from: fromRef.current, to: place.formatted_address });
      }
    });

    return () => {
      fromListener.remove();
      toListener.remove();
      window.google.maps.event.clearInstanceListeners(fromAutocomplete);
      window.google.maps.event.clearInstanceListeners(toAutocomplete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressAutocomplete, mapsLoaded]);

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
              ref={fromInputRef}
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
              ref={toInputRef}
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
        /* Google's address-suggestion dropdown (.pac-container) is appended
           to <body>, outside this component's own tree, and defaults to a
           light theme — restyle it to match the app instead of clashing. */
        .pac-container {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-top: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          font-family: inherit;
        }
        .pac-item {
          border-top: 1px solid var(--border);
          padding: 9px 12px;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover,
        .pac-item-selected {
          background: var(--surface);
        }
        .pac-item-query {
          color: var(--text);
        }
        .pac-icon {
          filter: invert(1) grayscale(1) brightness(1.6);
        }
        .pac-logo:after {
          margin: 4px 8px 8px;
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
