/**
 * Share link, schema v1 (WA-F12, WA-E6). The query carries the full scenario as canonical float64
 * values (shortest round-trip decimal), so opening a link reproduces the identical run and tier.
 *   ?v=1&h=<altitude m>&k=<speed factor>&dt=<s>&d=<orbits>o | <seconds>s&m=e|a
 * At most 512 characters; strict decimal grammar; out-of-range values rejected with a message;
 * unknown keys ignored.
 */
import { FIELDS, rangeMessage } from './schema';
import type { Scenario } from './scenario';

export const URL_MAX = 512;
const DECIMAL = /^\d+(\.\d+)?$/;

export type Decoded =
  | { ok: true; scenario: Scenario; mode: 'explore' | 'analyze' | null }
  | { ok: false; message: string }
  | { ok: 'empty' };

export function encodeScenario(s: Scenario, mode: 'explore' | 'analyze'): string {
  const d = s.duration.kind === 'orbits' ? `${String(s.duration.n)}o` : `${String(s.duration.s)}s`;
  return `?v=1&h=${String(s.altitudeM)}&k=${String(s.k)}&dt=${String(s.dtS)}&d=${d}&m=${mode === 'analyze' ? 'a' : 'e'}`;
}

function num(q: URLSearchParams, key: string, label: string): number | string {
  const raw = q.get(key);
  if (raw === null) return `The link has no ${label}.`;
  if (!DECIMAL.test(raw))
    return `The link's ${label} "${raw.slice(0, 24)}" is not a plain decimal number.`;
  return Number(raw);
}

export function decodeScenario(search: string): Decoded {
  if (search === '' || search === '?') return { ok: 'empty' };
  if (search.length > URL_MAX)
    return { ok: false, message: `The link is longer than ${String(URL_MAX)} characters.` };
  const q = new URLSearchParams(search);
  if (!q.has('v')) return { ok: 'empty' };
  if (q.get('v') !== '1')
    return {
      ok: false,
      message: `This link uses schema version ${String(q.get('v'))}; this site reads version 1.`,
    };
  const h = num(q, 'h', 'altitude');
  const k = num(q, 'k', 'speed factor');
  const dt = num(q, 'dt', 'time step');
  for (const v of [h, k, dt]) if (typeof v === 'string') return { ok: false, message: v };
  const hm = h as number;
  if (hm < FIELDS.altitude.min * 1000 || hm > FIELDS.altitude.max * 1000)
    return { ok: false, message: `Link altitude: ${rangeMessage(FIELDS.altitude)}` };
  if ((k as number) < FIELDS.k.min || (k as number) > FIELDS.k.max)
    return { ok: false, message: `Link speed factor: ${rangeMessage(FIELDS.k)}` };
  if ((dt as number) < FIELDS.dt.min || (dt as number) > FIELDS.dt.max)
    return { ok: false, message: `Link time step: ${rangeMessage(FIELDS.dt)}` };
  const draw = q.get('d') ?? '';
  const m = /^(\d+(?:\.\d+)?)([os])$/.exec(draw);
  if (!m)
    return {
      ok: false,
      message: 'The link\'s duration must be a number followed by "o" (orbits) or "s" (seconds).',
    };
  const dv = Number(m[1]);
  const field = m[2] === 'o' ? FIELDS.orbits : FIELDS.seconds;
  if (dv < field.min || dv > field.max)
    return { ok: false, message: `Link duration: ${rangeMessage(field)}` };
  const mode = q.get('m') === 'a' ? 'analyze' : q.get('m') === 'e' ? 'explore' : null;
  return {
    ok: true,
    scenario: {
      altitudeM: hm,
      k: k as number,
      dtS: dt as number,
      duration: m[2] === 'o' ? { kind: 'orbits', n: dv } : { kind: 'seconds', s: dv },
    },
    mode,
  };
}
