/**
 * Diagnostics (WA-F7, WA-F8, WA-F9): what the run is, how far it agrees with itself, and what
 * evidence exists for it. Every value says what it is: computed at a sample, exact (closed form)
 * or measured in a registered test. No accuracy is claimed for a run without a tier.
 */
import { R_EARTH } from '@orbital/engine';
import { StatusDone, TierBadge } from '../evidence/TierBadge';
import { evidenceFor, sci, type Evidence } from '../evidence/tiers';
import type { RunResult } from '../sim/protocol';
import { useStore } from '../state/store';
import { DriftPlot } from './DriftPlot';
import { formatK, group } from './format';
import { classification, formatE, sampleView, thirdReadout, useEvidence } from './runView';

const km = (m: number, d = 3) => group(m / 1000, d);

/** Mantissa with thin-space groups, as in the designs: −2.940 336 × 10⁷. */
function sciLong(x: number): string {
  const s = sci(x, 7);
  return s.replace(/^(−?-?\d)\.(\d{3})(\d{3})/, '$1.$2 $3').replace('-', '−');
}

export function TierSummary({ ev }: { ev: Evidence }) {
  return (
    <div className="diag-tier">
      <TierBadge ev={ev} />
      <p className="orb-caption">
        {ev.tier === 1
          ? 'Exactly the v0.1.0 reference case. Results below are completed and published.'
          : ev.tier === 2
            ? `Exactly registered case ${String(ev.id)}. Its measured errors are below.`
            : ev.claim}
      </p>
    </div>
  );
}

export function StaleNotice() {
  const fieldError = useStore((s) => s.fieldError);
  const error = useStore((s) => s.error);
  const computing = useStore((s) => s.computing);
  const rs = useStore((s) => s.resultScenario);
  const cancelRun = useStore.getState().cancelRun;
  const last = rs
    ? `k = ${formatK(rs.k)}, ${group(rs.altitudeM / 1000, rs.altitudeM % 1000 ? 3 : 0)} km`
    : '';
  if (fieldError)
    return (
      <div className="orb-banner orb-banner--warning" role="status">
        <div className="orb-banner__body">
          <p className="orb-banner__title">Input needs attention</p>
          <p className="orb-banner__text">
            Everything below is the last valid run ({last}), dimmed.
          </p>
        </div>
      </div>
    );
  if (computing && computing.total >= 100_000) {
    const pct = (100 * computing.done) / computing.total;
    return (
      <div className="orb-banner diag-computing" role="status">
        <div className="orb-banner__body">
          <p className="orb-banner__text">
            Computing {group(computing.total)} steps <span className="num">{Math.round(pct)}%</span>{' '}
            · the previous run stays interactive
          </p>
          <div className="orb-progress">
            <div className="orb-progress__bar" style={{ width: `${pct.toFixed(1)}%` }} />
          </div>
        </div>
        <button className="orb-btn orb-btn--quiet orb-btn--sm" onClick={cancelRun}>
          Cancel
        </button>
      </div>
    );
  }
  if (error)
    return (
      <div className="orb-banner orb-banner--warning" role="status">
        <div className="orb-banner__body">
          <p className="orb-banner__title">These inputs were not run</p>
          <p className="orb-banner__text">
            {error} Everything below is the last valid run ({last}), dimmed.
          </p>
        </div>
      </div>
    );
  return null;
}

export function useStale(): boolean {
  const fieldError = useStore((s) => s.fieldError);
  const computing = useStore((s) => s.computing);
  const stale = useStore((s) => s.resultScenario !== s.scenario);
  return !!fieldError || !!computing || stale;
}

