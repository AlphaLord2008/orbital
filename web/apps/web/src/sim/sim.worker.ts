/// <reference lib="webworker" />
/**
 * Simulation worker (WA-F3): physics never runs on the main thread. Runs are chunked
 * (50,000 steps) and yield between chunks, so a newer request supersedes a running one.
 */
import {
  analytic,
  MU_EARTH,
  propagateChunks,
  R_EARTH,
  RuntimeError,
  ValueError,
} from '@orbital/engine';
import { decimate, revolutionStarts } from './display';
import { exactPath } from './exact';
import type {
  ExactSummary,
  FromWorker,
  RunRequest,
  RunResult,
  Segment,
  ToWorker,
} from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let latest = 0;

const post = (m: FromWorker, transfer: Transferable[] = []) => {
  self.postMessage(m, transfer);
};

/** Yield to the event loop without the 4 ms setTimeout clamp. */
const tick = () =>
  new Promise<void>((resolve) => {
    const c = new MessageChannel();
    c.port1.onmessage = () => {
      c.port1.close();
      resolve();
    };
    c.port2.postMessage(0);
  });

function exactSummary(r0: readonly number[], v0: readonly number[]): ExactSummary {
  const el = analytic.elements(r0, v0);
  const [rp, ra] = analytic.apsides(r0, v0);
  const classification = analytic.classify(r0, v0);
  return {
    classification,
    e: el.e,
    periapsisRadius: rp,
    apoapsisRadius: ra,
    period: classification === 'bound' ? analytic.period(r0, v0) : null,
    timeToSurface: rp < R_EARTH ? analytic.timeToRadius(r0, v0, R_EARTH) : null,
  };
}

async function run(req: RunRequest): Promise<void> {
  const { id, run: spec } = req;
  const t0 = performance.now();
  const gen = propagateChunks([...spec.r0], [...spec.v0], spec.dt, spec.nSteps, MU_EARTH, R_EARTH);
  let step = gen.next();
  while (!step.done) {
    post({ type: 'progress', id, done: step.value.stepsDone, total: step.value.stepsTotal });
    await tick();
    if (latest !== id) return; // superseded or cancelled
    step = gen.next();
  }
  const traj = step.value;
  const t1 = performance.now();

  const revStarts = revolutionStarts(traj.x, traj.y);
  const exact = exactSummary(spec.r0, spec.v0);
  const last = traj.x.length - 1;
  const bound = exact.classification === 'bound' && traj.status === 'completed';
  const bounds = bound ? [...revStarts] : [0];
  const segments: Segment[] = bounds.map((lo, i) => {
    const hi = i + 1 < bounds.length ? (bounds[i + 1] as number) : last;
    const { indices, eps } = decimate(traj.x, traj.y, lo, hi);
    return { lo, hi, indices, eps };
  });
  const orbit = analytic.keplerOrbit([...spec.r0], [...spec.v0]);
  const pathEnd =
    exact.period !== null && exact.timeToSurface === null
      ? exact.period
      : exact.timeToSurface !== null
        ? exact.timeToSurface
        : traj.tEnd;
  const path = exactPath(orbit, 0, pathEnd);
  if (latest !== id) return;

  const result: RunResult = {
    id,
    run: spec,
    t: traj.t,
    x: traj.x,
    y: traj.y,
    vx: traj.vx,
    vy: traj.vy,
    status: traj.status,
    tEnd: traj.tEnd,
    revStarts: bound ? revStarts : Int32Array.of(0),
    segments,
    exact,
    exactPath: path,
    timing: { propagateMs: t1 - t0, displayMs: performance.now() - t1 },
  };
  post({ type: 'result', result }, [
    traj.t.buffer,
    traj.x.buffer,
    traj.y.buffer,
    traj.vx.buffer,
    traj.vy.buffer,
    path.buffer,
    ...segments.map((s) => s.indices.buffer),
  ]);
}

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  latest = msg.id;
  if (msg.type === 'cancel') return;
  run(msg).catch((e: unknown) => {
    if (e instanceof ValueError)
      post({ type: 'error', id: msg.id, kind: 'input', field: e.field, message: e.message });
    else if (e instanceof RuntimeError)
      post({ type: 'error', id: msg.id, kind: 'numerical', message: e.message });
    else
      post({
        type: 'error',
        id: msg.id,
        kind: 'internal',
        message: e instanceof Error ? e.message : String(e),
      });
  });
};
