import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { CAMPUS_SEARCH_TEXT } from "../lib/campus";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LOADER_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

// Biases (doesn't restrict) autocomplete predictions toward the LA area,
// since every real use of this app is a campus commute there — an exact
// street match anywhere else still works, this just ranks nearby ones
// first the way typing into Google Maps itself would.
const LA_BOUNDS = {
  west: -118.67, south: 33.7, east: -118.15, north: 34.34,
};

const SUGGEST_DEBOUNCE_MS = 220;
const MIN_CHARS = 3;

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
  onFilled, // (field, value, {from, to}, coord?) => void — fires after Home/Campus or an autocomplete pick fills a field; `coord` ({lat,lng}) is only present for an autocomplete pick, straight from Google, so the caller can skip re-geocoding that exact text
  onLater,
  onSubmit,
  submitLabel = "Search",
  fromPlaceholder = "Choose starting point…",
  toPlaceholder = "Where to?",
  addressAutocomplete = false, // opt-in: Google-style address suggestions as you type (rider dashboard's search bar only, not the driver's post-a-route form)
  children, // optional extra fields (e.g. driver's day/time/seats row)
}) {
  const [activeField, setActiveField] = useState("to");

  // Every useJsApiLoader call sharing this `id` (this one, the other
  // RouteSearchBar instance, and CampusMap's) must pass identical options
  // — the underlying loader is a singleton keyed by `id` and throws if two
  // callers disagree, even if only one of them actually needs Places. So
  // this always passes the real key/libraries regardless of whether
  // *this* instance uses addressAutocomplete; the hook itself is cheap
  // when the script is already loaded (which it always is once CampusMap
  // has mounted on the same page).
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // The `places` sub-library's classes (AutocompleteSuggestion etc.) come
  // through google.maps.importLibrary, not directly off google.maps.places,
  // even once the bootstrap loader above has finished.
  const [placesLib, setPlacesLib] = useState(null);
  useEffect(() => {
    if (!addressAutocomplete || !mapsLoaded) return;
    let cancelled = false;
    window.google.maps.importLibrary("places").then((lib) => {
      if (!cancelled) setPlacesLib(lib);
    });
    return () => {
      cancelled = true;
    };
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

  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null); // "from" | "to" | null
  const debounceRef = useRef(null);
  const sessionTokensRef = useRef({ from: null, to: null }); // one per field, reused across keystrokes until a pick or a clear
  const blurTimeoutRef = useRef(null);

  const fetchSuggestions = (field, text) => {
    clearTimeout(debounceRef.current);
    const setSuggestions = field === "from" ? setFromSuggestions : setToSuggestions;

    if (!placesLib || text.trim().length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!sessionTokensRef.current[field]) {
        sessionTokensRef.current[field] = new placesLib.AutocompleteSessionToken();
      }
      try {
        const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: sessionTokensRef.current[field],
          locationBias: LA_BOUNDS,
          includedRegionCodes: ["us"],
        });
        setSuggestions((suggestions || []).filter((s) => s.placePrediction).slice(0, 6));
      } catch {
        setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
  };

  const pickSuggestion = async (field, suggestion) => {
    clearTimeout(blurTimeoutRef.current);
    const prediction = suggestion.placePrediction;
    const text = prediction.text.toString();
    // Resolve the full address (and its coordinates) immediately. The
    // coordinates matter beyond just precision: the app's own geocoder
    // (free/OpenStreetMap-backed, for distance math server-side) doesn't
    // know every real place Google's autocomplete does — a landmark like
    // "Rosenfeld Steps" resolves fine here but 404s there. Passing the
    // coordinates Google already resolved up to the caller means callers
    // that want them (RiderDashboard's search) never have to re-geocode
    // this exact text through that weaker service at all.
    let address = text;
    let coord = null;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      if (place.formattedAddress) address = place.formattedAddress;
      if (place.location) coord = { lat: place.location.lat(), lng: place.location.lng() };
    } catch {
      // fall back to the prediction's own text, no coordinates
    }

    sessionTokensRef.current[field] = null; // that session is spent
    if (field === "from") {
      setFromSuggestions([]);
      onFromChange(address);
      onFilled?.("from", address, { from: address, to }, coord);
    } else {
      setToSuggestions([]);
      onToChange(address);
      onFilled?.("to", address, { from, to: address }, coord);
    }
    setOpenDropdown(null);
  };

  const suggestionsFor = (field) => (field === "from" ? fromSuggestions : toSuggestions);

  return (
    <div style={{ marginBottom: 20 }}>
      <form onSubmit={onSubmit}>
        <div className="route-fields">
          <div className="route-fields-connector" aria-hidden>
            <span className="route-dot" />
            <span className="route-dotted-line" />
            <span className="route-pin">📍</span>
          </div>

          <div className="route-field-row" style={{ position: "relative" }}>
            <input
              placeholder={fromPlaceholder}
              value={from}
              onChange={(e) => {
                onFromChange(e.target.value);
                if (addressAutocomplete) fetchSuggestions("from", e.target.value);
              }}
              onFocus={() => {
                setActiveField("from");
                if (addressAutocomplete) setOpenDropdown("from");
              }}
              onBlur={() => {
                // Only close if "from" is still the open one by the time this
                // fires — otherwise a stale timeout from this blur can land
                // *after* the other field has already opened its own
                // dropdown and incorrectly close that one instead.
                blurTimeoutRef.current = setTimeout(
                  () => setOpenDropdown((current) => (current === "from" ? null : current)),
                  150
                );
              }}
              className="route-input"
              autoComplete="off"
            />
            <button type="submit" className="route-search-btn" aria-label={submitLabel}>
              🔍
            </button>
            {addressAutocomplete && openDropdown === "from" && fromSuggestions.length > 0 && (
              <SuggestionDropdown suggestions={fromSuggestions} onPick={(s) => pickSuggestion("from", s)} />
            )}
          </div>
          <div className="route-field-divider" />
          <div className="route-field-row" style={{ position: "relative" }}>
            <input
              placeholder={toPlaceholder}
              value={to}
              onChange={(e) => {
                onToChange(e.target.value);
                if (addressAutocomplete) fetchSuggestions("to", e.target.value);
              }}
              onFocus={() => {
                setActiveField("to");
                if (addressAutocomplete) setOpenDropdown("to");
              }}
              onBlur={() => {
                blurTimeoutRef.current = setTimeout(
                  () => setOpenDropdown((current) => (current === "to" ? null : current)),
                  150
                );
              }}
              className="route-input"
              autoComplete="off"
            />
            {addressAutocomplete && openDropdown === "to" && toSuggestions.length > 0 && (
              <SuggestionDropdown suggestions={toSuggestions} onPick={(s) => pickSuggestion("to", s)} />
            )}
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
        .route-suggestions {
          position: absolute;
          left: -26px;
          right: 0;
          top: 100%;
          z-index: 20;
          margin-top: 6px;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }
        .route-suggestion-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          border-top: 1px solid var(--border);
          padding: 10px 12px;
          font-size: 13px;
          color: var(--text-muted);
          cursor: pointer;
        }
        .route-suggestion-item:first-child {
          border-top: none;
        }
        .route-suggestion-item:hover,
        .route-suggestion-item:focus {
          background: var(--surface);
        }
        .route-suggestion-main {
          color: var(--text);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function SuggestionDropdown({ suggestions, onPick }) {
  return (
    <div className="route-suggestions">
      {suggestions.map((s, i) => {
        const prediction = s.placePrediction;
        const main = prediction.mainText?.toString() || prediction.text.toString();
        const secondary = prediction.secondaryText?.toString();
        return (
          <button
            type="button"
            key={prediction.placeId || i}
            className="route-suggestion-item"
            // onMouseDown (not onClick) fires before the input's onBlur
            // closes the dropdown, so the pick still lands.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(s);
            }}
          >
            <span className="route-suggestion-main">{main}</span>
            {secondary ? <span> · {secondary}</span> : null}
          </button>
        );
      })}
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
