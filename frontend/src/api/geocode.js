import client from "./client";

// In-memory + sessionStorage cache so repeat views of the same address
// (across renders, tabs, and page reloads within a session) don't re-hit
// the backend/Nominatim. Keyed by the lowercased address string.
const memCache = new Map();
const STORAGE_KEY = "cc_geocode_cache_v1";

function loadStorageCache() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([k, v]) => memCache.set(k, v));
  } catch {
    // ignore — sessionStorage can throw in locked-down contexts
  }
}

function saveStorageCache() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memCache)));
  } catch {
    // ignore
  }
}

loadStorageCache();

/** Resolves an address to {lat, lng}, or null if it can't be found. */
export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;
  const key = address.trim().toLowerCase();
  if (memCache.has(key)) return memCache.get(key);

  try {
    const { data } = await client.get("/geocode", { params: { address } });
    const result = { lat: data.lat, lng: data.lng };
    memCache.set(key, result);
    saveStorageCache();
    return result;
  } catch {
    memCache.set(key, null);
    saveStorageCache();
    return null;
  }
}

/** Geocodes a list of addresses in parallel, returning a Map<address, {lat,lng}|null>. */
export async function geocodeMany(addresses) {
  const unique = [...new Set(addresses.filter(Boolean))];
  const results = await Promise.all(unique.map((addr) => geocodeAddress(addr)));
  const map = new Map();
  unique.forEach((addr, i) => map.set(addr, results[i]));
  return map;
}
