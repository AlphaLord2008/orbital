import { CONFORMS_TO_PYTHON, ENGINE_VERSION } from '@orbital/engine';
import { useEffect } from 'react';
import { Overlay } from './scene/Overlay';
import { Scene } from './scene/Scene';
import { type CameraPreset, type Mode, useStore } from './state/store';
import * as I from './ui/icons';
import { Readouts } from './ui/Readouts';
import { ScenarioCard } from './ui/ScenarioCard';
import { Transport } from './ui/Transport';

function ModeSwitch() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore.getState().setMode;
  const item = (m: Mode, label: string, Icon: () => React.JSX.Element) => (
    <button
      className="orb-mode__item"
      role="radio"
      aria-checked={mode === m}
      onClick={() => {
        setMode(m);
      }}
    >
      <Icon />
      {label}
    </button>
  );
  return (
    <div className="orb-mode" role="radiogroup" aria-label="Interface mode">
      {item('explore', 'Explore', I.Explore)}
      {item('analyze', 'Analyze', I.Analyze)}
    </div>
  );
}

function CameraButtons() {
  const request = useStore.getState().requestCamera;
  const b = (p: CameraPreset, label: string, Icon: () => React.JSX.Element) => (
    <button
      className="orb-iconbtn"
      aria-label={label}
      title={label}
      onClick={() => {
        request(p);
      }}
    >
      <Icon />
    </button>
  );
  return (
    <div className="hud-camera" role="group" aria-label="Camera">
      {b('top', 'Top-down north', I.ViewTop)}
      {b('oblique', 'Oblique', I.ViewOblique)}
      {b('fit', 'Fit orbit', I.ViewFit)}
    </div>
  );
}

function ViewToggles() {
  const showExact = useStore((s) => s.showExact);
  const showVelocity = useStore((s) => s.showVelocity);
  const { toggleExact, toggleVelocity } = useStore.getState();
  return (
    <section className="orb-card hud-view" aria-labelledby="vw-t">
      <h2 className="orb-card__title" id="vw-t">
        View
      </h2>
      <label className="hud-check">
        <input type="checkbox" checked={showExact} onChange={toggleExact} />
        Exact solution <span className="orb-legend__analytic" />{' '}
        <span className="orb-legend__ghost" />
      </label>
      <label className="hud-check">
        <input type="checkbox" checked={showVelocity} onChange={toggleVelocity} />
        Velocity direction <span className="orb-mk-velocity" />
      </label>
    </section>
  );
}

function Status() {
  const computing = useStore((s) => s.computing);
  const error = useStore((s) => s.error);
  if (error)
    return (
      <div className="orb-banner orb-banner--warning hud-status" role="alert">
        <div className="orb-banner__body">
          <p className="orb-banner__text">{error}</p>
        </div>
      </div>
    );
  if (!computing || computing.total < 100_000) return null;
  const pct = (100 * computing.done) / computing.total;
  return (
    <div className="hud-status orb-card" role="status" aria-live="polite">
      <span className="orb-caption">
        Computing {Math.round(pct)}% · {computing.total.toLocaleString('en-US')} steps
      </span>
      <div className="orb-progress">
        <div className="orb-progress__bar" style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
    </div>
  );
}

export function App() {
  const mode = useStore((s) => s.mode);
  useEffect(() => {
    useStore.getState().loadPreset('V0');
    useStore.getState().setRate(60);
  }, []);
  return (
    <main className={`orb app app--${mode}`}>
      <Scene />
      <Overlay />
      <header className="hud-header">
        <div className="hud-brand">
          <h1 className="hud-brand__name">ORBITAL</h1>
          <span className="hud-brand__tag">Every orbit here is integrated, not drawn.</span>
        </div>
        <ModeSwitch />
        <CameraButtons />
      </header>
      <div className="hud-left">
        <ScenarioCard />
        {mode === 'analyze' ? <ViewToggles /> : null}
      </div>
      <div className="hud-right">
        <Readouts />
      </div>
      <div className="orb-legend hud-legend" aria-hidden="true">
        <span className="orb-legend__item">
          <span className="orb-legend__past" />
          Computed past
        </span>
        <span className="orb-legend__item">
          <span className="orb-legend__future" />
          Computed future
        </span>
        <span className="orb-legend__item">
          <span className="orb-mk-craft" />
          Spacecraft
        </span>
      </div>
      <Status />
      <div className="hud-bottom">
        <Transport />
        <p className="hud-meta">
          Web Alpha · build {__ORBITAL_COMMIT__} · engine {ENGINE_VERSION} · browser engine
          conformance:{' '}
          {CONFORMS_TO_PYTHON === null ? 'Pending' : `Python orbital ${CONFORMS_TO_PYTHON}`} · Earth
          imagery: NASA Earth Observatory
        </p>
      </div>
    </main>
  );
}
