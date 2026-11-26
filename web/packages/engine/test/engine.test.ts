/** Implementation properties the port relies on (ADR-0003 §3.1). */
import { describe, expect, it } from 'vitest';
import { MU_EARTH, propagate, semiImplicitEulerStep, uncheckedStep } from '../src/index';
import { initialState, MU } from './helpers';

/** Deterministic PRNG so failures reproduce (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('unchecked inner step', () => {
  it('is bit-identical to the validated public step over 10^4 random states', () => {
    const rand = rng(20261125);
    const out = new Float64Array(4);
    for (let i = 0; i < 10_000; i++) {
      const radius = 6.4e6 + rand() * 4e8;
      const angle = rand() * 2 * Math.PI;
      const speed = rand() * 12_000;
      const dir = rand() * 2 * Math.PI;
      const r: [number, number] = [radius * Math.cos(angle), radius * Math.sin(angle)];
      const v: [number, number] = [speed * Math.cos(dir), speed * Math.sin(dir)];
      const dt = 0.1 + rand() * 299.9;
      const ref = semiImplicitEulerStep(r, v, dt);
      uncheckedStep(r[0], r[1], v[0], v[1], dt, MU, out);
      expect(Object.is(out[0], ref.r[0]) && Object.is(out[1], ref.r[1])).toBe(true);
      expect(Object.is(out[2], ref.v[0]) && Object.is(out[3], ref.v[1])).toBe(true);
    }
  });
});

describe('chunked propagation', () => {
  it.each([1, 7, 1000, 50_000])(
    'is bit-identical to a single chunk (chunk = %i steps)',
    (chunk) => {
      const { r0, v0 } = initialState(400_000, 1.1);
      const whole = propagate(r0, v0, 1.0, 20_000, MU, 6_378_137.0, 1_000_000);
      const chunked = propagate(r0, v0, 1.0, 20_000, MU, 6_378_137.0, chunk);
      for (const key of ['t', 'x', 'y', 'vx', 'vy'] as const) {
        expect(chunked[key]).toEqual(whole[key]);
      }
      expect(chunked.status).toBe(whole.status);
    },
  );
});

describe('impact boundary (F6: |r| <= body radius is an impact)', () => {
  it('a step landing exactly on the surface stops the run', () => {
    const r0: [number, number] = [7_000_000, 0];
    const v0: [number, number] = [-1_000, 7_000];
    const one = propagate(r0, v0, 1, 1);
    const x1 = one.x[1] as number;
    const y1 = one.y[1] as number;
    const surface = Math.sqrt(x1 * x1 + y1 * y1); // the same expression the propagator uses
    const traj = propagate(r0, v0, 1, 10, MU_EARTH, surface);
    expect(traj.status).toBe('impact');
    expect(traj.t.length).toBe(2);
    expect(propagate(r0, v0, 1, 1, MU_EARTH, surface * (1 - 1e-15)).status).toBe('completed');
  });
});
