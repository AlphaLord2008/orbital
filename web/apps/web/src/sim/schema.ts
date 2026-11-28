/**
 * The one input schema (WA-E1): every input's range, unit and grammar, used by the fields, the
 * URL codec and the run builder. Out-of-range values are rejected with a message, never clamped.
 */
import type { Duration, Scenario } from './scenario';

export interface FieldSpec {
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  /** Decimals shown in the field and the slider's snapping precision. */
  readonly digits: number;
  /** Slider mapping: logarithmic for quantities spanning decades. */
  readonly scale: 'linear' | 'log';
}

export const FIELDS = {
  altitude: { label: 'Altitude', unit: 'km', min: 100, max: 100_000, digits: 3, scale: 'log' },
  k: { label: 'Speed factor', unit: '×', min: 0.5, max: 1.6, digits: 3, scale: 'linear' },
  dt: { label: 'Time step', unit: 's', min: 0.1, max: 300, digits: 1, scale: 'log' },
  orbits: { label: 'Duration', unit: 'orbits', min: 0.01, max: 1000, digits: 2, scale: 'log' },
  seconds: { label: 'Duration', unit: 's', min: 1, max: 315_576_000, digits: 0, scale: 'log' },
} as const satisfies Record<string, FieldSpec>;

export type FieldId = keyof typeof FIELDS;

/** Strict decimal grammar (WA-E6): digits with an optional fraction. No signs, exponents or spaces inside. */
const DECIMAL = /^\d+(\.\d+)?$/;

export type Parsed = { ok: true; value: number } | { ok: false; message: string };

const fmtLimit = (x: number) => x.toLocaleString('en-US').replace(/,/g, ' ');

export function rangeMessage(f: FieldSpec): string {
  return `Enter ${fmtLimit(f.min)} to ${fmtLimit(f.max)} ${f.unit}.`;
}

export function parseField(id: FieldId, text: string): Parsed {
  const f = FIELDS[id];
  const t = text.trim();
  if (!DECIMAL.test(t))
    return { ok: false, message: `${rangeMessage(f)} Digits and one decimal point only.` };
  const value = Number(t);
  if (!Number.isFinite(value) || value < f.min || value > f.max)
    return { ok: false, message: rangeMessage(f) };
  return { ok: true, value };
}

/** Slider position u ∈ [0, 1] ↔ value, snapped to the field's displayed precision. */
export function fromSlider(id: FieldId, u: number): number {
  const f = FIELDS[id];
  const raw = f.scale === 'log' ? f.min * (f.max / f.min) ** u : f.min + (f.max - f.min) * u;
  const snapped = Number(raw.toFixed(f.digits));
  return Math.min(f.max, Math.max(f.min, snapped));
}

export function toSlider(id: FieldId, value: number): number {
  const f = FIELDS[id];
  const u =
    f.scale === 'log'
      ? Math.log(value / f.min) / Math.log(f.max / f.min)
      : (value - f.min) / (f.max - f.min);
  return Math.min(1, Math.max(0, u));
}

export function durationField(d: Duration): FieldId {
  return d.kind === 'orbits' ? 'orbits' : 'seconds';
}

/** Scenario values (SI) ↔ field values (display units). */
export function fieldValue(s: Scenario, id: FieldId): number {
  switch (id) {
    case 'altitude':
      return s.altitudeM / 1000;
    case 'k':
      return s.k;
    case 'dt':
      return s.dtS;
    case 'orbits':
      return s.duration.kind === 'orbits' ? s.duration.n : NaN;
    case 'seconds':
      return s.duration.kind === 'seconds' ? s.duration.s : NaN;
  }
}

export function withField(s: Scenario, id: FieldId, v: number): Scenario {
  switch (id) {
    case 'altitude':
      return { ...s, altitudeM: v * 1000 };
    case 'k':
      return { ...s, k: v };
    case 'dt':
      return { ...s, dtS: v };
    case 'orbits':
      return { ...s, duration: { kind: 'orbits', n: v } };
    case 'seconds':
      return { ...s, duration: { kind: 'seconds', s: v } };
  }
}
