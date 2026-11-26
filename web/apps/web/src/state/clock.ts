/** Playback clock (WA-F6). Pure; the store calls it once per animation frame. */

export const RATES = [1, 10, 60, 600, 3600, 10_000] as const;
export type Rate = (typeof RATES)[number] | 'fit';

/** "Fit" plays the whole run in 20 s of wall time. */
export const FIT_SECONDS = 20;

export function rateValue(rate: Rate, tEnd: number): number {
  return rate === 'fit' ? tEnd / FIT_SECONDS : rate;
}

/** Advance playback by `wallDt` seconds. Stops at the end of the run. */
export function advance(
  t: number,
  wallDt: number,
  rate: Rate,
  tEnd: number,
): { t: number; ended: boolean } {
  const next = t + Math.min(wallDt, 0.25) * rateValue(rate, tEnd); // a stalled tab does not jump ahead
  return next >= tEnd ? { t: tEnd, ended: true } : { t: next, ended: false };
}

/** Time of sample k: k·Δt, the engine's own t_k (never accumulated). */
export function sampleTime(k: number, dt: number): number {
  return k * dt;
}

/** The revolution containing sample k: index into `starts`. */
export function revolutionOf(starts: Int32Array, k: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] as number) <= k) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
