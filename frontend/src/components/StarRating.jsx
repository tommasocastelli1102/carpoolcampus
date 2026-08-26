/** One star: full gold, half gold/gray split, or empty gray — never mixes
 * "filled" color into an unfilled star, so a 3.5 always reads as exactly
 * 3 gold + 1 half + 1 gray at a glance. */
function Star({ type, size }) {
  if (type === "full") {
    return <span style={{ color: "var(--warning)" }}>★</span>;
  }
  if (type === "half") {
    return (
      <span style={{ position: "relative", display: "inline-block", width: "1em", height: "1em", lineHeight: 1 }}>
        <span style={{ position: "absolute", inset: 0, color: "var(--border)" }}>★</span>
        <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden", color: "var(--warning)" }}>★</span>
      </span>
    );
  }
  return <span style={{ color: "var(--border)" }}>★</span>;
}

/** value: 0-5, half-star precision (e.g. 3.5 -> ★★★⯪☆). */
export function StarDisplay({ value = 0, size = 15 }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const rounded = Math.round(rating * 2) / 2; // snap to nearest half-star
  const fullCount = Math.floor(rounded);
  const hasHalf = rounded % 1 !== 0;
  const emptyCount = 5 - fullCount - (hasHalf ? 1 : 0);

  const stars = [
    ...Array(fullCount).fill("full"),
    ...(hasHalf ? ["half"] : []),
    ...Array(emptyCount).fill("empty"),
  ];

  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {stars.map((type, i) => (
        <Star key={i} type={type} size={size} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, label }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="stars" style={{ fontSize: 26, cursor: "pointer" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            onClick={() => onChange(n)}
            style={{ marginRight: 4, color: n <= value ? "var(--warning)" : "var(--border)" }}
            role="button"
            aria-label={`${n} star`}
          >
            {n <= value ? "★" : "☆"}
          </span>
        ))}
      </div>
    </div>
  );
}
