/** Camera presets and limits (ADR-0004 §4). */
import { type PerspectiveCamera, Vector3 } from 'three';
import { EARTH_RADIUS_KM } from './frame';

export const FOV_DEG = 30;
export const NEAR_KM = 10;
export const FAR_KM = 1e7;
/** Closest approach: 1,000 km above the surface. */
export const MIN_DISTANCE_KM = EARTH_RADIUS_KM + 1000;
// Far enough to frame a one-day escape (X1) on a narrow portrait phone; the log depth buffer keeps precision.
export const MAX_DISTANCE_KM = 4e6;

/**
 * Distance at which a sphere of radius `extentKm` around the target fills the view with a margin.
 * `frame` is the part of the canvas not covered by panels, as fractions of its width and height
 * (the projection centre is moved to that region, see `Scene.tsx`), so the orbit is framed where
 * it can be seen rather than under a panel.
 */
export function fitDistance(
  camera: PerspectiveCamera,
  extentKm: number,
  frame: { w: number; h: number } = { w: 1, h: 1 },
): number {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  const vHalf = Math.atan(t * frame.h);
  const hHalf = Math.atan(t * camera.aspect * frame.w);
  const half = Math.min(vHalf, hHalf);
  const d = (extentKm * 1.4) / Math.sin(half); // margin matches the approved D1 framing
  return Math.min(Math.max(d, MIN_DISTANCE_KM), MAX_DISTANCE_KM);
}

/**
 * Exact perspective fit: the smallest camera distance along `dir` (unit, target → camera; the
 * target is the origin) at which every point projects inside the free part of the view with
 * `margin` (≥ 1; 1.35 matches the approved D1 framing of a LEO circle). A point nearer the camera
 * than the target projects larger than a bounding sphere suggests, which is why a sphere fit
 * let long escape paths leave narrow screens. Points are flat [x, y, z, …] in scene km.
 */
export function fitDistanceForPoints(
  camera: PerspectiveCamera,
  dir: Vector3,
  points: ArrayLike<number>,
  frame: { w: number; h: number } = { w: 1, h: 1 },
  margin = 1.35,
): number {
  const tanV = Math.tan((camera.fov * Math.PI) / 360) * frame.h;
  const tanH = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect * frame.w;
  // Camera basis: right ⟂ world up and dir; up completes it (top-down falls back to +x right).
  const right = new Vector3(0, 1, 0).cross(dir);
  if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
  right.normalize();
  const up = dir.clone().cross(right).normalize();
  let d = MIN_DISTANCE_KM;
  for (let i = 0; i + 2 < points.length; i += 3) {
    const x = points[i] as number;
    const y = points[i + 1] as number;
    const z = points[i + 2] as number;
    const along = x * dir.x + y * dir.y + z * dir.z; // toward the camera
    const lx = Math.abs(x * right.x + y * right.y + z * right.z);
    const ly = Math.abs(x * up.x + y * up.y + z * up.z);
    d = Math.max(d, along + (margin * lx) / tanH, along + (margin * ly) / tanV);
  }
  return Math.min(d, MAX_DISTANCE_KM);
}

/** Unit direction from the target to the camera for each preset. */
export function presetDirection(
  preset: 'top' | 'oblique' | 'fit',
  current: Vector3,
  focus?: Vector3,
): Vector3 {
  if (preset === 'fit' && focus) {
    // Look at an event (the impact) from 30° above the orbit plane.
    const el = (30 * Math.PI) / 180;
    const h = new Vector3(focus.x, 0, focus.z).normalize().multiplyScalar(Math.cos(el));
    return h.setY(Math.sin(el)).normalize();
  }
  if (preset === 'top') return new Vector3(0, 1, 1e-6).normalize(); // engine +x right, +y up
  if (preset === 'oblique') {
    // 30° above the orbit plane, looking from the side the spacecraft flies toward first
    // (engine +y, scene −Z), so a new run starts in front of the Earth (approved D1 framing).
    const el = (30 * Math.PI) / 180;
    const az = (20 * Math.PI) / 180;
    return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }
  return current.clone().normalize();
}

/** km per CSS pixel at distance d for a viewport `heightPx` tall. */
export function kmPerPixel(camera: PerspectiveCamera, d: number, heightPx: number): number {
  return (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / heightPx;
}

/** A "nice" scale-bar length (1, 2 or 5 × 10ⁿ km) close to `targetPx` pixels. */
export function niceScale(kmPerPx: number, targetPx = 96): { km: number; px: number } {
  const raw = kmPerPx * targetPx;
  const p = 10 ** Math.floor(Math.log10(raw));
  const km = [1, 2, 5, 10]
    .map((m) => m * p)
    .reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best));
  return { km, px: km / kmPerPx };
}

/** True when the segment from the camera to P passes through the Earth before reaching P. */
export function occludedByEarth(cam: Vector3, px: number, py: number, pz: number): boolean {
  const pr = Math.hypot(px, py, pz);
  const R = Math.min(EARTH_RADIUS_KM, pr) * (1 - 1e-9);
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (cam.x * dx + cam.y * dy + cam.z * dz);
  const c = cam.x * cam.x + cam.y * cam.y + cam.z * cam.z - R * R;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return false;
  const s = (-b - Math.sqrt(disc)) / (2 * a);
  return s > 0 && s < 1;
}
