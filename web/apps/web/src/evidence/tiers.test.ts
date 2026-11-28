import { describe, expect, it } from 'vitest';
import { buildRun, PRESETS, type PresetId } from '../sim/scenario';
import report from '../../../../../docs/validation/v0.1-circular-orbit.md?raw';
import results from '../../../../../docs/validation/v0.1.1-results.json';
import { evidenceFor, sci, V0_V010_ROWS } from './tiers';

const steps = (s: Parameters<typeof buildRun>[0]) => {
  const b = buildRun(s);
  if (!b.ok) throw new Error(b.message);
  return b.run.nSteps;
};

describe('evidence tiers (ADR-0008)', () => {
  it('each preset gets its own tier and case', () => {
    const got = (Object.keys(PRESETS) as PresetId[]).map((id) => {
      const s = PRESETS[id].scenario;
      const e = evidenceFor(s, steps(s));
      return `${id}:${String(e.tier)}:${String(e.id)}`;
    });
    expect(got).toEqual(['V0:1:V0', 'P1:2:P1', 'E1:2:E1', 'X1:2:X1', 'I1:2:I1', 'P2:2:P2']);
  });
  it('similarity earns nothing: k = 1.11, 401 km and dt 0.9 s are Unvalidated', () => {
    const e1 = PRESETS.E1.scenario;
    expect(evidenceFor({ ...e1, k: 1.11 }, steps({ ...e1, k: 1.11 })).tier).toBe(3);
    const v0 = PRESETS.V0.scenario;
    expect(evidenceFor({ ...v0, altitudeM: 401_000 }, 1000).tier).toBe(3);
    expect(evidenceFor({ ...v0, dtS: 0.9 }, 1000).tier).toBe(3);
  });
  it('prefix inheritance: shorter keeps the tier, longer loses it', () => {
    const v0 = PRESETS.V0.scenario;
    expect(
      evidenceFor(
        { ...v0, duration: { kind: 'orbits', n: 3 } },
        steps({ ...v0, duration: { kind: 'orbits', n: 3 } }),
      ).tier,
    ).toBe(1);
    expect(
      evidenceFor(
        { ...v0, duration: { kind: 'orbits', n: 11 } },
        steps({ ...v0, duration: { kind: 'orbits', n: 11 } }),
      ).tier,
    ).toBe(3);
  });
  it('Tier 1 values equal the published v0.1.0 report', () => {
    for (const row of V0_V010_ROWS) {
      const number = row.measured.replace(/ m$/, '');
      expect(report, row.test).toContain(number);
    }
  });
  it('Tier 2 rows are the registered values, every gated one marked by its limit', () => {
    const e = evidenceFor(PRESETS.E1.scenario, steps(PRESETS.E1.scenario));
    const energy = e.rows.find((r) => r.test === 'Energy |Δε/ε₀|');
    expect(energy).toEqual({
      test: 'Energy |Δε/ε₀|',
      limit: '≤ 4.00 × 10⁻⁴',
      measured: '2.02 × 10⁻⁴',
    });
    expect(e.rows.find((r) => r.test === 'Position at 1 rev')?.measured).toBe('65.6 m');
    // Every registered metric of every case has a label: nothing is silently dropped.
    for (const id of ['P1', 'E1', 'X1', 'I1', 'P2'] as const) {
      const ev = evidenceFor(PRESETS[id].scenario, steps(PRESETS[id].scenario));
      expect(ev.rows.length, id).toBe(Object.keys(results.cases[id].metrics).length);
    }
    const x1 = evidenceFor(PRESETS.X1.scenario, steps(PRESETS.X1.scenario));
    expect(x1.rows.find((r) => r.test === 'Position |Δr|/|r|, 24 h')).toEqual({
      test: 'Position |Δr|/|r|, 24 h',
      limit: '≤ 2.00 × 10⁻³',
      measured: '7.88 × 10⁻⁴',
    });
  });
  it('scientific formatting', () => {
    expect(sci(1.28e-6)).toBe('1.28 × 10⁻⁶');
    expect(sci(1e-10)).toBe('1.00 × 10⁻¹⁰');
    expect(sci(1e-10, 3, true)).toBe('10⁻¹⁰');
    expect(sci(65.6355)).toBe('65.6');
    expect(sci(10)).toBe('10');
  });
});
