/**
 * Validation evidence tiers (ADR-0008, requirements §4, WA-F9). A run's tier comes from an exact
 * match of its float64 parameters against a case that has passed; similarity earns nothing.
 * Measured values come from the registered results file (v0.1.1) and the v0.1.0 report; nothing
 * here is estimated.
 */
import results from '../../../../../docs/validation/v0.1.1-results.json';
import { buildRun, PRESETS, type PresetId, type Scenario } from '../sim/scenario';

export type Tier = 1 | 2 | 3;

export interface GateRow {
  readonly test: string;
  readonly limit: string;
  readonly measured: string;
}

export interface Evidence {
  readonly tier: Tier;
  readonly id: PresetId | null;
  readonly label: string;
  /** One sentence: what this tier claims, or why there is no claim. */
  readonly claim: string;
  readonly rows: readonly GateRow[];
  /** Completed results carry their source and date. */
  readonly status: { readonly kind: 'done'; readonly text: string } | null;
  /** Registered limits on the drift quantities the plots show, for the limit line. */
  readonly gates: { readonly energy: number | null; readonly radius: number | null };
}

/** v0.1.1 registered run: commit 531147f, 2026-11-25 (docs/validation/v0.1.1-web-alpha-presets.md). */
export const V011_RUN = {
  commit: (results as { commit: string }).commit,
  date: '2026-11-25',
} as const;

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 1.28e-6 → "1.28 × 10⁻⁶"; mid-range values plain. */
export function sci(x: number, digits = 3, collapse = false): string {
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-2 && a < 1e5)
    return x.toPrecision(digits).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m));
  const exp = Math.floor(Math.log10(a));
  const mant = (x / 10 ** exp).toFixed(digits - 1);
  const ten = `10${exp < 0 ? '⁻' : ''}${String(Math.abs(exp))
    .split('')
    .map((d) => SUP[Number(d)])
    .join('')}`;
  if (collapse && Number(mant) === 1) return ten; // a limit of 1.00 × 10⁻¹⁰ reads as 10⁻¹⁰
  return `${mant} × ${ten}`;
}

/**
 * Tier 1 evidence: V0 against T3–T8 at the v0.1.0 tolerances, as published in
 * docs/validation/v0.1-circular-orbit.md §4 (checked against that file by tiers.test.ts).
 */
export const V0_V010_ROWS: readonly GateRow[] = [
  { test: 'T3 angular momentum', limit: '≤ 10⁻¹⁰', measured: '8.66 × 10⁻¹⁵' },
  { test: 'T4 radius', limit: '≤ 10⁻³', measured: '5.663 × 10⁻⁴' },
  { test: 'T5 energy', limit: '≤ 10⁻⁵', measured: '1.28 × 10⁻⁶' },
  { test: 'T6 first period', limit: '≤ 10⁻⁵', measured: '9.067 × 10⁻⁷' },
  { test: 'T7 position, 1 orbit', limit: '≤ 100 m', measured: '38.71 m' },
  { test: 'T8 convergence', limit: '9 to 11', measured: '10.1' },
];

/** Human labels of the pre-registered metrics (requirements-0.1.1 §5). */
const METRIC_LABEL: Readonly<Record<string, string>> = {
  'P1-a': 'Angular momentum |Δh/h₀|',
  'P1-b': 'Radius |r − r₀|/r₀',
  'P1-c': 'Energy |Δε/ε₀|',
  'P1-d': 'First-period error',
  'P1-e': 'Position at 1 rev',
  'E1-a': 'Angular momentum |Δh/h₀|',
  'E1-b': 'Energy |Δε/ε₀|',
  'E1-c': 'First-period error',
  'E1-d': 'Apoapsis error',
  'E1-e': 'Position at 1 rev',
  'E1-f': 'Convergence ratio',
  'E1-r': 'Max position error, orbit 1',
  'X1-a': 'Angular momentum |Δh/h₀|',
  'X1-b': 'Energy |Δε|/(μ/r₀)',
  'X1-c': 'ε > 0 at every sample',
  'X1-d-1h': 'Position |Δr|/|r|, 1 h',
  'X1-d-6h': 'Position |Δr|/|r|, 6 h',
  'X1-d-24h': 'Position |Δr|/|r|, 24 h',
  'X1-e': 'Convergence ratio',
  'I1-a': 'Impact at a step boundary',
  'I1-b': 'Impact time error, Δt 1 s',
  'I1-c': 'Impact time error, Δt 0.1 s',
  'I1-d': 'Convergence ratio',
  'I1-e': 'Angular momentum |Δh/h₀|',
  'I1-f': 'Energy |Δε/ε₀|',
  'P2-a': 'Angular momentum |Δh/h₀|',
  'P2-r1': 'Energy |Δε/ε₀|',
  'P2-r2': 'Radius |r − r₀|/r₀',
  'P2-r3': 'First-period error',
  'P2-r4-n1': 'Position at 1 rev',
  'P2-r4-10': 'Position after 10 revs',
};

