// Shared between the rider and driver dashboards' from/to search bar: a
// quick way to tell whether a route's text is "campus" without geocoding,
// plus the canonical search text the Campus/Home shortcut buttons fill in.
const CAMPUS_KEYWORDS = ["ucla", "anderson", "campus", "westwood plaza", "hilgard"];

export function isCampusText(text) {
  const t = (text || "").toLowerCase();
  return CAMPUS_KEYWORDS.some((kw) => t.includes(kw));
}

// Filled into the From/To field by the "🎓 Campus" shortcut — matches every
// seeded campus route ("UCLA Anderson", "UCLA Campus", ...) via the
// backend's ILIKE substring search.
export const CAMPUS_SEARCH_TEXT = "UCLA";
