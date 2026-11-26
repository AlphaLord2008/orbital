import { analytic, propagate, stepsForDuration } from '@orbital/engine';
import { describe, expect, it } from 'vitest';
import { advance, revolutionOf, sampleTime } from '../state/clock';
import {
  decimate,
  hermite,
  mustKeep,
  RDP_EPS_M,
  revolutionStarts,
  sampleIndex,
  VERTEX_CAP,
} from './display';
import { buildRun, PRESETS } from './scenario';

function runPreset(id: keyof typeof PRESETS) {
  const b = buildRun(PRESETS[id].scenario);
  if (!b.ok) throw new Error(b.message);
  const { r0, v0, dt, nSteps } = b.run;
  return { traj: propagate([...r0], [...v0], dt, nSteps), r0, v0 };
}

function distToPolyline(px: number, py: number, xs: number[], ys: number[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < xs.length; i++) {
    const ax = xs[i]!,
      ay = ys[i]!,
      bx = xs[i + 1]!,
      by = ys[i + 1]!;
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy;
    const u = Math.max(0, Math.min(1, l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0));
    best = Math.min(best, Math.hypot(px - ax - u * dx, py - ay - u * dy));
  }
  return best;
}

describe('revolution splitting (WA-D4)', () => {
  it('uses the first_period crossing rule', () => {
    const { traj, r0, v0 } = runPreset('V0');
    const starts = revolutionStarts(traj.x, traj.y);
    expect(starts[0]).toBe(0);
    expect(starts.length).toBe(10); // 10 orbits: starts at 0 and nine crossings (the 10th lands at the end or just after)
    const T = analytic.period(r0, v0);
    expect(Math.abs((traj.t[starts[1]!] as number) - T)).toBeLessThanOrEqual(traj.dt);
  });
  it('escape and impact runs are one segment', () => {
    for (const id of ['X1', 'I1'] as const)
      expect(revolutionStarts(runPreset(id).traj.x, runPreset(id).traj.y).length).toBe(1);
  });
});

describe('decimation (R3, R16) — property tests on every preset', () => {
  for (const id of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    it(`${id}: every sample within ε of the line; events kept; cap respected`, () => {
      const { traj } = runPreset(id);
      const starts = revolutionStarts(traj.x, traj.y);
      const last = traj.x.length - 1;
      for (let r = 0; r < starts.length; r++) {
        const lo = starts[r]!;
        const hi = r + 1 < starts.length ? starts[r + 1]! : last;
        const { indices, eps } = decimate(traj.x, traj.y, lo, hi);
        expect(indices.length).toBeLessThanOrEqual(VERTEX_CAP);
        expect(eps).toBe(RDP_EPS_M);
        const set = new Set(indices);
        for (const k of mustKeep(traj.x, traj.y, lo, hi)) expect(set.has(k)).toBe(true);
        expect(indices[0]).toBe(lo);
        expect(indices[indices.length - 1]).toBe(hi);
        const xs = [...indices].map((k) => traj.x[k]!);
        const ys = [...indices].map((k) => traj.y[k]!);
        // check a spread of samples (all samples for short spans)
        const stride = Math.max(1, Math.floor((hi - lo) / 4000));
        for (let k = lo; k <= hi; k += stride) {
          expect(distToPolyline(traj.x[k]!, traj.y[k]!, xs, ys)).toBeLessThanOrEqual(eps + 1e-6);
        }
      }
    });
  }
  it('keeps the impact sample', () => {
    const { traj } = runPreset('I1');
    const last = traj.x.length - 1;
    expect(decimate(traj.x, traj.y, 0, last).indices.at(-1)).toBe(last);
  });
});

describe('Hermite marker (R2)', () => {
  it('passes through the samples', () => {
    const out = new Float64Array(2);
    hermite(1, 2, 3, 4, 5, 6, 7, 8, 10, 0, out);
    expect([...out]).toEqual([1, 2]);
    hermite(1, 2, 3, 4, 5, 6, 7, 8, 10, 1, out);
    expect([...out]).toEqual([5, 6]);
  });
  it('stays on the exact orbit at Δt = 60 s (sub-metre), unlike a chord (km)', () => {
    const { r0, v0 } = { r0: [6778137, 0], v0: [0, 7668.558175407055] };
    const orbit = analytic.keplerOrbit(r0, v0);
    const a = new Float64Array(4),
      b = new Float64Array(4),
      m = new Float64Array(4),
      h = new Float64Array(2);
    let worstH = 0,
      worstLin = 0;
    for (let t = 0; t < 5400; t += 60) {
      orbit.stateAt(t, a);
      orbit.stateAt(t + 60, b);
      orbit.stateAt(t + 30, m);
      hermite(a[0]!, a[1]!, a[2]!, a[3]!, b[0]!, b[1]!, b[2]!, b[3]!, 60, 0.5, h);
      worstH = Math.max(worstH, Math.hypot(h[0]! - m[0]!, h[1]! - m[1]!));
      worstLin = Math.max(
        worstLin,
        Math.hypot((a[0]! + b[0]!) / 2 - m[0]!, (a[1]! + b[1]!) / 2 - m[1]!),
      );
    }
    expect(worstH).toBeLessThan(1);
    expect(worstLin).toBeGreaterThan(3000);
  });
});

describe('clock (R1, WA-F6)', () => {
  it('sample index of every sample time is exact', () => {
    for (const dt of [0.1, 1, 10, 60, 0.3, 7.7]) {
      for (let k = 0; k < 20000; k++) expect(sampleIndex(sampleTime(k, dt), dt, 1e9)).toBe(k);
    }
  });
  it('sample index is the latest sample at or before t, clamped', () => {
    expect(sampleIndex(15.99, 1, 100)).toBe(15);
    expect(sampleIndex(-3, 1, 100)).toBe(0);
    expect(sampleIndex(1e6, 1, 100)).toBe(99);
  });
  it('advances at the rate, fits the run into 20 s, stops at the end', () => {
    expect(advance(0, 0.1, 60, 1000)).toEqual({ t: 6, ended: false });
    let t = 0,
      ended = false,
      frames = 0;
    while (!ended) {
      ({ t, ended } = advance(t, 1 / 60, 'fit', 55536));
      frames++;
    }
    expect(t).toBe(55536);
    expect(frames).toBeGreaterThanOrEqual(1199);
    expect(frames).toBeLessThanOrEqual(1201);
  });
  it('finds the revolution of a sample', () => {
    const starts = Int32Array.from([0, 100, 200]);
    expect([0, 99, 100, 150, 200, 5000].map((k) => revolutionOf(starts, k))).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
  });
  it('step budget: suggests the smallest dt that fits (WA-F4)', () => {
    const b = buildRun({ altitudeM: 400_000, k: 1, dtS: 0.1, duration: { kind: 'orbits', n: 20 } });
    expect(b.ok).toBe(false);
    if (!b.ok) {
      expect(b.field).toBe('dt');
      const fit = buildRun({
        altitudeM: 400_000,
        k: 1,
        dtS: b.suggestedDt!,
        duration: { kind: 'orbits', n: 20 },
      });
      expect(fit.ok).toBe(true);
    }
    expect(stepsForDuration(1, 1)).toBe(1);
  });
});
