/**
 * Numerical drift plot (WA-F8). Self-consistency, not accuracy.
 *
 * Two series, never confused:
 *  - **Running maximum** (solid line): the largest drift from sample 0 up to the sample played.
 *    It is the headline number, and the dot at its end *is* that number at the playhead, so the
 *    dot always sits on the line.
 *  - **At each sample** (band): the min–max of the drift within each bucket of samples, drawn
 *    only for buckets that playback has fully passed, so it never shows a sample beyond k.
 * The x-axis is the whole run (0 to its end); the y-axis starts at 0 and ends at a round value
 * above the run's largest drift, so the scale does not jump while playing.
 *
 * Text and the dot are HTML positioned in percent: the SVG is stretched to its frame
 * (preserveAspectRatio none), which would distort glyphs and circles.
 */
import { sci } from '../evidence/tiers';
import { bucketOf } from '../sim/diagnostics';
import { clock } from './format';

const W = 1000;
const H = 100;

/** The smallest 1, 2 or 5 × 10ⁿ at or above x (x > 0). */
export function niceCeil(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 5, 10]) if (m * p >= x * (1 - 1e-12)) return m * p;
  return 10 * p;
}

/** Running maximum of bucket maxima over buckets [0, kb), then the exact value at sample k. */
export function runningMaxPoints(
  max: Float32Array,
  kb: number,
  current: number,
): { b: number; v: number }[] {
  const pts: { b: number; v: number }[] = [];
  let m = 0;
  for (let b = 0; b < kb; b++) {
    m = Math.max(m, max[b] as number);
    pts.push({ b, v: m });
  }
  return pts.concat({ b: kb, v: Math.max(m, current) });
}

const shortClock = (t: number) => clock(t).replace(/\.\d$/, '');
/** Axis tick: 5 × 10⁻³, 2.5 × 10⁻³, 10⁻³, 0.05 (no trailing zeros). */
export const tick = (x: number) => sci(x, 2, true).replace(/\.0(?= ×)/, '');

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/**
 * Y-axis labels for 0, top/2 and top. Below 0.01 the power of ten is factored out into one
 * axis label (scientific convention), so ticks read 5 / 2.5 / 0 with "× 10⁻³" above.
 */
export function yTicks(top: number): { factor: string | null; labels: [string, string, string] } {
  const trim = (v: number) => String(Number(v.toPrecision(3)));
  if (top >= 1e-2) return { factor: null, labels: [trim(top), trim(top / 2), '0'] };
  const e = Math.floor(Math.log10(top) + 1e-12);
  const m = top / 10 ** e;
  const sup = String(Math.abs(e))
    .split('')
    .map((d) => SUP[Number(d)])
    .join('');
  return { factor: `× 10${e < 0 ? '⁻' : ''}${sup}`, labels: [trim(m), trim(m / 2), '0'] };
}

export function DriftPlot(p: {
  title: string;
  min: Float32Array;
  max: Float32Array;
  /** Running maximum up to sample k. */
  current: number;
  k: number;
  n: number;
  tPlayed: number;
  tEnd: number;
  /** A registered limit for this quantity, drawn when it is on the plot's scale. */
  limit?: { value: number; label: string } | null;
  /** Show the key to the two series (once per group of plots). */
  legend?: boolean;
}) {
  const B = p.max.length;
  const kb = bucketOf(p.k, p.n, B);
  let runMax = 0;
  for (let b = 0; b < B; b++) runMax = Math.max(runMax, p.max[b] as number);
  const showLimit = !!p.limit && p.limit.value <= 4 * runMax;
  const top = niceCeil(Math.max(runMax, showLimit && p.limit ? p.limit.value : 0) * 1.05 || 1);
  const frac = p.n > 1 ? Math.min(1, p.k / (p.n - 1)) : 0;
  const xB = (b: number) => ((b + 0.5) / B) * W; // bucket centre
  const Y = (v: number) => H - (Math.min(v, top) / top) * H;
  const xNow = frac * W;

  // Band: fully played buckets only.
  const upper: string[] = [];
  const lower: string[] = [];
  for (let b = 0; b < kb; b++) {
    upper.push(`${xB(b).toFixed(1)},${Y(p.max[b] as number).toFixed(2)}`);
    lower.push(`${xB(b).toFixed(1)},${Y(p.min[b] as number).toFixed(2)}`);
  }
  const band = upper.length ? [...upper, ...lower.reverse()].join(' ') : '';

  // Running maximum: a monotone step line ending exactly at the dot.
  const rm = runningMaxPoints(p.max, kb, p.current);
  let d = `M0,${Y(0).toFixed(2)}`;
  for (const pt of rm) {
    const x = pt.b === kb ? xNow : xB(pt.b);
    d += ` H${x.toFixed(1)} V${Y(pt.v).toFixed(2)}`;
  }
  // The dot is the line's end point, so it cannot sit off the line.
  const dotTop = (100 * Y(rm.at(-1)?.v ?? p.current)) / H;
  const ticks = yTicks(top);
  const limitTop = showLimit && p.limit ? (100 * Y(p.limit.value)) / H : 0;
  return (
    <figure
      className="orb-plot"
      aria-label={`${p.title}: running maximum ${sci(p.current)} up to sample ${String(p.k)}; plot scale 0 to ${tick(top)}`}
    >
      <div className="orb-plot__head">
        <span className="orb-plot__title">{p.title}</span>
        <span className="orb-plot__value">
          <span className="orb-plot__value-tag">max so far</span>{' '}
          <span className="orb-plot__num">{sci(p.current)}</span>
        </span>
      </div>
      <div className="orb-plot__body">
        <div className="orb-plot__yaxis" aria-hidden="true">
          {ticks.factor ? <span className="orb-plot__factor">{ticks.factor}</span> : null}
          <span>{ticks.labels[0]}</span>
          <span>{ticks.labels[1]}</span>
          <span>0</span>
        </div>
        <div className="orb-plot__frame">
          <svg
            viewBox={`0 0 ${String(W)} ${String(H)}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line className="plot-grid" x1="0" x2={W} y1={H / 2} y2={H / 2} />
            <rect className="plot-played" x="0" y="0" width={xNow} height={H} />
            {showLimit && p.limit ? (
              <line
                className="plot-limit"
                x1="0"
                x2={W}
                y1={Y(p.limit.value)}
                y2={Y(p.limit.value)}
              />
            ) : null}
            <polygon className="plot-band" points={band} />
            <path className="plot-max" d={d} />
            <line className="plot-now" x1={xNow} x2={xNow} y1="0" y2={H} />
          </svg>
          <span
            className="plot-dot"
            style={{ left: `${(100 * frac).toFixed(2)}%`, top: `${dotTop.toFixed(2)}%` }}
          />
          {showLimit && p.limit ? (
            <span
              className={`plot-limit__label${limitTop < 22 ? ' plot-limit__label--below' : ''}`}
              style={{ top: `${limitTop.toFixed(2)}%` }}
            >
              {p.limit.label}
            </span>
          ) : null}
        </div>
      </div>
      <div className="orb-plot__axis" aria-hidden="true">
        <span>0</span>
        <span className="orb-plot__played">played to {shortClock(p.tPlayed)}</span>
        <span>{shortClock(p.tEnd)}</span>
      </div>
      {p.legend ? (
        <div className="orb-plot__legend" aria-hidden="true">
          <span>
            <span className="plot-key plot-key--max" />
            Running maximum
          </span>
          <span>
            <span className="plot-key plot-key--band" />
            At each sample (range)
          </span>
        </div>
      ) : null}
    </figure>
  );
}