export function PrimaryReadouts({ r, compact }: { r: RunResult; compact?: boolean }) {
  const t = useStore((s) => s.t);
  const stale = useStale();
  const sv = sampleView(r, t);
  const third = thirdReadout(r);
  return (
    <div className="diag-primary">
      <dl className={`orb-primary${compact ? ' orb-primary--compact' : ''}`}>
        <div className="orb-primary__item">
          <dt>Altitude</dt>
          <dd>
            {group(sv.altKm, compact ? 3 : 2)}
            <span className="unit">km</span>
          </dd>
        </div>
        <div className="orb-primary__item">
          <dt>Speed</dt>
          <dd>
            {sv.speedKms.toFixed(compact ? 4 : 3)}
            <span className="unit">km/s</span>
          </dd>
        </div>
        <div className="orb-primary__item">
          <dt>
            {third.label} <span className="hud-exact">exact</span>
          </dt>
          <dd>
            {third.value}
            {third.unit ? <span className="unit">{third.unit}</span> : null}
          </dd>
        </div>
      </dl>
      <span className="orb-stamp">
        sample {group(sv.k)} · t = {group(sv.t, r.run.dt % 1 === 0 ? 0 : 1)} s
        {stale ? ' · previous run' : ''}
      </span>
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="orb-kv__tag">{children}</span>;
}

export function OrbitElements({ r }: { r: RunResult }) {
  const ex = r.exact;
  return (
    <div className="diag-group">
      <div className="diag-group__head">
        <p className="orb-section-label">Orbit</p>
        <span className="diag-group__note">closed form</span>
      </div>
      <dl className="orb-kv">
        <dt>Classification</dt>
        <dd className="diag-text">{classification(r)}</dd>
        <dt>Eccentricity</dt>
        <dd>
          {formatE(ex.e)}
          <Tag>exact</Tag>
        </dd>
        <dt>Periapsis altitude</dt>
        <dd>
          {km(ex.periapsisRadius - R_EARTH)}
          <span className="unit">km</span>
          <Tag>exact</Tag>
        </dd>
        <dt>Apoapsis altitude</dt>
        <dd>
          {ex.apoapsisRadius === null ? 'none' : km(ex.apoapsisRadius - R_EARTH)}
          {ex.apoapsisRadius === null ? null : <span className="unit">km</span>}
          <Tag>exact</Tag>
        </dd>
      </dl>
      {!ex.available && ex.unavailableReason ? (
        <p className="orb-caption">{ex.unavailableReason}</p>
      ) : null}
    </div>
  );
}

function RunVsExact({ r }: { r: RunResult }) {
  const ex = r.exact;
  const d = r.diag;
  const rows: [string, string, string | null, 'run' | 'exact'][] = [];
  if (r.status === 'impact') {
    rows.push(['Impact detected, run', group(r.tEnd, 1), 's', 'run']);
    if (ex.timeToSurface !== null) {
      rows.push(['Surface crossing, exact', group(ex.timeToSurface, 3), 's', 'exact']);
      rows.push(['Detection gap', group(r.tEnd - ex.timeToSurface, 3), 's', 'run']);
    }
  } else {
    if (d.firstPeriodRun !== null)
      rows.push(['First period, run', group(d.firstPeriodRun, 3), 's', 'run']);
    if (ex.period !== null && ex.available)
      rows.push(['First period, exact', group(ex.period, 3), 's', 'exact']);
  }
  rows.push(['Altitude range, run', `${km(d.altMinRun, 2)}–${km(d.altMaxRun, 2)}`, 'km', 'run']);
  if (ex.apoapsisRadius !== null && ex.e < 1e-9)
    rows.push(['Altitude, exact', km(ex.periapsisRadius - R_EARTH), 'km', 'exact']);
  else if (ex.apoapsisRadius !== null)
    rows.push([
      'Altitude, exact',
      `${km(ex.periapsisRadius - R_EARTH, 2)}–${km(ex.apoapsisRadius - R_EARTH, 2)}`,
      'km',
      'exact',
    ]);
  return (
    <>
      <div className="diag-group__head">
        <p className="orb-section-label">This run vs exact</p>
      </div>
      <dl className="orb-kv">
        {rows.map(([label, value, unit, tag]) => (
          <div className="diag-kv-row" key={label}>
            <dt>{label}</dt>
            <dd>
              {value}
              {unit ? <span className="unit">{unit}</span> : null}
              <Tag>{tag}</Tag>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function EvidenceCard({ ev }: { ev: Evidence }) {
  return (
    <div className={`orb-tier-card${ev.tier === 3 ? ' orb-tier-card--none' : ''}`}>
      <div>
        <TierBadge ev={ev} />
      </div>
      <p className="orb-tier-card__claim">{ev.claim}</p>
      {ev.rows.length ? (
        <table className="orb-gates">
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Limit</th>
              <th scope="col">Measured</th>
            </tr>
          </thead>
          <tbody>
            {ev.rows.map((row) => (
              <tr key={row.test}>
                <td>{row.test}</td>
                <td className="num">{row.limit}</td>
                <td className="num">{row.measured}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {ev.status ? (
        <div>
          <StatusDone text={ev.status.text} />
        </div>
      ) : null}
    </div>
  );
}

export function Advanced({ r, ev }: { r: RunResult; ev: Evidence }) {
  const t = useStore((s) => s.t);
  const sv = sampleView(r, t);
  const d = r.diag;
  const eTitle = d.energyScale === 'eps0' ? 'Energy drift |Δε/ε₀|' : 'Energy drift |Δε|/(μ/r₀)';
  const gateLabel = ev.id ? `${ev.id} limit` : 'limit';
  // |r| is conserved only on a circle; on any other path its change is the orbit, not drift.
  const circular = r.exact.e < 1e-9 && r.status === 'completed';
  return (
    <>
      <div className="diag-group__head">
        <p className="orb-section-label">State at sample</p>
        <span className="diag-group__note">sample {group(sv.k)}</span>
      </div>
      <dl className="orb-kv">
        <dt>Specific energy ε</dt>
        <dd>
          {sciLong(sv.eps)}
          <span className="unit">J/kg</span>
        </dd>
        <dt>Angular momentum h</dt>
        <dd>
          {sciLong(sv.h)}
          <span className="unit">m²/s</span>
        </dd>
        <dt>Radius |r|</dt>
        <dd>
          {group((sv.altKm * 1000 + R_EARTH) / 1000, 3)}
          <span className="unit">km</span>
        </dd>
      </dl>
      <RunVsExact r={r} />
      <div className="diag-group__head">
        <p className="orb-section-label">Numerical drift · self-consistency</p>
      </div>
      <DriftPlot
        title={eTitle}
        min={d.eMin}
        max={d.eMax}
        current={d.eMaxSoFar[sv.k] as number}
        k={sv.k}
        n={sv.n}
        tPlayed={sv.t}
        tEnd={r.tEnd}
        limit={ev.gates.energy !== null ? { value: ev.gates.energy, label: gateLabel } : null}
        legend={!circular}
      />
      {circular ? (
        <DriftPlot
          title="Radius drift |Δr|/r₀"
          min={d.rMin}
          max={d.rMax}
          current={d.rMaxSoFar[sv.k] as number}
          k={sv.k}
          n={sv.n}
          tPlayed={sv.t}
          tEnd={r.tEnd}
          limit={ev.gates.radius !== null ? { value: ev.gates.radius, label: gateLabel } : null}
          legend
        />
      ) : null}
      <p className="orb-caption">
        Drift is how far the run disagrees with itself: the line is the largest drift up to the
        sample played (the number above), the band the drift at each sample.{' '}
        {ev.tier === 3
          ? 'It is not accuracy, and no tested case measures accuracy for this run.'
          : `Accuracy against the exact solution is what ${String(ev.id)} measures, below.`}
      </p>
      <div className="diag-group__head">
        <p className="orb-section-label">Validation evidence</p>
      </div>
      <EvidenceCard ev={ev} />
    </>
  );
}

export function DiagnosticsBody({ touch }: { touch?: boolean }) {
  const r = useStore((s) => s.result);
  const ev = useEvidence();
  const stale = useStale();
  if (!r || !ev) return <p className="orb-caption">Computing the first orbit…</p>;
  return (
    <>
      <StaleNotice />
      <div className={`diag-body${stale ? ' is-stale' : ''}`}>
        <TierSummary ev={ev} />
        <div className="diag-group">
          <p className="orb-section-label">Primary</p>
          <PrimaryReadouts r={r} compact />
        </div>
        <OrbitElements r={r} />
        <details className="orb-disclosure" open={!touch}>
          <summary>
            Advanced
            <span className="diag-chev" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16">
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </summary>
          <div className="orb-disclosure__body">
            <Advanced r={r} ev={ev} />
          </div>
        </details>
        <CopyReport />
      </div>
    </>
  );
}

/** WA-E8: everything needed to reproduce and discuss this run, as plain text. */
export function diagnosticReport(): string {
  const s = useStore.getState();
  const r = s.result;
  const rs = s.resultScenario;
  if (!r || !rs) return 'No run.';
  const sv = sampleView(r, s.t);
  const evd = evidenceFor(rs, r.run.nSteps);
  const d =
    rs.duration.kind === 'orbits'
      ? `${String(rs.duration.n)} orbits`
      : `${String(rs.duration.s)} s`;
  const lines = [
    `ORBITAL Web Alpha · build ${__ORBITAL_COMMIT__}`,
    `Link: ${location.href}`,
    `Inputs: altitude ${String(rs.altitudeM)} m · k ${String(rs.k)} · Δt ${String(rs.dtS)} s · ${d} · ${group(r.run.nSteps)} steps`,
    `Evidence: ${evd.label}${evd.id ? ` ${evd.id}` : ''} (tier ${String(evd.tier)}). ${evd.claim}`,
    `Classification (exact): ${classification(r)} · e = ${String(r.exact.e)}`,
    `At sample ${String(sv.k)} (t = ${String(sv.t)} s): altitude ${sv.altKm.toFixed(6)} km · speed ${sv.speedKms.toFixed(6)} km/s · ε ${sv.eps.toExponential(9)} J/kg · h ${sv.h.toExponential(9)} m²/s`,
    `Drift to this sample (self-consistency): energy ${sci(r.diag.eMaxSoFar[sv.k] as number)} · radius ${sci(r.diag.rMaxSoFar[sv.k] as number)}`,
    `Run status: ${r.status} at t = ${String(r.tEnd)} s`,
  ];
  for (const row of evd.rows) lines.push(`  ${row.test}: ${row.measured} (limit ${row.limit})`);
  return lines.join('\n');
}

function CopyReport() {
  const announce = useStore.getState().announce;
  return (
    <button
      className="orb-btn orb-btn--quiet orb-btn--sm diag-copy"
      onClick={() => {
        void navigator.clipboard.writeText(diagnosticReport()).then(
          () => {
            announce('Diagnostic report copied.');
          },
          () => {
            announce('Could not copy: the browser blocked clipboard access.');
          },
        );
      }}
    >
      Copy diagnostic report
    </button>
  );
}
