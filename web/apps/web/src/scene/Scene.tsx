/**
 * The 3D view (WA-F5, WA-D1–D10), plain three.js driven from the store. One per-frame
 * function updates the Earth, lines, camera and the screen-space overlay; React renders
 * only the host element. (ADR-0007 rev 3: React Three Fiber removed to meet the 300 KB
 * first-route JS budget; its `import * as THREE` defeats tree-shaking.)
 */
import { analytic } from '@orbital/engine';
import { useEffect, useRef, useState } from 'react';
import { PerspectiveCamera, Scene as ThreeScene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { hermite, sampleIndex } from '../sim/display';
import type { RunResult } from '../sim/protocol';
import { useStore } from '../state/store';
import { group } from '../ui/format';
import {
  FAR_KM,
  fitDistance,
  FOV_DEG,
  kmPerPixel,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  NEAR_KM,
  niceScale,
  occludedByEarth,
  presetDirection,
} from './camera';
import { createEarth } from './earth';
import { EARTH_RADIUS_KM, M_PER_UNIT, packScenePositions } from './frame';
import { COLORS, makeLine, setLinePositions, setSegment, updateDashes } from './lines';
import { insetViewport, type OverlayFrame, type Pt, updateOverlay } from './Overlay';

const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Per-result display geometry, built once when a result arrives. */
interface Prepared {
  result: RunResult;
  forward: Float32Array[];
  reversed: Float32Array[];
  exactPath: Float32Array;
  /** Null when the exact solution is unavailable (parabolic band): no ghost, no crossing mark. */
  orbit: analytic.KeplerOrbit | null;
  crossing: [number, number] | null;
  extentKm: number;
}

function prepare(result: RunResult): Prepared {
  const forward = result.segments.map((s) => packScenePositions(result.x, result.y, s.indices));
  const reversed = result.segments.map((s) =>
    packScenePositions(result.x, result.y, Int32Array.from(s.indices).reverse()),
  );
  const ep = result.exactPath;
  const exactPath = new Float32Array((ep.length / 2) * 3);
  let extent = 0;
  for (let i = 0; i < ep.length / 2; i++) {
    exactPath[3 * i] = (ep[2 * i] as number) / M_PER_UNIT;
    exactPath[3 * i + 2] = -(ep[2 * i + 1] as number) / M_PER_UNIT;
  }
  for (let k = 0; k < result.x.length; k += Math.max(1, Math.floor(result.x.length / 4096))) {
    extent = Math.max(extent, Math.hypot(result.x[k] as number, result.y[k] as number));
  }
  extent =
    Math.max(extent, Math.hypot(result.x.at(-1) as number, result.y.at(-1) as number)) / M_PER_UNIT;
  const orbit = result.exact.available
    ? analytic.keplerOrbit([...result.run.r0], [...result.run.v0])
    : null;
  let crossing: [number, number] | null = null;
  if (orbit && result.exact.timeToSurface !== null) {
    const s = new Float64Array(4);
    orbit.stateAt(result.exact.timeToSurface, s);
    crossing = [s[0] as number, s[1] as number];
  }
  return {
    result,
    forward,
    reversed,
    exactPath,
    orbit,
    crossing,
    extentKm: Math.max(extent, EARTH_RADIUS_KM),
  };
}

function lowerBound(a: Int32Array, v: number): number {
  // index of the last element <= v
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((a[mid] as number) <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

interface View {
  dispose(): void;
}

function createView(host: HTMLElement): View {
  const renderer = new WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor('#0b0e13');
  host.appendChild(renderer.domElement);
  const scene = new ThreeScene();
  const cam = new PerspectiveCamera(FOV_DEG, 1, NEAR_KM, FAR_KM);
  const insetCam = new PerspectiveCamera(FOV_DEG, 480 / 300, 1, FAR_KM);
  let insetKmPx = 0;
  cam.position.set(9000, 7000, 22000);
  const size = { width: 1, height: 1 };
  const resize = () => {
    size.width = host.clientWidth || 1;
    size.height = host.clientHeight || 1;
    renderer.setSize(size.width, size.height, false);
    cam.aspect = size.width / size.height;
    cam.updateProjectionMatrix();
    for (const l of Object.values(lines)) l.material.resolution.set(size.width, size.height);
  };
  const earth = createEarth(renderer, () => undefined);
  scene.add(earth.mesh);

  const lines = {
    past: makeLine({ color: COLORS.accent, widthPx: 2 }),
    pastJoin: makeLine({ color: COLORS.accent, widthPx: 2 }),
    future: makeLine({ color: COLORS.accent, widthPx: 1.5, opacity: 0.55, dashPx: [6, 5] }),
    futureJoin: makeLine({ color: COLORS.accent, widthPx: 1.5, opacity: 0.55, dashPx: [6, 5] }),
    exact: makeLine({ color: COLORS.analytic, widthPx: 1, dashPx: [2, 4] }),
    axisX: makeLine({ color: COLORS.axis, widthPx: 1, opacity: 0.6 }),
    axisY: makeLine({ color: COLORS.axis, widthPx: 1, opacity: 0.6 }),
  };
  Object.values(lines).forEach((l) => scene.add(l));
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = MIN_DISTANCE_KM;
  controls.maxDistance = MAX_DISTANCE_KM;
  controls.zoomSpeed = 0.8;
  controls.rotateSpeed = 0.6;

  const prepared: { current: Prepared | null } = { current: null };
  const segIdx = { current: -1 };
  const flight: { current: { from: Vector3; to: Vector3; start: number } | null } = {
    current: null,
  };
  const tmp = { v: new Vector3(), h: new Float64Array(2), s: new Float64Array(4) };

  /** Build display geometry for a new result (also called before a camera fit, so it fits the new run). */
  const sync = (r: RunResult | null) => {
    if (!r || prepared.current?.result === r) return;
    prepared.current = prepare(r);
    segIdx.current = -1;
    setLinePositions(lines.exact, prepared.current.exactPath);
    const L = prepared.current.extentKm * 1.1;
    setLinePositions(lines.axisX, Float32Array.of(0, 0, 0, L, 0, 0));
    setLinePositions(lines.axisY, Float32Array.of(0, 0, 0, 0, 0, -L));
  };

  // Camera presets (Top-down north, Oblique, Fit orbit).
  const unsubscribe = useStore.subscribe((s, prev) => {
    if (s.cameraRequest.seq === prev.cameraRequest.seq) return;
    sync(s.result);
    const extent = prepared.current ? prepared.current.extentKm : EARTH_RADIUS_KM + 2000;
    const r = prepared.current?.result;
    const focus =
      r?.status === 'impact'
        ? new Vector3((r.x.at(-1) as number) / M_PER_UNIT, 0, -(r.y.at(-1) as number) / M_PER_UNIT)
        : undefined;
    const dir = presetDirection(s.cameraRequest.preset, cam.position, focus);
    const to = dir.multiplyScalar(fitDistance(cam, extent));
    if (reducedMotion) cam.position.copy(to);
    else flight.current = { from: cam.position.clone(), to, start: performance.now() };
  });

  // WA-E5: keep the page alive on context loss; three restores on webglcontextrestored.
  const onLost = (e: Event) => {
    e.preventDefault();
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);

  const frame = (delta: number) => {
    const st = useStore.getState();
    st.tick(delta);

    // Camera flight (eased), then controls.
    const f = flight.current;
    if (f) {
      const u = Math.min(1, (performance.now() - f.start) / 700);
      const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      cam.position.lerpVectors(f.from, f.to, e);
      if (u >= 1) flight.current = null;
    }
    controls.update();

    sync(st.result);
    const p = prepared.current;
    const frame: OverlayFrame = {
      marker: null,
      velocity: null,
      ghost: null,
      impact: null,
      crossing: null,
      xLabel: null,
      yLabel: null,
      scale: null,
      inset: null,
      width: size.width,
      height: size.height,
    };
    const dist = cam.position.length();
    const kmPx = kmPerPixel(cam, dist, size.height);
    for (const l of Object.values(lines)) updateDashes(l, kmPx);
    const project = (X: number, Y: number, Z: number): Pt | null => {
      tmp.v.set(X, Y, Z).project(cam);
      if (tmp.v.z > 1) return null;
      return { x: ((tmp.v.x + 1) / 2) * size.width, y: ((1 - tmp.v.y) / 2) * size.height };
    };

    if (!p) {
      Object.values(lines).forEach((l) => (l.visible = false));
      updateOverlay(frame);
      return false;
    }
    const res = p.result;
    const n = res.x.length;
    const dt = res.run.dt;
    const t = Math.min(st.t, res.tEnd);
    const k = sampleIndex(t, dt, n);

    // Marker: Hermite between samples k and k+1 (display only, R2).
    let mx = res.x[k] as number;
    let my = res.y[k] as number;
    if (k < n - 1) {
      const s = Math.min(Math.max((t - k * dt) / dt, 0), 1);
      hermite(
        mx,
        my,
        res.vx[k] as number,
        res.vy[k] as number,
        res.x[k + 1] as number,
        res.y[k + 1] as number,
        res.vx[k + 1] as number,
        res.vy[k + 1] as number,
        dt,
        s,
        tmp.h,
      );
      mx = tmp.h[0] as number;
      my = tmp.h[1] as number;
    }
    const MX = mx / M_PER_UNIT;
    const MZ = -my / M_PER_UNIT;

    // Current segment: revolution (bound) or whole run (R4).
    let si = 0;
    while (si + 1 < res.segments.length && (res.segments[si + 1]?.lo as number) <= k) si++;
    const seg = res.segments[si];
    if (seg) {
      if (si !== segIdx.current) {
        setLinePositions(lines.past, p.forward[si] as Float32Array);
        setLinePositions(lines.future, p.reversed[si] as Float32Array);
        segIdx.current = si;
      }
      const m = seg.indices.length;
      const j = lowerBound(seg.indices, k);
      lines.past.geometry.instanceCount = j;
      lines.past.visible = j > 0;
      lines.future.geometry.instanceCount = Math.max(0, m - 2 - j);
      lines.future.visible = m - 2 - j > 0;
      const fw = p.forward[si] as Float32Array;
      setSegment(lines.pastJoin, fw[3 * j] as number, 0, fw[3 * j + 2] as number, MX, 0, MZ);
      lines.pastJoin.visible = true;
      if (j + 1 < m) {
        setSegment(
          lines.futureJoin,
          MX,
          0,
          MZ,
          fw[3 * (j + 1)] as number,
          0,
          fw[3 * (j + 1) + 2] as number,
        );
        lines.futureJoin.visible = true;
      } else lines.futureJoin.visible = false;
    }
    lines.exact.visible = st.showExact;
    lines.axisX.visible = true;
    lines.axisY.visible = true;

    // Overlay marks.
    const mp = project(MX, 0, MZ);
    if (mp) frame.marker = { ...mp, hidden: occludedByEarth(cam.position, MX, 0, MZ) };
    if (st.showVelocity && mp) {
      const vx = (res.vx[k] as number) / M_PER_UNIT;
      const vz = -(res.vy[k] as number) / M_PER_UNIT;
      const span = dist * 0.01;
      const vn = Math.hypot(vx, vz);
      const q = project(MX + (vx / vn) * span, 0, MZ + (vz / vn) * span);
      if (q) {
        const L = Math.hypot(q.x - mp.x, q.y - mp.y);
        if (L > 1e-6) frame.velocity = { x: (q.x - mp.x) / L, y: (q.y - mp.y) / L };
      }
    }
    const tCross = res.exact.timeToSurface;
    if (p.orbit && st.showExact && (tCross === null || t <= tCross)) {
      p.orbit.stateAt(t, tmp.s);
      const GX = (tmp.s[0] as number) / M_PER_UNIT;
      const GZ = -(tmp.s[1] as number) / M_PER_UNIT;
      const g = project(GX, 0, GZ);
      if (g && !occludedByEarth(cam.position, GX, 0, GZ)) frame.ghost = g;
    }
    if (res.status === 'impact') {
      const ix = (res.x[n - 1] as number) / M_PER_UNIT;
      const iz = -(res.y[n - 1] as number) / M_PER_UNIT;
      const ip = project(ix, 0, iz);
      if (ip && !occludedByEarth(cam.position, ix, 0, iz)) {
        frame.impact = {
          ...ip,
          label: `Numerical impact detected · sample ${group(n - 1)}`,
        };
      }
    }
    if (p.crossing && tCross !== null && (st.showExact || st.mode === 'analyze')) {
      const cx = p.crossing[0] / M_PER_UNIT;
      const cz = -p.crossing[1] / M_PER_UNIT;
      const cp = project(cx, 0, cz);
      if (cp && !occludedByEarth(cam.position, cx, 0, cz)) {
        frame.crossing = {
          ...cp,
          label: `Analytical surface crossing · t = ${group(tCross, 1)} s exact`,
        };
      }
    }
    // WA-F10 / R14: Impact detail inset when the two impact marks are under 24 px apart (Analyze).
    if (
      st.mode === 'analyze' &&
      frame.impact &&
      p.crossing &&
      tCross !== null &&
      res.status === 'impact'
    ) {
      const ix = (res.x[n - 1] as number) / M_PER_UNIT;
      const iz = -(res.y[n - 1] as number) / M_PER_UNIT;
      const cx = p.crossing[0] / M_PER_UNIT;
      const cz = -p.crossing[1] / M_PER_UNIT;
      const cp = project(cx, 0, cz);
      const ip = frame.impact;
      if (cp && Math.hypot(cp.x - ip.x, cp.y - ip.y) < 24) {
        const mid = new Vector3((ix + cx) / 2, 0, (iz + cz) / 2);
        const sep = Math.hypot(ix - cx, iz - cz);
        const dir = cam.position.clone().sub(mid).normalize();
        const hHalf = Math.atan(Math.tan((insetCam.fov * Math.PI) / 360) * insetCam.aspect);
        const d = Math.max(sep / (0.3 * 2 * Math.tan(hHalf)), 50);
        insetCam.position.copy(mid).addScaledVector(dir, d);
        insetCam.up.copy(cam.up);
        insetCam.lookAt(mid);
        insetCam.updateMatrixWorld();
        insetKmPx = kmPerPixel(insetCam, d, 300);
        const toInset = (X: number, Z: number): Pt => {
          tmp.v.set(X, 0, Z).project(insetCam);
          return { x: ((tmp.v.x + 1) / 2) * 480, y: ((1 - tmp.v.y) / 2) * 300 };
        };
        const gap = tCross - res.tEnd;
        frame.inset = {
          impact: toInset(ix, iz),
          crossing: toInset(cx, cz),
          box: { x: (ip.x + cp.x) / 2, y: (ip.y + cp.y) / 2 },
          zoom: cam.position.distanceTo(mid) / d,
          impactStamp: `sample ${group(n - 1)} · t = ${group(res.tEnd, dt % 1 === 0 ? 0 : 1)} s`,
          crossingStamp: `t = ${group(tCross, 1)} s · exact`,
          caption: `The run detects impact at whole steps: the first sample at or below Earth’s radius. This run got there ${Math.abs(gap).toFixed(1)} s ${
            gap >= 0 ? 'before' : 'after'
          } the exact crossing; the two points are ${sep.toFixed(1)} km apart. This is this run's own comparison, not a validation result.`,
        };
      }
    }
    const L = p.extentKm * 1.1;
    frame.xLabel = occludedByEarth(cam.position, L, 0, 0) ? null : project(L, 0, 0);
    frame.yLabel = occludedByEarth(cam.position, 0, 0, -L) ? null : project(0, 0, -L);
    const sc = niceScale(kmPx);
    frame.scale = { px: sc.px, label: `${sc.km.toLocaleString('en-US')} km at Earth’s distance` };
    updateOverlay(frame);
    return frame.inset !== null;
  };

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const delta = Math.min((now - last) / 1000, 0.25);
    last = now;
    const wantsInset = frame(delta);
    earth.update(Math.min(useStore.getState().t, prepared.current?.result.tEnd ?? Infinity));
    renderer.render(scene, cam);
    const vp = wantsInset ? insetViewport(host.getBoundingClientRect()) : null;
    if (vp) {
      const y = size.height - vp.y - vp.h;
      renderer.setScissorTest(true);
      renderer.setScissor(vp.x, y, vp.w, vp.h);
      renderer.setViewport(vp.x, y, vp.w, vp.h);
      renderer.clear();
      for (const l of Object.values(lines)) {
        l.material.resolution.set(vp.w, vp.h);
        updateDashes(l, insetKmPx);
      }
      renderer.render(scene, insetCam);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, size.width, size.height);
      for (const l of Object.values(lines)) l.material.resolution.set(size.width, size.height);
    }
  };
  raf = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      unsubscribe();
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      Object.values(lines).forEach((l) => {
        l.geometry.dispose();
        l.material.dispose();
      });
      earth.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function Scene() {
  const host = useRef<HTMLDivElement>(null);
  const result = useStore((s) => s.result);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let view: View;
    try {
      // WA-N4: probe for WebGL 2 first, so an unsupported browser gets the fallback without a renderer error.
      if (!document.createElement('canvas').getContext('webgl2'))
        throw new Error('WebGL 2 is not available');
      view = createView(host.current);
    } catch (e) {
      // WA-N4/WA-E5: no WebGL → keep every control, readout and number working; say why the view is missing.
      const message = e instanceof Error ? e.message : String(e);
      queueMicrotask(() => {
        setFailed(message);
      });
      return;
    }
    return () => {
      view.dispose();
    };
  }, []);
  if (failed !== null) {
    return (
      <div className="scene scene--failed" role="note">
        <p className="orb-caption">
          The 3D view could not start because WebGL is unavailable in this browser. Every readout
          and control still works from the same computed run.
        </p>
      </div>
    );
  }
  const label = result
    ? `Orbit view: ${result.exact.classification === 'bound' ? 'bound orbit' : 'escape trajectory'}, ${
        result.status === 'impact' ? 'ends in impact' : 'completed'
      }, ${result.x.length.toLocaleString('en-US')} computed samples.`
    : 'Orbit view: computing.';
  return <div ref={host} className="scene" role="img" aria-label={label} />;
}
