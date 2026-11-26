/** Application state (ADR-0007: Zustand). Scenario, result and playback live in one store. */
import { create } from 'zustand';
import { SimClient } from '../sim/client';
import type { RunResult } from '../sim/protocol';
import { buildRun, PRESETS, type PresetId, type Scenario } from '../sim/scenario';
import { advance, type Rate } from './clock';

export type CameraPreset = 'top' | 'oblique' | 'fit';
export type Mode = 'explore' | 'analyze';

interface State {
  scenario: Scenario;
  presetId: PresetId | null;
  result: RunResult | null;
  computing: { done: number; total: number } | null;
  error: string | null;
  /** Playback time [s] and transport. */
  t: number;
  playing: boolean;
  rate: Rate;
  mode: Mode;
  showExact: boolean;
  showVelocity: boolean;
  /** Bumped to ask the scene to move the camera to a preset. */
  cameraRequest: { preset: CameraPreset; seq: number };
  /** Fit the camera when the pending run arrives (preset loads). */
  fitOnResult: boolean;

  setScenario: (s: Scenario, presetId?: PresetId | null) => void;
  loadPreset: (id: PresetId) => void;
  tick: (wallDt: number) => void;
  seek: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setRate: (r: Rate) => void;
  setMode: (m: Mode) => void;
  toggleExact: () => void;
  toggleVelocity: () => void;
  requestCamera: (p: CameraPreset) => void;
}

const client = new SimClient();
const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useStore = create<State>()((set, get) => ({
  scenario: PRESETS.V0.scenario,
  presetId: 'V0',
  result: null,
  computing: null,
  error: null,
  t: 0,
  playing: !reducedMotion, // WA-A7: paused on load under reduced motion
  rate: 600,
  mode: 'explore',
  showExact: false,
  showVelocity: false,
  cameraRequest: { preset: 'oblique', seq: 0 },
  fitOnResult: true,

  setScenario(s, presetId = null) {
    set({ scenario: s, presetId, error: null });
    const b = buildRun(s);
    if (!b.ok) {
      client.cancel();
      set({ computing: null, error: b.message });
      return;
    }
    client.run(b.run, {
      onProgress: (done, total) => {
        set({ computing: { done, total } });
      },
      onResult: (result) => {
        const prev = get().result;
        // Keep playback time when the new run still contains it; otherwise restart.
        const t = prev && get().t <= result.tEnd ? get().t : 0;
        const fit = get().fitOnResult;
        set({ result, computing: null, t, fitOnResult: false });
        if (fit) get().requestCamera(prev ? 'fit' : 'oblique');
      },
      onError: (_kind, message) => {
        set({ computing: null, error: message });
      },
    });
  },
  loadPreset(id) {
    set({ t: 0, rate: id === 'P1' ? 3600 : id === 'X1' ? 'fit' : 600, fitOnResult: true });
    get().setScenario(PRESETS[id].scenario, id);
  },
  tick(wallDt) {
    const { playing, result, t, rate } = get();
    if (!playing || !result) return;
    const next = advance(t, wallDt, rate, result.tEnd);
    set(next.ended ? { t: next.t, playing: false } : { t: next.t });
  },
  seek(t) {
    const r = get().result;
    set({ t: r ? Math.min(Math.max(t, 0), r.tEnd) : 0 });
  },
  setPlaying(p) {
    const { result, t } = get();
    // Play at the end restarts from the beginning.
    set(p && result && t >= result.tEnd ? { playing: true, t: 0 } : { playing: p });
  },
  setRate(r) {
    set({ rate: r });
  },
  setMode(m) {
    set({ mode: m, showVelocity: m === 'analyze' });
  },
  toggleExact() {
    set((s) => ({ showExact: !s.showExact }));
  },
  toggleVelocity() {
    set((s) => ({ showVelocity: !s.showVelocity }));
  },
  requestCamera(p) {
    set((s) => ({ cameraRequest: { preset: p, seq: s.cameraRequest.seq + 1 } }));
  },
}));
