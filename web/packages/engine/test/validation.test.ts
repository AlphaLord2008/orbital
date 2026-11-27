/**
 * TypeScript analytic validation (requirements-0.1.1 §6), independent of conformance:
 *  1. The TS analytic port reproduces the stored 50-digit reference within REF-1 tolerances.
 *  2. TS-V0 … TS-P2: the TS engine passes every v0.1.1 gate and prediction band on its own,
 *     measured against exact solutions, never against Python engine output.
 */
import { describe, expect, it } from 'vitest';
import {
  analytic,
  firstPeriod,
  propagate,
  radius,
  specificEnergy,
  stepsForDuration,
} from '../src/index';
import { num, REFERENCE, vec } from './fixtures';
import { eDrift, hDrift, max, MU, positionErrors, RE, rDrift, relDev, withinBand } from './helpers';

const REF1 = 1e-12;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('REF-1 (TS): analytic port vs the 50-digit reference', () => {
  for (const [id, ref] of Object.entries(REFERENCE)) {
    const r0 = vec(ref.inputs.r0);
    const v0 = vec(ref.inputs.v0);
    it(`${id} scalars`, () => {
      const el = analytic.elements(r0, v0);
      const [rp, ra] = analytic.apsides(r0, v0);
      const s = ref.scalars;
      expect(rel(el.energy, num(s['energy'] ?? ''))).toBeLessThanOrEqual(REF1);
      expect(rel(el.h, num(s['h'] ?? ''))).toBeLessThanOrEqual(REF1);
      expect(rel(el.a, num(s['a'] ?? ''))).toBeLessThanOrEqual(REF1);
      expect(rel(rp, num(s['r_p'] ?? ''))).toBeLessThanOrEqual(REF1);
      expect(Math.abs(el.e - num(s['e'] ?? ''))).toBeLessThanOrEqual(
        REF1 * Math.max(1, num(s['e'] ?? '')),
      );
      if (s['period'] !== undefined) {
        expect(rel(analytic.period(r0, v0), num(s['period']))).toBeLessThanOrEqual(REF1);
        expect(rel(ra as number, num(s['r_a'] ?? ''))).toBeLessThanOrEqual(REF1);
      } else {
        expect(ra).toBeNull();
      }
    });
    it(`${id} states at ${String(ref.states.length)} checkpoints`, () => {
      const orbit = analytic.keplerOrbit(r0, v0);
      const out = new Float64Array(4);
      let worst = 0;
      for (const st of ref.states) {
        orbit.stateAt(num(st.t), out);
        const [x, y] = vec(st.r);
        const [vx, vy] = vec(st.v);
        worst = Math.max(
          worst,
          Math.hypot((out[0] as number) - x, (out[1] as number) - y) / Math.hypot(x, y),
          Math.hypot((out[2] as number) - vx, (out[3] as number) - vy) / Math.hypot(vx, vy),
        );
      }
      expect(worst).toBeLessThanOrEqual(REF1);
    });
  }
  it('I1 time of flight within 1e-6 s', () => {
    const ref = REFERENCE['I1'];
    if (!ref?.crossing) throw new Error('missing I1 crossing');
    const t = analytic.timeToRadius(vec(ref.inputs.r0), vec(ref.inputs.v0), RE);
    expect(Math.abs(t - num(ref.crossing['t'] ?? ''))).toBeLessThanOrEqual(1e-6);
  });
});

// ---- TS-V0 … TS-P2: the registered gates, on the TS engine ----------------------------------

const input = (id: string) => {
  const ref = REFERENCE[id];
  if (!ref) throw new Error(id);
  return { r0: vec(ref.inputs.r0), v0: vec(ref.inputs.v0) };
};
const before = (t: Float64Array, limit: number) => (i: number) => (t[i] as number) < limit;

describe('TS-V0 (gates T3–T8)', () => {
  const { r0, v0 } = input('V0');
  const T = analytic.period(r0, v0);
  const traj = propagate(r0, v0, 1, stepsForDuration(10 * T, 1));
  it('T3–T7', () => {
    expect(max(hDrift(traj))).toBeLessThanOrEqual(1e-10);
    expect(max(rDrift(traj))).toBeLessThanOrEqual(1e-3);
    expect(max(eDrift(traj))).toBeLessThanOrEqual(1e-5);
    expect(rel(firstPeriod(traj), T)).toBeLessThanOrEqual(1e-5);
    expect(positionErrors(r0, v0, traj)[stepsForDuration(T, 1)]).toBeLessThanOrEqual(100);
  });
  it('T8', () => {
    const coarse = propagate(r0, v0, 10, stepsForDuration(10 * T, 10));
    const ratio = max(relDev(radius(coarse.x, coarse.y))) / max(rDrift(traj));
    expect(ratio).toBeGreaterThanOrEqual(9);
    expect(ratio).toBeLessThanOrEqual(11);
  });
});

