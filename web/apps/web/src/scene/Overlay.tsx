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
  /** WA-F10 Impact detail inset: marks in inset-view coordinates, plus the box around the region in the main view. */
  inset: {
    impact: Pt;
    crossing: Pt;
    box: Pt;
    zoom: number;
    impactStamp: string;
    crossingStamp: string;
    caption: string;
  } | null;
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
  inset?: HTMLElement | null;
  insetView?: HTMLDivElement | null;
  insetZoom?: HTMLSpanElement | null;
  insetImpact?: SVGGElement | null;
  insetCrossing?: SVGRectElement | null;
  insetImpactLabel?: HTMLSpanElement | null;
  insetCrossingLabel?: HTMLSpanElement | null;
  insetImpactStamp?: HTMLSpanElement | null;
  insetCrossingStamp?: HTMLSpanElement | null;
  insetCaption?: HTMLElement | null;
  insetBox?: HTMLSpanElement | null;
  insetLeader?: SVGLineElement | null;
}

/** The inset's 3D viewport in CSS px relative to the scene, or null while the inset is hidden. */
export function insetViewport(
  sceneRect: DOMRect,
): { x: number; y: number; w: number; h: number } | null {
  const v = els.insetView;
  if (!v || els.inset?.hasAttribute('hidden')) return null;
  const r = v.getBoundingClientRect();
  return { x: r.left - sceneRect.left, y: r.top - sceneRect.top, w: r.width, h: r.height };
}

const setText = (el: Element | null | undefined, text: string) => {
  if (el && el.textContent !== text) el.textContent = text;
};

const els: Els = {};

/** Ref callback that registers an element and starts it hidden. */
function reg<K extends keyof Els>(key: K) {
  return (e: Els[K]) => {
    els[key] = e;
    e?.setAttribute('hidden', '');
  };
}
let lastLabel = '';
/** The spacecraft label's box this frame: lower-priority labels (axes) yield to it. */
let labelBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
const underLabel = (p: Pt | null, w = 14, h = 18): boolean =>
  !!p &&
  !!labelBox &&
  p.x + 6 + w > labelBox.x0 &&
  p.x + 6 < labelBox.x1 &&
  p.y - 9 + h > labelBox.y0 &&
  p.y - 9 < labelBox.y1;

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
  labelBox = null;
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
      // Keep the whole label inside the view on narrow screens.
      const x = Math.min(Math.max(right ? lx : lx - w, 4), f.width - w - 4);
      const y = below ? ly : ly - 22;
      place(els.label, x, y);
      labelBox = { x0: x - 6, y0: y - 6, x1: x + w + 6, y1: y + els.label.offsetHeight + 6 };
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
  show(els.impactLabel, !!f.impact && !f.inset); // the inset carries the labels when shown
  if (f.impact) {
    placeSvg(els.impact, f.impact.x, f.impact.y);
    if (els.impactLabel) {
      if (els.impactLabel.lastChild) els.impactLabel.lastChild.textContent = f.impact.label;
      place(els.impactLabel, f.impact.x + 14, f.impact.y + 10);
    }
  }
  show(els.crossing, !!f.crossing);
  show(els.crossingLabel, !!f.crossing && !f.inset);
  if (f.crossing) {
    placeSvg(els.crossing, f.crossing.x, f.crossing.y, 45);
    if (els.crossingLabel) {
      if (els.crossingLabel.lastChild) els.crossingLabel.lastChild.textContent = f.crossing.label;
      place(els.crossingLabel, f.crossing.x + 14, f.crossing.y - 32);
    }
  }
  const ins = f.inset;
  show(els.inset, !!ins);
  show(els.insetBox, !!ins);
  show(els.insetLeader, !!ins);
  if (ins) {
    placeSvg(els.insetImpact, ins.impact.x, ins.impact.y);
    placeSvg(els.insetCrossing, ins.crossing.x, ins.crossing.y, 45);
    place(els.insetImpactLabel, Math.max(8, ins.impact.x - 120), ins.impact.y + 16);
    const cw = els.insetCrossingLabel?.offsetWidth ?? 220;
    const cxRight = ins.crossing.x + 14 + cw <= 472;
    place(
      els.insetCrossingLabel,
      cxRight ? ins.crossing.x + 14 : ins.crossing.x - 14 - cw,
      ins.crossing.y - 52,
    );
    setText(els.insetZoom, `${ins.zoom.toFixed(0)}× closer`);
    setText(els.insetImpactStamp, ins.impactStamp);
    setText(els.insetCrossingStamp, ins.crossingStamp);
    setText(els.insetCaption, ins.caption);
    place(els.insetBox, ins.box.x - 14, ins.box.y - 14);
    const fig = els.inset?.getBoundingClientRect();
    const root = els.inset?.offsetParent?.getBoundingClientRect();
    if (fig && root && els.insetLeader) {
      els.insetLeader.setAttribute('x1', ins.box.x.toFixed(1));
      els.insetLeader.setAttribute('y1', (ins.box.y - 14).toFixed(1));
      els.insetLeader.setAttribute('x2', (fig.left - root.left + fig.width / 2).toFixed(1));
      els.insetLeader.setAttribute('y2', (fig.bottom - root.top).toFixed(1));
    }
  }
  const xOk = !!f.xLabel && !underLabel(f.xLabel);
  show(els.xLabel, xOk);
  if (xOk && f.xLabel) place(els.xLabel, f.xLabel.x + 6, f.xLabel.y - 9);
  const yOk = !!f.yLabel && !underLabel(f.yLabel);
  show(els.yLabel, yOk);
  if (yOk && f.yLabel) place(els.yLabel, f.yLabel.x + 6, f.yLabel.y - 9);
  show(els.scale, !!f.scale);
  if (f.scale && els.scaleBar && els.scaleText) {
    els.scaleBar.style.width = `${f.scale.px.toFixed(1)}px`;
    if (els.scaleText.textContent !== f.scale.label) els.scaleText.textContent = f.scale.label;
  }
}

