/** Values shown for the run on screen at playback time t: all read at sample k = ⌊t/Δt⌋ (R1). */
import { MU_EARTH, R_EARTH } from '@orbital/engine';
import { useMemo } from 'react';
import { evidenceFor, type Evidence } from '../evidence/tiers';
import { sampleIndex } from '../sim/display';
import type { RunResult } from '../sim/protocol';
import type { Scenario } from '../sim/scenario';
import { useStore } from '../state/store';
import { duration } from './format';

export interface SampleView {
  k: number;
  n: number;
  t: number;
  altKm: number;
  speedKms: number;
  /** Specific energy and angular momentum at sample k, from the sample's own state. */
  eps: number;
  h: number;
}

export function sampleView(r: RunResult, t: number): SampleView {
  const n = r.x.length;
  const k = sampleIndex(Math.min(t, r.tEnd), r.run.dt, n);
  const x = r.x[k] as number;
  const y = r.y[k] as number;
  const vx = r.vx[k] as number;
  const vy = r.vy[k] as number;
  const rr = Math.hypot(x, y);
  return {
    k,
    n,
    t: k * r.run.dt,
    altKm: (rr - R_EARTH) / 1000,
    speedKms: Math.hypot(vx, vy) / 1000,
    eps: 0.5 * (vx * vx + vy * vy) - MU_EARTH / rr,
    h: x * vy - y * vx,
  };
}

export function useEvidence(): Evidence | null {
  const result = useStore((s) => s.result);
  const rs = useStore((s) => s.resultScenario);
  return useMemo(() => (result && rs ? evidenceFor(rs, result.run.nSteps) : null), [result, rs]);
}

export function classification(r: RunResult): string {
  const ex = r.exact;
  if (!ex.available && Math.abs(1 - ex.e) < 1e-9) return 'Parabolic · at the escape threshold';
  if (ex.classification === 'escape') return 'Escape · hyperbolic';
  if (ex.timeToSurface !== null) return 'Bound · reaches the surface';
  return ex.e < 1e-9 ? 'Bound · circular' : 'Bound · ellipse';
}

/** The third primary readout: exact period, or exact time to the surface. */
export function thirdReadout(r: RunResult): {
  label: string;
  value: string;
  unit?: string | undefined;
} {
  const ex = r.exact;
  const v = !ex.available
    ? null
    : ex.timeToSurface !== null
      ? { label: 'Time to surface', d: ex.timeToSurface }
      : ex.period !== null
        ? { label: 'Period', d: ex.period }
        : null;
  if (!v) return { label: 'Period', value: ex.available ? 'none' : 'not computed' };
  const [value, unit] = duration(v.d).split(' ');
  return { label: v.label, value: value ?? '', unit };
}

export function same(a: Scenario | null, b: Scenario | null): boolean {
  return a === b;
}

/** Eccentricity with enough decimals that 1 − e is visible near the escape threshold (Batch B). */
export function formatE(e: number): string {
  if (e < 1e-9) return '0';
  const d = Math.min(12, Math.max(3, Math.ceil(-Math.log10(Math.max(Math.abs(1 - e), 1e-15))) + 3));
  return e.toFixed(d);
}
