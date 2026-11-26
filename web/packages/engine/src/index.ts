/**
 * @orbital/engine: TypeScript port of the validated ORBITAL core (ADR-0003).
 *
 * Python (`orbital`) is authoritative. This port must pass, independently:
 *   - analytic validation against the stored 50-digit reference (test/validation.test.ts),
 *   - the v0.1.0 acceptance tests T1–T10 (test/acceptance.test.ts),
 *   - conformance with Python output, C1–C8 (test/conformance.test.ts),
 * in Node and in Chromium, Firefox and WebKit.
 *
 * Boundary (TS T12): zero runtime dependencies, no DOM types, no React/three/app imports.
 */
export { MU_EARTH, R_EARTH } from './constants';
export { RuntimeError, ValueError } from './errors';
export {
  circularInitialState,
  circularVelocity,
  gravityAccel,
  semiImplicitEulerStep,
  uncheckedStep,
  type Vec2,
} from './dynamics';
export {
  CHUNK_STEPS,
  propagate,
  propagateChunks,
  stepsForDuration,
  type Progress,
  type Trajectory,
} from './propagate';
export {
  angularMomentumZ,
  firstPeriod,
  maxRelativeDrift,
  radius,
  specificEnergy,
} from './diagnostics';
export * as analytic from './analytic';

export const ENGINE_PACKAGE = '@orbital/engine';
export const ENGINE_VERSION = '0.1.1';

/**
 * The Python release this engine has been shown to conform to. Set only when C1–C8 and
 * the analytic validation pass in all four environments; the UI says "Pending" while null (G1-5).
 */
export const CONFORMS_TO_PYTHON: string | null = null;