/** Units of metrics whose value is not a ratio. */
const METRIC_UNIT: Readonly<Record<string, string>> = {
  'P1-e': ' m',
  'E1-e': ' m',
  'I1-b': ' s',
  'I1-c': ' s',
  'E1-r': ' m',
  'P2-r4-n1': ' m',
  'P2-r4-10': ' m',
};

interface Metric {
  value: number | number[] | boolean | null;
  gate: number | number[] | null;
  op: string | null;
  pass: boolean | null;
}
interface CaseResult {
  metrics: Record<string, Metric>;
  pass: boolean;
}
const CASES = (results as unknown as { cases: Record<string, CaseResult> }).cases;

function fmtValue(v: Metric['value'], unit: string): string {
  if (v === null) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.map((x) => sci(x)).join(', ') + unit;
  return sci(v) + unit;
}

function fmtGate(m: Metric, unit: string): string {
  if (m.gate === null) return 'recorded';
  if (m.op === 'in' && Array.isArray(m.gate))
    return `${sci(m.gate[0] ?? NaN, 3, true)} to ${sci(m.gate[1] ?? NaN, 3, true)}`;
  if (m.op === 'exact' || typeof m.gate !== 'number') return 'exact';
  return `≤ ${sci(m.gate, 3, true)}${unit}`;
}

function caseRows(id: Exclude<PresetId, 'V0'>): GateRow[] {
  const c = CASES[id];
  if (!c) return [];
  return Object.entries(c.metrics)
    .filter(([key]) => key in METRIC_LABEL)
    .map(([key, m]) => {
      const unit = METRIC_UNIT[key] ?? '';
      return {
        test: METRIC_LABEL[key] ?? key,
        limit: fmtGate(m, unit),
        measured: fmtValue(m.value, unit),
      };
    });
}

function caseGates(id: Exclude<PresetId, 'V0'>): Evidence['gates'] {
  const m = CASES[id]?.metrics ?? {};
  const g = (key: string) => {
    const x = m[key];
    return x && typeof x.gate === 'number' && x.op !== 'exact' ? x.gate : null;
  };
  const energy = { P1: 'P1-c', E1: 'E1-b', X1: 'X1-b', I1: 'I1-f', P2: 'P2-r1' }[id];
  const radius = { P1: 'P1-b', E1: '', X1: '', I1: '', P2: 'P2-r2' }[id];
  return { energy: g(energy), radius: radius ? g(radius) : null };
}

const NO_GATES = { energy: null, radius: null } as const;

const TESTED: readonly PresetId[] = ['V0', 'P1', 'E1', 'X1', 'I1', 'P2'];

/** Steps of each case's tested run (its registered duration). */
const TESTED_STEPS: Readonly<Record<PresetId, number>> = Object.fromEntries(
  TESTED.map((id) => {
    const b = buildRun(PRESETS[id].scenario);
    return [id, b.ok ? b.run.nSteps : 0];
  }),
) as Record<PresetId, number>;

/** Describe the first parameter that differs from the nearest preset, for the Unvalidated claim. */
function changed(s: Scenario): string {
  const base = PRESETS.V0.scenario;
  if (s.k !== base.k) return `k = ${String(s.k)}`;
  if (s.altitudeM !== base.altitudeM) return `altitude ${String(s.altitudeM / 1000)} km`;
  if (s.dtS !== base.dtS) return `Δt = ${String(s.dtS)} s`;
  return 'This duration';
}

/** The run's tier: an exact float64 match on altitude, k and Δt, and no more steps than tested. */
export function evidenceFor(s: Scenario, nSteps: number): Evidence {
  for (const id of TESTED) {
    const c = PRESETS[id].scenario;
    if (s.altitudeM !== c.altitudeM || s.k !== c.k || s.dtS !== c.dtS) continue;
    const passed = CASES[id]?.pass === true;
    if (nSteps <= TESTED_STEPS[id] && passed) {
      if (id === 'V0') {
        return {
          tier: 1,
          id,
          label: 'Validated reference',
          claim: 'Exactly the v0.1.0 reference case: 400 km, k = 1, Δt = 1 s, up to 10 orbits.',
          rows: V0_V010_ROWS,
          status: { kind: 'done', text: 'Completed · v0.1.0 · 2026-11-23' },
          gates: { energy: 1e-5, radius: 1e-3 },
        };
      }
      return {
        tier: 2,
        id,
        label: 'Tested condition',
        claim: `Exactly case ${id}, registered before it was run. These are its measured errors against an exact solution, with its limits.`,
        rows: caseRows(id),
        status: { kind: 'done', text: `Completed · v0.1.1 · ${V011_RUN.date}` },
        gates: caseGates(id),
      };
    }
    return {
      tier: 3,
      id: null,
      label: 'Unvalidated',
      claim: `Longer than case ${id} was tested. A longer run is not a prefix of the tested one, so no accuracy is claimed.`,
      rows: [],
      status: null,
      gates: NO_GATES,
    };
  }
  return {
    tier: 3,
    id: null,
    label: 'Unvalidated',
    claim: `${changed(s)} matches no tested case. Nearby cases give no evidence for this one, so no accuracy is claimed.`,
    rows: [],
    status: null,
    gates: NO_GATES,
  };
}
