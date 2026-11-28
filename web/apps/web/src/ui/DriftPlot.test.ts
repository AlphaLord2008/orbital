import { describe, expect, it } from 'vitest';
import { niceCeil, runningMaxPoints, yTicks } from './DriftPlot';

describe('drift plot (WA-F8)', () => {
  it('the running-maximum line is monotone and ends exactly at the headline value', () => {
    const max = Float32Array.from([1e-4, 3e-4, 2e-4, 5e-4, 4e-4]);
    // Playback inside bucket 3; the headline is the running max up to sample k (4.5e-4 here).
    const pts = runningMaxPoints(max, 3, 4.5e-4);
    expect(pts.map((p) => p.b)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < pts.length; i++)
      expect(pts[i]?.v).toBeGreaterThanOrEqual(pts[i - 1]?.v ?? 0);
    expect(pts.at(-1)?.v).toBe(4.5e-4);
    // Buckets not yet fully played (3 and 4) never contribute: 5e-4 is not shown before its time.
    expect(Math.max(...pts.map((p) => p.v))).toBeLessThan(5e-4);
  });

  it('the line never drops below the past maximum, even if the headline is stale-low', () => {
    const max = Float32Array.from([2e-3, 1e-3]);
    expect(runningMaxPoints(max, 1, 1e-3).at(-1)?.v).toBe(max[0]);
  });

  it('axis tops are round values at or above the data', () => {
    expect(niceCeil(4.61e-3)).toBeCloseTo(5e-3, 15);
    expect(niceCeil(0.0316)).toBeCloseTo(0.05, 15);
    expect(niceCeil(1e-3)).toBeCloseTo(1e-3, 15);
    expect(niceCeil(1.2e-15)).toBeCloseTo(2e-15, 25);
  });

  it('ticks factor out small powers of ten', () => {
    expect(yTicks(5e-3)).toEqual({ factor: '× 10⁻³', labels: ['5', '2.5', '0'] });
    expect(yTicks(1e-15)).toEqual({ factor: '× 10⁻¹⁵', labels: ['1', '0.5', '0'] });
    expect(yTicks(0.05)).toEqual({ factor: null, labels: ['0.05', '0.025', '0'] });
  });
});
