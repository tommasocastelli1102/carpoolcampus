// The rider's preferred search radius for "Choose a ride" — how far from
// the selected starting point a driver's route can be and still show up.
// Stored per-browser (not per-account) since it's just a display
// preference, editable from the profile menu.
const STORAGE_KEY = "cc_search_radius_mi";
const CHANGE_EVENT = "cc:search-radius-changed";

export const DEFAULT_SEARCH_RADIUS_MI = 1.5;

export const SEARCH_RADIUS_OPTIONS = [0.5, 1, 1.5, 3, 5, 10];

export function getSearchRadius() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEARCH_RADIUS_MI;
  } catch {
    return DEFAULT_SEARCH_RADIUS_MI;
  }
}

/** Persists the new radius and notifies any open dashboard (e.g. the
 * rider dashboard, if it's mounted at the same time as the profile
 * menu) to re-filter immediately — localStorage writes alone don't
 * trigger a re-render within the same tab. */
export function setSearchRadius(miles) {
  try {
    localStorage.setItem(STORAGE_KEY, String(miles));
  } catch {
    // Non-fatal — the in-memory value below still updates for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onSearchRadiusChange(handler) {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
