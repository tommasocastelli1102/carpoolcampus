import { isCampusText, CAMPUS_SEARCH_TEXT } from "../lib/campus";

/** The one shared "Uber-style" interaction surface for both dashboards:
 * a From/To field pair plus two one-tap shortcuts for the two routes
 * everyone actually takes — to campus, or back home — so there's no need
 * for a separate "other destination" input. Typing anything else directly
 * into From/To already covers every other case.
 *
 * Riders search existing routes with this; drivers use the identical bar
 * to describe the route they're offering. `submitLabel` and the
 * placeholders are the only things that differ between the two.
 */
export default function RouteSearchBar({
  from,
  to,
  onFromChange,
  onToChange,
  onCampus,
  onHome,
  onSubmit,
  submitLabel = "Search",
  fromPlaceholder = "From…",
  toPlaceholder = "To…",
  children, // optional extra fields (e.g. driver's day/time/seats row)
}) {
  const campusActive = isCampusText(to);
  const homeActive = isCampusText(from);

  return (
    <div className="card-flat" style={{ marginBottom: 20 }}>
      <form onSubmit={onSubmit} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <input
          placeholder={fromPlaceholder}
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          style={{ flex: "1 1 140px", minWidth: 0 }}
        />
        <input
          placeholder={toPlaceholder}
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          style={{ flex: "1 1 140px", minWidth: 0 }}
        />
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          <ShortcutButton active={campusActive} onClick={onCampus}>
            🎓 Campus
          </ShortcutButton>
          <ShortcutButton active={homeActive} onClick={onHome}>
            🏠 Home
          </ShortcutButton>
        </div>
        <button className="btn btn-primary" style={{ flexShrink: 0 }}>
          {submitLabel}
        </button>
        {children}
      </form>
    </div>
  );
}

function ShortcutButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-sm"
      style={{
        flexShrink: 0,
        whiteSpace: "nowrap",
        background: active ? "var(--primary)" : "transparent",
        color: active ? "#fff" : "var(--text-muted)",
        border: active ? "none" : "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

export { CAMPUS_SEARCH_TEXT };
