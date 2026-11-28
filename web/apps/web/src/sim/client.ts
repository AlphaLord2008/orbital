/**
 * Main-thread side of the simulation worker: supersession, result cache, watchdog (WA-F3, WA-E4).
 */
import type { FromWorker, RunResult } from './protocol';
import type { RunSpec } from './scenario';

export interface RunCallbacks {
  onProgress(done: number, total: number): void;
  onResult(result: RunResult, cached: boolean): void;
  onError(
    kind: 'input' | 'numerical' | 'internal' | 'crashed',
    message: string,
    field?: string,
  ): void;
}

const CACHE_BYTES = 160 * 1024 * 1024;
const WATCHDOG_MS = 5000;

function resultBytes(r: RunResult): number {
  return (
    5 * r.x.byteLength +
    r.exactPath.byteLength +
    3 * r.diag.eMaxSoFar.byteLength +
    r.segments.reduce((n, s) => n + s.indices.byteLength, 0)
  );
}

export function runKey(run: RunSpec): string {
  return `${String(run.r0[0])}|${String(run.v0[1])}|${String(run.dt)}|${String(run.nSteps)}`;
}

export class SimClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private active: {
    id: number;
    key: string;
    cb: RunCallbacks;
    run: RunSpec;
    restarted: boolean;
  } | null = null;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private readonly cache = new Map<string, RunResult>();
  private cacheBytes = 0;

  private spawn(): Worker {
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
      name: 'orbital-sim',
    });
    w.onmessage = (ev: MessageEvent<FromWorker>) => {
      this.onMessage(ev.data);
    };
    w.onerror = (ev) => {
      ev.preventDefault();
      this.recover('worker error');
    };
    return w;
  }

  private get w(): Worker {
    this.worker ??= this.spawn();
    return this.worker;
  }

  /** Start a run. A newer call supersedes the previous one within one message. */
  run(spec: RunSpec, cb: RunCallbacks): void {
    const key = runKey(spec);
    const hit = this.cache.get(key);
    if (hit) {
      this.cancel();
      this.cache.delete(key); // refresh LRU order
      this.cache.set(key, hit);
      cb.onResult(hit, true);
      return;
    }
    const id = this.nextId++;
    this.active = { id, key, cb, run: spec, restarted: false };
    this.w.postMessage({ type: 'run', id, run: spec });
    this.arm();
  }

  cancel(): void {
    if (!this.active) return;
    this.w.postMessage({ type: 'cancel', id: this.nextId++ });
    this.active = null;
    clearTimeout(this.watchdog);
  }

  dispose(): void {
    clearTimeout(this.watchdog);
    this.worker?.terminate();
    this.worker = null;
    this.active = null;
  }

  private arm(): void {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      this.recover('no response for 5 s');
    }, WATCHDOG_MS);
  }

  /** WA-E4: one automatic restart, then report. */
  private recover(reason: string): void {
    clearTimeout(this.watchdog);
    this.worker?.terminate();
    this.worker = null;
    const a = this.active;
    if (!a) return;
    if (!a.restarted) {
      const id = this.nextId++;
      this.active = { ...a, id, restarted: true };
      this.w.postMessage({ type: 'run', id, run: a.run });
      this.arm();
    } else {
      this.active = null;
      a.cb.onError('crashed', `The simulation worker stopped (${reason}) and did not recover.`);
    }
  }

  private onMessage(m: FromWorker): void {
    const a = this.active;
    const id = m.type === 'result' ? m.result.id : m.id;
    if (!a || id !== a.id) return; // stale
    if (m.type === 'progress') {
      this.arm();
      a.cb.onProgress(m.done, m.total);
      return;
    }
    clearTimeout(this.watchdog);
    this.active = null;
    if (m.type === 'error') {
      a.cb.onError(m.kind, m.message, m.field);
      return;
    }
    this.store(a.key, m.result);
    a.cb.onResult(m.result, false);
  }

  private store(key: string, r: RunResult): void {
    const bytes = resultBytes(r);
    if (bytes > CACHE_BYTES) return;
    this.cache.set(key, r);
    this.cacheBytes += bytes;
    for (const [k, v] of this.cache) {
      if (this.cacheBytes <= CACHE_BYTES) break;
      this.cache.delete(k);
      this.cacheBytes -= resultBytes(v);
    }
  }
}
