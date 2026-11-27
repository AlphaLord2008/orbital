/** Screen-space fat lines (ADR-0007: Line2) with the design-system strokes. */
import { Color } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export const COLORS = {
  accent: '#ff9548',
  analytic: '#62c2e3',
  axis: '#9aa3b2',
  critical: '#f2685b',
} as const;

export interface LineStyle {
  color: string;
  widthPx: number;
  opacity?: number;
  /** Dash and gap in CSS px; converted to world units every frame. */
  dashPx?: readonly [number, number];
}

export function makeLine(style: LineStyle): Line2 {
  const material = new LineMaterial({
    color: new Color(style.color).getHex(),
    linewidth: style.widthPx,
    worldUnits: false,
    transparent: (style.opacity ?? 1) < 1,
    opacity: style.opacity ?? 1,
    dashed: style.dashPx !== undefined,
    depthTest: true,
    depthWrite: false,
  });
  const line = new Line2(new LineGeometry(), material);
  line.frustumCulled = false;
  line.userData['dashPx'] = style.dashPx;
  return line;
}

/** Keep dashes at their CSS-pixel lengths for the current zoom (km per px at the target). */
export function updateDashes(line: Line2, kmPerPx: number): void {
  const d = line.userData['dashPx'] as readonly [number, number] | undefined;
  if (!d) return;
  line.material.dashSize = d[0] * kmPerPx;
  line.material.gapSize = d[1] * kmPerPx;
}

export function setLinePositions(line: Line2, positions: Float32Array): void {
  line.geometry.dispose();
  const g = new LineGeometry();
  if (positions.length >= 6) g.setPositions(positions);
  line.geometry = g;
  if (line.material.dashed && positions.length >= 6) line.computeLineDistances();
  line.visible = positions.length >= 6;
}

/** Overwrite a one-segment line in place (no allocation): used for the joins at the playhead. */
export function setSegment(
  line: Line2,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): void {
  const start = line.geometry.attributes['instanceStart'];
  if (!start) {
    setLinePositions(line, Float32Array.of(ax, ay, az, bx, by, bz));
    return;
  }
  const buf = (start as unknown as { data: { array: Float32Array; needsUpdate: boolean } }).data;
  buf.array.set([ax, ay, az, bx, by, bz]);
  buf.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  if (line.material.dashed) line.computeLineDistances();
}
