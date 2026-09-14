/**
 * Local icon set.
 *
 * Intentionally dependency-free. An earlier build used lucide-react, which
 * threw an internal `useContext` error against React 19 on the client's
 * machine; hand-rolled SVGs remove that failure mode entirely and keep the
 * bundle smaller.
 *
 * Every icon inherits `currentColor`, so colour is controlled with Tailwind
 * text utilities (e.g. `text-brand-500`).
 */
function Svg({ size = 20, className = '', children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const MenuIcon = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const StarIcon = ({ filled = false, ...p }) => (
  <Svg {...p}>
    <path
      d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 16.9 6.4 20l1.4-6.2-4.8-4.3 6.4-.6L12 3z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </Svg>
);

export const MapPinIcon = (p) => (
  <Svg {...p}>
    <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

export const PhoneIcon = (p) => (
  <Svg {...p}>
    <path
      d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.2 2 2 0 014.11 2h3a2 2 0 012 1.72c.12.9.34 1.79.65 2.65a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.43-1.22a2 2 0 012.11-.45c.86.31 1.75.53 2.65.65A2 2 0 0122 16.92z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </Svg>
);

export const MailIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3.5 7l8.5 6.5L20.5 7" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

export const ClockIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

export const CalendarIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

export const UsersIcon = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="17" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M15.5 15c2.5.3 4.5 2 4.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

export const BedIcon = (p) => (
  <Svg {...p}>
    <path
      d="M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6M3 18h18M3 18v2M21 18v2M7 10V7a2 2 0 012-2h6a2 2 0 012 2v3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronLeftIcon = (p) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronRightIcon = (p) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const AlertIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" />
  </Svg>
);

export const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

export const SpinnerIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** Tala means "star" — the brand mark is an eight-point star. */
export function TalaMark({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M20 1.5l3.2 11.1 8.2-6.1-4.9 9.5 11.1-1.8-9.9 5.8 9.9 5.8-11.1-1.8 4.9 9.5-8.2-6.1L20 38.5l-3.2-11.1-8.2 6.1 4.9-9.5L2.4 25.8l9.9-5.8-9.9-5.8 11.1 1.8-4.9-9.5 8.2 6.1L20 1.5z"
      />
    </svg>
  );
}

/* ---- Service icons (What We Cater section) ---- */

export const RingsIcon = (p) => (
  <Svg {...p}>
    <circle cx="8.5" cy="15.5" r="4.5" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="15.5" cy="15.5" r="4.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9 11L11.5 4l2.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const BriefcaseIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="7.5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 7.5V6a2 2 0 012-2h4a2 2 0 012 2v1.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 12.5h18" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

export const CakeIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M12 3.5c-.6.6-.6 1.4 0 2s.6 1.4 0 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <rect x="4" y="12" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 16c1.5-1 2.5 1 4 0s2.5-1 4 0 2.5-1 4 0 2.5-1 4 0" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 12V9.5a1.5 1.5 0 013 0V12M13 12V9.5a1.5 1.5 0 013 0V12" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

export const HomeHeartIcon = (p) => (
  <Svg {...p}>
    <path d="M4 11l8-7 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M12 18s-2.8-1.7-2.8-3.6c0-1 .8-1.7 1.7-1.7.5 0 1 .3 1.1.6.1-.3.6-.6 1.1-.6.9 0 1.7.7 1.7 1.7C14.8 16.3 12 18 12 18z"
      fill="currentColor"
      stroke="none"
    />
  </Svg>
);

export const SlidersIcon = (p) => (
  <Svg {...p}>
    <path d="M4 6h10M17 6h3M4 12h5M12 12h8M4 18h13M20 18h0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="8" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="16" cy="18" r="2" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

export const ChevronDownIcon = (p) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CalculatorIcon = (p) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8.5" cy="12" r="0.9" fill="currentColor" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    <circle cx="15.5" cy="12" r="0.9" fill="currentColor" />
    <circle cx="8.5" cy="15.5" r="0.9" fill="currentColor" />
    <circle cx="12" cy="15.5" r="0.9" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="0.9" fill="currentColor" />
  </Svg>
);
