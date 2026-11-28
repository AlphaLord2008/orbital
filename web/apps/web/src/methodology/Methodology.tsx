/**
 * Methodology (WA-F13). Every measured number on this page is read from the registered results
 * (v0.1.1-results.json) or the published v0.1.0 report rows, never typed in by hand.
 */
import { CONFORMS_TO_PYTHON, ENGINE_VERSION, MU_EARTH, R_EARTH } from '@orbital/engine';
import { useEffect, useState } from 'react';
import { StatusDone, TierBadge } from '../evidence/TierBadge';
import { evidenceFor, sci, V0_V010_ROWS, V011_RUN } from '../evidence/tiers';
import { buildRun, PRESETS, type PresetId } from '../sim/scenario';
import { group } from '../ui/format';

const CASES: readonly Exclude<PresetId, 'V0'>[] = ['P1', 'E1', 'X1', 'I1', 'P2'];

function evidence(id: PresetId) {
  const s = PRESETS[id].scenario;
  const b = buildRun(s);
  return evidenceFor(s, b.ok ? b.run.nSteps : Infinity);
}

const SECTIONS = [
  ['model', 'The model'],
  ['integrator', 'The integrator'],
  ['numbers', 'Reading the numbers'],
  ['impact', 'Impact: numerical vs analytical'],
  ['tiers', 'Evidence tiers'],
  ['v010', 'v0.1.0 validation'],
  ['v011', 'v0.1.1 cases'],
  ['browser', 'Browser engine'],
  ['limits', 'Known limits'],
  ['drawn', 'What is computed, what is illustrative'],
  ['credits', 'Credits'],
] as const;

/** The section being read, for the table of contents (aria-current). */
function useActiveSection(): string {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = SECTIONS.find(([id]) => seen.get(id));
        if (first) setActive(first[0]);
      },
      { rootMargin: '-84px 0px -55% 0px' },
    );
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => {
      io.disconnect();
    };
  }, []);
  return active;
}

function Section(p: { id: (typeof SECTIONS)[number][0]; children: React.ReactNode }) {
  const i = SECTIONS.findIndex(([id]) => id === p.id);
  const title = SECTIONS[i]?.[1] ?? '';
  return (
    <section id={p.id} className="m-section" aria-labelledby={`${p.id}-h`}>
      <span className="m-section__n">{String(i + 1).padStart(2, '0')}</span>
      <h2 id={`${p.id}-h`}>{title}</h2>
      {p.children}
    </section>
  );
}

