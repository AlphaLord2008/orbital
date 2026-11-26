/**
 * Typed access to the committed fixtures (JSON imports work in Node and in browsers).
 * reference/: 50-digit mpmath values (scripts/reference_mp.py) for analytic validation.
 * conformance/: authoritative Python engine output (scripts/generate_fixtures.py).
 */
import refV0 from '../../../../fixtures/v1/reference/V0.json';
import refP1 from '../../../../fixtures/v1/reference/P1.json';
import refE1 from '../../../../fixtures/v1/reference/E1.json';
import refX1 from '../../../../fixtures/v1/reference/X1.json';
import refI1 from '../../../../fixtures/v1/reference/I1.json';
import refP2 from '../../../../fixtures/v1/reference/P2.json';
import c1 from '../../../../fixtures/v1/conformance/C1.json';
import c2 from '../../../../fixtures/v1/conformance/C2.json';
import c3 from '../../../../fixtures/v1/conformance/C3.json';
import c4 from '../../../../fixtures/v1/conformance/C4.json';
import c5 from '../../../../fixtures/v1/conformance/C5.json';
import c6 from '../../../../fixtures/v1/conformance/C6.json';
import c7 from '../../../../fixtures/v1/conformance/C7.json';
import c8 from '../../../../fixtures/v1/conformance/C8.json';

/** Python repr strings parse to the identical float64. */
export const num = (s: string): number => Number(s);
export const vec = (a: readonly string[]): [number, number] => [num(a[0] ?? ''), num(a[1] ?? '')];

export interface ReferenceFile {
  case: string;
  inputs: { r0: string[]; v0: string[]; mu: string; r_earth: string };
  scalars: Record<string, string>;
  crossing?: Record<string, string>;
  states: { dt: string; k: number; t: string; r: string[]; v: string[] }[];
}

export interface RunFixture {
  case: string;
  inputs: {
    r0: string[];
    v0: string[];
    dt: string;
    n_steps: number;
    mu: string;
    body_radius: string;
  };
  summary: {
    status: 'completed' | 'impact';
    samples: number;
    n_steps_requested: number;
    t_end: string;
    first_period: string | null;
    max_rel_energy_drift: string;
    max_rel_h_drift: string;
    analytic: Record<string, string | null>;
  };
  samples: { k: number; t: string; r: string[]; v: string[]; energy: string; h: string }[];
}

export interface TableFixture {
  case: string;
  rows: Record<string, unknown>[];
}

export const REFERENCE: Record<string, ReferenceFile> = {
  V0: refV0,
  P1: refP1,
  E1: refE1,
  X1: refX1,
  I1: refI1,
  P2: refP2,
};

export const RUNS: Record<string, RunFixture> = {
  C1: c1,
  C2: c2,
  C3: c3,
  C4: c4,
  C5: c5,
  C6: c6,
} as Record<string, RunFixture>;
export const C7 = c7 as TableFixture;
export const C8 = c8 as TableFixture;
