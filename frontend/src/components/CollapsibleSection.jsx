import { useState } from "react";
import { ChevronIcon } from "./Icons";

/** A `.card` section with a clickable header that shows/hides its content.
 * Closed by default. Uncontrolled unless `open`/`onOpenChange` are both
 * passed (used by "Incoming requests" so the top "Requests" button can
 * force it open when jumped to). `id` goes on the outer wrapper so an
 * in-page anchor (`href="#id"`) still scrolls to the right place while
 * collapsed. */
export default function CollapsibleSection({
  title,
  id,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  style,
  children,
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const toggle = () => (isControlled ? onOpenChange(!open) : setOpenState((v) => !v));

  return (
    <div id={id} className="card" style={{ marginBottom: 20, ...style }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
        }}
      >
        <h2 style={{ fontSize: 20, margin: 0 }}>{title}</h2>
        <span
          style={{
            display: "flex",
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        >
          <ChevronIcon />
        </span>
      </button>

      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}
