// Shared Google Maps JS SDK config — CampusMap (the map itself) and
// RouteSearchBar (address autocomplete) both call useJsApiLoader, and the
// library only avoids re-loading the script (and warning about it) when
// every caller passes the exact same `id` plus a stable `libraries` array
// reference, so those live here once instead of being redefined per file.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const GOOGLE_MAPS_LOADER_ID = "carpoolcampus-google-maps";
export const GOOGLE_MAPS_LIBRARIES = ["places"];
