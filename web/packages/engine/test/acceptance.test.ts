/**
 * The v0.1.0 acceptance tests T1–T10, ported with the v0.1.0 tolerances unchanged
 * (docs/requirements-0.1.md §6). T11 (plot) has no engine counterpart; T12 is the
 * boundary check (boundary.node.test.ts, check-engine-boundary.mjs, ESLint).
 */
import { describe, expect, it } from 'vitest';
import {
  circularInitialState,
  circularVelocity,
  firstPeriod,
  gravityAccel,
  propagate,
  semiImplicitEulerStep,
  stepsForDuration,
  ValueError,
  type Trajectory,
} from '../src/index';
import { eDrift, hDrift, max, MU, RE, rDrift, relDev } from './helpers';
import { radius } from '../src/index';

const R0 = RE + 400_000;
const T = 2 * Math.PI * Math.sqrt(R0 ** 3 / MU);
const N = stepsForDuration(10 * T, 1.0);
const ref = (() => {
  const { r0, v0 } = circularInitialState(400_000);
  return propagate(r0, v0, 1.0, N);
})();
const inOrbit = (traj: Trajectory, orbit: number) => (i: number) =>
  (traj.t[i] as number) >= (orbit - 1) * T && (traj.t[i] as number) < orbit * T;
const relErr = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('T1 gravity', () => {
  it.each([
    [R0, 0],
    [0, R0],
    [R0 / Math.SQRT2, -R0 / Math.SQRT2],
  ])('magnitude mu/r^2 at (%f, %f)', (x, y) => {
    const [ax, ay] = gravityAccel([x, y]);
    expect(relErr(Math.hypot(ax, ay), MU / R0 ** 2)).toBeLessThanOrEqual(1e-12);
    // points toward the origin: a . r_hat = -|a|
    const dot = (ax * x + ay * y) / Math.hypot(x, y);
    expect(relErr(dot, -Math.hypot(ax, ay))).toBeLessThanOrEqual(1e-12);
  });
  it('inverse-square law a(2r) = a(r)/4', () => {
    const a1 = gravityAccel([R0, 0]);
    const a2 = gravityAccel([2 * R0, 0]);
    expect(relErr(a2[0] / a1[0], 0.25)).toBeLessThanOrEqual(1e-12);
  });
  it('unit sanity: |a(r0)| = 8.676 m/s^2 (reference-values.md)', () => {
    expect(Math.abs(gravityAccel([R0, 0])[0]).toPrecision(4)).toBe('8.676');
    expect(circularVelocity(R0).toPrecision(10)).toBe('7668.558175');
  });
});

describe('T2 one step vs hand calculation', () => {
  it('matches within 1e-9', () => {
    const { r0, v0 } = circularInitialState(400_000);
    const step = semiImplicitEulerStep(r0, v0, 1.0);
    const ax0 = -MU / R0 ** 2;
    const v1 = [ax0, Math.sqrt(MU / R0)];
    const r1 = [R0 + (v1[0] as number), v1[1] as number];
    const got = [...step.v, ...step.r];
    const want = [...v1, ...r1];
    got.forEach((g, i) => {
      expect(relErr(g, want[i] as number)).toBeLessThanOrEqual(1e-9);
    });
  });
});

describe('T3–T8 reference circular orbit (400 km, dt 1 s, 10 orbits)', () => {
  it('T3 angular momentum: max |dh/h0| <= 1e-10', () => {
    expect(max(hDrift(ref))).toBeLessThanOrEqual(1e-10);
  });
  it('T4 radius: max |dr|/r0 <= 1e-3 and orbit 10 <= 1.1 x orbit 1', () => {
    const d = rDrift(ref);
    expect(max(d)).toBeLessThanOrEqual(1e-3);
    expect(max(d, inOrbit(ref, 10))).toBeLessThanOrEqual(1.1 * max(d, inOrbit(ref, 1)));
  });
  it('T5 energy: max |de/e0| <= 1e-5 and orbit 10 <= 1.1 x orbit 1', () => {
    const d = eDrift(ref);
    expect(max(d)).toBeLessThanOrEqual(1e-5);
    expect(max(d, inOrbit(ref, 10))).toBeLessThanOrEqual(1.1 * max(d, inOrbit(ref, 1)));
  });
  it('T6 first period within 1e-5 of 2 pi sqrt(r0^3/mu)', () => {
    expect(relErr(firstPeriod(ref), T)).toBeLessThanOrEqual(1e-5);
  });
  it('T7 position error after one orbit (n = 5553) <= 100 m', () => {
    const k = stepsForDuration(T, 1.0);
    expect(k).toBe(5553);
    const w = (2 * Math.PI) / T;
    const tk = ref.t[k] as number;
    const err = Math.hypot(
      (ref.x[k] as number) - R0 * Math.cos(w * tk),
      (ref.y[k] as number) - R0 * Math.sin(w * tk),
    );
    expect(err).toBeLessThanOrEqual(100);
  });
  it('T8 radius error scales linearly with dt (ratio in [9, 11])', () => {
    const { r0, v0 } = circularInitialState(400_000);
    const coarse = propagate(r0, v0, 10.0, stepsForDuration(10 * T, 10.0));
    const ratio = max(relDev(radius(coarse.x, coarse.y))) / max(rDrift(ref));
    expect(ratio).toBeGreaterThanOrEqual(9);
    expect(ratio).toBeLessThanOrEqual(11);
  });
});

