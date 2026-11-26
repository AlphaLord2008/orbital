/**
 * Engine ↔ scene mapping (ADR-0004 §1). The only place where metres become kilometres and
 * engine axes become scene axes.
 *
 *   [X, Y, Z]_scene,km = (1/1000) · [[1, 0, 0], [0, 0, 1], [0, −1, 0]] · [x, y, z]_engine,m
 *
 * Engine orbits lie in z = 0, so scene Y (north) is always 0 for trajectory points and a
 * counter-clockwise engine orbit is counter-clockwise seen from scene +Y.
 */
import { R_EARTH } from '@orbital/engine';

/** Metres per scene unit. */
export const M_PER_UNIT = 1000;

/** The mapping as a row-major 3 × 3 matrix (dimensionless; the 1/1000 is applied separately). */
export const ENGINE_TO_SCENE: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
];

/** Earth radius in scene units (km), from the engine constant, never typed. */
export const EARTH_RADIUS_KM = R_EARTH / M_PER_UNIT;

/** WGS 84 nominal Earth rotation rate [rad/s] (ADR-0004 §2). */
export const OMEGA_EARTH = 7.292115e-5;

/** Engine (x, y, z) in metres → scene (X, Y, Z) in km. */
export function engineToScene(x: number, y: number, z = 0): [number, number, number] {
  return [x / M_PER_UNIT, z / M_PER_UNIT, -y / M_PER_UNIT];
}

/** Scene (X, Y, Z) in km → engine (x, y, z) in metres. */
export function sceneToEngine(X: number, Y: number, Z: number): [number, number, number] {
  return [X * M_PER_UNIT, -Z * M_PER_UNIT, Y * M_PER_UNIT];
}

/**
 * Write engine-plane samples (x[i], y[i]) for the listed indices into a packed Float32 array
 * of scene positions [X, 0, Z, …].
 */
export function packScenePositions(
  x: Float64Array,
  y: Float64Array,
  indices: ArrayLike<number>,
  out = new Float32Array(indices.length * 3),
): Float32Array {
  for (let i = 0; i < indices.length; i++) {
    const k = indices[i] as number;
    out[3 * i] = (x[k] as number) / M_PER_UNIT;
    out[3 * i + 1] = 0;
    out[3 * i + 2] = -(y[k] as number) / M_PER_UNIT;
  }
  return out;
}

/** Earth rotation angle about scene +Y at simulation time t [s]; θ₀ = 0 (arbitrary, disclosed). */
export function earthAngle(t: number): number {
  return OMEGA_EARTH * t;
}
