// Radix has a Slider primitive but no number-field primitive, so the typed field is a plain
// <input> wired by hand: role, label, invalid state and keyboard stepping are our code.
import * as Slider from '@radix-ui/react-slider';
import { useId, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [value, setValue] = useState(400);
  const [text, setText] = useState('400');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const commit = (raw: string) => {
    const v = Number(raw.replace(/\s/g, ''));
    if (!Number.isFinite(v) || v < 100 || v > 100000) {
      setError('Enter 100 to 100 000 km.');
      return;
    }
    setError(null);
    setValue(v);
    setText(String(v));
  };
  return (
    <main>
      <h1>Spike</h1>
      <label htmlFor={id}>Altitude (km)</label>
      <input
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(text);
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const v = Math.min(100000, Math.max(100, value + (e.key === 'ArrowUp' ? 1 : -1)));
            setValue(v);
            setText(String(v));
          }
        }}
      />
      {error && <p id={`${id}-err`} className="error">{error}</p>}
      <span className="label" id={`${id}-sl`}>Altitude slider</span>
      <Slider.Root
        className="track"
        min={100}
        max={100000}
        step={1}
        value={[value]}
        onValueChange={([v]) => {
          if (v !== undefined) {
            setValue(v);
            setText(String(v));
            setError(null);
          }
        }}
      >
        <Slider.Track>
          <Slider.Range className="range" />
        </Slider.Track>
        <Slider.Thumb className="thumb" aria-labelledby={`${id}-sl`} aria-valuetext={`${value} km`} />
      </Slider.Root>
      <p id="state">committed={value}</p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
