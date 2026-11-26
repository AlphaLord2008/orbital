/** Number formatting for readouts: thin-space digit groups as in the approved designs. */
const NNBSP = ' ';

export function group(n: number, digits = 0): string {
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  const g = (i ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return `${n < 0 ? '−' : ''}${g}${f ? `.${f}` : ''}`;
}

/** HH:MM:SS.s, with days when needed. */
export function clock(t: number): string {
  const days = Math.floor(t / 86_400);
  const rem = t - days * 86_400;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem - h * 3600) / 60);
  const s = rem - h * 3600 - m * 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  const ss = s.toFixed(1).padStart(4, '0');
  return `${days > 0 ? `${String(days)}d ` : ''}${pad(h)}:${pad(m)}:${ss}`;
}

export function duration(t: number): string {
  if (t < 120) return `${t.toFixed(1)} s`;
  if (t < 7200) return `${(t / 60).toFixed(2)} min`;
  return `${(t / 3600).toFixed(3)} h`;
}
