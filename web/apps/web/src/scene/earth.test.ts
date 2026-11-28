import { describe, expect, it } from 'vitest';
import { maxTier, neededTier, tierBytes } from './earth';

describe('Earth texture selection (requirements §6.1, ADR-0004 §2)', () => {
  it('loads a sharper texture only when the current one would be magnified', () => {
    // W/π texels span the disc: 2K covers ≤ 651 px, 4K ≤ 1303 px.
    expect(neededTier(300)).toBe('2k');
    expect(neededTier(651)).toBe('2k');
    expect(neededTier(700)).toBe('4k');
    expect(neededTier(1303)).toBe('4k');
    expect(neededTier(1400)).toBe('8k');
  });

  it('caps the texture by device class', () => {
    const desk = { maxTextureSize: 16384, screenMinPx: 900, deviceMemoryGb: 8 };
    expect(maxTier(desk)).toBe('8k'); // class A
    expect(maxTier({ ...desk, deviceMemoryGb: undefined })).toBe('8k'); // Safari/Firefox: no report
    expect(maxTier({ ...desk, deviceMemoryGb: 4 })).toBe('4k'); // class B laptop
    expect(maxTier({ ...desk, maxTextureSize: 4096 })).toBe('4k'); // GPU cannot hold 8K
    expect(maxTier({ ...desk, screenMinPx: 390 })).toBe('4k'); // class C phone
    expect(maxTier({ ...desk, screenMinPx: 390, deviceMemoryGb: 2 })).toBe('2k'); // class D
    expect(maxTier({ ...desk, maxTextureSize: 2048 })).toBe('2k');
  });

  it('GPU memory per tier stays inside the class budgets (≤ 64 MB C/D, ≤ 192 MB A)', () => {
    const MB = 1024 * 1024;
    expect(tierBytes('2k') / MB).toBeCloseTo(10.67, 1);
    expect(tierBytes('4k') / MB).toBeCloseTo(42.67, 1);
    expect(tierBytes('4k')).toBeLessThanOrEqual(64 * MB);
    expect(tierBytes('8k') / MB).toBeCloseTo(170.67, 1);
    expect(tierBytes('8k')).toBeLessThanOrEqual(192 * MB);
  });
});
