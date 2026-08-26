import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeMany } from "../api/geocode";
import { estimateMinutes, haversineMiles, formatMiles } from "../lib/geo";

const ROUTE_COLOR = "#2D6CF6"; // var(--primary), hardcoded: Leaflet can't read CSS custom props
const MATCH_COLOR = "#3FA66A"; // muted green, used only for map match/no-match status — the one
const NO_MATCH_COLOR = "#5B6479"; // deliberate exception to the app's no-green rule (see CampusMap docs)

function pinIcon({ emoji, ring, size = 30 }) {
  return L.divIcon({
    className: "",
    html: `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:#12172B;border:2.5px solid ${ring};
        display:flex;align-items:center;justify-content:center;
        font-size:${Math.round(size * 0.52)}px;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
      ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const HOME_ICON = pinIcon({ emoji: "🏠", ring: ROUTE_COLOR, size: 32 });
const DEST_ICON = pinIcon({ emoji: "🎓", ring: "#F6B62D", size: 32 });
const STOP_ICON = pinIcon({ emoji: "📍", ring: ROUTE_COLOR, size: 22 });

function personIcon(matching, kind) {
  return pinIcon({ emoji: kind === "driver" ? "🚗" : "🎒", ring: matching ? MATCH_COLOR : NO_MATCH_COLOR, size: 26 });
}

/**
 * badge: { kind: 'pickup' | 'meet_outside', meetOutsideDisplay?: 'message' | 'distance' }
 *  - 'pickup'      -> "+N min" estimated detour, from `home` to this person's pin.
 *  - 'meet_outside' with meetOutsideDisplay:
 *      'message'  -> a fixed "I can reach your apartment" note (driver's view of a rider
 *                    who opted to meet outside — no need for a distance figure).
 *      'distance' -> "X.X mi to reach" (rider's view of a driver they'd meet outside).
 */
function badgeText(home, personCoord, badge) {
  if (!badge || !home || !personCoord) return null;
  if (badge.kind === "pickup") {
    const mins = estimateMinutes(home, personCoord);
    return mins == null ? null : `+${mins} min`;
  }
  if (badge.kind === "meet_outside") {
    if (badge.meetOutsideDisplay === "distance") {
      const miles = formatMiles(haversineMiles(home, personCoord));
      return miles ? `${miles} to reach` : null;
    }
    return "I can reach your apartment";
  }
  return null;
}

export function MapLegend() {
  const items = [
    { swatch: "#12172B", ring: ROUTE_COLOR, label: "Home / route" },
    { swatch: "#12172B", ring: "#F6B62D", label: "Destination" },
    { swatch: "#12172B", ring: MATCH_COLOR, label: "Matches your availability" },
    { swatch: "#12172B", ring: NO_MATCH_COLOR, label: "No match" },
  ];
  return (
    <div className="row" style={{ gap: 14, flexWrap: "wrap", marginTop: 10 }}>
      {items.map((it) => (
        <span key={it.label} className="row" style={{ gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: it.swatch,
              border: `2px solid ${it.ring}`,
              display: "inline-block",
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function FitBounds({ points }) {
  const map = useMap();
  const signature = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return null;
}

/**
 * A schematic commute map: your home, your destination (campus), and other
 * people (drivers or riders) color-coded by whether they match your
 * availability. Uses free OpenStreetMap tiles + Nominatim geocoding (via
 * the backend /geocode proxy) — no API key, no paid mapping service.
 *
 * Green/gray here is a deliberate, narrow exception to the app's
 * "no green" rule: it's a functional match/no-match signal on the map,
 * not part of the general UI palette.
 */
export default function CampusMap({
  homeAddress,
  destinationAddress,
  others = [], // [{ id, address, matching, kind: 'driver'|'rider', name?, badge?: {kind:'pickup'|'meet_outside', meetOutsideDisplay?} }]
  routeStops = [], // [address, ...] already-booked stops along the route (rider's view of a driver's route)
  variant = "compact", // "compact" | "expanded"
  onExpandRequest,
  emptyHint,
}) {
  const [coords, setCoords] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const addressList = useMemo(() => {
    const list = [homeAddress, destinationAddress, ...others.map((o) => o.address), ...routeStops];
    return list.filter(Boolean);
  }, [homeAddress, destinationAddress, others, routeStops]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    geocodeMany(addressList).then((map) => {
      if (!cancelled) {
        setCoords(map);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressList.join("|")]);

  const home = homeAddress ? coords.get(homeAddress) : null;
  const dest = destinationAddress ? coords.get(destinationAddress) : null;
  const stopCoords = routeStops.map((a) => coords.get(a)).filter(Boolean);
  const othersWithCoords = others
    .map((o) => ({ ...o, coord: coords.get(o.address) }))
    .filter((o) => o.coord);

  const allPoints = [home, dest, ...stopCoords, ...othersWithCoords.map((o) => o.coord)].filter(Boolean);

  const routeLine = home && dest ? [home, ...stopCoords, dest] : null;
  const interactive = variant === "expanded";
  const height = variant === "expanded" ? "100%" : "clamp(220px, 38vh, 340px)";

  return (
    <div style={{ position: "relative", height, borderRadius: variant === "expanded" ? 0 : "var(--radius-lg)", overflow: "hidden" }}>
      {loading && allPoints.length === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface)",
            zIndex: 2,
          }}
        >
          <div className="spinner" />
        </div>
      ) : allPoints.length === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface)",
            color: "var(--text-muted)",
            fontSize: 13,
            textAlign: "center",
            padding: 20,
          }}
        >
          {emptyHint || "Add an address to see it on the map."}
        </div>
      ) : (
        <MapContainer
          center={home ? [home.lat, home.lng] : [34.07, -118.44]}
          zoom={13}
          style={{ height: "100%", width: "100%", background: "#0A0E1A" }}
          zoomControl={interactive}
          dragging={interactive}
          scrollWheelZoom={interactive}
          doubleClickZoom={interactive}
          touchZoom={interactive}
          attributionControl={interactive}
        >
          {/* Esri's free dark-canvas tiles — no API key needed (unlike CARTO's
              basemaps.cartocdn.com, which now requires one). Base layer +
              a separate transparent reference layer for labels. */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS community"
          />
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />
          <FitBounds points={allPoints} />

          {routeLine && <Polyline positions={routeLine.map((p) => [p.lat, p.lng])} pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.85 }} />}

          {home && <Marker position={[home.lat, home.lng]} icon={HOME_ICON} />}
          {dest && <Marker position={[dest.lat, dest.lng]} icon={DEST_ICON} />}
          {stopCoords.map((c, i) => (
            <Marker key={`stop-${i}`} position={[c.lat, c.lng]} icon={STOP_ICON} />
          ))}

          {othersWithCoords.map((o) => {
            const text = [o.name, badgeText(home, o.coord, o.badge)].filter(Boolean).join(" · ");
            return (
              <Marker key={o.id} position={[o.coord.lat, o.coord.lng]} icon={personIcon(o.matching, o.kind)}>
                {text && (
                  <Tooltip permanent direction="right" offset={[14, 0]} className="cc-map-tooltip">
                    {text}
                  </Tooltip>
                )}
              </Marker>
            );
          })}
        </MapContainer>
      )}

      {!interactive && (
        <button
          type="button"
          onClick={onExpandRequest}
          aria-label="Expand map"
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            zIndex: 3,
            padding: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              background: "rgba(10,14,26,0.85)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 999,
            }}
          >
            🔍 Tap to expand
          </span>
        </button>
      )}

      <style>{`
        .cc-map-tooltip {
          background: rgba(10,14,26,0.92) !important;
          border: 1px solid var(--border) !important;
          color: #fff !important;
          font-size: 11.5px !important;
          padding: 3px 8px !important;
          border-radius: 999px !important;
          box-shadow: none !important;
        }
        .cc-map-tooltip::before { display: none !important; }
        .leaflet-control-attribution {
          background: rgba(10,14,26,0.7) !important;
          color: var(--text-muted) !important;
        }
        .leaflet-control-attribution a { color: var(--text-muted) !important; }
      `}</style>
    </div>
  );
}