describe('T9 input, endpoint and precondition cases', () => {
  const good: [number, number] = [R0, 0];
  const goodV: [number, number] = [0, 7668];
  it('gravityAccel at the origin', () => {
    expect(() => gravityAccel([0, 0])).toThrow(ValueError);
  });
  it.each([[[1, 2, 3]], [[[1], [2]]], [[1]], [5]])('wrong shape %j', (bad) => {
    expect(() => propagate(bad, goodV, 1, 10)).toThrow(ValueError);
    expect(() => propagate(good, bad, 1, 10)).toThrow(ValueError);
  });
  it.each([[[NaN, 0]], [[Infinity, 0]], [[0, -Infinity]]])('non-finite %j', (bad) => {
    expect(() => propagate(bad, goodV, 1, 10)).toThrow(ValueError);
  });
  it('integer position is accepted', () => {
    expect(propagate([6778137, 0], goodV, 1, 2).x[0]).toBe(6778137);
  });
  it('caller arrays are unchanged and not shared', () => {
    const r0: [number, number] = [R0, 0];
    const v0: [number, number] = [0, 7668];
    const traj = propagate(r0, v0, 1, 5);
    expect(r0).toEqual([R0, 0]);
    expect(v0).toEqual([0, 7668]);
    traj.x[0] = 1;
    expect(r0[0]).toBe(R0);
  });
  it.each([0, -1, Infinity, NaN, true])('invalid dt %s', (dt) => {
    expect(() => propagate(good, goodV, dt, 10)).toThrow(ValueError);
  });
  it.each([0, true, 2.5])('invalid n_steps %s', (n) => {
    expect(() => propagate(good, goodV, 1, n)).toThrow(ValueError);
  });
  it('|r0| <= R_E', () => {
    expect(() => propagate([RE, 0], goodV, 1, 10)).toThrow(ValueError);
  });
  it.each([
    [0.3, 0.1, 3, 0.30000000000000004],
    [2.9999, 1, 2, 2],
    [3.0000001, 1, 3, 3],
    [10, 3, 3, 9],
  ])('F4 row duration %f dt %f -> n %i', (duration, dt, n, tEnd) => {
    expect(stepsForDuration(duration, dt)).toBe(n);
    expect(n * dt).toBe(tEnd);
  });
  it('F4 row 1 s / 2 s is less than one step', () => {
    expect(() => stepsForDuration(1, 2)).toThrow(ValueError);
  });
  it('any steps_for_duration result: duration - dt < t_end <= duration (1 + 2e-9)', () => {
    for (const [d, dt] of [
      [5553.624, 1],
      [86164.1, 10],
      [0.7, 0.1],
      [1e6, 0.1],
      [123.456, 0.789],
    ] as const) {
      const tEnd = stepsForDuration(d, dt) * dt;
      expect(tEnd).toBeGreaterThan(d - dt);
      expect(tEnd).toBeLessThanOrEqual(d * (1 + 2e-9));
    }
  });
  it('firstPeriod rejects off-axis, clockwise and short trajectories', () => {
    const offAxis = propagate([R0, 1], [0, 7668], 1, 10);
    expect(() => firstPeriod(offAxis)).toThrow(ValueError);
    const cw = propagate([R0, 0], [0, -7668], 1, 10);
    expect(() => firstPeriod(cw)).toThrow(ValueError);
    const short = propagate([R0, 0], [0, 7668], 1, 100);
    expect(() => firstPeriod(short)).toThrow(ValueError);
  });
});

describe('T10 impact', () => {
  it('free fall from 400 km stops with status impact at the surface crossing', () => {
    const traj = propagate([R0, 0], [0, 0], 1.0, 10_000);
    expect(traj.status).toBe('impact');
    const n = traj.x.length - 1;
    expect(Math.hypot(traj.x[n] as number, traj.y[n] as number)).toBeLessThanOrEqual(RE);
    expect(Math.hypot(traj.x[n - 1] as number, traj.y[n - 1] as number)).toBeGreaterThan(RE);
  });
});
