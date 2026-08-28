import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, OverlayView, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { geocodeMany } from "../api/geocode";
import { estimateMinutes, haversineMiles, formatMiles } from "../lib/geo";

const ROUTE_COLOR = "#2D6CF6"; // var(--primary)
const DEST_COLOR = "#F6B62D";
const MATCH_COLOR = "#3FA66A"; // muted green, used only for map match/no-match status — the one
const NO_MATCH_COLOR = "#5B6479"; // deliberate exception to the app's no-green rule (see docs below)

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_LIBRARIES = []; // stable reference — recreating this array on every render forces useJsApiLoader to reload the script

// A dark map style approximating the app's own dark theme (--bg/--surface/
// --border/--text-muted), since Google's default basemap is white.
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#12172b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0e1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a9b0c3" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#232a4a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#232a4a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7c85a3" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2a3155" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#333c66" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0e1a" }] },
];

/** Centers a div (of `size`px) on its lat/lng instead of Google's default
 * top-left anchoring — same effect as Leaflet's iconAnchor. */
function centerOffset(width, height) {
  return { x: -(width / 2), y: -(height / 2) };
}

function PinBadge({ emoji, photoUrl, ring, size = 30 }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#12172B",
        border: `2.5px solid ${ring}`,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.52),
      }}
    >
      {photoUrl && !photoFailed ? (
        <img
          src={photoUrl}
          alt=""
          onError={() => setPhotoFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        emoji
      )}
    </div>
  );
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

function ratingText(rating) {
  const n = Number(rating);
  return n > 0 ? `★${n.toFixed(1)}` : null;
}

