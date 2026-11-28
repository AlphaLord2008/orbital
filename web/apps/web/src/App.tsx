import { CONFORMS_TO_PYTHON, ENGINE_VERSION } from '@orbital/engine';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { TierBadge } from './evidence/TierBadge';
import { Overlay } from './scene/Overlay';
import { Scene } from './scene/Scene';
import { PRESETS } from './sim/scenario';
import { type CameraPreset, type Mode, useStore } from './state/store';
import { Dialogs } from './ui/Dialogs';
import {
  DiagnosticsBody,
  EvidenceCard,
  PrimaryReadouts,
  StaleNotice,
  useStale,
} from './ui/Diagnostics';
import * as I from './ui/icons';
import { classification, formatE, useEvidence } from './ui/runView';
import { PresetSelect, ScenarioFields } from './ui/ScenarioControls';
import { Transport } from './ui/Transport';

// Phones in portrait, and any short landscape screen where the desktop panels cannot fit (WA-A12).
const PHONE = '(max-width: 760px), (max-height: 500px)';
function usePhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(PHONE);
      m.addEventListener('change', cb);
      return () => {
        m.removeEventListener('change', cb);
      };
    },
    () => matchMedia(PHONE).matches,
  );
}

function ModeSwitch({ touch }: { touch?: boolean }) {
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
      {touch ? null : <Icon />}
      {label}
    </button>
  );
  return (
    <div
      className={`orb-mode${touch ? ' orb-mode--touch' : ''}`}
      role="radiogroup"
      aria-label="Interface mode"
    >
      {item('explore', 'Explore', I.Explore)}
      {item('analyze', 'Analyze', I.Analyze)}
    </div>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  const announce = useStore.getState().announce;
  return (
    <button
      className="orb-btn orb-btn--secondary orb-btn--sm"
      onClick={() => {
        void navigator.clipboard.writeText(location.href).then(
          () => {
            setDone(true);
            announce('Link copied. It reopens this exact run.');
            setTimeout(() => {
              setDone(false);
            }, 2000);
          },
          () => {
            announce('Could not copy: the browser blocked clipboard access.');
          },
        );
      }}
    >
      <I.Link />
      {done ? 'Copied' : 'Copy link'}
    </button>
  );
}

function Header({ phone }: { phone: boolean }) {
  const { setDialog, setPresentation } = useStore.getState();
  if (phone)
    return (
      <header className="hud-header hud-header--phone" data-occludes="top">
        <h1 className="hud-brand__name">ORBITAL</h1>
        <ModeSwitch touch />
        <a
          className="orb-iconbtn orb-iconbtn--touch"
          href="methodology.html"
          aria-label="How this works"
        >
          <I.Info />
        </a>
      </header>
    );
  return (
    <header className="hud-header" data-occludes="top">
      <div className="hud-brand">
        <h1 className="hud-brand__name">ORBITAL</h1>
        <span className="hud-brand__tag">
          Every computed orbit is integrated step by step, not drawn.
        </span>
      </div>
      <ModeSwitch />
      <nav className="hud-nav" aria-label="Site">
        <a className="orb-btn orb-btn--quiet orb-btn--sm" href="methodology.html">
          How this works
        </a>
        <button
          className="orb-iconbtn"
          aria-label="Data view"
          title="Data view"
          onClick={() => {
            setDialog('data');
          }}
        >
          <I.Table />
        </button>
        <button
          className="orb-iconbtn"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={() => {
            setDialog('shortcuts');
          }}
        >
          <I.Keyboard />
        </button>
        <button
          className="orb-iconbtn"
          aria-label="Presentation mode"
          title="Presentation mode (P)"
          onClick={() => {
            setPresentation(true);
          }}
        >
          <I.Present />
        </button>
        <CopyLink />
      </nav>
    </header>
  );
}

