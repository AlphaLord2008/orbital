/**
 * Exact two-body solutions (port of orbital/analytic.py, AN-1 … AN-6).
 * Validated against the stored 50-digit reference values (fixtures/v1/reference), not
 * against Python output (requirements-0.1.1 §6).
 */
import { MU_EARTH } from './constants';
import { RuntimeError, ValueError } from './errors';
import { asPositiveScalar, asVector2 } from './validation';
import type { Vec2 } from './dynamics';

export const PARABOLIC_TOLERANCE = 1e-9;
export const KEPLER_TOLERANCE = 1e-15;
export const KEPLER_MAX_ITERATIONS = 100;

export interface Elements {
  readonly energy: number;
  readonly h: number;
  readonly eVec: Vec2;
  readonly e: number;
  /** Semi-major axis; negative for hyperbolic orbits; Infinity when energy is exactly 0. */
  readonly a: number;
  readonly p: number;
  readonly omega: number;
  readonly nu0: number;
}

interface State {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mu: number;
}

function state(r: unknown, v: unknown, mu: unknown): State {
  const [x, y] = asVector2(r, 'r');
  const [vx, vy] = asVector2(v, 'v');
  const m = asPositiveScalar(mu, 'mu');
  if (Math.hypot(x, y) === 0)
    throw new ValueError('r is the origin, where two-body motion is undefined');
  return { x, y, vx, vy, mu: m };
}

function elementsOf(s: State): Elements {
  const { x, y, vx, vy, mu } = s;
  const rNorm = Math.hypot(x, y);
  const vSq = vx * vx + vy * vy;
  const h = x * vy - y * vx;
  if (h === 0) throw new ValueError('radial trajectory (h = 0) is not supported');
  const energy = 0.5 * vSq - mu / rNorm;
  const rDotV = x * vx + y * vy;
  const c = vSq - mu / rNorm;
  const ex = (c * x - rDotV * vx) / mu;
  const ey = (c * y - rDotV * vy) / mu;
  const e = Math.hypot(ex, ey);
  const p = (h * h) / mu;
  const a = energy !== 0 ? -mu / (2 * energy) : Infinity;
  const sense = h > 0 ? 1 : -1;
  let omega = 0;
  let nu0 = 0;
  if (e !== 0) {
    omega = Math.atan2(ey, ex);
    const px = ex / e;
    const py = ey / e;
    nu0 = Math.atan2(sense * (px * y - py * x), px * x + py * y);
  }
  return { energy, h, eVec: [ex, ey], e, a, p, omega, nu0 };
}

/** AN-1 */
export function elements(r: unknown, v: unknown, mu: unknown = MU_EARTH): Elements {
  return elementsOf(state(r, v, mu));
}

/** AN-2: 'bound' if energy < 0, otherwise 'escape'. */
export function classify(r: unknown, v: unknown, mu: unknown = MU_EARTH): 'bound' | 'escape' {
  const s = state(r, v, mu);
  const energy = 0.5 * (s.vx * s.vx + s.vy * s.vy) - s.mu / Math.hypot(s.x, s.y);
  return energy < 0 ? 'bound' : 'escape';
}

/** AN-3: [r_p, r_a | null]. */
export function apsides(r: unknown, v: unknown, mu: unknown = MU_EARTH): [number, number | null] {
  const el = elements(r, v, mu);
  return [el.p / (1 + el.e), el.energy < 0 ? el.p / (1 - el.e) : null];
}

/** AN-4 */
export function period(r: unknown, v: unknown, mu: unknown = MU_EARTH): number {
  const s = state(r, v, mu);
  const el = elementsOf(s);
  if (el.energy >= 0) throw new ValueError('period is defined only for bound orbits (epsilon < 0)');
  return 2 * Math.PI * Math.sqrt(el.a ** 3 / s.mu);
}

function solveElliptic(mean: number, e: number): number {
  let E = mean + e * Math.sin(mean);
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const step = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) <= KEPLER_TOLERANCE) return E;
  }
  throw new RuntimeError("Kepler's equation (elliptic) did not converge in 100 iterations");
}

/** sinh x - x without cancellation (Taylor series for |x| < 1). */
function sinhMinusX(x: number): number {
  if (Math.abs(x) >= 1) return Math.sinh(x) - x;
  const x2 = x * x;
  let term = (x * x2) / 6;
  let sum = term;
  for (let n = 2; n <= 12; n++) {
    term = (term * x2) / (2 * n * (2 * n + 1));
    sum += term;
  }
  return sum;
}

function coshMinusOne(x: number): number {
  const half = Math.sinh(0.5 * x);
  return 2 * half * half;
}

function solveHyperbolic(mean: number, e: number): number {
  let H = Math.asinh(mean / e);
  const eMinus1 = e - 1;
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const residual = eMinus1 * H + e * sinhMinusX(H) - mean;
    const step = residual / (eMinus1 + e * coshMinusOne(H));
    H -= step;
    if (Math.abs(step) <= KEPLER_TOLERANCE * Math.abs(H)) return H;
  }
  throw new RuntimeError("Kepler's equation (hyperbolic) did not converge in 100 iterations");
}

