export function SteeringWheelIcon({ size = 40, color = "var(--primary-hover)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" stroke={color} strokeWidth="1.6" />
      <path
        d="M12 3.6v6M6.3 16.2l3.9-2.7M17.7 16.2l-3.9-2.7"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9 20.2c1 .35 2 .35 3 .35s2 0 3-.35" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DenyIcon({ size = 40, color = "var(--danger)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M5.8 5.8l12.4 12.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CarIcon({ size = 40, color = "var(--primary-hover)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M3.5 14.5l1.3-4.4A2.2 2.2 0 0 1 6.9 8.5h10.2a2.2 2.2 0 0 1 2.1 1.6l1.3 4.4"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="2.6" y="14.5" width="18.8" height="4.4" rx="1.4" stroke={color} strokeWidth="1.6" />
      <circle cx="7" cy="19.1" r="1.5" fill="var(--bg)" stroke={color} strokeWidth="1.6" />
      <circle cx="17" cy="19.1" r="1.5" fill="var(--bg)" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
