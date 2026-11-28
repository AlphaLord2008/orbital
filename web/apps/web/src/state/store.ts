/** Application state (ADR-0007: Zustand). Scenario, result and playback live in one store. */
import { create } from 'zustand';
import { SimClient } from '../sim/client';
import type { RunResult } from '../sim/protocol';
import { buildRun, PRESETS, type PresetId, type Scenario } from '../sim/scenario';
import { decodeScenario, encodeScenario } from '../sim/url';
import { advance, type Rate } from './clock';

export type CameraPreset = 'top' | 'oblique' | 'fit';
export type Mode = 'explore' | 'analyze';
export type Sheet = 'none' | 'controls' | 'diagnostics';
export type Dialog = 'none' | 'data' | 'shortcuts';
export type FieldError = { field: string; label: string; message: string } | null;

interface State {
  scenario: Scenario;
  presetId: PresetId | null;
  result: RunResult | null;
  /** The scenario that produced `result`. When it differs from `scenario`, the result is stale. */
  resultScenario: Scenario | null;
  computing: { done: number; total: number } | null;
  error: string | null;
  /** Input → updated orbit for the last run [ms] (WA-N2), and whether it came from the cache. */
  lastRun: { ms: number; cached: boolean; steps: number; seq: number } | null;
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
  /** A field whose typed value is invalid (WA-E2): the last valid run stays, dimmed. */
  fieldError: FieldError;
  presentation: boolean;
  /** A share link that could not be opened; the app shows V0 and says why. */
  linkError: string | null;
  /** Phone layout: which bottom sheet is expanded. */
  sheet: Sheet;
  dialog: Dialog;
  /** Polite live-region text (WA-A3). */
  announcement: { text: string; seq: number };

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
  setFieldError: (e: FieldError) => void;
  /** Stop the run in progress and go back to the inputs of the run on screen. */
  cancelRun: () => void;
  setPresentation: (on: boolean) => void;
  setSheet: (s: Sheet) => void;
  setDialog: (d: Dialog) => void;
  announce: (text: string) => void;
  /** Read the share link from the address bar (WA-F12); falls back to V0. */
  initFromUrl: (search: string) => void;
}

const client = new SimClient();
const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useStore = create<State>()((set, get) => ({
  scenario: PRESETS.V0.scenario,
  presetId: 'V0',
  result: null,
  resultScenario: null,
  computing: null,
  error: null,
  lastRun: null,
  t: 0,
  playing: !reducedMotion, // WA-A7: paused on load under reduced motion
  rate: 600,
  mode: 'explore',
  showExact: false,
  showVelocity: false,
  cameraRequest: { preset: 'oblique', seq: 0 },
  fitOnResult: true,
  fieldError: null,
  presentation: false,
  linkError: null,
  sheet: 'none',
  dialog: 'none',
  announcement: { text: '', seq: 0 },

  setScenario(s, presetId = null) {
    set({ scenario: s, presetId, error: null });
    const b = buildRun(s);
    if (!b.ok) {
      client.cancel();
      set({ computing: null, error: b.message });
      return;
    }
    const requested = performance.now();
    client.run(b.run, {
      onProgress: (done, total) => {
        set({ computing: { done, total } });
      },
      onResult: (result, cached) => {
        const prev = get().result;
        // Keep playback time when the new run still contains it; otherwise restart.
        const t = prev && get().t <= result.tEnd ? get().t : 0;
        const fit = get().fitOnResult;
        set({
          result,
          resultScenario: s,
          computing: null,
          t,
          fitOnResult: false,
          lastRun: {
            ms: performance.now() - requested,
            cached,
            steps: result.run.nSteps,
            seq: (get().lastRun?.seq ?? 0) + 1,
          },
        });
        // First run: Oblique, except an impact, which is framed on its impact point (Fit).
        if (fit) get().requestCamera(prev || result.status === 'impact' ? 'fit' : 'oblique');
        writeUrl(s, get().mode);
      },
      onError: (_kind, message) => {
        set({ computing: null, error: message });
      },
    });
  },
  loadPreset(id) {
    // A preset is a fresh start: playback restarts from t = 0 (paused under reduced motion, WA-A7).
    set({
      t: 0,
      playing: !reducedMotion,
      rate: id === 'P1' ? 3600 : id === 'X1' ? 'fit' : 600,
      fitOnResult: true,
      fieldError: null,
    });
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
    // WA-F18: no recompute, no playback reset, no camera move.
    set({ mode: m, showVelocity: m === 'analyze', sheet: 'none' });
    const rs = get().resultScenario;
    if (rs) writeUrl(rs, m);
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
  setFieldError(e) {
    const cur = get().fieldError;
    if (cur?.field === e?.field && cur?.message === e?.message) return;
    set({ fieldError: e });
  },
  cancelRun() {
    client.cancel();
    const rs = get().resultScenario;
    set({ computing: null, error: null, ...(rs ? { scenario: rs } : {}) });
  },
  setPresentation(on) {
    set({ presentation: on, sheet: 'none', dialog: 'none' });
  },
  setSheet(sheet) {
    set({ sheet });
  },
  setDialog(dialog) {
    set({ dialog });
  },
  announce(text) {
    set((s) => ({ announcement: { text, seq: s.announcement.seq + 1 } }));
  },
  initFromUrl(search) {
    const d = decodeScenario(search);
    if (d.ok === true) {
      const preset = (Object.keys(PRESETS) as PresetId[]).find((id) =>
        sameScenario(PRESETS[id].scenario, d.scenario),
      );
      if (d.mode) set({ mode: d.mode, showVelocity: d.mode === 'analyze' });
      set({ fitOnResult: true, t: 0 });
      get().setScenario(d.scenario, preset ?? null);
      return;
    }
    get().loadPreset('V0');
    if (d.ok === false) set({ linkError: d.message });
  },
}));

function sameScenario(a: Scenario, b: Scenario): boolean {
  return (
    a.altitudeM === b.altitudeM &&
    a.k === b.k &&
    a.dtS === b.dtS &&
    a.duration.kind === b.duration.kind &&
    (a.duration.kind === 'orbits'
      ? b.duration.kind === 'orbits' && a.duration.n === b.duration.n
      : b.duration.kind === 'seconds' && a.duration.s === b.duration.s)
  );
}

/** Keep the address bar a share link for the run on screen (replaceState: no history spam). */
function writeUrl(s: Scenario, mode: Mode): void {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  const q = encodeScenario(s, mode);
  if (location.search !== q)
    history.replaceState(null, '', `${location.pathname}${q}${location.hash}`);
}