function CameraSeg({ touch }: { touch?: boolean | undefined }) {
  const req = useStore((s) => s.cameraRequest);
  const request = useStore.getState().requestCamera;
  const item = (p: CameraPreset, label: string) => (
    <button
      className="orb-seg__item"
      aria-pressed={req.seq > 0 && req.preset === p}
      onClick={() => {
        request(p);
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      className={`orb-seg${touch ? ' orb-seg--touch' : ''} cam-seg`}
      role="group"
      aria-label="Camera"
    >
      {item('top', 'Top-down')}
      {item('oblique', 'Oblique')}
      {item('fit', 'Fit orbit')}
    </div>
  );
}

function Switch(p: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="orb-switch" role="switch" aria-checked={p.on} onClick={p.onToggle}>
      <span className="orb-switch__track">
        <span className="orb-switch__knob" />
      </span>
      {p.label}
    </button>
  );
}

function ViewInspection({ touch }: { touch?: boolean | undefined }) {
  const showExact = useStore((s) => s.showExact);
  const showVelocity = useStore((s) => s.showVelocity);
  const { toggleExact, toggleVelocity } = useStore.getState();
  return (
    <div className="orb-panel__section setup-view">
      <p className="orb-section-label">View and inspection</p>
      <CameraSeg touch={touch} />
      <div className="setup-switches">
        <Switch on={showVelocity} label="Velocity direction" onToggle={toggleVelocity} />
        <Switch on={showExact} label="Exact solution" onToggle={toggleExact} />
      </div>
    </div>
  );
}

/*
 * App regions, dialogs and the phone tab panel are named with aria-label holding the visible
 * heading's exact text, not aria-labelledby: in CI, Playwright's Firefox content process segfaults
 * when axe computes the app's region name through aria-labelledby
 * (docs/validation/wa5-firefox-axe-crash.md). The accessible names are unchanged.
 */
function Panel(p: {
  id: string;
  title: string;
  side: 'left' | 'right';
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section
      id={p.id}
      className={`orb-panel hud-panel hud-panel--${p.side}${collapsed ? ' orb-panel--collapsed' : ''}`}
      aria-label={p.title}
      data-occludes={p.side}
    >
      <header className="orb-panel__header">
        <h2 className="orb-panel__title" id={`${p.id}-t`}>
          {p.title}
        </h2>
        <button
          className={`orb-iconbtn panel-collapse panel-collapse--${p.side}`}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${p.title.toLowerCase()}`}
          aria-expanded={!collapsed}
          onClick={() => {
            setCollapsed(!collapsed);
          }}
        >
          <I.Collapse />
        </button>
      </header>
      <div className="orb-panel__body">{p.children}</div>
    </section>
  );
}

function SetupPanel() {
  return (
    <Panel id="controls" title="Setup" side="left">
      <div className="orb-panel__section">
        <PresetSelect />
      </div>
      <div className="orb-panel__section">
        <ScenarioFields full />
      </div>
      <ViewInspection />
    </Panel>
  );
}

/** Explore: the essentials only, so the orbit stays the subject. */
function ExploreCard() {
  return (
    <section id="controls" className="orb-card hud-scenario" aria-label="Scenario">
      <h2 className="orb-card__title" id="sc-t">
        Scenario
      </h2>
      <PresetSelect />
      <ScenarioFields full={false} />
      <CameraSeg />
    </section>
  );
}

function ExploreReadouts() {
  const r = useStore((s) => s.result);
  const ev = useEvidence();
  const stale = useStale();
  const computing = useStore((s) => s.computing);
  if (!r || !ev)
    return (
      <section className="orb-card hud-readouts" aria-label="Readouts">
        <p className="orb-caption">{computing ? 'Computing the first orbit…' : 'No result yet.'}</p>
      </section>
    );
  return (
    <section className={`orb-card hud-readouts`} aria-label="Readouts">
      <h2 className="visually-hidden" id="ro-t">
        Readouts
      </h2>
      <StaleNotice />
      <div className={`hud-readouts__values${stale ? ' is-stale' : ''}`}>
        <div className="hud-readouts__head">
          <TierBadge ev={ev} />
          <span className="hud-kind">
            {classification(r)} · e = {formatE(r.exact.e)}
          </span>
        </div>
        <PrimaryReadouts r={r} />
        {!r.exact.available && r.exact.unavailableReason ? (
          <p className="orb-caption">{r.exact.unavailableReason}</p>
        ) : null}
        {r.status === 'impact' ? (
          <p className="orb-caption">
            The run stopped at the first sample with |r| ≤ R<sub>E</sub>. It is never extrapolated
            to the surface.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Legend() {
  const showExact = useStore((s) => s.showExact);
  const showVelocity = useStore((s) => s.showVelocity);
  return (
    <div className="orb-legend hud-legend" aria-hidden="true" data-occludes="top">
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
      {showVelocity ? (
        <span className="orb-legend__item">
          <span className="orb-mk-velocity" />
          Velocity direction
        </span>
      ) : null}
      {showExact ? (
        <>
          <span className="orb-legend__item">
            <span className="orb-legend__analytic" />
            Exact solution
          </span>
          <span className="orb-legend__item">
            <span className="orb-legend__ghost" />
            Exact position now
          </span>
        </>
      ) : null}
    </div>
  );
}

function SceneBanner() {
  const fieldError = useStore((s) => s.fieldError);
  const mode = useStore((s) => s.mode);
  const linkError = useStore((s) => s.linkError);
  if (linkError)
    return (
      <div className="orb-banner orb-banner--warning scene-banner" role="alert">
        <div className="orb-banner__body">
          <p className="orb-banner__text">
            This link could not be opened. {linkError} Showing the reference case V0 instead.
          </p>
        </div>
        <button
          className="orb-iconbtn"
          aria-label="Dismiss"
          onClick={() => {
            useStore.setState({ linkError: null });
          }}
        >
          <I.Close />
        </button>
      </div>
    );
  if (!fieldError) return null;
  return (
    <div className="orb-banner orb-banner--warning scene-banner" role="status">
      <div className="orb-banner__body">
        <p className="orb-banner__text">
          Showing the last valid run · fix the {fieldError.label.toLowerCase()} in{' '}
          {mode === 'analyze' ? 'Setup' : 'Scenario'}
        </p>
      </div>
    </div>
  );
}

function Presentation() {
  const r = useStore((s) => s.result);
  const presetId = useStore((s) => s.presetId);
  const ev = useEvidence();
  const setPresentation = useStore.getState().setPresentation;
  return (
    <>
      <header className="hud-header hud-header--pres" data-occludes="top">
        <h1 className="hud-brand__name">ORBITAL</h1>
        <button
          className="orb-btn orb-btn--secondary"
          onClick={() => {
            setPresentation(false);
          }}
        >
          Exit presentation <span className="orb-kbd">Esc</span>
        </button>
      </header>
      <Legend />
      {r && ev ? (
        <div className="orb-panel pres-readouts" data-occludes="bottom">
          <div className="pres-readouts__id">
            <TierBadge ev={ev} />
            <span className="pres-readouts__name">
              {presetId ? PRESETS[presetId].label : 'Custom scenario'}
            </span>
          </div>
          <PrimaryReadouts r={r} />
        </div>
      ) : null}
    </>
  );
}

/** Publish the sheet's height so the 3D view frames the orbit above it. */
function useSheetHeight() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      root.style.setProperty('--sheet-h', `${String(Math.round(r.height))}px`);
      root.style.setProperty('--sheet-w', `${String(Math.round(r.width))}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--sheet-h');
      root.style.removeProperty('--sheet-w');
    };
  });
  return ref;
}

