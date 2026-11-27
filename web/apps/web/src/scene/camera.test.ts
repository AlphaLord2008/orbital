import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fitDistance, MIN_DISTANCE_KM, niceScale, occludedByEarth } from './camera';
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
  it('scale bar picks 1-2-5 lengths', () => {
    expect(niceScale(20).km).toBe(2000);
    expect(niceScale(0.6).km).toBe(50);
  });
});
