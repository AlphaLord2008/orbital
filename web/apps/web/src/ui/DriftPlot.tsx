/**
 * Numerical drift plot (WA-F8): min–max envelope per bucket, drawn up to the playback sample so
 * the plot grows with the run; the orange dot is the current sample. Self-consistency, not accuracy.
 */
import { bucketOf } from '../sim/diagnostics';
import { sci } from '../evidence/tiers';
import { clock } from './format';

const W = 288;
const H = 62;

export function DriftPlot(p: {
  title: string;
  min: Float32Array;
  max: Float32Array;
  current: number;
  k: number;
  n: number;
  tPlayed: number;
  /** A registered limit for this quantity, drawn when it is on the plot's scale. */
  limit?: { value: number; label: string } | null;
}) {
  const B = p.max.length;
  const kb = bucketOf(p.k, p.n, B);
  let top = 0;
  for (let b = 0; b < B; b++) top = Math.max(top, p.max[b] as number);
  const showLimit = !!p.limit && p.limit.value <= 4 * top;
  if (showLimit && p.limit) top = Math.max(top, p.limit.value);
  top = top > 0 ? top * 1.08 : 1;
  const X = (b: number) => (B > 1 ? (b / (B - 1)) * W : 0);
  const Y = (v: number) => H - 1 - (v / top) * (H - 2);
  const upper: string[] = [];
  const lower: string[] = [];
  for (let b = 0; b <= kb; b++) {
    upper.push(`${X(b).toFixed(1)},${Y(p.max[b] as number).toFixed(1)}`);
    lower.push(`${X(b).toFixed(1)},${Y(p.min[b] as number).toFixed(1)}`);
  }
  if (kb === 0) {
    upper.push(`1,${Y(p.max[0] as number).toFixed(1)}`);
    lower.push(`1,${Y(p.min[0] as number).toFixed(1)}`);
  }
  const poly = [...upper, ...lower.reverse()].join(' ');
  const cx = X(kb);
  const cy = Y(p.current);
  return (
    <figure
      className="orb-plot"
      aria-label={`${p.title}: ${sci(p.current)} at sample ${String(p.k)}`}
    >
      <div className="orb-plot__head">
        <span className="orb-plot__title">{p.title}</span>
        <span className="orb-plot__value">{sci(p.current)}</span>
      </div>
      <div className="orb-plot__frame">
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {showLimit && p.limit ? (
            <>
              <line
                className="plot-limit"
                x1="0"
                x2={W}
                y1={Y(p.limit.value)}
                y2={Y(p.limit.value)}
              />
            </>
          ) : null}
          <polygon className="plot-band" points={poly} />
          <circle className="plot-dot" cx={cx} cy={cy} r="3" />
        </svg>
        {/* HTML, not SVG text: the plot is stretched to its frame (preserveAspectRatio none),
            which distorts glyphs, and this was the app's only SVG text when Firefox's content
            process crashed under axe in CI. */}
        {showLimit && p.limit ? (
          <span
            className="plot-limit__label"
            style={{ top: `${((100 * Y(p.limit.value)) / H).toFixed(2)}%` }}
          >
            {p.limit.label}
          </span>
        ) : null}
      </div>
      <div className="orb-plot__axis">
        <span>0</span>
        <span>played to {clock(p.tPlayed).replace(/\.\d$/, '')}</span>
        <span />
      </div>
    </figure>
  );
}
