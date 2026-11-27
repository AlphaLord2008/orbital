/**
 * Orbital diagnostics (port of orbital/diagnostics.py; F8, F8a), on structure-of-arrays.
 */
import { MU_EARTH } from './constants';
import { ValueError } from './errors';
import type { Trajectory } from './propagate';
import { asPositiveScalar } from './validation';

/** |r| per sample [m]. */
export function radius(x: Float64Array, y: Float64Array): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number;
    const yi = y[i] as number;
    out[i] = Math.sqrt(xi * xi + yi * yi);
  }
  return out;
}

/** epsilon = |v|^2 / 2 - mu / |r| per sample [m^2/s^2]. */
export function specificEnergy(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
  mu: unknown = MU_EARTH,
): Float64Array {
  const m = asPositiveScalar(mu, 'mu');
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number;
    const yi = y[i] as number;
    const rNorm = Math.sqrt(xi * xi + yi * yi);
    if (rNorm === 0) {
      throw new ValueError('r includes the origin, where the gravitational potential is undefined');
    }
    const vxi = vx[i] as number;
    const vyi = vy[i] as number;
    out[i] = 0.5 * (vxi * vxi + vyi * vyi) - m / rNorm;
  }
  return out;
}

/** h = x v_y - y v_x per sample [m^2/s]. */
export function angularMomentumZ(
  x: Float64Array,
  y: Float64Array,
  vx: Float64Array,
  vy: Float64Array,
): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    out[i] = (x[i] as number) * (vy[i] as number) - (y[i] as number) * (vx[i] as number);
  }
  return out;
}

/** max |a_i - a_0| / |a_0|. */
export function maxRelativeDrift(values: Float64Array): number {
  const a0 = values[0] as number;
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs((values[i] as number) - a0) / Math.abs(a0);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Time of the first completed counter-clockwise revolution (F8a) [s]: the first
 * upward +x-axis crossing, linearly interpolated. Same rules as Python.
 */
export function firstPeriod(traj: Trajectory): number {
  const { x, y, vx, vy, t, dt } = traj;
  if (!((y[0] as number) === 0 && (x[0] as number) > 0)) {
    throw new ValueError(
      `trajectory must start on the +x axis (y0 = 0, x0 > 0), got r0 = [${String(x[0])}, ${String(y[0])}]`,
    );
  }
  if ((x[0] as number) * (vy[0] as number) - (y[0] as number) * (vx[0] as number) <= 0) {
    throw new ValueError('trajectory must move counter-clockwise (h0 > 0)');
  }
  for (let k = 1; k < y.length; k++) {
    const yPrev = y[k - 1] as number;
    const yk = y[k] as number;
    if (yPrev < 0 && yk >= 0 && (x[k] as number) > 0) {
      const fraction = -yPrev / (yk - yPrev);
      return (t[k - 1] as number) + dt * fraction;
    }
  }
  throw new ValueError('trajectory does not contain a complete revolution');
}
