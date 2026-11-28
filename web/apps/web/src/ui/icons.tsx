/** Inline stroke icons from the design system (1.5 px, currentColor). */
const P = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const Explore = () => (
  <svg {...P}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </svg>
);
export const Analyze = () => (
  <svg {...P}>
    <path d="M5 7h9M18 7h1M5 17h3M12 17h7" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const Play = () => (
  <svg {...P}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const Pause = () => (
  <svg {...P}>
    <rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" />
  </svg>
);
export const StepBack = () => (
  <svg {...P}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const StepFwd = () => (
  <svg {...P}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const RevBack = () => (
  <svg {...P}>
    <path d="M18 6l-6 6 6 6M11 6l-6 6 6 6" />
  </svg>
);
export const RevFwd = () => (
  <svg {...P}>
    <path d="M6 6l6 6-6 6M13 6l6 6-6 6" />
  </svg>
);
export const Chevron = () => (
  <svg {...P}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const Table = () => (
  <svg {...P}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M3.5 10h17M3.5 14.5h17M9.5 5v14" />
  </svg>
);
export const Keyboard = () => (
  <svg {...P}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M8 14h8" />
  </svg>
);
export const Present = () => (
  <svg {...P}>
    <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
    <path d="M12 16.5V20M8.5 20h7" />
  </svg>
);
export const Link = () => (
  <svg {...P}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </svg>
);
export const Info = () => (
  <svg {...P}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const Sliders = () => (
  <svg {...P}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const Collapse = () => (
  <svg {...P}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const Close = () => (
  <svg {...P}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
