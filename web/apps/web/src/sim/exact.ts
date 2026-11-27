/** Exact two-body path for display (ADR-0005 R8, R16): from the analytic module, never decimated against the run. */
import { analytic } from '@orbital/engine';

/**
 * Sample the exact trajectory over [t0, t1] so that no chord deviates from the curve by more
 * than `tol` metres at its midpoint. Returns packed [x0, y0, x1, y1, …].
 */
export function exactPath(
  orbit: analytic.KeplerOrbit,
  t0: number,
  t1: number,
  tol = 10,
  maxPoints = 60_000,
): Float64Array {
  const s = new Float64Array(4);
  const at = (t: number): [number, number] => {
    orbit.stateAt(t, s);
    return [s[0] as number, s[1] as number];
  };
  const out: number[] = [];
  const base = 256;
  let [ax, ay] = at(t0);
  out.push(ax, ay);
  for (let i = 0; i < base; i++) {
    const ta = t0 + ((t1 - t0) * i) / base;
    const tb = i === base - 1 ? t1 : t0 + ((t1 - t0) * (i + 1)) / base;
    // depth-first subdivision of [ta, tb], emitting points in order
    const stack: [number, number, number, number, number, number, number][] = [];
    const [bx, by] = at(tb);
    stack.push([ta, tb, ax, ay, bx, by, 0]);
    while (stack.length > 0) {
      const [u, v, ux, uy, vx, vy, depth] = stack.pop() as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const tm = 0.5 * (u + v);
      const [mx, my] = at(tm);
      const sag = Math.hypot(mx - 0.5 * (ux + vx), my - 0.5 * (uy + vy));
      if (sag > tol && depth < 20 && out.length / 2 < maxPoints) {
        stack.push([tm, v, mx, my, vx, vy, depth + 1]); // second half after the first
        stack.push([u, tm, ux, uy, mx, my, depth + 1]);
      } else {
        out.push(vx, vy);
      }
    }
    ax = bx;
    ay = by;
  }
  return Float64Array.from(out);
}
