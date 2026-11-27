/**
 * Display-side processing of a computed trajectory (ADR-0005 R2–R5, R16). Pure functions;
 * they run in the simulation worker and never change the data behind any number.
 */

/**
 * Sample indices where a revolution starts: 0, then every k with y[k−1] < 0 ≤ y[k] and x[k] > 0,
 * the crossing rule of `first_period` (WA-D4).
 */
export function revolutionStarts(x: Float64Array, y: Float64Array): Int32Array {
  const out = [0];
  for (let k = 1; k < y.length; k++) {
    if ((y[k - 1] as number) < 0 && (y[k] as number) >= 0 && (x[k] as number) > 0) out.push(k);
  }
  return Int32Array.from(out);
}

/**
 * Indices that decimation must keep in [lo, hi] (R16): both ends, and the samples on either side
 * of every local extremum of |r| (apsides). Revolution boundaries and the impact sample are the
 * ends of their segments, so they are kept by construction.
 */
export function mustKeep(x: Float64Array, y: Float64Array, lo: number, hi: number): number[] {
  const keep = [lo];
  const r = (k: number) => Math.hypot(x[k] as number, y[k] as number);
  let prev = r(lo);
  let cur = lo + 1 <= hi ? r(lo + 1) : prev;
  for (let k = lo + 1; k < hi; k++) {
    const next = r(k + 1);
    if ((cur > prev && cur >= next) || (cur < prev && cur <= next)) keep.push(k - 1, k, k + 1);
    prev = cur;
    cur = next;
  }
  keep.push(hi);
  return [...new Set(keep)].filter((k) => k >= lo && k <= hi).sort((a, b) => a - b);
}

/** Distance from (px, py) to the segment (ax, ay)–(bx, by). */
function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let u = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/**
 * Ramer–Douglas–Peucker on samples [lo, hi] with tolerance eps (metres), keeping `keep`.
 * Iterative, so 10⁶ samples cannot overflow the stack. Returns sorted sample indices.
 */
export function rdp(
  x: Float64Array,
  y: Float64Array,
  lo: number,
  hi: number,
  eps: number,
  keep: readonly number[],
): Int32Array {
  const marked = new Uint8Array(hi - lo + 1);
  for (const k of keep) marked[k - lo] = 1;
  // Simplify each span between consecutive kept samples independently.
  const stack: number[] = [];
  for (let i = 0; i + 1 < keep.length; i++) stack.push(keep[i] as number, keep[i + 1] as number);
  while (stack.length > 0) {
    const b = stack.pop() as number;
    const a = stack.pop() as number;
    if (b - a < 2) continue;
    const ax = x[a] as number;
    const ay = y[a] as number;
    const bx = x[b] as number;
    const by = y[b] as number;
    let worst = -1;
    let at = -1;
    for (let k = a + 1; k < b; k++) {
      const d = segmentDistance(x[k] as number, y[k] as number, ax, ay, bx, by);
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (worst > eps) {
      marked[at - lo] = 1;
      stack.push(a, at, at, b);
    }
  }
  let count = 0;
  for (const m of marked) count += m;
  const out = new Int32Array(count);
  let j = 0;
  for (let i = 0; i < marked.length; i++) if (marked[i]) out[j++] = lo + i;
  return out;
}

export const RDP_EPS_M = 100;
export const VERTEX_CAP = 20_000;

/** R3: ε = 100 m, doubled until the line fits the vertex cap; the achieved ε is reported. */
export function decimate(
  x: Float64Array,
  y: Float64Array,
  lo: number,
  hi: number,
): { indices: Int32Array; eps: number } {
  const keep = mustKeep(x, y, lo, hi);
  let eps = RDP_EPS_M;
  for (;;) {
    const indices = rdp(x, y, lo, hi, eps, keep);
    if (indices.length <= VERTEX_CAP || eps > 1e9) return { indices, eps };
    eps *= 2;
  }
}

/**
 * Cubic Hermite position between samples k and k+1 at fraction s ∈ [0, 1] (R2). Display only.
 * Writes [x, y] in metres.
 */
export function hermite(
  x0: number,
  y0: number,
  vx0: number,
  vy0: number,
  x1: number,
  y1: number,
  vx1: number,
  vy1: number,
  dt: number,
  s: number,
  out: Float64Array,
): void {
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  out[0] = h00 * x0 + h10 * dt * vx0 + h01 * x1 + h11 * dt * vx1;
  out[1] = h00 * y0 + h10 * dt * vy0 + h01 * y1 + h11 * dt * vy1;
}

/** R1: readouts use sample k = min(⌊t/Δt⌋, N − 1). */
export function sampleIndex(t: number, dt: number, n: number): number {
  let k = Math.floor(t / dt);
  // t / dt can round below an integer even when t is exactly sample k's time k·dt.
  if ((k + 1) * dt <= t) k += 1;
  else if (k * dt > t) k -= 1;
  return k < 0 ? 0 : k > n - 1 ? n - 1 : k;
}
