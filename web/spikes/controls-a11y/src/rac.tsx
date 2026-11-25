// React Aria Components: Slider and NumberField are both primitives with built-in labels,
// descriptions, errors, keyboard and touch behaviour and locale-aware number parsing.
// Range checking is done by us (validate) so an out-of-range entry stays visible with an
// error instead of being clamped (design D4, requirements WA-E2).
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FieldError,
  Group,
  Input,
  Label,
  NumberField,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from 'react-aria-components';

function App() {
  const [value, setValue] = useState(400);
  const [draft, setDraft] = useState<number>(400);
  const fmt = { maximumFractionDigits: 3 };
  return (
    <main>
      <h1>Spike</h1>
      <NumberField
        value={draft}
        onChange={(v) => {
          setDraft(v);
          if (Number.isFinite(v) && v >= 100 && v <= 100000) setValue(v);
        }}
        step={1}
        formatOptions={fmt}
        validationBehavior="aria"
        validate={(v) => (v < 100 || v > 100000 ? 'Enter 100 to 100 000 km.' : null)}
      >
        <Label>Altitude (km)</Label>
        <Group>
          <Input />
        </Group>
        <FieldError className="error" />
      </NumberField>
      <Slider
        value={value}
        minValue={100}
        maxValue={100000}
        step={1}
        formatOptions={{ style: 'unit', unit: 'kilometer' }}
        onChange={(v) => {
          setValue(v);
          setDraft(v);
        }}
      >
        <Label>Altitude slider</Label>
        <SliderOutput />
        <SliderTrack className="track">
          <SliderThumb className="thumb" />
        </SliderTrack>
      </Slider>
      <p id="state">committed={value}</p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
