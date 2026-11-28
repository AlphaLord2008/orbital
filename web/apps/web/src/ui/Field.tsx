/**
 * A numeric input with its slider (WA-F1): both edit the same value through the one schema
 * (WA-E1). Typing commits on Enter or blur; an invalid value is reported, never clamped, and the
 * last valid run stays on screen (WA-E2). The slider snaps to the field's displayed precision and
 * is a native range input underneath, so keyboard and screen readers get it for free (WA-A4).
 */
import { useEffect, useId, useState } from 'react';
import { FIELDS, type FieldId, fromSlider, parseField, toSlider } from '../sim/schema';
import { useStore } from '../state/store';

export interface FieldProps {
  field: FieldId;
  value: number;
  onCommit: (v: number) => void;
  /** Values the slider snaps to when within 0.5 % of the travel (e.g. k = 1 and √2 marks). */
  marks?: readonly { value: number; label: string }[];
  help?: React.ReactNode | undefined;
  format?: (v: number) => string;
  slider?: boolean;
  touch?: boolean | undefined;
  label?: string;
}

export function Field(p: FieldProps) {
  const f = FIELDS[p.field];
  const id = useId();
  // A draft and its error belong to the value they were typed against: when the value changes
  // from elsewhere (preset, link, slider), they are obsolete.
  const [edit, setEdit] = useState<{ for: number; draft: string | null; err: string | null }>({
    for: p.value,
    draft: null,
    err: null,
  });
  const current = edit.for === p.value ? edit : { for: p.value, draft: null, err: null };
  const { draft, err } = current;
  const setDraft = (d: string | null) => {
    setEdit((e) => ({ ...(e.for === p.value ? e : { err: null }), for: p.value, draft: d }));
  };
  const setErr = (x: string | null) => {
    setEdit((e) => ({ ...(e.for === p.value ? e : { draft: null }), for: p.value, err: x }));
  };
  const [active, setActive] = useState(false);
  const setFieldError = useStore.getState().setFieldError;
  const label = p.label ?? f.label;
  const fmt = p.format ?? ((v: number) => v.toFixed(f.digits));
  const shown = draft ?? fmt(p.value);

  useEffect(() => {
    setFieldError(err ? { field: p.field, label, message: err } : null);
  }, [err, p.field, label, setFieldError]);
  useEffect(
    () => () => {
      if (useStore.getState().fieldError?.field === p.field) setFieldError(null);
    },
    [p.field, setFieldError],
  );

  const commit = () => {
    if (draft === null) return;
    const r = parseField(p.field, draft);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setErr(null);
    setDraft(null);
    if (r.value !== p.value) p.onCommit(r.value);
  };

  const steps = f.scale === 'linear' ? Math.round((f.max - f.min) * 10 ** f.digits) : 1000;
  const u = toSlider(p.field, p.value);
  const fromStep = (i: number) => {
    let v = fromSlider(p.field, i / steps);
    for (const m of p.marks ?? [])
      if (Math.abs(toSlider(p.field, m.value) - i / steps) < 0.005) v = m.value;
    return v;
  };
  const pct = `${(100 * u).toFixed(2)}%`;
  const msgId = `${id}-m`;
  return (
    <div className={`orb-field${err ? ' orb-field--error' : ''}`}>
      <div className="orb-field__top">
        <label className="orb-field__label" htmlFor={id}>
          {label}
        </label>
        <span
          className={`orb-num${p.touch ? ' orb-num--touch' : ''}${err ? ' orb-num--error' : ''}`}
        >
          <input
            id={id}
            value={shown}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!err}
            aria-describedby={err || p.help ? msgId : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              if (err) setErr(parseField(p.field, e.target.value).ok ? null : err);
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
          <span className="orb-num__unit">{f.unit}</span>
        </span>
      </div>
      {p.slider === false ? null : (
        <div
          className={`orb-slider${p.touch ? ' orb-slider--touch' : ''}${active ? ' is-active' : ''}`}
        >
          <span className="orb-slider__rail" />
          <span className="orb-slider__fill" style={{ width: pct }} />
          {(p.marks ?? []).map((m) => (
            <span
              key={m.label}
              className="orb-slider__mark"
              style={{ left: `${(100 * toSlider(p.field, m.value)).toFixed(2)}%` }}
            />
          ))}
          <span className="orb-slider__thumb" style={{ left: pct }} />
          <input
            type="range"
            className="orb-slider__input"
            aria-label={`${label} slider`}
            min={0}
            max={steps}
            step={1}
            value={Math.round(u * steps)}
            aria-valuetext={`${fmt(p.value)} ${f.unit === '×' ? 'times circular speed' : f.unit}`}
            onPointerDown={() => {
              setActive(true);
            }}
            onPointerUp={() => {
              setActive(false);
            }}
            onBlur={() => {
              setActive(false);
            }}
            onChange={(e) => {
              const v = fromStep(Number(e.target.value));
              setErr(null);
              setDraft(null);
              if (v !== p.value) p.onCommit(v);
            }}
          />
        </div>
      )}
      {err ? (
        <p className="orb-field__msg" id={msgId} role="alert">
          {err}
        </p>
      ) : p.help ? (
        <p className="orb-field__msg" id={msgId}>
          {p.help}
        </p>
      ) : null}
    </div>
  );
}
