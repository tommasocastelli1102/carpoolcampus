// Small geo helpers for the map: distance + a rough drive-time estimate.
// No routing API involved — straight-line distance at an assumed average
// city-driving speed. Good enough for a "+X min" badge, not turn-by-turn.

const EARTH_RADIUS_MI = 3958.8;
const ASSUMED_AVG_SPEED_MPH = 22; // city driving with stops/lights

export function haversineMiles(a, b) {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_MI * c;
}

export function estimateMinutes(a, b) {
  const miles = haversineMiles(a, b);
  if (miles == null) return null;
  return Math.max(1, Math.round((miles / ASSUMED_AVG_SPEED_MPH) * 60));
}

export function formatMiles(miles) {
  if (miles == null) return null;
  return miles < 0.1 ? "<0.1 mi" : `${miles.toFixed(1)} mi`;
}

export function milesToKm(miles) {
  return miles == null ? null : miles * 1.60934;
}

// EPA's cited average for a typical passenger vehicle is ~404 g CO2/mile
// (~251 g/km). Each completed carpool trip is treated as one avoided
// solo-car trip of the same distance — a documented estimate, not a
// precise per-driver emissions model.
const CO2_G_PER_KM = 251;

export function co2SavedKg(totalKm) {
  return (totalKm * CO2_G_PER_KM) / 1000;
}
