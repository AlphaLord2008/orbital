/**
 * Scenario controls, shared by the Explore card, the Analyze Setup panel and the phone sheet.
 * Explore shows the preset and the two essential inputs; Analyze adds time step and duration.
 */
import { buildRun, PRESETS, type PresetId, type Scenario } from '../sim/scenario';
import { useStore } from '../state/store';
import { Field } from './Field';
import { formatK, group } from './format';

const K_MARKS = [
  { value: 1, label: 'circular' },
  { value: Math.SQRT2, label: 'escape' },
] as const;

export function PresetSelect({ touch }: { touch?: boolean }) {
  const presetId = useStore((s) => s.presetId);
  const loadPreset = useStore.getState().loadPreset;
  return (
    <>
      <label className="visually-hidden" htmlFor="preset">
        Preset
      </label>
      <select
        id="preset"
        className={`orb-select${touch ? ' orb-select--touch' : ''}`}
        value={presetId ?? ''}
        onChange={(e) => {
          loadPreset(e.target.value as PresetId);
        }}
      >
        {presetId === null ? <option value="">Custom scenario</option> : null}
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <option key={id} value={id}>
            {PRESETS[id].label}
          </option>
        ))}
      </select>
    </>
  );
}

function withK(s: Scenario, k: number): Scenario {
  // An unbound trajectory has no period: keep the run length as a time.
  const d = s.duration;
  return {
    ...s,
    k,
    duration: k >= Math.SQRT2 && d.kind === 'orbits' ? { kind: 'seconds', s: 86_400 } : d,
  };
}

export function ScenarioFields({ full, touch }: { full: boolean; touch?: boolean | undefined }) {
  const scenario = useStore((s) => s.scenario);
  const result = useStore((s) => s.result);
  const resultScenario = useStore((s) => s.resultScenario);
  const setScenario = useStore.getState().setScenario;
  const b = buildRun(scenario);
  const period = result && resultScenario === scenario ? result.exact.period : null;
  const dtHelp = b.ok
    ? `${group(b.run.nSteps)} steps${period ? ` · ${group(period / scenario.dtS)} per revolution` : ''}`
    : b.message;
  const d = scenario.duration;
  return (
    <>
      <Field
        field="altitude"
        touch={touch}
        value={scenario.altitudeM / 1000}
        help={touch ? '100 to 100 000 km' : undefined}
        onCommit={(v) => {
          setScenario({ ...scenario, altitudeM: v * 1000 });
        }}
      />
      <Field
        field="k"
        touch={touch}
        value={scenario.k}
        format={formatK}
        marks={K_MARKS}
        help="v₀ / v_circ · 1 circular · √2 escape"
        onCommit={(v) => {
          setScenario(withK(scenario, v));
        }}
      />
      {full ? (
        <>
          <Field
            field="dt"
            touch={touch}
            value={scenario.dtS}
            help={dtHelp}
            onCommit={(v) => {
              setScenario({ ...scenario, dtS: v });
            }}
          />
          <Field
            field={d.kind === 'orbits' ? 'orbits' : 'seconds'}
            touch={touch}
            slider={false}
            value={d.kind === 'orbits' ? d.n : d.s}
            format={(v) => (d.kind === 'orbits' ? String(v) : v.toFixed(0))}
            help={
              d.kind === 'seconds'
                ? `${(d.s / 3600).toFixed(2)} h · an unbound path has no period, so its length is a time`
                : undefined
            }
            onCommit={(v) => {
              setScenario({
                ...scenario,
                duration:
                  d.kind === 'orbits' ? { kind: 'orbits', n: v } : { kind: 'seconds', s: v },
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}
