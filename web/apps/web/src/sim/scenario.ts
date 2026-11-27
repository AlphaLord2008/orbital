/**
 * Scenario → engine run (WA-F1, WA-F2, WA-F4, WA-F11). One place builds the initial state,
 * so presets reproduce their v0.1.1 cases bit for bit.
 */
import { analytic, MU_EARTH, R_EARTH, stepsForDuration } from '@orbital/engine';

export type Duration =
  | { readonly kind: 'orbits'; readonly n: number }
  | { readonly kind: 'seconds'; readonly s: number };

export interface Scenario {
  readonly altitudeM: number;
  readonly k: number;
  readonly dtS: number;
  readonly duration: Duration;
}

export const STEP_BUDGET = 1_000_000;

export type PresetId = 'V0' | 'P1' | 'E1' | 'X1' | 'I1' | 'P2';

/** GEO altitude of case P1, (μ/ω_E²)^(1/3) − R_E as computed by Python (requirements-0.1.1 §5). */
export const GEO_ALTITUDE_M = 35786035.93115724;

export const PRESETS: Readonly<
  Record<PresetId, { readonly label: string; readonly scenario: Scenario }>
> = {
  V0: {
    label: 'ISS · 400 km',
    scenario: { altitudeM: 400_000, k: 1, dtS: 1, duration: { kind: 'orbits', n: 10 } },
  },
  P1: {
    label: 'GEO',
    scenario: { altitudeM: GEO_ALTITUDE_M, k: 1, dtS: 10, duration: { kind: 'orbits', n: 2 } },
  },
  E1: {
    label: 'Ellipse · k 1.10',
    scenario: { altitudeM: 400_000, k: 1.1, dtS: 1, duration: { kind: 'orbits', n: 2 } },
  },
  X1: {
    label: 'Escape · k 1.42',
    scenario: { altitudeM: 400_000, k: 1.42, dtS: 1, duration: { kind: 'seconds', s: 86_400 } },
  },
  I1: {
    label: 'Impact · k 0.98',
    scenario: { altitudeM: 400_000, k: 0.98, dtS: 1, duration: { kind: 'orbits', n: 1 } },
  },
  P2: {
    label: 'Coarse step · Δt 60 s',
    scenario: { altitudeM: 400_000, k: 1, dtS: 60, duration: { kind: 'orbits', n: 10 } },
  },
};

export interface RunSpec {
  readonly r0: readonly [number, number];
  readonly v0: readonly [number, number];
  readonly dt: number;
  readonly nSteps: number;
  readonly duration: number;
}

export type BuildResult =
  | { readonly ok: true; readonly run: RunSpec }
  | {
      readonly ok: false;
      readonly field: 'duration' | 'dt';
      readonly message: string;
      readonly suggestedDt?: number;
    };

/** r₀ = (R_E + h, 0), v₀ = (0, k·√(μ/r₀)), the construction of `circular_initial_state` and the v0.1.1 cases. */
export function initialState(s: Scenario): { r0: [number, number]; v0: [number, number] } {
  const radius = R_EARTH + s.altitudeM;
  return { r0: [radius, 0], v0: [0, s.k * Math.sqrt(MU_EARTH / radius)] };
}

export function buildRun(s: Scenario): BuildResult {
  const { r0, v0 } = initialState(s);
  let duration: number;
  if (s.duration.kind === 'orbits') {
    if (analytic.classify(r0, v0) !== 'bound') {
      return {
        ok: false,
        field: 'duration',
        message: 'This trajectory is not bound, so it has no period. Give the duration as a time.',
      };
    }
    duration = s.duration.n * analytic.period(r0, v0);
  } else {
    duration = s.duration.s;
  }
  const nSteps = stepsForDuration(duration, s.dtS);
  if (nSteps > STEP_BUDGET) {
    // Smallest dt (to 0.1 s) that fits the budget, never a silent truncation (WA-F4).
    const suggestedDt = Math.ceil((duration / STEP_BUDGET) * 10) / 10;
    return {
      ok: false,
      field: 'dt',
      message: `${nSteps.toLocaleString('en-US')} steps exceed the 1,000,000-step budget.`,
      suggestedDt,
    };
  }
  return { ok: true, run: { r0, v0, dt: s.dtS, nSteps, duration } };
}

/** Canonical cache key: the float64 inputs exactly as the engine sees them. */
export function scenarioKey(s: Scenario): string {
  const d = s.duration.kind === 'orbits' ? `o${String(s.duration.n)}` : `s${String(s.duration.s)}`;
  return `${String(s.altitudeM)}|${String(s.k)}|${String(s.dtS)}|${d}`;
}