describe('TS-P1 (GEO, scale-invariance predictions ±10%)', () => {
  const { r0, v0 } = input('P1');
  const T = analytic.period(r0, v0);
  const traj = propagate(r0, v0, 10, stepsForDuration(2 * T, 10));
  const n1 = stepsForDuration(T, 10);
  it('P1-a … P1-e', () => {
    expect(max(hDrift(traj))).toBeLessThanOrEqual(1e-10);
    const b = max(rDrift(traj));
    expect(b <= 1e-3 && withinBand(b, 3.646e-4, 0.1)).toBe(true);
    const c = max(eDrift(traj));
    expect(c <= 1e-5 && withinBand(c, 5.318e-7, 0.1)).toBe(true);
    const d = rel(firstPeriod(traj), T);
    expect(d <= 1e-5 && withinBand(d, 3.768e-7, 0.1)).toBe(true);
    const e = positionErrors(r0, v0, traj)[n1] as number;
    expect(e <= 1.5e-5 * r0[0] && withinBand(e, 100.0, 0.1)).toBe(true);
  });
});

describe('TS-E1 (ellipse k = 1.10)', () => {
  const { r0, v0 } = input('E1');
  const T = analytic.period(r0, v0);
  const ra = analytic.apsides(r0, v0)[1] as number;
  const traj = propagate(r0, v0, 1, stepsForDuration(2 * T, 1));
  const fine = propagate(r0, v0, 0.1, stepsForDuration(T, 0.1));
  it('E1-a … E1-f', () => {
    expect(max(hDrift(traj))).toBeLessThanOrEqual(1e-10);
    const b = max(eDrift(traj));
    expect(b <= 4e-4 && withinBand(b, 2.016e-4, 0.05)).toBe(true);
    expect(rel(firstPeriod(traj), T)).toBeLessThanOrEqual(1e-5);
    const rad = radius(traj.x, traj.y);
    expect(Math.abs(max(rad, before(traj.t, T)) - ra) / ra).toBeLessThanOrEqual(1e-4);
    const err = positionErrors(r0, v0, traj);
    expect(err[stepsForDuration(T, 1)]).toBeLessThanOrEqual(500);
    const ratio =
      max(err, before(traj.t, T)) / max(positionErrors(r0, v0, fine), before(fine.t, T));
    expect(ratio).toBeGreaterThanOrEqual(9);
    expect(ratio).toBeLessThanOrEqual(11);
  });
});

describe('TS-X1 (escape k = 1.42)', () => {
  const { r0, v0 } = input('X1');
  const traj = propagate(r0, v0, 1, 86_400);
  const fine = propagate(r0, v0, 0.1, 36_000);
  it('X1-a … X1-e', () => {
    expect(max(hDrift(traj))).toBeLessThanOrEqual(1e-10);
    const energy = specificEnergy(traj.x, traj.y, traj.vx, traj.vy);
    let b = 0;
    for (const e of energy) b = Math.max(b, Math.abs(e - (energy[0] as number)));
    b /= MU / r0[0];
    expect(b <= 1e-3 && withinBand(b, 2.089e-4, 0.1)).toBe(true);
    expect(traj.status).toBe('completed');
    expect(energy.every((e) => e > 0)).toBe(true);
    const err = positionErrors(r0, v0, traj);
    const orbit = analytic.keplerOrbit(r0, v0);
    const s = new Float64Array(4);
    for (const k of [3600, 21_600, 86_400]) {
      orbit.stateAt(traj.t[k] as number, s);
      expect((err[k] as number) / Math.hypot(s[0] as number, s[1] as number)).toBeLessThanOrEqual(
        2e-3,
      );
    }
    const ratio =
      max(err, (i) => (traj.t[i] as number) <= 3600) / max(positionErrors(r0, v0, fine));
    expect(ratio).toBeGreaterThanOrEqual(9);
    expect(ratio).toBeLessThanOrEqual(11);
  });
});

describe('TS-I1 (impact k = 0.98)', () => {
  const { r0, v0 } = input('I1');
  const T = analytic.period(r0, v0);
  const tStar = analytic.timeToRadius(r0, v0, RE);
  const traj = propagate(r0, v0, 1, stepsForDuration(T, 1));
  const fine = propagate(r0, v0, 0.1, stepsForDuration(T, 0.1));
  it('I1-a … I1-f', () => {
    expect(traj.status).toBe('impact');
    const rad = radius(traj.x, traj.y);
    const n = rad.length - 1;
    expect((rad[n] as number) <= RE && RE < (rad[n - 1] as number)).toBe(true);
    const b = Math.abs(traj.tEnd - tStar);
    const c = Math.abs(fine.tEnd - tStar);
    expect(b).toBeLessThanOrEqual(30);
    expect(c).toBeLessThanOrEqual(3);
    expect(b / c).toBeGreaterThanOrEqual(7);
    expect(b / c).toBeLessThanOrEqual(14);
    expect(max(hDrift(traj))).toBeLessThanOrEqual(1e-10);
    const f = max(eDrift(traj));
    expect(f <= 1e-4 && withinBand(f, 4.783e-5, 0.1)).toBe(true);
  });
});

describe('TS-P2 (coarse step)', () => {
  const { r0, v0 } = input('P2');
  const T = analytic.period(r0, v0);
  const traj = propagate(r0, v0, 60, stepsForDuration(10 * T, 60));
  it('P2-a', () => {
    expect(max(hDrift(traj))).toBeLessThanOrEqual(1e-10);
    expect(traj.x.length).toBe(926);
  });
});
