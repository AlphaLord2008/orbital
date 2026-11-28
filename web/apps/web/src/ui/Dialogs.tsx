/** Data view with CSV export (WA-A2, WA-F15) and the keyboard shortcut sheet (WA-A5). */
import { useEffect, useRef } from 'react';
import type { RunResult } from '../sim/protocol';
import type { Scenario } from '../sim/scenario';
import { useStore } from '../state/store';
import { group } from './format';
import * as I from './icons';
import { sampleView } from './runView';

function Modal(p: { id: string; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const setDialog = useStore.getState().setDialog;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`orb-panel app-dialog${p.wide ? ' app-dialog--wide' : ''}`}
      aria-labelledby={`${p.id}-t`}
      onClose={() => {
        setDialog('none');
      }}
    >
      <header className="orb-panel__header">
        <h2 className="orb-panel__title" id={`${p.id}-t`}>
          {p.title}
        </h2>
        <button
          className="orb-iconbtn"
          aria-label="Close"
          onClick={() => {
            ref.current?.close();
          }}
        >
          <I.Close />
        </button>
      </header>
      <div className="orb-panel__body">{p.children}</div>
    </dialog>
  );
}

/** Full-precision CSV: SI units, shortest round-trip decimals (every float64 recovers exactly). */
export function runCsv(r: RunResult): Blob {
  const parts: string[] = ['t_s,x_m,y_m,vx_m_per_s,vy_m_per_s\n'];
  const n = r.x.length;
  for (let i = 0; i < n; i += 20_000) {
    let chunk = '';
    for (let k = i; k < Math.min(n, i + 20_000); k++)
      chunk += `${String(r.t[k])},${String(r.x[k])},${String(r.y[k])},${String(r.vx[k])},${String(r.vy[k])}\n`;
    parts.push(chunk);
  }
  return new Blob(parts, { type: 'text/csv' });
}

function csvName(s: Scenario): string {
  return `orbital-h${String(s.altitudeM)}-k${String(s.k)}-dt${String(s.dtS)}.csv`;
}

const ROWS = 60;

function DataView() {
  const r = useStore((s) => s.result);
  const rs = useStore((s) => s.resultScenario);
  const t = useStore((s) => s.t);
  if (!r || !rs)
    return (
      <Modal id="dv" title="Data view">
        {<p className="orb-caption">No run yet.</p>}
      </Modal>
    );
  const n = r.x.length;
  const cur = sampleView(r, t).k;
  const idx = new Set<number>();
  for (let j = 0; j < ROWS; j++) idx.add(Math.round((j * (n - 1)) / (ROWS - 1)));
  idx.add(cur);
  const rows = [...idx].sort((a, b) => a - b);
  const f = (v: number, d: number) => group(v / 1000, d);
  return (
    <Modal id="dv" title="Data view" wide>
      <p className="orb-caption">
        {ROWS} evenly spaced samples of {group(n)}, plus the current one (highlighted). Positions in
        km, velocities in km/s. The CSV holds every sample in SI units at full precision.
      </p>
      <div className="dv-scroll" tabIndex={0} aria-label="Samples">
        <table className="orb-gates dv-table">
          <thead>
            <tr>
              <th scope="col">Sample</th>
              <th scope="col">t (s)</th>
              <th scope="col">x (km)</th>
              <th scope="col">y (km)</th>
              <th scope="col">vx (km/s)</th>
              <th scope="col">vy (km/s)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr
                key={k}
                className={k === cur ? 'is-current' : undefined}
                aria-current={k === cur ? 'true' : undefined}
              >
                <td className="num">{group(k)}</td>
                <td className="num">{group(r.t[k] as number, r.run.dt % 1 ? 1 : 0)}</td>
                <td className="num">{f(r.x[k] as number, 3)}</td>
                <td className="num">{f(r.y[k] as number, 3)}</td>
                <td className="num">{f(r.vx[k] as number, 5)}</td>
                <td className="num">{f(r.vy[k] as number, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="orb-btn orb-btn--secondary dv-csv"
        onClick={() => {
          const url = URL.createObjectURL(runCsv(r));
          const a = document.createElement('a');
          a.href = url;
          a.download = csvName(rs);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 10_000);
        }}
      >
        Download CSV · {group(n)} rows
      </button>
    </Modal>
  );
}

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Space', 'Play or pause'],
  ['← →', 'Step one sample (timeline focused)'],
  ['Page Up / Page Down', 'Jump 1 % of the run (timeline focused)'],
  ['Home / End', 'First or last sample (timeline focused)'],
  ['← → ↑ ↓', 'Turn the view (view focused)'],
  ['+ / −', 'Zoom the view (view focused)'],
  ['P', 'Presentation mode'],
  ['?', 'This sheet'],
  ['Esc', 'Close a sheet or leave presentation mode'],
];

function Shortcuts() {
  return (
    <Modal id="ks" title="Keyboard shortcuts">
      <dl className="orb-kv ks-list">
        {SHORTCUTS.map(([k, what]) => (
          <div className="diag-kv-row" key={k}>
            <dt>{what}</dt>
            <dd>
              {k.split(' / ').map((x, i) => (
                <span key={x}>
                  {i ? ' / ' : ''}
                  <kbd className="orb-kbd">{x}</kbd>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useStore((s) => s.dialog);
  return dialog === 'data' ? <DataView /> : dialog === 'shortcuts' ? <Shortcuts /> : null;
}
