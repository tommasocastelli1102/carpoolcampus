export function StarDisplay({ value = 0, size = 15 }) {
  const rounded = Math.round(value || 0);
  return (
    <span className="stars" style={{ fontSize: size }}>
      {"★".repeat(rounded)}
      {"☆".repeat(Math.max(0, 5 - rounded))}
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
            style={{ marginRight: 4 }}
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
