/**
 * Run diagnostics (WA-F8), computed in the worker from the computed samples only:
 * self-consistency drift (energy, angular momentum, radius) as running maxima per sample and as
 * min–max buckets for the plots, and run-measured values (first period, altitude range).
 * None of this is accuracy: accuracy is what the tested cases measure (ADR-0008 rule 3).
 */
import {
  angularMomentumZ,
  firstPeriod,
  MU_EARTH,
  R_EARTH,
  specificEnergy,
  type Trajectory,
  ValueError,
} from '@orbital/engine';

export const PLOT_BUCKETS = 288;

export interface RunDiagnostics {
  /** Running max of the energy drift up to sample k (relative, see `energyScale`). */
  readonly eMaxSoFar: Float32Array;
  readonly hMaxSoFar: Float32Array;
  /** Running max of ||r| − r₀| / r₀ up to sample k. */
  readonly rMaxSoFar: Float32Array;
  /** 'eps0' = |Δε/ε₀|; 'mu_r0' = |Δε|/(μ/r₀), used when ε₀ is ~0 (near-parabolic). */
  readonly energyScale: 'eps0' | 'mu_r0';
  /** Per-bucket min and max of the energy and radius drift; bucket b covers samples [⌊b·n/B⌋, ⌊(b+1)·n/B⌋). */
  readonly eMin: Float32Array;
  readonly eMax: Float32Array;
  readonly rMin: Float32Array;
  readonly rMax: Float32Array;
  /** First period measured from the run's samples, or null if no full revolution was computed. */
  readonly firstPeriodRun: number | null;
  readonly altMinRun: number;
  readonly altMaxRun: number;
}

export function bucketOf(k: number, n: number, buckets = PLOT_BUCKETS): number {
  return Math.min(buckets - 1, Math.floor((k * buckets) / n));
}

export function runDiagnostics(traj: Trajectory): RunDiagnostics {
  const n = traj.x.length;
  const e = specificEnergy(traj.x, traj.y, traj.vx, traj.vy);
  const h = angularMomentumZ(traj.x, traj.y, traj.vx, traj.vy);
  const e0 = e[0] as number;
  const h0 = h[0] as number;
  const r0 = Math.hypot(traj.x[0] as number, traj.y[0] as number);
  const muR0 = MU_EARTH / r0;
  const energyScale = Math.abs(e0) < 1e-6 * muR0 ? 'mu_r0' : 'eps0';
  const eDen = energyScale === 'eps0' ? Math.abs(e0) : muR0;
  const B = Math.min(PLOT_BUCKETS, n);
  const eMaxSoFar = new Float32Array(n);
  const hMaxSoFar = new Float32Array(n);
  const rMaxSoFar = new Float32Array(n);
  const eMin = new Float32Array(B).fill(Infinity);
  const eMax = new Float32Array(B).fill(-Infinity);
  const rMin = new Float32Array(B).fill(Infinity);
  const rMax = new Float32Array(B).fill(-Infinity);
  let me = 0;
  let mh = 0;
  let mr = 0;
  let rLo = Infinity;
  let rHi = -Infinity;
  for (let k = 0; k < n; k++) {
    const r = Math.hypot(traj.x[k] as number, traj.y[k] as number);
    const de = Math.abs((e[k] as number) - e0) / eDen;
    const dh = Math.abs(((h[k] as number) - h0) / h0);
    const dr = Math.abs(r - r0) / r0;
    me = Math.max(me, de);
    mh = Math.max(mh, dh);
    mr = Math.max(mr, dr);
    eMaxSoFar[k] = me;
    hMaxSoFar[k] = mh;
    rMaxSoFar[k] = mr;
    rLo = Math.min(rLo, r);
    rHi = Math.max(rHi, r);
    const b = bucketOf(k, n, B);
    if (de < (eMin[b] as number)) eMin[b] = de;
    if (de > (eMax[b] as number)) eMax[b] = de;
    if (dr < (rMin[b] as number)) rMin[b] = dr;
    if (dr > (rMax[b] as number)) rMax[b] = dr;
  }
  let firstPeriodRun: number | null = null;
  try {
    firstPeriodRun = firstPeriod(traj);
  } catch (err) {
    if (!(err instanceof ValueError)) throw err;
  }
  return {
    eMaxSoFar,
    hMaxSoFar,
    rMaxSoFar,
    energyScale,
    eMin,
    eMax,
    rMin,
    rMax,
    firstPeriodRun,
    altMinRun: rLo - R_EARTH,
    altMaxRun: rHi - R_EARTH,
  };
}
