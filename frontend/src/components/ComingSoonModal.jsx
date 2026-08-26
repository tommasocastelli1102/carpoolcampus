export default function ComingSoonModal({ title = "We're working on it!", message = "Available soon.", onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <h3 style={{ marginBottom: 8 }}>{title}</h3>
        <p className="muted" style={{ marginBottom: 22 }}>
          {message}
        </p>
        <button className="btn btn-primary btn-block" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