function anomalyToMean(nu: number, e: number, elliptic: boolean): number {
  if (elliptic) {
    const E =
      2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    return E - e * Math.sin(E);
  }
  const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
  return e * Math.sinh(H) - H;
}

function checkConic(el: Elements): boolean {
  if (Math.abs(el.e - 1) < PARABOLIC_TOLERANCE) {
    throw new ValueError(`parabolic trajectory (e = ${String(el.e)}) is not supported`);
  }
  return el.e < 1;
}

/** Precomputed propagation of one initial state, so many times can be evaluated cheaply. */
export interface KeplerOrbit {
  readonly elements: Elements;
  /** Exact state at time t after the initial state: writes [x, y, vx, vy] into out. */
  stateAt(t: number, out: Float64Array): void;
}

/** AN-5 setup: validate once, then evaluate `stateAt` at any finite time. */
export function keplerOrbit(r0: unknown, v0: unknown, mu: unknown = MU_EARTH): KeplerOrbit {
  const s = state(r0, v0, mu);
  const el = elementsOf(s);
  const elliptic = checkConic(el);
  const e = el.e;
  const sense = el.h > 0 ? 1 : -1;
  let px: number;
  let py: number;
  if (e === 0) {
    const r = Math.hypot(s.x, s.y);
    px = s.x / r;
    py = s.y / r;
  } else {
    px = el.eVec[0] / e;
    py = el.eVec[1] / e;
  }
  const qx = -sense * py;
  const qy = sense * px;
  const alpha = Math.abs(el.a);
  const n = Math.sqrt(s.mu / alpha ** 3);
  const mean0 = anomalyToMean(el.nu0, e, elliptic);
  const vp = Math.sqrt(s.mu / el.p);
  const sqrt1me2 = Math.sqrt(Math.abs(1 - e * e));
  return {
    elements: el,
    stateAt(t: number, out: Float64Array): void {
      if (!Number.isFinite(t)) throw new ValueError('t must be finite');
      const mean = mean0 + n * t;
      let cosNum: number;
      let sinNum: number;
      let radius: number;
      if (elliptic) {
        const turns = pyRoundHalfEven(mean / (2 * Math.PI));
        const E = solveElliptic(mean - 2 * Math.PI * turns, e);
        cosNum = Math.cos(E) - e;
        sinNum = sqrt1me2 * Math.sin(E);
        radius = alpha * (1 - e * Math.cos(E));
      } else {
        const H = solveHyperbolic(mean, e);
        const chm1 = coshMinusOne(H);
        cosNum = e - 1 - chm1;
        sinNum = sqrt1me2 * Math.sinh(H);
        radius = alpha * (e - 1 + e * chm1);
      }
      const norm = Math.hypot(cosNum, sinNum);
      const cosNu = cosNum / norm;
      const sinNu = sinNum / norm;
      out[0] = radius * (cosNu * px + sinNu * qx);
      out[1] = radius * (cosNu * py + sinNu * qy);
      out[2] = vp * (-sinNu * px + (e + cosNu) * qx);
      out[3] = vp * (-sinNu * py + (e + cosNu) * qy);
    },
  };
}

/** NumPy's np.round: half to even. */
function pyRoundHalfEven(q: number): number {
  const f = Math.floor(q);
  const diff = q - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** AN-5 convenience: exact state at one time. */
export function stateAt(
  r0: unknown,
  v0: unknown,
  t: number,
  mu: unknown = MU_EARTH,
): { r: Vec2; v: Vec2 } {
  const out = new Float64Array(4);
  keplerOrbit(r0, v0, mu).stateAt(t, out);
  return { r: [out[0] as number, out[1] as number], v: [out[2] as number, out[3] as number] };
}

/** AN-6: earliest t > 0 with |r(t)| = radius. */
export function timeToRadius(
  r0: unknown,
  v0: unknown,
  radius: unknown,
  mu: unknown = MU_EARTH,
): number {
  const s = state(r0, v0, mu);
  const R = asPositiveScalar(radius, 'radius');
  const el = elementsOf(s);
  const elliptic = checkConic(el);
  const e = el.e;
  const rp = el.p / (1 + e);
  if (R < rp || (elliptic && R > el.p / (1 - e))) {
    throw new ValueError(`the trajectory never reaches radius ${String(R)} m`);
  }
  if (e === 0) throw new ValueError(`a circular trajectory stays at radius ${String(rp)} m`);
  const cosTarget = Math.min(1, Math.max(-1, (el.p / R - 1) / e));
  const nuTarget = Math.acos(cosTarget);
  const n = Math.sqrt(s.mu / Math.abs(el.a) ** 3);
  const mean0 = anomalyToMean(el.nu0, e, elliptic);
  let best = Infinity;
  for (const nu of [nuTarget, -nuTarget]) {
    let dm = anomalyToMean(nu, e, elliptic) - mean0;
    if (elliptic) {
      dm = dm % (2 * Math.PI); // math.fmod semantics: sign of the dividend
      if (dm <= 0) dm += 2 * Math.PI;
    }
    if (dm > 0) best = Math.min(best, dm / n);
  }
  if (!Number.isFinite(best)) {
    throw new ValueError(`the trajectory never reaches radius ${String(R)} m after t = 0`);
  }
  return best;
}
