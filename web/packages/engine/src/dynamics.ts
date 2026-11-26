/**
 * Equations of motion for the two-body problem (port of orbital/dynamics.py).
 * Arithmetic follows the Python operation for operation:
 *   |r| = sqrt(x*x + y*y), a = (-mu / |r|**3) * r, v' = v + dt*a, r' = r + dt*v'.
 */
import { MU_EARTH, R_EARTH } from './constants';
import { ValueError } from './errors';
import { asPositiveScalar, asVector2 } from './validation';

export type Vec2 = [number, number];

/** Gravitational acceleration a = -mu r / |r|^3 [m/s^2]. */
export function gravityAccel(r: unknown, mu: unknown = MU_EARTH): Vec2 {
  const [x, y] = asVector2(r, 'r');
  const m = asPositiveScalar(mu, 'mu');
  const rNorm = Math.sqrt(x * x + y * y);
  if (rNorm === 0) {
    throw new ValueError("r is the origin, where a point mass's gravity is undefined");
  }
  const c = -m / rNorm ** 3;
  const ax = c * x;
  const ay = c * y;
  if (!(Number.isFinite(rNorm) && Number.isFinite(ax) && Number.isFinite(ay))) {
    throw new ValueError(
      `gravity_accel cannot be represented in float64 at r = [${String(x)}, ${String(y)}] m`,
    );
  }
  return [ax, ay];
}

/** Circular-orbit speed sqrt(mu / r) [m/s]. */
export function circularVelocity(r: unknown, mu: unknown = MU_EARTH): number {
  const radius = asPositiveScalar(r, 'r');
  const m = asPositiveScalar(mu, 'mu');
  return Math.sqrt(m / radius);
}

/** Counter-clockwise circular orbit at `altitude`: r0 = (R + h, 0), v0 = (0, v_c). */
export function circularInitialState(
  altitude: unknown,
  mu: unknown = MU_EARTH,
  bodyRadius: unknown = R_EARTH,
): { r0: Vec2; v0: Vec2 } {
  const h = asPositiveScalar(altitude, 'altitude');
  const body = asPositiveScalar(bodyRadius, 'body_radius');
  const radius = body + h;
  return { r0: [radius, 0], v0: [0, circularVelocity(radius, mu)] };
}

/** One semi-implicit (symplectic) Euler step, validated: v' = v + dt a(r); r' = r + dt v'. */
export function semiImplicitEulerStep(
  r: unknown,
  v: unknown,
  dt: unknown,
  mu: unknown = MU_EARTH,
): { r: Vec2; v: Vec2 } {
  const [x, y] = asVector2(r, 'r');
  const [vx, vy] = asVector2(v, 'v');
  const h = asPositiveScalar(dt, 'dt');
  const [ax, ay] = gravityAccel([x, y], mu);
  const vxNew = vx + h * ax;
  const vyNew = vy + h * ay;
  return { r: [x + h * vxNew, y + h * vyNew], v: [vxNew, vyNew] };
}

/**
 * The unchecked inner step used by `propagate` after it validates its inputs once
 * (ADR-0003 §3.1). Same operations as `semiImplicitEulerStep`; tests prove the two
 * bit-identical over 10^4 random states. Writes into `out` = [x, y, vx, vy].
 */
export function uncheckedStep(
  x: number,
  y: number,
  vx: number,
  vy: number,
  dt: number,
  mu: number,
  out: Float64Array,
): void {
  const rNorm = Math.sqrt(x * x + y * y);
  const c = -mu / rNorm ** 3;
  const vxNew = vx + dt * (c * x);
  const vyNew = vy + dt * (c * y);
  out[0] = x + dt * vxNew;
  out[1] = y + dt * vyNew;
  out[2] = vxNew;
  out[3] = vyNew;
}
