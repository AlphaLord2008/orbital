import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  fitDistance,
  fitDistanceForPoints,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  niceScale,
  occludedByEarth,
  presetDirection,
} from './camera';
import { EARTH_RADIUS_KM } from './frame';

describe('camera helpers', () => {
  it('occlusion: far side hidden, near side and limb-grazing LEO visible', () => {
    const cam = new Vector3(0, 0, 50_000);
    const leo = EARTH_RADIUS_KM + 400;
    expect(occludedByEarth(cam, 0, 0, -leo)).toBe(true); // directly behind
    expect(occludedByEarth(cam, 0, 0, leo)).toBe(false); // in front
    expect(occludedByEarth(cam, leo, 0, 0)).toBe(false); // beside the limb: 400 km line never wrongly hidden
    expect(occludedByEarth(cam, 0, leo * 0.999, -leo * 0.05)).toBe(false);
  });
  it('a point on the surface facing the camera is visible; one on the far side is not', () => {
    const cam = new Vector3(0, 0, 50_000);
    expect(occludedByEarth(cam, 0, 0, EARTH_RADIUS_KM - 1)).toBe(false);
    expect(occludedByEarth(cam, 0, 0, -(EARTH_RADIUS_KM - 1))).toBe(true);
  });
  it('fit distance keeps the extent in view and respects the minimum', () => {
    const cam = new PerspectiveCamera(30, 16 / 9, 10, 1e6);
    const d = fitDistance(cam, 42_164);
    expect(Math.asin(42_164 / d)).toBeLessThan((15 * Math.PI) / 180 / 1.3);
    expect(fitDistance(cam, 1)).toBe(MIN_DISTANCE_KM);
  });
  it('fit distance frames the orbit inside the part of the view no panel covers', () => {
    const cam = new PerspectiveCamera(30, 1440 / 900, 10, 1e6);
    const whole = fitDistance(cam, 20_000);
    const narrow = fitDistance(cam, 20_000, { w: 0.5, h: 0.8 });
    expect(narrow).toBeGreaterThan(whole);
    // The extent's angular radius fits the free region's half-width with the same margin.
    const t = Math.tan((15 * Math.PI) / 180);
    const hHalf = Math.atan(t * cam.aspect * 0.5);
    expect(Math.asin((20_000 * 1.4) / narrow)).toBeCloseTo(Math.min(hHalf, Math.atan(t * 0.8)), 9);
  });
  it('oblique looks from the side the spacecraft flies toward first (scene −Z, engine +y)', () => {
    const d = presetDirection('oblique', new Vector3(1, 0, 0));
    expect(d.length()).toBeCloseTo(1, 12);
    expect(d.z).toBeLessThan(0);
    expect(Math.asin(d.y)).toBeCloseTo((30 * Math.PI) / 180, 12);
  });
  it('the perspective fit keeps every point inside the free view, including points near the camera', () => {
    const cam = new PerspectiveCamera(30, 375 / 520, 10, 1e6);
    const dir = presetDirection('oblique', new Vector3(1, 0, 0));
    // A long straight escape leg running toward and across the camera.
    const pts: number[] = [];
    for (let i = 0; i <= 100; i++) pts.push(7000 + i * 500, 0, -i * 300); // fit stays below MAX_DISTANCE_KM
    const frame = { w: 1, h: 0.8 };
    const d = fitDistanceForPoints(cam, dir, pts, frame);
    expect(d).toBeLessThan(MAX_DISTANCE_KM);
    cam.position.copy(dir).multiplyScalar(d);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    for (let i = 0; i < pts.length; i += 3) {
      const v = new Vector3(pts[i], pts[i + 1], pts[i + 2]).project(cam);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1 / 1.35 + 1e-9);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(0.8 / 1.35 + 1e-9);
    }
  });
  it('scale bar picks 1-2-5 lengths', () => {
    expect(niceScale(20).km).toBe(2000);
    expect(niceScale(0.6).km).toBe(50);
  });
});
