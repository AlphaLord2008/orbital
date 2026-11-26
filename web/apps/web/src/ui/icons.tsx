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
export const ViewTop = () => (
  <svg {...P}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);
export const ViewOblique = () => (
  <svg {...P}>
    <ellipse cx="12" cy="12" rx="9" ry="4" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);
export const ViewFit = () => (
  <svg {...P}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
