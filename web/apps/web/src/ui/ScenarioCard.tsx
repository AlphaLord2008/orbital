/** Scenario card (Explore): preset and the two essential inputs. Full controls arrive in WA-5. */
import { useState } from 'react';
import { PRESETS, type PresetId } from '../sim/scenario';
import { useStore } from '../state/store';
import { formatK } from './format';

const ALT = { min: 100, max: 100_000 };
const K = { min: 0.5, max: 1.6 };

function NumberInput(props: {
  id: string;
  label: string;
  unit: string;
  value: number;
  digits: number;
  format?: (v: number) => string;
  min: number;
  max: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const shown =
    draft ?? (props.format ? props.format(props.value) : props.value.toFixed(props.digits));
  const commit = () => {
    if (draft === null) return;
    const v = /^\s*\d+(\.\d*)?\s*$/.test(draft) ? Number(draft) : NaN;
    if (!Number.isFinite(v) || v < props.min || v > props.max) {
      setErr(`Enter ${String(props.min)}–${props.max.toLocaleString('en-US')} ${props.unit}.`);
      return;
    }
    setErr(null);
    setDraft(null);
    props.onCommit(v);
  };
  return (
    <div className={`orb-field${err ? ' orb-field--error' : ''}`}>
      <div className="orb-field__top">
        <label className="orb-field__label" htmlFor={props.id}>
          {props.label}
        </label>
        <span className={`orb-num${err ? ' orb-num--error' : ''}`}>
          <input
            id={props.id}
            value={shown}
            inputMode="decimal"
            aria-invalid={!!err}
            aria-describedby={err ? `${props.id}-err` : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(null);
                setErr(null);
              }
            }}
          />
          <span className="orb-num__unit">{props.unit}</span>
        </span>
      </div>
      {err ? (
        <p className="orb-field__msg" id={`${props.id}-err`}>
          {err}
        </p>
      ) : null}
    </div>
  );
}

export function ScenarioCard() {
  const scenario = useStore((s) => s.scenario);
  const presetId = useStore((s) => s.presetId);
  const { loadPreset, setScenario } = useStore.getState();
  return (
    <section className="orb-card hud-scenario" aria-labelledby="sc-t">
      <h2 className="orb-card__title" id="sc-t">
        Scenario
      </h2>
      <label className="visually-hidden" htmlFor="preset">
        Preset
      </label>
      <select
        id="preset"
        className="orb-select"
        value={presetId ?? ''}
        onChange={(e) => {
          loadPreset(e.target.value as PresetId);
        }}
      >
        {presetId === null ? <option value="">Custom</option> : null}
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <option key={id} value={id}>
            {PRESETS[id].label}
          </option>
        ))}
      </select>
      <NumberInput
        id="alt"
        label="Altitude"
        unit="km"
        digits={3}
        {...ALT}
        value={scenario.altitudeM / 1000}
        onCommit={(v) => {
          setScenario({ ...scenario, altitudeM: v * 1000 });
        }}
      />
      <NumberInput
        id="k"
        label="Speed factor"
        unit="×"
        digits={3}
        format={formatK}
        {...K}
        value={scenario.k}
        onCommit={(v) => {
          // An unbound trajectory has no period: keep the run length as a time.
          const d = scenario.duration;
          setScenario({
            ...scenario,
            k: v,
            duration: v >= Math.SQRT2 && d.kind === 'orbits' ? { kind: 'seconds', s: 86_400 } : d,
          });
        }}
      />
      <p className="orb-caption">1 = circular · √2 ≈ 1.41421 = escape</p>
    </section>
  );
}
