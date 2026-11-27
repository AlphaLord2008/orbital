/** Primary readouts (WA-F7): sample-k values with their stamp, and the exact period. */
import { R_EARTH } from '@orbital/engine';
import { sampleIndex } from '../sim/display';
import { useStore } from '../state/store';
import { duration, formatK, group } from './format';

export function Readouts() {
  const result = useStore((s) => s.result);
  const t = useStore((s) => s.t);
  const mode = useStore((s) => s.mode);
  const computing = useStore((s) => s.computing);
  const scenario = useStore((s) => s.scenario);
  const resultScenario = useStore((s) => s.resultScenario);
  const error = useStore((s) => s.error);
  if (!result) {
    return (
      <section className="orb-card hud-readouts" aria-label="Readouts">
        <p className="orb-caption">{computing ? 'Computing the first orbit…' : 'No result yet.'}</p>
      </section>
    );
  }
  const n = result.x.length;
  const k = sampleIndex(Math.min(t, result.tEnd), result.run.dt, n);
  const x = result.x[k] as number;
  const y = result.y[k] as number;
  const alt = (Math.hypot(x, y) - R_EARTH) / 1000;
  const speed = Math.hypot(result.vx[k] as number, result.vy[k] as number) / 1000;
  const ex = result.exact;
  const e = ex.e;
  // Enough decimals that 1 − e is visible near the escape threshold.
  const eDigits = Math.min(
    12,
    Math.max(3, Math.ceil(-Math.log10(Math.max(Math.abs(1 - e), 1e-15))) + 3),
  );
  const parabolic = !ex.available && Math.abs(1 - e) < 1e-9;
  const kind = parabolic
    ? 'Parabolic · at the escape threshold'
    : ex.classification === 'escape'
      ? 'Escape · hyperbolic trajectory'
      : ex.timeToSurface !== null
        ? 'Bound · reaches the surface'
        : e < 1e-9
          ? 'Bound · circular orbit'
          : 'Bound · elliptical orbit';
  const third = !ex.available
    ? { label: 'Period', value: 'not computed' }
    : ex.timeToSurface !== null
      ? { label: 'Time to surface', value: duration(ex.timeToSurface) }
      : ex.period !== null
        ? { label: 'Period', value: duration(ex.period) }
        : { label: 'Period', value: 'none' };
  const [num, unit] = /^[\d.−-]/.test(third.value)
    ? third.value.split(' ')
    : [third.value, undefined];
  // The inputs changed but no new run replaced this one (it failed or is still computing).
  const stale = resultScenario !== scenario;
  const prev = resultScenario;
  return (
    <section
      className={`orb-card hud-readouts${computing || stale ? ' is-stale' : ''}`}
      aria-labelledby="ro-t"
    >
      <h2 className="visually-hidden" id="ro-t">
        Readouts
      </h2>
      {stale && !computing && prev ? (
        <div className="orb-banner orb-banner--warning" role="status">
          <div className="orb-banner__body">
            <p className="orb-banner__text">
              Showing the previous run (altitude {group(prev.altitudeM / 1000, 3)} km, speed factor{' '}
              {formatK(prev.k)}). The new inputs were not computed{error ? `: ${error}` : '.'}
            </p>
          </div>
        </div>
      ) : null}
      <span className="hud-kind">
        {kind} · e = {e.toFixed(eDigits)}
      </span>
      <div className="hud-readouts__values">
        <dl className={`orb-primary${mode === 'analyze' ? ' orb-primary--compact' : ''}`}>
          <div className="orb-primary__item">
            <dt>Altitude</dt>
            <dd>
              {group(alt, 2)}
              <span className="unit">km</span>
            </dd>
          </div>
          <div className="orb-primary__item">
            <dt>Speed</dt>
            <dd>
              {speed.toFixed(3)}
              <span className="unit">km/s</span>
            </dd>
          </div>
          <div className="orb-primary__item">
            <dt>
              {third.label} <span className="hud-exact">exact</span>
            </dt>
            <dd>
              {num}
              {unit ? <span className="unit">{unit}</span> : null}
            </dd>
          </div>
        </dl>
        <span className="orb-stamp">
          sample {group(k)} · t = {group(k * result.run.dt, result.run.dt % 1 === 0 ? 0 : 1)} s
        </span>
      </div>
      {!ex.available && ex.unavailableReason ? (
        <p className="orb-caption">{ex.unavailableReason}</p>
      ) : null}
      {result.status === 'impact' ? (
        <p className="orb-caption">
          The run stopped at sample {group(n - 1)}, the first with |r| ≤ R<sub>E</sub>. It is never
          extrapolated to the surface.
        </p>
      ) : null}
    </section>
  );
}
