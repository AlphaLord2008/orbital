/**
 * Screen-space scene marks (ADR-0005 R12–R14, R17): spacecraft marker and ring, its
 * not-to-scale label, the behind-Earth indicator, the velocity arrow, the exact-position
 * ghost, numerical impact cross, analytical crossing diamond, axis labels and scale bar.
 * Positions are written straight to the DOM every frame (no React render per frame).
 */
import { useRef } from 'react';

export interface Pt {
  x: number;
  y: number;
}

export interface OverlayFrame {
  marker: (Pt & { hidden: boolean }) | null;
  velocity: Pt | null; // unit screen direction
  ghost: Pt | null;
  impact: (Pt & { label: string }) | null;
  crossing: (Pt & { label: string }) | null;
  xLabel: Pt | null;
  yLabel: Pt | null;
  scale: { px: number; label: string } | null;
  width: number;
  height: number;
}

interface Els {
  marker?: SVGGElement | null;
  behind?: SVGGElement | null;
  label?: HTMLSpanElement | null;
  leader?: SVGLineElement | null;
  arrow?: SVGGElement | null;
  ghost?: SVGCircleElement | null;
  impact?: SVGGElement | null;
  impactLabel?: HTMLSpanElement | null;
  crossing?: SVGRectElement | null;
  crossingLabel?: HTMLSpanElement | null;
  xLabel?: HTMLSpanElement | null;
  yLabel?: HTMLSpanElement | null;
  scale?: HTMLDivElement | null;
  scaleText?: HTMLSpanElement | null;
  scaleBar?: HTMLDivElement | null;
}

const els: Els = {};

/** Ref callback that registers an element and starts it hidden. */
function reg<K extends keyof Els>(key: K) {
  return (e: Els[K]) => {
    els[key] = e;
    e?.setAttribute('hidden', '');
  };
}
let lastLabel = '';

const show = (el: Element | null | undefined, on: boolean) => {
  if (el) el.toggleAttribute('hidden', !on);
};
const place = (el: HTMLElement | null | undefined, x: number, y: number) => {
  if (el) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
};
const placeSvg = (el: SVGElement | null | undefined, x: number, y: number, rot = 0) => {
  el?.setAttribute(
    'transform',
    `translate(${x.toFixed(1)} ${y.toFixed(1)})${rot ? ` rotate(${rot.toFixed(1)})` : ''}`,
  );
};

