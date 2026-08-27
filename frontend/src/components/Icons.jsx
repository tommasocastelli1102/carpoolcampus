export function BellIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M6 10a6 6 0 1 1 12 0c0 3.4 1 5.2 1.8 6.2.4.5.1 1.3-.6 1.3H4.8c-.7 0-1-.8-.6-1.3C5 15.2 6 13.4 6 10z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 20a2.5 2.5 0 0 0 5 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="8.2" r="3.4" stroke={color} strokeWidth="1.6" />
      <path d="M4.6 19.4c1.2-3.6 4-5.4 7.4-5.4s6.2 1.8 7.4 5.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

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

export function EyeIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function EyeOffIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M3.5 3.5l17 17M10.6 10.7a3 3 0 0 0 4.2 4.2M7.4 7.5C4.7 9 3 12 3 12s3.6 7 10 7c1.6 0 3-.3 4.2-.8M17 6.3C15.7 5.5 14 5 12 5c-.7 0-1.4.06-2 .17M21 12s-1 2-3 3.6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12 4v16M4 12h16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function XIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M5 5l14 14M19 5L5 19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
