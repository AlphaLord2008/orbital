/** Shared helpers for the engine tests: runs, drifts and exact-solution errors. */
import {
  analytic,
  angularMomentumZ,
  propagate,
  radius,
  specificEnergy,
  type Trajectory,
} from '../src/index';

export const MU = 3.986004418e14;
export const RE = 6_378_137.0;

export function initialState(
  altitude: number,
  k: number,
): { r0: [number, number]; v0: [number, number] } {
  const r = RE + altitude;
  return { r0: [r, 0], v0: [0, k * Math.sqrt(MU / r)] };
}

export function relDev(values: Float64Array): Float64Array {
  const out = new Float64Array(values.length);
  const a0 = values[0] as number;
  for (let i = 0; i < values.length; i++)
    out[i] = Math.abs((values[i] as number) - a0) / Math.abs(a0);
  return out;
}

export function max(values: Float64Array, mask?: (i: number) => boolean): number {
  let m = -Infinity;
  for (let i = 0; i < values.length; i++)
    if (!mask || mask(i)) m = Math.max(m, values[i] as number);
  return m;
}

export const hDrift = (t: Trajectory) => relDev(angularMomentumZ(t.x, t.y, t.vx, t.vy));
export const eDrift = (t: Trajectory) => relDev(specificEnergy(t.x, t.y, t.vx, t.vy));
export const rDrift = (t: Trajectory) => relDev(radius(t.x, t.y));

/** |r_k - r_exact(t_k)| for every sample, exact solution from the TS analytic port. */
export function positionErrors(
  r0: [number, number],
  v0: [number, number],
  traj: Trajectory,
): Float64Array {
  const orbit = analytic.keplerOrbit(r0, v0);
  const s = new Float64Array(4);
  const out = new Float64Array(traj.t.length);
  for (let k = 0; k < traj.t.length; k++) {
    orbit.stateAt(traj.t[k] as number, s);
    out[k] = Math.hypot(
      (traj.x[k] as number) - (s[0] as number),
      (traj.y[k] as number) - (s[1] as number),
    );
  }
  return out;
}

export function run(r0: [number, number], v0: [number, number], dt: number, n: number): Trajectory {
  return propagate(r0, v0, dt, n);
}

/** Assert value within band of prediction (fraction). */
export function withinBand(value: number, prediction: number, band: number): boolean {
  return Math.abs(value - prediction) <= band * prediction;
}
