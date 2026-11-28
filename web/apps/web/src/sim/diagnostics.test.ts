import {
  firstPeriod,
  maxRelativeDrift,
  propagate,
  specificEnergy,
  angularMomentumZ,
} from '@orbital/engine';
import { describe, expect, it } from 'vitest';
import { bucketOf, PLOT_BUCKETS, runDiagnostics } from './diagnostics';
import { buildRun, PRESETS } from './scenario';

function run(id: keyof typeof PRESETS) {
  const b = buildRun(PRESETS[id].scenario);
  if (!b.ok) throw new Error(b.message);
  return propagate([...b.run.r0], [...b.run.v0], b.run.dt, b.run.nSteps);
}

describe('run diagnostics (WA-F8)', () => {
  it('the final running max equals the engine drift statistic', () => {
    for (const id of ['V0', 'E1', 'P2', 'I1'] as const) {
      const t = run(id);
      const d = runDiagnostics(t);
      const n = t.x.length;
      const eTrue = maxRelativeDrift(specificEnergy(t.x, t.y, t.vx, t.vy));
      const hTrue = maxRelativeDrift(angularMomentumZ(t.x, t.y, t.vx, t.vy));
      expect(Math.abs((d.eMaxSoFar[n - 1] as number) - eTrue) / eTrue).toBeLessThan(1e-6); // float32 storage
      expect(d.hMaxSoFar[n - 1]).toBeCloseTo(hTrue, 20);
      expect(d.energyScale).toBe('eps0');
    }
  });
  it('the running max is monotone and the buckets bound every sample', () => {
    const t = run('E1');
    const d = runDiagnostics(t);
    const n = t.x.length;
    for (let k = 1; k < n; k++)
      expect(d.eMaxSoFar[k]).toBeGreaterThanOrEqual(d.eMaxSoFar[k - 1] as number);
    expect(bucketOf(0, n)).toBe(0);
    expect(bucketOf(n - 1, n)).toBe(PLOT_BUCKETS - 1);
    const e = specificEnergy(t.x, t.y, t.vx, t.vy);
    for (let k = 0; k < n; k += 97) {
      const de = Math.fround(
        Math.abs((e[k] as number) - (e[0] as number)) / Math.abs(e[0] as number),
      );
      const b = bucketOf(k, n);
      expect(de).toBeGreaterThanOrEqual(d.eMin[b] as number);
      expect(de).toBeLessThanOrEqual(d.eMax[b] as number);
    }
  });
  it('run-measured first period and altitude range; none for an impact run', () => {
    const v0 = run('V0');
    const d = runDiagnostics(v0);
    expect(d.firstPeriodRun).toBe(firstPeriod(v0));
    expect(d.altMinRun).toBeLessThan(400_000);
    expect(d.altMaxRun).toBeGreaterThan(400_000);
    expect(runDiagnostics(run('I1')).firstPeriodRun).toBeNull();
  });
});