export function MapLegend() {
  const items = [
    { swatch: "#12172B", ring: ROUTE_COLOR, label: "Home / route" },
    { swatch: "#12172B", ring: DEST_COLOR, label: "Destination" },
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

/**
 * A schematic commute map: your home, your destination (campus), and other
 * people (drivers or riders) color-coded by whether they match your
 * availability. Uses the Google Maps JavaScript API for the basemap, and
 * the existing free Nominatim proxy (backend /geocode) for turning
 * addresses into coordinates — Google's Maps JS key is browser/domain-
 * restricted and isn't usable for the backend's server-side geocoding
 * calls anyway, so that half of the pipeline is unchanged.
 *
 * Green/gray here is a deliberate, narrow exception to the app's
 * "no green" rule: it's a functional match/no-match signal on the map,
 * not part of the general UI palette.
 */
export default function CampusMap({
  homeAddress,
  destinationAddress,
  others = [], // [{ id, address, matching, kind: 'driver'|'rider', name?, rating?, photoUrl?, availabilityText?, badge?: {kind:'pickup'|'meet_outside', meetOutsideDisplay?} }]
  routeStops = [], // [address, ...] already-booked stops along the route (rider's view of a driver's route)
  variant = "compact", // "compact" | "expanded"
  onExpandRequest,
  onPersonClick, // (person) => void — only fires once the map is interactive (expanded); compact mode's whole surface is a tap-to-expand target
  emptyHint,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "carpoolcampus-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [coords, setCoords] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false); // true once the map instance actually exists — see note by <GoogleMap> below
  const mapRef = useRef(null);

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
  const pointsSignature = allPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");

  // Fit the map to whatever's currently plotted, same as Leaflet's
  // fitBounds — re-runs whenever the actual set of points changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google || allPoints.length === 0) return;
    if (allPoints.length === 1) {
      map.setCenter({ lat: allPoints[0].lat, lng: allPoints[0].lng });
      map.setZoom(13);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    allPoints.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 32);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsSignature, isLoaded]);

  const routeLine = home && dest ? [home, ...stopCoords, dest] : null;
  const interactive = variant === "expanded";
  const height = variant === "expanded" ? "100%" : "clamp(220px, 38vh, 340px)";

  const mapOptions = useMemo(
    () => ({
      styles: DARK_MAP_STYLE,
      disableDefaultUI: !interactive,
      zoomControl: interactive,
      draggable: interactive,
      scrollwheel: interactive,
      disableDoubleClickZoom: !interactive,
      gestureHandling: interactive ? "greedy" : "none",
      clickableIcons: false,
      backgroundColor: "#0A0E1A",
    }),
    [interactive]
  );

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: variant === "expanded" ? 0 : "var(--radius-lg)",
        overflow: "hidden",
        isolation: "isolate",
        zIndex: 0,
      }}
    >
      {!GOOGLE_MAPS_API_KEY || loadError ? (
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
          {loadError ? "Couldn't load Google Maps." : "Map unavailable — no Google Maps API key configured."}
        </div>
      ) : (loading && allPoints.length === 0) || !isLoaded ? (
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
        <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={home ? { lat: home.lat, lng: home.lng } : { lat: 34.07, lng: -118.44 }}
          zoom={13}
          options={mapOptions}
          onLoad={(map) => {
            mapRef.current = map;
            // OverlayView children mounted in the same tick as the map
            // instance being created can fail to position themselves (no
            // projection yet) and never draw — gating them on this instead
            // of just `isLoaded` fixed pins silently going missing.
            setMapReady(true);
          }}
          onUnmount={() => {
            mapRef.current = null;
            setMapReady(false);
          }}
        >
          {mapReady && routeLine && (
            <Polyline
              path={routeLine.map((p) => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: ROUTE_COLOR, strokeWeight: 4, strokeOpacity: 0.85 }}
            />
          )}
          {mapReady && (
            <>
              {home && (
                <OverlayView
                  key="home-pin"
                  position={{ lat: home.lat, lng: home.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={centerOffset}
                >
                  <PinBadge emoji="🏠" ring={ROUTE_COLOR} size={32} />
                </OverlayView>
              )}
              {dest && (
                <OverlayView
                  key="dest-pin"
                  position={{ lat: dest.lat, lng: dest.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={centerOffset}
                >
                  <PinBadge emoji="🎓" ring={DEST_COLOR} size={32} />
                </OverlayView>
              )}
              {stopCoords.map((c, i) => (
                <OverlayView
                  key={`stop-${i}`}
                  position={{ lat: c.lat, lng: c.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={centerOffset}
                >
                  <PinBadge emoji="📍" ring={ROUTE_COLOR} size={22} />
                </OverlayView>
              ))}
              {othersWithCoords.map((o) => {
                // Compact, always-visible label: name + rating + the +min/distance badge.
                const nameWithRating = [o.name, ratingText(o.rating)].filter(Boolean).join(" ");
                const text = [nameWithRating, badgeText(home, o.coord, o.badge)].filter(Boolean).join(" · ");
                // Hover-only (native title attribute): when they're available, and
                // that clicking sends a request — shown "on overlay" per spec,
                // without permanently cluttering the map with every driver's hours.
                const hoverParts = [o.availabilityText];
                if (interactive && onPersonClick) hoverParts.push("Click to send a ride request");
                const hoverTitle = hoverParts.filter(Boolean).join(" — ");
                return (
                  <OverlayView
                    key={o.id}
                    position={{ lat: o.coord.lat, lng: o.coord.lng }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={centerOffset}
                  >
                    <div
                      title={hoverTitle || undefined}
                      onClick={onPersonClick ? () => onPersonClick(o) : undefined}
                      style={{ position: "relative", cursor: onPersonClick ? "pointer" : "default" }}
                    >
                      <PinBadge emoji={o.kind === "driver" ? "🚗" : "🎒"} photoUrl={o.photoUrl} ring={o.matching ? MATCH_COLOR : NO_MATCH_COLOR} size={30} />
                      {text && (
                        <span
                          style={{
                            position: "absolute",
                            left: "calc(100% + 8px)",
                            top: "50%",
                            transform: "translateY(-50%)",
                            whiteSpace: "nowrap",
                            background: "rgba(10,14,26,0.92)",
                            border: "1px solid var(--border)",
                            color: "#fff",
                            fontSize: 11.5,
                            padding: "3px 8px",
                            borderRadius: 999,
                          }}
                        >
                          {text}
                        </span>
                      )}
                    </div>
                  </OverlayView>
                );
              })}
            </>
          )}
        </GoogleMap>
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
    </div>
  );
}
