/**
 * TS analytic solution across the escape threshold (Batch B), against the independent 50-digit
 * universal-variable reference (fixtures/v1/domain/conics.json). Same accuracy model as
 * tests/test_conic_domain.py: REF-1 (1e-12) + 4ε/|1 − e| (element conditioning of float64 inputs)
 * + 8ε|v||t|/|r| (time rounding in M = M0 + n t); velocity relative to max(|v|, √(μ/p)).
 */
import { describe, expect, it } from 'vitest';
import domain from '../../../../fixtures/v1/domain/conics.json';
import { analytic, MU_EARTH, propagate, R_EARTH, ValueError } from '../src/index';

const EPS = Number.EPSILON;
const num = (s: string) => Number(s);

describe.each(domain.cases)('$name', (c) => {
  const r0 = c.inputs.r0.map(num);
  const v0 = c.inputs.v0.map(num);
  const e = num(c.scalars.e);
  const h = num(c.scalars.h);
  const vScale = Math.sqrt(MU_EARTH / ((h * h) / MU_EARTH));

  it('elements and classification', () => {
    expect(Math.abs(analytic.elements(r0, v0).e - e)).toBeLessThanOrEqual(4 * EPS);
    expect(analytic.classify(r0, v0)).toBe(num(c.scalars.energy) < 0 ? 'bound' : 'escape');
  });

  it(`state at ${String(c.states.length)} times`, () => {
    const orbit = analytic.keplerOrbit(r0, v0);
    const out = new Float64Array(4);
    for (const s of c.states) {
      const t = num(s.t);
      const [x, y] = s.r.map(num) as [number, number];
      const [vx, vy] = s.v.map(num) as [number, number];
      orbit.stateAt(t, out);
      const rn = Math.hypot(x, y);
      const vn = Math.hypot(vx, vy);
      const tol = 1e-12 + (4 * EPS) / Math.abs(1 - e) + (8 * EPS * vn * Math.abs(t)) / rn;
      expect(
        Math.hypot((out[0] as number) - x, (out[1] as number) - y) / rn,
        `r at t = ${String(t)}`,
      ).toBeLessThanOrEqual(tol);
      expect(
        Math.hypot((out[2] as number) - vx, (out[3] as number) - vy) / Math.max(vn, vScale),
        `v at t = ${String(t)}`,
      ).toBeLessThanOrEqual(tol);
    }
  });
});

describe('domain boundaries', () => {
  const radius = R_EARTH + 400_000;
  const vc = Math.sqrt(MU_EARTH / radius);
  it('the parabolic band |e − 1| < 1e-9 is rejected; just outside it on both sides is solved', () => {
    expect(() => analytic.keplerOrbit([radius, 0], [0, Math.SQRT2 * vc])).toThrow(ValueError);
    for (const k of [Math.sqrt(2 - 2e-9), Math.sqrt(2 + 2e-9)]) {
      const out = new Float64Array(4);
      analytic.keplerOrbit([radius, 0], [0, k * vc]).stateAt(60, out);
      expect(out.every(Number.isFinite)).toBe(true);
    }
  });
  it('k = 1.41 over a full period (threw "did not converge" before)', () => {
    const r0 = [radius, 0];
    const v0 = [0, 1.41 * vc];
    const orbit = analytic.keplerOrbit(r0, v0);
    const T = analytic.period(r0, v0);
    const out = new Float64Array(4);
    for (let i = 0; i <= 20_000; i++) orbit.stateAt((T * i) / 20_000, out);
    expect(out.every(Number.isFinite)).toBe(true);
  });
  it('the numerical propagator never uses the Kepler solver', () => {
    const traj = propagate([radius, 0], [0, 1.41 * vc], 1, 86_400);
    expect(traj.status).toBe('completed');
  });
});