function PhoneSheet() {
  const sheetRef = useSheetHeight();
  const sheet = useStore((s) => s.sheet);
  const mode = useStore((s) => s.mode);
  const presetId = useStore((s) => s.presetId);
  const r = useStore((s) => s.result);
  const ev = useEvidence();
  const { setSheet, setMode } = useStore.getState();
  const [tab, setTab] = useState<'controls' | 'diagnostics' | 'evidence'>('diagnostics');
  if (sheet === 'controls' && mode === 'explore')
    return (
      <section
        className="orb-sheet phone-sheet phone-sheet--tall"
        aria-label="Scenario"
        id="controls"
        ref={sheetRef}
      >
        <span className="orb-sheet__handle" aria-hidden="true" />
        <div className="phone-sheet__head">
          <h2 id="ps-t">Scenario</h2>
          <button
            className="orb-btn orb-btn--quiet orb-btn--sm phone-touch"
            onClick={() => {
              setSheet('none');
            }}
          >
            Done
          </button>
        </div>
        <div className="phone-sheet__body">
          <PresetSelect touch />
          <ScenarioFields full={false} touch />
          <button
            className="orb-btn orb-btn--secondary phone-touch"
            onClick={() => {
              setMode('analyze');
              setSheet('diagnostics');
              setTab('controls');
            }}
          >
            <I.Sliders />
            All controls in Analyze
          </button>
          <p className="orb-caption">Changes run straight away.</p>
        </div>
      </section>
    );
  if (sheet !== 'none' && mode === 'analyze') {
    const tabs = [
      ['controls', 'Controls'],
      ['diagnostics', 'Diagnostics'],
      ['evidence', 'Evidence'],
    ] as const;
    return (
      <section
        className="orb-sheet phone-sheet phone-sheet--tall"
        aria-label="Analyze"
        id="controls"
        ref={sheetRef}
      >
        <span className="orb-sheet__handle" aria-hidden="true" />
        <div className="phone-sheet__tabs">
          <div className="orb-tabs" role="tablist">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                className="orb-tab"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls="phone-tabpanel"
                onClick={() => {
                  setTab(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="orb-btn orb-btn--quiet orb-btn--sm phone-touch"
            onClick={() => {
              setSheet('none');
            }}
          >
            Done
          </button>
        </div>
        <div
          className="phone-sheet__body"
          role="tabpanel"
          id="phone-tabpanel"
          aria-label={tabs.find(([id]) => id === tab)?.[1]}
        >
          {tab === 'controls' ? (
            <>
              <PresetSelect touch />
              <ScenarioFields full touch />
              <ViewInspection touch />
            </>
          ) : tab === 'diagnostics' ? (
            <DiagnosticsBody touch />
          ) : ev ? (
            <EvidenceCard ev={ev} />
          ) : null}
        </div>
      </section>
    );
  }
  return (
    <section className="orb-sheet phone-sheet" aria-label="Run" ref={sheetRef}>
      <span className="orb-sheet__handle" aria-hidden="true" />
      <div className="phone-sheet__head">
        <span className="phone-sheet__name">
          {presetId ? PRESETS[presetId].label : 'Custom scenario'}
        </span>
        <button
          className="orb-btn orb-btn--secondary orb-btn--sm phone-touch"
          onClick={() => {
            setSheet(mode === 'analyze' ? 'diagnostics' : 'controls');
          }}
        >
          <I.Sliders />
          {mode === 'analyze' ? 'Diagnostics' : 'Controls'}
        </button>
      </div>
      <StaleNotice />
      {r ? <PrimaryReadouts r={r} /> : <p className="orb-caption">Computing the first orbit…</p>}
      <Transport phone />
    </section>
  );
}

function LiveRegion() {
  const a = useStore((s) => s.announcement);
  const seq = useStore((s) => s.lastRun?.seq);
  const r = useStore((s) => s.result);
  const ev = useEvidence();
  const [text, setText] = useState('');
  // Announce a finished run once input settles, not every slider tick.
  useEffect(() => {
    if (!r || !ev || seq === undefined) return;
    const id = setTimeout(() => {
      setText(`Run ready: ${classification(r)}. ${ev.label}${ev.id ? ` ${ev.id}` : ''}.`);
    }, 800);
    return () => {
      clearTimeout(id);
    };
  }, [seq, r, ev]);
  useEffect(() => {
    if (!a.seq) return;
    const id = setTimeout(() => {
      setText(a.text);
    }, 0);
    return () => {
      clearTimeout(id);
    };
  }, [a]);
  return (
    <div className="visually-hidden" aria-live="polite" role="status">
      {text}
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest('input, select, textarea, [contenteditable]') !== null;
      const s = useStore.getState();
      if (e.key === 'Escape' && s.presentation) {
        s.setPresentation(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || s.dialog !== 'none') return;
      if (e.key === '?') {
        e.preventDefault();
        s.setDialog('shortcuts');
      } else if (e.key === 'p' || e.key === 'P') {
        s.setPresentation(!s.presentation);
      } else if (e.key === ' ' && !el.closest('button, [role="slider"], a')) {
        e.preventDefault();
        s.setPlaying(!s.playing);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

export function App() {
  const mode = useStore((s) => s.mode);
  const lastRun = useStore((s) => s.lastRun);
  const runR0 = useStore((s) => s.result?.run.r0[0]);
  const presentation = useStore((s) => s.presentation);
  const fieldError = useStore((s) => s.fieldError);
  const phone = usePhone();
  useShortcuts();
  useEffect(() => {
    const s = useStore.getState();
    s.initFromUrl(location.search);
    if (!location.search) s.setRate(60);
  }, []);
  return (
    <main
      className={`orb app app--${mode}${presentation ? ' app--presentation' : ''}${phone ? ' app--phone' : ''}${
        fieldError ? ' app--invalid' : ''
      }`}
      data-run-ms={lastRun ? lastRun.ms.toFixed(1) : undefined}
      data-run-steps={lastRun?.steps}
      data-run-cached={lastRun?.cached}
      data-run-seq={lastRun?.seq}
      data-run-r0={runR0}
    >
      <a className="skip-link" href="#controls">
        Skip to controls
      </a>
      <Scene />
      <Overlay />
      <SceneBanner />
      {presentation ? (
        <Presentation />
      ) : phone ? (
        <>
          <Header phone />
          <PhoneTier />
          <PhoneSheet />
        </>
      ) : (
        <>
          <Header phone={false} />
          {mode === 'analyze' ? (
            <>
              <SetupPanel />
              <Panel id="diagnostics" title="Diagnostics" side="right">
                <DiagnosticsBody />
              </Panel>
            </>
          ) : (
            <>
              <div className="hud-left" data-occludes="left">
                <ExploreCard />
              </div>
              <div className="hud-right" data-occludes="right">
                <ExploreReadouts />
              </div>
            </>
          )}
          <Legend />
        </>
      )}
      {phone && !presentation ? null : (
        <div className="hud-bottom" data-occludes="bottom">
          <Transport />
          {presentation ? null : (
            <p className="hud-meta">
              Web Alpha · build {__ORBITAL_COMMIT__} · engine {ENGINE_VERSION} · browser engine
              conformance:{' '}
              {CONFORMS_TO_PYTHON === null ? 'Pending' : `Python orbital ${CONFORMS_TO_PYTHON}`} ·
              Earth imagery: NASA Earth Observatory
            </p>
          )}
        </div>
      )}
      <Dialogs />
      <LiveRegion />
    </main>
  );
}

function PhoneTier() {
  const ev = useEvidence();
  const sheet = useStore((s) => s.sheet);
  if (!ev || sheet !== 'none') return null;
  return (
    <div className="phone-tier" data-occludes="top">
      <TierBadge ev={ev} />
    </div>
  );
}