export function Overlay() {
  const root = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={root} className="scene-overlay" aria-hidden="true">
        <svg className="scene-overlay__svg">
          <line ref={reg('leader')} className="mk-leader" />
          <line ref={reg('insetLeader')} className="mk-leader mk-leader--dashed" />
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
        <span ref={reg('insetBox')} className="scene-overlay__box" />
        <div ref={reg('scale')} className="orb-scalebar scene-overlay__scale">
          <span ref={(e) => void (els.scaleText = e)} />
          <div ref={(e) => void (els.scaleBar = e)} className="orb-scalebar__bar" />
        </div>
      </div>
      <figure ref={reg('inset')} className="orb-inset scene-inset">
        <div className="orb-inset__head">
          Impact detail
          <span ref={(e) => void (els.insetZoom = e)} />
        </div>
        <div ref={(e) => void (els.insetView = e)} className="orb-inset__view scene-inset__view">
          <svg className="scene-overlay__svg" aria-hidden="true">
            <g ref={(e) => void (els.insetImpact = e)} className="mk-impact">
              <path d="M-6 -6 L6 6 M6 -6 L-6 6" />
            </g>
            <rect
              ref={(e) => void (els.insetCrossing = e)}
              className="mk-crossing"
              x="-5.66"
              y="-5.66"
              width="11.31"
              height="11.31"
            />
          </svg>
          <span
            ref={(e) => void (els.insetImpactLabel = e)}
            className="orb-scene-label scene-overlay__label scene-inset__label scene-inset__label--impact"
          >
            <span className="scene-inset__name">
              <span className="orb-mk-impact" />
              Numerical impact detected
            </span>
            <span ref={(e) => void (els.insetImpactStamp = e)} className="num" />
          </span>
          <span
            ref={(e) => void (els.insetCrossingLabel = e)}
            className="orb-scene-label scene-overlay__label scene-inset__label scene-inset__label--crossing"
          >
            <span className="scene-inset__name">
              <span className="orb-mk-crossing" />
              Analytical surface crossing
            </span>
            <span ref={(e) => void (els.insetCrossingStamp = e)} className="num" />
          </span>
        </div>
        <figcaption ref={(e) => void (els.insetCaption = e)} className="scene-inset__caption" />
      </figure>
    </>
  );
}