/** Called by the scene driver once per frame. */
export function updateOverlay(f: OverlayFrame): void {
  const m = f.marker;
  show(els.marker, !!m && !m.hidden);
  show(els.behind, !!m && m.hidden);
  show(els.label, !!m);
  show(els.leader, !!m);
  if (m) {
    placeSvg(m.hidden ? els.behind : els.marker, m.x, m.y);
    // Label below-left of the ring with a leader, flipped near the edges.
    const right = m.x < f.width / 2; // label toward the centre, away from the side panels
    const below = m.y < f.height - 120;
    const lx = right ? m.x + 30 : m.x - 30;
    const ly = below ? m.y + 34 : m.y - 34;
    const text = m.hidden ? 'Spacecraft behind Earth' : 'Spacecraft';
    if (els.label && text !== lastLabel) {
      if (els.label.firstChild) els.label.firstChild.textContent = text;
      lastLabel = text;
    }
    if (els.label) {
      const w = els.label.offsetWidth;
      place(els.label, right ? lx : lx - w, below ? ly : ly - 22);
    }
    const ux = (right ? 1 : -1) * Math.SQRT1_2;
    const uy = (below ? 1 : -1) * Math.SQRT1_2;
    els.leader?.setAttribute('x1', (m.x + ux * 15).toFixed(1));
    els.leader?.setAttribute('y1', (m.y + uy * 15).toFixed(1));
    els.leader?.setAttribute('x2', lx.toFixed(1));
    els.leader?.setAttribute('y2', (below ? ly : ly).toFixed(1));
  }
  const v = f.velocity;
  show(els.arrow, !!m && !m.hidden && !!v);
  if (m && v) placeSvg(els.arrow, m.x, m.y, (Math.atan2(v.y, v.x) * 180) / Math.PI);

  show(els.ghost, !!f.ghost);
  if (f.ghost) {
    els.ghost?.setAttribute('cx', f.ghost.x.toFixed(1));
    els.ghost?.setAttribute('cy', f.ghost.y.toFixed(1));
  }
  show(els.impact, !!f.impact);
  show(els.impactLabel, !!f.impact);
  if (f.impact) {
    placeSvg(els.impact, f.impact.x, f.impact.y);
    if (els.impactLabel) {
      if (els.impactLabel.lastChild) els.impactLabel.lastChild.textContent = f.impact.label;
      place(els.impactLabel, f.impact.x + 14, f.impact.y + 10);
    }
  }
  show(els.crossing, !!f.crossing);
  show(els.crossingLabel, !!f.crossing);
  if (f.crossing) {
    placeSvg(els.crossing, f.crossing.x, f.crossing.y, 45);
    if (els.crossingLabel) {
      if (els.crossingLabel.lastChild) els.crossingLabel.lastChild.textContent = f.crossing.label;
      place(els.crossingLabel, f.crossing.x + 14, f.crossing.y - 32);
    }
  }
  show(els.xLabel, !!f.xLabel);
  if (f.xLabel) place(els.xLabel, f.xLabel.x + 6, f.xLabel.y - 9);
  show(els.yLabel, !!f.yLabel);
  if (f.yLabel) place(els.yLabel, f.yLabel.x + 6, f.yLabel.y - 9);
  show(els.scale, !!f.scale);
  if (f.scale && els.scaleBar && els.scaleText) {
    els.scaleBar.style.width = `${f.scale.px.toFixed(1)}px`;
    if (els.scaleText.textContent !== f.scale.label) els.scaleText.textContent = f.scale.label;
  }
}

export function Overlay() {
  const root = useRef<HTMLDivElement>(null);
  return (
    <div ref={root} className="scene-overlay" aria-hidden="true">
      <svg className="scene-overlay__svg">
        <line ref={reg('leader')} className="mk-leader" />
        <g ref={reg('arrow')} className="mk-velocity">
          <line x1="15" y1="0" x2="51" y2="0" />
          <path d="M55 0 L47 -4.5 L47 4.5 Z" />
        </g>
        <circle ref={reg('ghost')} className="mk-ghost" r="5" />
        <rect
          ref={reg('crossing')}
          className="mk-crossing"
          x="-5.66"
          y="-5.66"
          width="11.31"
          height="11.31"
        />
        <g ref={reg('impact')} className="mk-impact">
          <path d="M-6 -6 L6 6 M6 -6 L-6 6" />
        </g>
        <g ref={reg('behind')} className="mk-behind">
          <circle r="13" />
        </g>
        <g ref={reg('marker')} className="mk-craft">
          <circle className="mk-craft__ring" r="13" />
          <circle className="mk-craft__disc" r="6" />
        </g>
      </svg>
      <span ref={reg('label')} className="orb-scene-label scene-overlay__label">
        <span>Spacecraft</span> <span className="num">· not to scale</span>
      </span>
      <span ref={reg('impactLabel')} className="orb-scene-label scene-overlay__label">
        <span className="orb-mk-impact" />
        <span>Numerical impact detected</span>
      </span>
      <span ref={reg('crossingLabel')} className="orb-scene-label scene-overlay__label">
        <span className="orb-mk-crossing" />
        <span>Analytical surface crossing</span>
      </span>
      <span ref={reg('xLabel')} className="orb-scene-label scene-overlay__label">
        x
      </span>
      <span ref={reg('yLabel')} className="orb-scene-label scene-overlay__label">
        y
      </span>
      <div ref={reg('scale')} className="orb-scalebar scene-overlay__scale">
        <span ref={(e) => void (els.scaleText = e)} />
        <div ref={(e) => void (els.scaleBar = e)} className="orb-scalebar__bar" />
      </div>
    </div>
  );
}
