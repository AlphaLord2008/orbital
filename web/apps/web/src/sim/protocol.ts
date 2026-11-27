/** Messages between the UI and the simulation worker (WA-F3). */
import type { RunSpec } from './scenario';

export interface RunRequest {
  readonly type: 'run';
  readonly id: number;
  readonly run: RunSpec;
}
export interface CancelRequest {
  readonly type: 'cancel';
  readonly id: number;
}
export type ToWorker = RunRequest | CancelRequest;

export interface Segment {
  /** First and last sample of the revolution (bound) or of the whole run. */
  readonly lo: number;
  readonly hi: number;
  /** Decimated sample indices, sorted, including lo, hi and every R16 event. */
  readonly indices: Int32Array;
  /** Achieved RDP tolerance [m]. */
  readonly eps: number;
}

/** Closed-form values for the configured initial state (ADR-0005 R15: tagged exact). */
export interface ExactSummary {
  readonly classification: 'bound' | 'escape';
  readonly e: number;
  readonly periapsisRadius: number;
  readonly apoapsisRadius: number | null;
  readonly period: number | null;
  /** Exact time of the first surface crossing, when the conic reaches R_E. */
  readonly timeToSurface: number | null;
  /**
   * Whether the closed-form solution exists for this state. It does not inside the parabolic
   * band |e − 1| < 1e-9 (outside the analytic module's domain, AN-5) or if the analytic module
   * reports an error; the computed trajectory is still shown, and the UI says why there is no
   * exact overlay.
   */
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface RunResult {
  readonly id: number;
  readonly run: RunSpec;
  readonly t: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly status: 'completed' | 'impact';
  readonly tEnd: number;
  readonly revStarts: Int32Array;
  readonly segments: readonly Segment[];
  readonly exact: ExactSummary;
  /** Exact two-body path as packed [x, y] metres, adaptively sampled (sagitta ≤ 10 m). */
  readonly exactPath: Float64Array;
  readonly timing: { readonly propagateMs: number; readonly displayMs: number };
}

export type FromWorker =
  | {
      readonly type: 'progress';
      readonly id: number;
      readonly done: number;
      readonly total: number;
    }
  | { readonly type: 'result'; readonly result: RunResult }
  | {
      readonly type: 'error';
      readonly id: number;
      readonly kind: 'input' | 'numerical' | 'internal';
      readonly field?: string;
      readonly message: string;
    };
