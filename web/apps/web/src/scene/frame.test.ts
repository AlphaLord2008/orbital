import { R_EARTH } from '@orbital/engine';
import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_KM,
  earthAngle,
  ENGINE_TO_SCENE,
  engineToScene,
  OMEGA_EARTH,
  sceneToEngine,
} from './frame';

// ADR-0004 §5 frame tests.
describe('frame', () => {
  it('is a proper rotation (determinant +1, orthonormal)', () => {
    const m = ENGINE_TO_SCENE.map((row) => [...row]);
    const det = (a: number[][]) =>
      a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
      a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
      a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
    expect(det(m)).toBe(1);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let dot = 0;
        for (let k = 0; k < 3; k++) dot += m[i]![k]! * m[j]![k]!;
        expect(dot).toBe(i === j ? 1 : 0);
      }
  });
  it('engineToScene applies the matrix and the 1/1000 scale', () => {
    const [X, Y, Z] = engineToScene(1.5e6, -2.5e6, 3.5e6);
    const m = ENGINE_TO_SCENE;
    const v = [1.5e6, -2.5e6, 3.5e6];
    const ref = m.map((row) => (row[0] * v[0]! + row[1] * v[1]! + row[2] * v[2]!) / 1000);
    expect([X, Y, Z]).toEqual(ref);
  });
  it('round trip engine → scene → engine within 1 ulp relative', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 8e7;
    for (let i = 0; i < 1000; i++) {
      const p = [rnd(), rnd(), rnd()] as const;
      const back = sceneToEngine(...engineToScene(p[0], p[1], p[2]));
      for (let j = 0; j < 3; j++) {
        const pj = p[j] as number;
        expect(Math.abs((back[j] as number) - pj) / Math.abs(pj)).toBeLessThanOrEqual(
          Number.EPSILON,
        );
      }
    }
  });
  it('a counter-clockwise engine orbit has angular velocity along scene +Y', () => {
    const [ax, ay, az] = engineToScene(7e6, 0);
    const [bx, by, bz] = engineToScene(0, 7e6);
    // (a × b) is the rotation axis of a CCW quarter turn
    const cross = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    expect(cross[0]).toBe(0);
    expect(cross[1]).toBeGreaterThan(0);
    expect(cross[2]).toBe(0);
  });
  it('Earth radius equals R_EARTH / 1000 exactly', () => {
    expect(EARTH_RADIUS_KM).toBe(R_EARTH / 1000);
    expect(EARTH_RADIUS_KM).toBe(6378.137);
  });
  it('Earth turns 2π in one sidereal period, within 1e-12 rad', () => {
    expect(Math.abs(earthAngle((2 * Math.PI) / OMEGA_EARTH) - 2 * Math.PI)).toBeLessThanOrEqual(
      1e-12,
    );
  });
});
