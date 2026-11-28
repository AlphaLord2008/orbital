import type { Evidence } from './tiers';

const Check = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M3.5 8.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Flask = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M6 2.5h4M6.8 2.5v4L3.5 12.6a1 1 0 0 0 .9 1.4h7.2a1 1 0 0 0 .9-1.4L9.2 6.5v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);
const Ring = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle
      cx="8"
      cy="8"
      r="5.25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeDasharray="2.4 2"
    />
  </svg>
);

export function TierBadge({ ev }: { ev: Evidence }) {
  const cls = ev.tier === 1 ? 'validated' : ev.tier === 2 ? 'tested' : 'unvalidated';
  return (
    <span className={`orb-tier orb-tier--${cls}`} data-tier={ev.tier}>
      {ev.tier === 1 ? <Check /> : ev.tier === 2 ? <Flask /> : <Ring />}
      {ev.label}
      {ev.id ? <span className="orb-tier__id">{ev.id}</span> : null}
    </span>
  );
}

export function StatusDone({ text }: { text: string }) {
  return (
    <span className="orb-status orb-status--done">
      <Check />
      {text}
    </span>
  );
}
