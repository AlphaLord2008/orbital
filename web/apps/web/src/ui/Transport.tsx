/** Playback (WA-F6): play/pause, time, scrubbable track with one tick per revolution, rates, step and revolution skip. */
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { sampleIndex } from '../sim/display';
import { RATES, type Rate, revolutionOf } from '../state/clock';
import { useStore } from '../state/store';
import { clock } from './format';
import * as I from './icons';

const EXPLORE_RATES: readonly Rate[] = [1, 60, 600];
const rateLabel = (r: Rate) => (r === 'fit' ? 'Fit' : `${r.toLocaleString('en-US')}×`);

export function Transport() {
  const result = useStore((s) => s.result);
  const t = useStore((s) => s.t);
  const playing = useStore((s) => s.playing);
  const rate = useStore((s) => s.rate);
  const mode = useStore((s) => s.mode);
  const { setPlaying, seek, setRate } = useStore.getState();
  const track = useRef<HTMLDivElement>(null);

  const tEnd = result?.tEnd ?? 0;
  const dt = result?.run.dt ?? 1;
  const n = result?.x.length ?? 1;
  const starts = result?.revStarts ?? Int32Array.of(0);
  const bound = result?.exact.classification === 'bound' && result.status === 'completed';
  const k = sampleIndex(Math.min(t, tEnd), dt, n);
  const rev = revolutionOf(starts, k);
  const frac = tEnd > 0 ? Math.min(t / tEnd, 1) : 0;

  const seekFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !result) return;
    const u = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    // Scrubbing snaps to computed samples (R1).
    seek(sampleIndex(u * tEnd, dt, n) * dt);
  };
  const stepTo = (kk: number) => {
    seek(Math.min(Math.max(kk, 0), n - 1) * dt);
  };
  const onKey = (e: KeyboardEvent) => {
    const big = Math.max(1, Math.round(n / 100));
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      PageDown: -big,
      PageUp: big,
    };
    if (e.key in map) {
      e.preventDefault();
      stepTo(k + (map[e.key] ?? 0));
    } else if (e.key === 'Home') stepTo(0);
    else if (e.key === 'End') stepTo(n - 1);
  };
  const ticks = bound ? [...starts].map((s) => (s * dt) / tEnd) : [];
  if (bound && tEnd > 0) ticks.push(1);
  const rates: readonly Rate[] =
    mode === 'analyze'
      ? [...RATES, 'fit']
      : EXPLORE_RATES.includes(rate)
        ? EXPLORE_RATES
        : [...EXPLORE_RATES, rate];

  return (
    <div className="orb-transport hud-transport" role="group" aria-label="Playback">
      <button
        className="orb-iconbtn orb-iconbtn--play"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => {
          setPlaying(!playing);
        }}
        disabled={!result}
      >
        {playing ? <I.Pause /> : <I.Play />}
      </button>
      {mode === 'analyze' ? (
        <div className="hud-steps">
          <button
            className="orb-iconbtn"
            aria-label="Previous revolution"
            disabled={!bound}
            onClick={() => {
              stepTo(starts[Math.max(0, rev - (k === starts[rev] ? 1 : 0))] ?? 0);
            }}
          >
            <I.RevBack />
          </button>
          <button
            className="orb-iconbtn"
            aria-label="Previous sample"
            onClick={() => {
              stepTo(k - 1);
            }}
          >
            <I.StepBack />
          </button>
          <button
            className="orb-iconbtn"
            aria-label="Next sample"
            onClick={() => {
              stepTo(k + 1);
            }}
          >
            <I.StepFwd />
          </button>
          <button
            className="orb-iconbtn"
            aria-label="Next revolution"
            disabled={!bound}
            onClick={() => {
              stepTo(starts[rev + 1] ?? n - 1);
            }}
          >
            <I.RevFwd />
          </button>
        </div>
      ) : null}
      <div className="orb-transport__time">
        <span className="orb-transport__t">{clock(Math.min(t, tEnd))}</span>
        <span className="orb-transport__sub">
          {bound
            ? `rev ${String(rev + 1)} of ${String(starts.length)}`
            : result?.status === 'impact'
              ? 'until impact'
              : `of ${clock(tEnd)}`}
        </span>
      </div>
      <div
        ref={track}
        className="orb-track"
        role="slider"
        tabIndex={0}
        aria-label="Playback time"
        aria-valuemin={0}
        aria-valuemax={tEnd}
        aria-valuenow={Math.min(t, tEnd)}
        aria-valuetext={`${clock(Math.min(t, tEnd))}, sample ${String(k)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e);
        }}
      >
        <span className="orb-track__rail" />
        <span className="orb-track__past" style={{ width: `${(frac * 100).toFixed(3)}%` }} />
        {ticks.map((u, i) => (
          <span key={i} className="orb-track__tick" style={{ left: `${(u * 100).toFixed(3)}%` }} />
        ))}
        {ticks.length <= 12
          ? ticks.map((u, i) => (
              <span
                key={`l${String(i)}`}
                className="orb-track__label"
                style={{ left: `${(u * 100).toFixed(3)}%` }}
              >
                {i}
              </span>
            ))
          : null}
        {result?.status === 'impact' ? (
          <span className="orb-track__end" style={{ left: '100%' }} />
        ) : null}
        <span className="orb-track__head" style={{ left: `${(frac * 100).toFixed(3)}%` }} />
      </div>
      <div className="orb-seg" role="group" aria-label="Playback rate">
        {rates.map((r) => (
          <button
            key={String(r)}
            className="orb-seg__item num"
            aria-pressed={rate === r}
            onClick={() => {
              setRate(r);
            }}
          >
            {rateLabel(r)}
          </button>
        ))}
      </div>
    </div>
  );
}
