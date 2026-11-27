/**
 * Fixed-step orbit propagation (port of orbital/propagate.py; requirements F3–F7).
 *
 * `propagate` validates once, then runs the unchecked inner step (bit-identical to the
 * validated step) in chunks of CHUNK_STEPS so a worker can report progress
 * (ADR-0003 §3.1). Chunked and unchunked runs are bit-identical by construction: the
 * chunk boundary only pauses the loop.
 */
import { MU_EARTH, R_EARTH } from './constants';
import { RuntimeError, ValueError } from './errors';
import { uncheckedStep } from './dynamics';
import { asPositiveInt, asPositiveScalar, asVector2 } from './validation';

/** Relative distance from a whole number of steps that counts as that number (F4). */
const STEP_SNAP_TOLERANCE = 1e-9;

/** Steps per chunk between progress reports. */
export const CHUNK_STEPS = 50_000;

/** Propagation result, structure-of-arrays, SI units. N = number of samples. */
export interface Trajectory {
  readonly t: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly dt: number;
  readonly nStepsRequested: number;
  readonly status: 'completed' | 'impact';
  readonly tEnd: number;
}

export interface Progress {
  readonly stepsDone: number;
  readonly stepsTotal: number;
}

/** Whole steps of size `dt` that fit in `duration`, with the F4 snap rule. */
export function stepsForDuration(duration: unknown, dt: unknown): number {
  const d = asPositiveScalar(duration, 'duration');
  const h = asPositiveScalar(dt, 'dt');
  const q = d / h;
  if (!Number.isFinite(q)) {
    throw new ValueError(`duration / dt is too large to represent: ${String(d)} / ${String(h)}`);
  }
  const nearest = pyRound(q);
  let n: number;
  if (nearest >= 1 && Math.abs(q - nearest) <= STEP_SNAP_TOLERANCE * nearest) {
    n = nearest;
  } else {
    n = Math.floor(q);
  }
  if (n < 1) {
    throw new ValueError(
      `duration (${String(d)} s) is shorter than one step (dt = ${String(h)} s)`,
    );
  }
  return n;
}

/** Python's round(): half to even (Math.round rounds half up). */
function pyRound(q: number): number {
  const f = Math.floor(q);
  const diff = q - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * Propagate as a generator: yields Progress after every CHUNK_STEPS steps and returns
 * the Trajectory. Errors are thrown exactly as `propagate` throws them.
 */
export function* propagateChunks(
  r0: unknown,
  v0: unknown,
  dt: unknown,
  nSteps: unknown,
  mu: unknown = MU_EARTH,
  bodyRadius: unknown = R_EARTH,
  chunkSteps: number = CHUNK_STEPS,
): Generator<Progress, Trajectory, void> {
  const [x0, y0] = asVector2(r0, 'r0');
  const [vx0, vy0] = asVector2(v0, 'v0');
  const h = asPositiveScalar(dt, 'dt');
  const n = asPositiveInt(nSteps, 'n_steps');
  const m = asPositiveScalar(mu, 'mu');
  const body = asPositiveScalar(bodyRadius, 'body_radius');
  if (Math.sqrt(x0 * x0 + y0 * y0) <= body) {
    throw new ValueError(`r0 is at or inside the central body: |r0| <= ${String(body)} m`);
  }

  const x = new Float64Array(n + 1);
  const y = new Float64Array(n + 1);
  const vx = new Float64Array(n + 1);
  const vy = new Float64Array(n + 1);
  x[0] = x0;
  y[0] = y0;
  vx[0] = vx0;
  vy[0] = vy0;
  const s = new Float64Array(4);
  let cx = x0;
  let cy = y0;
  let cvx = vx0;
  let cvy = vy0;
  let status: 'completed' | 'impact' = 'completed';
  let last = n;

  for (let k = 1; k <= n; k++) {
    uncheckedStep(cx, cy, cvx, cvy, h, m, s);
    cx = s[0] as number;
    cy = s[1] as number;
    cvx = s[2] as number;
    cvy = s[3] as number;
    if (!(
      Number.isFinite(cx) &&
      Number.isFinite(cy) &&
      Number.isFinite(cvx) &&
      Number.isFinite(cvy)
    )) {
      throw new RuntimeError(`state became non-finite at step ${String(k)}`);
    }
    x[k] = cx;
    y[k] = cy;
    vx[k] = cvx;
    vy[k] = cvy;
    if (Math.sqrt(cx * cx + cy * cy) <= body) {
      status = 'impact';
      last = k;
      break;
    }
    if (k % chunkSteps === 0 && k < n) yield { stepsDone: k, stepsTotal: n };
  }

  const count = last + 1;
  const t = new Float64Array(count);
  for (let k = 0; k < count; k++) t[k] = k * h; // t_k = k * dt, never accumulated
  const trim = (a: Float64Array) => (count === n + 1 ? a : a.slice(0, count));
  return {
    t,
    x: trim(x),
    y: trim(y),
    vx: trim(vx),
    vy: trim(vy),
    dt: h,
    nStepsRequested: n,
    status,
    tEnd: t[count - 1] as number,
  };
}

/** Propagate a two-body orbit with `nSteps` fixed semi-implicit Euler steps (F3–F7). */
export function propagate(
  r0: unknown,
  v0: unknown,
  dt: unknown,
  nSteps: unknown,
  mu: unknown = MU_EARTH,
  bodyRadius: unknown = R_EARTH,
  chunkSteps: number = CHUNK_STEPS,
): Trajectory {
  const gen = propagateChunks(r0, v0, dt, nSteps, mu, bodyRadius, chunkSteps);
  for (;;) {
    const next = gen.next();
    if (next.done === true) return next.value;
  }
}
