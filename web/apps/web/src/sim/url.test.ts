import { describe, expect, it } from 'vitest';
import { evidenceFor } from '../evidence/tiers';
import { parseField } from './schema';
import { buildRun, PRESETS, type PresetId } from './scenario';
import { decodeScenario, encodeScenario } from './url';

describe('share link v1 (WA-F12, WA-E6)', () => {
  it('every preset round-trips bit for bit and keeps its tier', () => {
    for (const id of Object.keys(PRESETS) as PresetId[]) {
      const s = PRESETS[id].scenario;
      const d = decodeScenario(encodeScenario(s, 'analyze'));
      expect(d.ok).toBe(true);
      if (d.ok !== true) continue;
      expect(d.scenario).toEqual(s);
      expect(Object.is(d.scenario.altitudeM, s.altitudeM)).toBe(true);
      expect(d.mode).toBe('analyze');
      const b = buildRun(d.scenario);
      expect(b.ok && evidenceFor(d.scenario, b.run.nSteps).id).toBe(id);
    }
  });
  it('rejects, never clamps', () => {
    const bad = [
      ['?v=1&h=50000&k=1&dt=1&d=10o', 'altitude'],
      ['?v=1&h=400000&k=1.7&dt=1&d=10o', 'speed factor'],
      ['?v=1&h=400000&k=1&dt=0.01&d=10o', 'time step'],
      ['?v=1&h=4e5&k=1&dt=1&d=10o', 'plain decimal'],
      ['?v=1&h=-400000&k=1&dt=1&d=10o', 'plain decimal'],
      ['?v=1&h=400000&k=1&dt=1&d=10x', 'duration'],
      ['?v=2&h=400000&k=1&dt=1&d=10o', 'version'],
      [`?v=1&h=400000&k=1&dt=1&d=10o&pad=${'x'.repeat(520)}`, 'longer than 512'],
    ] as const;
    for (const [q, word] of bad) {
      const d = decodeScenario(q);
      expect(d.ok, q).toBe(false);
      if (d.ok === false) expect(d.message).toContain(word);
    }
  });
  it('ignores unknown keys and treats a bare URL as no scenario', () => {
    expect(decodeScenario('?v=1&h=400000&k=1&dt=1&d=10o&utm=x').ok).toBe(true);
    expect(decodeScenario('').ok).toBe('empty');
    expect(decodeScenario('?utm=x').ok).toBe('empty');
  });
  it('fields share the schema: exact typed values, range messages', () => {
    expect(parseField('k', '1.4142')).toEqual({ ok: true, value: 1.4142 });
    expect(parseField('altitude', '99').ok).toBe(false);
    expect(parseField('altitude', '1e3').ok).toBe(false);
    expect(parseField('dt', ' 60 ')).toEqual({ ok: true, value: 60 });
  });
});
