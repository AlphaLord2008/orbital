/**
 * Python–TypeScript conformance, C1–C8 (ADR-0003 §3.3), against fixtures written by the
 * authoritative Python engine (scripts/generate_fixtures.py).
 *   position, velocity, per-sample energy and h:  relative <= 1e-11
 *   derived scalars (elements, period, first period, time to surface): relative <= 1e-12
 *   drift statistics (max relative energy and h drift): absolute <= 1e-11. They are
 *     differences of per-sample values, so a 1e-13 roundoff difference in a sample is a
 *     1e-13 absolute difference here, not a small relative one.
 *   status, sample count, steps, classification, error class and field: exact.
 */
import { describe, expect, it } from 'vitest';
import {
  analytic,
  angularMomentumZ,
  firstPeriod,
  gravityAccel,
  maxRelativeDrift,
  propagate,
  specificEnergy,
  stepsForDuration,
  ValueError,
} from '../src/index';
import { C7, C8, num, RUNS, vec } from './fixtures';
import { RE } from './helpers';

const STATE = 1e-11;
const SCALAR = 1e-12;
const DRIFT_ABS = 1e-11;
const rel = (a: number, b: number) => (b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b));

describe.each(Object.keys(RUNS))('%s', (id) => {
  const fx = RUNS[id];
  if (!fx) throw new Error(id);
  const r0 = vec(fx.inputs.r0);
  const v0 = vec(fx.inputs.v0);
  const traj = propagate(
    r0,
    v0,
    num(fx.inputs.dt),
    fx.inputs.n_steps,
    num(fx.inputs.mu),
    num(fx.inputs.body_radius),
  );
  const energy = specificEnergy(traj.x, traj.y, traj.vx, traj.vy);
  const h = angularMomentumZ(traj.x, traj.y, traj.vx, traj.vy);

  it('status, sample count and steps are exact', () => {
    expect(traj.status).toBe(fx.summary.status);
    expect(traj.t.length).toBe(fx.summary.samples);
    expect(traj.nStepsRequested).toBe(fx.summary.n_steps_requested);
    expect(traj.tEnd).toBe(num(fx.summary.t_end));
  });

  it(`${String(fx.samples.length)} stored samples within 1e-11`, () => {
    let worst = 0;
    for (const s of fx.samples) {
      const k = s.k;
      expect(traj.t[k]).toBe(num(s.t));
      const [x, y] = vec(s.r);
      const [vx, vy] = vec(s.v);
      worst = Math.max(
        worst,
        Math.hypot((traj.x[k] as number) - x, (traj.y[k] as number) - y) / Math.hypot(x, y),
        Math.hypot((traj.vx[k] as number) - vx, (traj.vy[k] as number) - vy) / Math.hypot(vx, vy),
        rel(energy[k] as number, num(s.energy)),
        rel(h[k] as number, num(s.h)),
      );
    }
    expect(worst).toBeLessThanOrEqual(STATE);
  });

  it('summaries', () => {
    expect(
      Math.abs(maxRelativeDrift(energy) - num(fx.summary.max_rel_energy_drift)),
    ).toBeLessThanOrEqual(DRIFT_ABS);
    expect(Math.abs(maxRelativeDrift(h) - num(fx.summary.max_rel_h_drift))).toBeLessThanOrEqual(
      DRIFT_ABS,
    );
    if (fx.summary.first_period === null) {
      expect(() => firstPeriod(traj)).toThrow(ValueError);
    } else {
      expect(rel(firstPeriod(traj), num(fx.summary.first_period))).toBeLessThanOrEqual(SCALAR);
    }
    const a = fx.summary.analytic;
    const el = analytic.elements(r0, v0);
    const [rp, ra] = analytic.apsides(r0, v0);
    expect(analytic.classify(r0, v0)).toBe(a['classification']);
    expect(rel(el.energy, num(a['energy'] ?? ''))).toBeLessThanOrEqual(SCALAR);
    expect(rel(el.h, num(a['h'] ?? ''))).toBeLessThanOrEqual(SCALAR);
    expect(rel(el.a, num(a['a'] ?? ''))).toBeLessThanOrEqual(SCALAR);
    expect(Math.abs(el.e - num(a['e'] ?? ''))).toBeLessThanOrEqual(SCALAR * Math.max(1, el.e));
    expect(rel(rp, num(a['r_p'] ?? ''))).toBeLessThanOrEqual(SCALAR);
    if (a['r_a'] === null) expect(ra).toBeNull();
    else expect(rel(ra as number, num(a['r_a'] ?? ''))).toBeLessThanOrEqual(SCALAR);
    if (a['period'] !== null)
      expect(rel(analytic.period(r0, v0), num(a['period'] ?? ''))).toBeLessThanOrEqual(SCALAR);
    if (a['time_to_surface'] !== undefined) {
      expect(
        rel(analytic.timeToRadius(r0, v0, RE), num(a['time_to_surface'] ?? '')),
      ).toBeLessThanOrEqual(SCALAR);
    }
  });
});

describe('C7 steps_for_duration endpoint table', () => {
  it.each(C7.rows)('%j', (row) => {
    const duration = num(row['duration'] as string);
    const dt = num(row['dt'] as string);
    if ('error' in row) {
      let field = '';
      try {
        stepsForDuration(duration, dt);
      } catch (e) {
        expect(e).toBeInstanceOf(ValueError);
        field = (e as ValueError).field;
      }
      expect(field).toBe(row['field']);
    } else {
      const n = stepsForDuration(duration, dt);
      expect(n).toBe(row['n']);
      expect(n * dt).toBe(num(row['t_end'] as string));
    }
  });
});

/** Decode the JSON encoding used for invalid inputs: non-finite floats as strings. */
function dec(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(dec);
  if (x === 'nan') return NaN;
  if (x === 'inf') return Infinity;
  if (x === '-inf') return -Infinity;
  return x;
}

describe('C8 invalid inputs: same error class and field', () => {
  it.each(C8.rows)('%j', (row) => {
    const a = row['args'] as Record<string, unknown>;
    const call = (): unknown => {
      switch (row['fn']) {
        case 'propagate':
          return propagate(
            dec(a['r0']),
            dec(a['v0']),
            dec(a['dt']),
            dec(a['n_steps']),
            dec(a['mu'] ?? 3.986004418e14),
          );
        case 'gravity_accel':
          return gravityAccel(dec(a['r']));
        case 'steps_for_duration':
          return stepsForDuration(dec(a['duration']), dec(a['dt']));
        default:
          throw new Error(`unknown fn ${String(row['fn'])}`);
      }
    };
    let caught: unknown;
    try {
      call();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValueError);
    expect((caught as ValueError).field).toBe(row['field']);
  });
});