export function Methodology() {
  const v0 = evidence('V0');
  const i1 = evidence('I1');
  const i1b = i1.rows.find((r) => r.test === 'Impact time error, Δt 1 s');
  // ω·Δt·r/2 at 400 km with Δt = 1 s, where ω = √(μ/r³).
  const r400 = R_EARTH + 400e3;
  const wobble = Math.sqrt(MU_EARTH / r400 ** 3) * r400 * 0.5;
  const active = useActiveSection();
  return (
    <div className="orb m-page">
      <header className="m-header">
        <span className="m-brand">ORBITAL</span>
        <a className="orb-btn orb-btn--secondary orb-btn--sm" href="/">
          Back to the simulator
        </a>
      </header>
      <main className="m-main">
        <section className="m-hero" aria-labelledby="m-title">
          <p className="orb-section-label">Methodology</p>
          <h1 id="m-title">How ORBITAL computes an orbit</h1>
          <p className="m-lede">
            Every computed trajectory, the orange line and the spacecraft, is integrated step by
            step by the physics engine; none of it is drawn from a formula. The exact solution, the
            cyan dotted line and its ghost marker, is the opposite: closed-form two-body formulas,
            shown only to compare against, never integrated. This page states the model, the
            evidence behind each preset, and what the app does not model.
          </p>
          <dl className="m-stats">
            {(
              [
                [
                  V0_V010_ROWS[4]?.measured,
                  'Position error after one orbit, ISS reference case (T7)',
                  'v0.1.0',
                ],
                [
                  V0_V010_ROWS[2]?.measured,
                  'Largest relative energy drift over 10 orbits (T5)',
                  'v0.1.0',
                ],
                [
                  V0_V010_ROWS[0]?.measured,
                  'Largest relative change in angular momentum (T3)',
                  'v0.1.0',
                ],
                [
                  `${String(CASES.length)} cases`,
                  'Ellipse, escape, impact, GEO and coarse-step cases, limits registered in advance',
                  'v0.1.1',
                ],
              ] as const
            ).map(([v, what, rel]) => (
              <div className="m-stat" key={what}>
                <dt>{what}</dt>
                <dd>{v}</dd>
                <dd>
                  <StatusDone text={`Completed · ${rel}`} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <nav className="m-toc" aria-label="On this page">
          <p className="orb-section-label">On this page</p>
          <ol>
            {SECTIONS.map(([id, title], i) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={active === id ? 'location' : undefined}>
                  <span className="m-toc__n">{String(i + 1).padStart(2, '0')}</span>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="m-body">
          <Section id="model">
            <p>
              ORBITAL integrates Newton&apos;s law of gravitation for one spacecraft around a
              point-mass Earth. The model is deliberately small, so that every claim about it can be
              tested.
            </p>
            <table className="orb-gates m-table">
              <thead>
                <tr>
                  <th scope="col">Assumption</th>
                  <th scope="col">Value or statement</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gravitational parameter μ</td>
                  <td>{sci(MU_EARTH, 10)} m³/s²</td>
                  <td>WGS 84 (NGA.STND.0036)</td>
                </tr>
                <tr>
                  <td>Earth radius R_E (impact boundary)</td>
                  <td>{group(R_EARTH)} m</td>
                  <td>WGS 84 equatorial radius</td>
                </tr>
                <tr>
                  <td>Frame</td>
                  <td>Idealised Earth-centred inertial, 2D (equatorial plane)</td>
                  <td>ADR-0002</td>
                </tr>
                <tr>
                  <td>Forces not modelled</td>
                  <td>Drag, J2 and higher harmonics, Sun, Moon, radiation pressure</td>
                  <td>Out of scope for Web Alpha</td>
                </tr>
                <tr>
                  <td>Earth rotation (drawing only)</td>
                  <td>7.292 115 × 10⁻⁵ rad/s, from an arbitrary orientation</td>
                  <td>WGS 84; ADR-0004</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section id="integrator">
            <p>
              Each step updates velocity first, then position with the new velocity. This is
              semi-implicit (symplectic) Euler with a fixed step Δt:
            </p>
            <div
              className="m-eq"
              role="math"
              aria-label="v at k plus 1 equals v at k plus delta t times a of r at k; r at k plus 1 equals r at k plus delta t times v at k plus 1; a of r equals minus mu r over the cube of the length of r."
            >
              <span className="m-eq__lhs">
                <b>v</b>
                <sub>
                  <var>k</var>+1
                </sub>
              </span>
              <span className="m-eq__rhs">
                = <b>v</b>
                <sub>
                  <var>k</var>
                </sub>{' '}
                + Δ<var>t</var> · <b>a</b>(<b>r</b>
                <sub>
                  <var>k</var>
                </sub>
                )
              </span>
              <span className="m-eq__n">(1)</span>
              <span className="m-eq__lhs">
                <b>r</b>
                <sub>
                  <var>k</var>+1
                </sub>
              </span>
              <span className="m-eq__rhs">
                = <b>r</b>
                <sub>
                  <var>k</var>
                </sub>{' '}
                + Δ<var>t</var> · <b>v</b>
                <sub>
                  <var>k</var>+1
                </sub>
              </span>
              <span className="m-eq__n">(2)</span>
              <span className="m-eq__lhs">
                <b>a</b>(<b>r</b>)
              </span>
              <span className="m-eq__rhs">
                = −<var>μ</var> <b>r</b> / |<b>r</b>|<sup>3</sup>
              </span>
              <span className="m-eq__n">(3)</span>
            </div>
            <ul>
              <li>Angular momentum is conserved exactly, up to rounding.</li>
              <li>
                Energy error is second order on a circle but first order on an ellipse, where it
                scales with radial speed.
              </li>
              <li>
                Position error is first order and mostly along the track. Mid-orbit it reaches
                kilometres, then nearly cancels each revolution.
              </li>
            </ul>
          </Section>

          <Section id="numbers">
            <p>ORBITAL shows three kinds of number, and labels each one.</p>
            <table className="orb-gates m-table">
              <thead>
                <tr>
                  <th scope="col">Kind</th>
                  <th scope="col">Label</th>
                  <th scope="col">Where it comes from</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sample readout</td>
                  <td>
                    a sample stamp, or <i>run</i>
                  </td>
                  <td>
                    One computed sample, never interpolated (ADR-0005). The marker moves smoothly;
                    the numbers do not.
                  </td>
                </tr>
                <tr>
                  <td>Exact</td>
                  <td>
                    <i>exact</i>
                  </td>
                  <td>
                    The closed-form two-body solution for the configured starting state. Never
                    integrated, so it is unaffected by the step size; it is what the run is compared
                    with.
                  </td>
                </tr>
                <tr>
                  <td>Measured result</td>
                  <td>Completed, with release and date</td>
                  <td>A published validation report, never computed in the browser</td>
                </tr>
              </tbody>
            </table>
            <h3>Why the altitude of a circular orbit wobbles</h3>
            <p>
              On the 400 km ISS preset the altitude readout oscillates by a few kilometres. The
              orbit is circular; the wobble is numerical. Semi-implicit Euler&apos;s position and
              velocity are effectively half a step apart, so each stored state sits slightly off the
              true circle, by about ω·Δt·r/2 ≈ {(wobble / 1000).toFixed(1)} km. The error does not
              grow; it oscillates once per revolution.
            </p>
            <h3>Why eccentricity and apsides are shown as exact</h3>
            <p>
              The same half-step offset corrupts orbital elements computed from a stored state: on a
              circular orbit they would report a nonzero eccentricity. So the diagnostics show the
              exact elements of the configured orbit, tagged <i>exact</i>. What the run itself
              measured, such as its first period, appears under Advanced, tagged <i>run</i>.
            </p>
            <h3>The exact solution is a reference, not a second simulation</h3>
            <p>
              With <i>Exact solution</i> on, the cyan dotted path and the ghost marker come from
              Kepler&apos;s equation solved in closed form for the same starting state (ADR-0005
              R8). Nothing in them is stepped or integrated, and the integrator never reads them.
              Where the orange marker runs ahead of or behind the ghost, that gap is the run&apos;s
              own position error at that moment.
            </p>
            <h3>Drift is self-consistency, not accuracy</h3>
            <p>
              The drift plots show how far the run&apos;s energy and radius move from their starting
              values: a line for the largest drift so far (the number shown) and a band for the
              drift at each sample. A run can agree with itself and still be far from the exact
              orbit, so drift never raises an evidence tier. Accuracy is what the registered cases
              measure against an exact solution.
            </p>
          </Section>

          <Section id="impact">
            <p>
              When a trajectory reaches the ground, ORBITAL shows two different events with two
              different marks.
            </p>
            <dl className="orb-kv m-kv">
              <dt>Numerical impact detected</dt>
              <dd className="m-dd-text">
                The first computed sample with |r| ≤ R_E. The run stops there. It is quantised to
                whole steps and carries the run&apos;s position error.
              </dd>
              <dt>Analytical surface crossing</dt>
              <dd className="m-dd-text">
                Where the exact two-body trajectory meets the surface, from the closed-form time of
                flight. Not affected by the step size.
              </dd>
            </dl>
            <p>
              At a grazing angle a small radial error moves the crossing a long way along the track.
              Case I1 registered a limit for the timing error before it was run and measured{' '}
              {i1b?.measured ?? '—'} at Δt = 1 s (limit {i1b?.limit ?? '—'}).
            </p>
          </Section>

          <Section id="tiers">
            <p>
              Every run carries one evidence tier, from an exact match of its inputs. Similar inputs
              earn nothing.
            </p>
            <table className="orb-gates m-table">
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col">Applies when</th>
                  <th scope="col">What it claims</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <TierBadge ev={v0} />
                  </td>
                  <td>Exactly the v0.1.0 case: 400 km, k = 1, Δt = 1 s, up to 10 orbits</td>
                  <td>Meets T3–T8 at the v0.1.0 tolerances</td>
                </tr>
                <tr>
                  <td>
                    <TierBadge ev={evidence('E1')} />
                  </td>
                  <td>
                    Altitude, k and Δt bit-identical to a v0.1.1 case that has passed; no more steps
                    than were tested
                  </td>
                  <td>That case&apos;s measured errors against an exact solution</td>
                </tr>
                <tr>
                  <td>
                    <TierBadge ev={{ ...v0, tier: 3, id: null, label: 'Unvalidated' }} />
                  </td>
                  <td>Everything else, including any change to a tested case or a longer run</td>
                  <td>No accuracy claim</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section id="v010">
            <p>
              <StatusDone text="Completed · v0.1.0 · 2026-11-23" />
            </p>
            <table className="orb-gates m-table">
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Limit</th>
                  <th scope="col">Measured</th>
                </tr>
              </thead>
              <tbody>
                {V0_V010_ROWS.map((r) => (
                  <tr key={r.test}>
                    <td>{r.test}</td>
                    <td className="num">{r.limit}</td>
                    <td className="num">{r.measured}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="v011">
            <p>
              Five further cases, each with its limits registered before it was run, and one
              registered run (commit <code>{V011_RUN.commit}</code>, {V011_RUN.date}). P2 records
              its errors at a coarse step without a gate; it shows what a 60 s step costs.
            </p>
            {CASES.map((id) => {
              const ev = evidence(id);
              return (
                <div className="m-case" key={id}>
                  <h3>
                    {id} · {PRESETS[id].label}
                  </h3>
                  <table className="orb-gates m-table">
                    <thead>
                      <tr>
                        <th scope="col">Metric</th>
                        <th scope="col">Limit</th>
                        <th scope="col">Measured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.rows.map((r) => (
                        <tr key={r.test}>
                          <td>{r.test}</td>
                          <td className="num">{r.limit}</td>
                          <td className="num">{r.measured}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </Section>

          <Section id="browser">
            <p>
              The browser runs a TypeScript port of the Python engine (engine {ENGINE_VERSION}). It
              is checked against the Python implementation for bit-level agreement on the registered
              cases (ADR-0003, C1–C8):{' '}
              {CONFORMS_TO_PYTHON === null
                ? 'pending'
                : `conforms to Python orbital ${CONFORMS_TO_PYTHON}`}{' '}
              in Node, Chromium, Firefox and WebKit in CI. Rounding can differ between CPU kernels;
              the floating-point note in the repository records where and why.
            </p>
          </Section>

          <Section id="limits">
            <ul>
              <li>Two dimensions, one body, point-mass Earth: no drag, no J2, no third bodies.</li>
              <li>A fixed-step first-order integrator: accurate where tested, not everywhere.</li>
              <li>
                Inside |e − 1| &lt; 10⁻⁹ the exact solution is not computed; the run is still shown,
                without an exact overlay.
              </li>
              <li>Runs are limited to one million steps.</li>
              <li>
                3D rendering is verified on a GPU in Chromium, Firefox and WebKit on macOS (WA-6).
                Performance is measured on one class A machine only; the other reference devices
                (classes B–D) are not yet measured.
              </li>
            </ul>
          </Section>

          <Section id="drawn">
            <table className="orb-gates m-table">
              <thead>
                <tr>
                  <th scope="col">Scene element</th>
                  <th scope="col">Kind</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Trajectory, computed past and future', 'Computed samples'],
                    [
                      'Spacecraft marker position',
                      'Computed; smoothed between samples for display only',
                    ],
                    ['Velocity arrow direction', 'Computed at the current sample'],
                    ['Exact path and exact-position ghost', 'Closed form, never integrated'],
                    [
                      'Numerical impact cross / analytical crossing diamond',
                      'Computed / closed form',
                    ],
                    ['Spacecraft size', 'Illustrative, not to scale'],
                    ['Earth texture and its rotation', 'Illustrative'],
                    ['Axis labels and scale bar', 'Drawn to the scene scale'],
                  ] as const
                ).map(([el, kind]) => (
                  <tr key={el}>
                    <td>{el}</td>
                    <td>{kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="credits">
            <p>
              Earth imagery: NASA Earth Observatory, <i>Blue Marble: Next Generation</i> with
              topography and bathymetry, December 2004 (Reto Stöckli, NASA Goddard Space Flight
              Center), downloaded from NASA and reduced to 2K, 4K and 8K textures without colour
              changes. Its orientation is arbitrary: no date or longitude is implied. Constants: WGS
              84 (NGA.STND.0036). Typeface: IBM Plex.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
