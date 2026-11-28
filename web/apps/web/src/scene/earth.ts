/**
 * True-scale Earth (ADR-0004 §2): radius from R_EARTH, WGS 84 rotation from an arbitrary
 * θ₀ = 0, camera-attached headlight (no Sun, no terminator), a 1.6 px inner limb at 25%.
 *
 * Texture: NASA Blue Marble Next Generation (topography and bathymetry, December 2004),
 * derived from the NASA original by `scripts/design/derive_earth_textures.py`
 * (provenance: docs/validation/wa6/earth-texture.md). 2K arrives first (≤ 400 KB, every class);
 * 4K and 8K load only when the Earth is drawn large enough on screen that the texture in use
 * would be magnified, and only on devices that may hold them (requirements §6.1). A replaced
 * texture is disposed at once, so GPU memory holds one Earth texture.
 */
import {
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  type WebGLRenderer,
} from 'three';
import earth2k from '../assets/earth-2k.webp?url';
import earth4k from '../assets/earth-4k.webp?url';
import earth8k from '../assets/earth-8k.webp?url';
import { EARTH_RADIUS_KM, earthAngle } from './frame';

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
void main() {
  vUv = uv;
  vNormalView = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

// The approved WA-0 shading (scripts/design/render.py, render_earth): in linear light,
// colour × (0.42 + 0.58·(n·v)^0.55) × 1.18, clipped by the sRGB encode; then a 1.6 px rim
// mixed at 25 % toward a cool grey-blue. Nothing is drawn outside the disc.
const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D map;
uniform vec3 rimColor;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewPos;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vNormalView);
  float ndv = clamp(dot(n, normalize(-vViewPos)), 0.0, 1.0);
  float shade = 0.42 + 0.58 * pow(ndv, 0.55);
  vec3 color = min(texture2D(map, vUv).rgb * shade * 1.18, vec3(1.0));
  float w = max(fwidth(ndv) * 1.6, 1e-4);
  float rim = 1.0 - smoothstep(0.0, w, ndv);
  color = mix(color, rimColor, 0.25 * rim);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export type EarthTier = '2k' | '4k' | '8k';
const TIERS: readonly { tier: EarthTier; url: string; width: number }[] = [
  { tier: '2k', url: earth2k, width: 2048 },
  { tier: '4k', url: earth4k, width: 4096 },
  { tier: '8k', url: earth8k, width: 8192 },
];

/**
 * The largest texture this device may load (requirements §6.1): class D (≤ 2 GB reported, or
 * a GPU limit under 4096) keeps 2K; phones, touch-first tablets and GPUs without 8192 textures
 * stop at 4K (classes B–C, ≤ 64 MB of texture); class A desktops may load 8K. `deviceMemory`
 * is Chromium-only and capped at 8; Safari and Firefox do not report it, so a touch-first
 * device (an iPad) is capped by its pointer, not its memory.
 */
export function maxTier(opts: {
  maxTextureSize: number;
  screenMinPx: number;
  deviceMemoryGb: number | undefined;
  touchPrimary?: boolean;
}): EarthTier {
  const mem = opts.deviceMemoryGb;
  if (opts.maxTextureSize < 4096 || (mem !== undefined && mem <= 2)) return '2k';
  if (
    opts.maxTextureSize < 8192 ||
    opts.screenMinPx < 600 ||
    opts.touchPrimary === true ||
    (mem !== undefined && mem < 8)
  )
    return '4k';
  return '8k';
}

/**
 * The smallest texture that is not magnified when the Earth's disc is `diameterPx` device pixels
 * across: an equirectangular texture of width W has W/π texels across the disc at its centre.
 */
export function neededTier(diameterPx: number): EarthTier {
  if (diameterPx <= 2048 / Math.PI) return '2k';
  if (diameterPx <= 4096 / Math.PI) return '4k';
  return '8k';
}

/** GPU bytes for an RGBA8 texture of this tier with its full mip chain (× 4/3). */
export function tierBytes(tier: EarthTier): number {
  const w = TIERS.find((t) => t.tier === tier)?.width ?? 2048;
  return Math.round((w * (w / 2) * 4 * 4) / 3);
}

const rank = (t: EarthTier) => TIERS.findIndex((x) => x.tier === t);

type Source = HTMLImageElement | ImageBitmap;

/**
 * Fetch and decode to an ImageBitmap off the main thread, already flipped for WebGL and with
 * no colour conversion (the bytes stay sRGB; the texture is tagged sRGB). Uploading an
 * ImageBitmap avoids a synchronous re-decode inside texImage2D, which stalled the main thread
 * for ~400 ms on the 8K texture (measured, M3 Pro, Chromium). Falls back to an <img> where
 * createImageBitmap or its options are unavailable.
 */
function loadBitmap(
  url: string,
  onReady: (src: Source, flipped: boolean) => void,
  onFail: () => void,
): void {
  if (typeof createImageBitmap !== 'function') {
    loadDecoded(
      url,
      (img) => {
        onReady(img, false);
      },
      onFail,
    );
    return;
  }
  fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) =>
      createImageBitmap(blob, {
        imageOrientation: 'flipY',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      }),
    )
    .then(
      (bmp) => {
        onReady(bmp, true);
      },
      () => {
        loadDecoded(
          url,
          (img) => {
            onReady(img, false);
          },
          onFail,
        );
      },
    );
}

/**
 * Load an image and decode it before it reaches WebGL. `decode()` lets the browser decode
 * off the main thread, so the texture upload does not also pay for decoding.
 */
function loadDecoded(
  url: string,
  onReady: (img: HTMLImageElement) => void,
  onFail: () => void,
): void {
  const img = new Image();
  img.decoding = 'async';
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    onReady(img);
  };
  img.addEventListener(
    'error',
    () => {
      if (settled) return;
      settled = true;
      onFail();
    },
    { once: true },
  );
  img.src = url;
  if (typeof img.decode === 'function') {
    img.decode().then(done, () => {
      if (img.complete && img.naturalWidth > 0) done();
      else img.addEventListener('load', done, { once: true });
    });
  } else {
    img.addEventListener('load', done, { once: true });
  }
}

export interface Earth {
  readonly mesh: Mesh;
  /** Rotate to simulation time t [s]. */
  update(t: number): void;
  /** Tell the Earth how large it is drawn (device px across the disc); may start a sharper texture. */
  setDrawnDiameter(px: number): void;
  dispose(): void;
}

export function createEarth(
  renderer: WebGLRenderer,
  onTexture: (tier: EarthTier, bytes: number) => void,
): Earth {
  const geometry = new SphereGeometry(EARTH_RADIUS_KM, 192, 96);
  const material = new ShaderMaterial({
    uniforms: {
      map: { value: null },
      // (0.55, 0.68, 0.82) in display space, as in the approved renders.
      rimColor: { value: new Color().setRGB(0.55, 0.68, 0.82).convertSRGBToLinear() },
    },
    vertexShader,
    fragmentShader,
  });
  const mesh = new Mesh(geometry, material);
  mesh.visible = false; // until the first texture arrives: never an untextured sphere
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let limit = maxTier({
    maxTextureSize: renderer.capabilities.maxTextureSize,
    screenMinPx: Math.min(screen.width, screen.height),
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    touchPrimary: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
  });
  let current: { tier: EarthTier; tex: Texture } | null = null;
  let loading: EarthTier | null = null;
  let wanted: EarthTier = '2k';
  let wantedSince = 0;
  let retried = false;
  let disposed = false;

  const load = (tier: EarthTier) => {
    const t = TIERS[rank(tier)];
    if (!t) return;
    loading = tier;
    loadBitmap(
      t.url,
      (img, flipped) => {
        loading = null;
        if (disposed) {
          if ('close' in img) img.close();
          return;
        }
        const tex = new Texture(img);
        tex.flipY = !flipped; // an ImageBitmap arrives already flipped
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = anisotropy;
        tex.minFilter = LinearMipmapLinearFilter; // trilinear: no shimmer when zoomed out
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        const old = current;
        current = { tier, tex };
        material.uniforms['map'] = { value: tex };
        material.needsUpdate = true;
        mesh.visible = true;
        if (old) {
          old.tex.dispose(); // one Earth texture on the GPU at a time
          const src = old.tex.image as Source;
          if ('close' in src) src.close();
        }
        onTexture(tier, tierBytes(tier));
        // A larger tier, if still wanted, starts from the next setDrawnDiameter call.
      },
      () => {
        // Download or decode failed: keep the texture in use and stop asking for sharper ones
        // this session (no retry loop on a bad connection). The first texture is retried once.
        loading = null;
        if (disposed) return;
        if (!current && !retried) {
          retried = true;
          load(tier);
        } else if (current) limit = current.tier;
      },
    );
  };
  load('2k');

  return {
    mesh,
    update(t) {
      mesh.rotation.y = earthAngle(t);
    },
    setDrawnDiameter(px) {
      const need = neededTier(px);
      const w = rank(need) > rank(limit) ? limit : need;
      const now = performance.now();
      if (w !== wanted) {
        wanted = w;
        wantedSince = now;
      }
      // Only a size the view keeps for 400 ms counts: a zoom passing through, or a camera
      // flight, must not start a large download and upload.
      if (loading || !current || now - wantedSince < 400) return;
      // Step up one tier at a time; never step down (no reload churn while zooming).
      if (rank(wanted) > rank(current.tier)) {
        const next = TIERS[rank(current.tier) + 1];
        if (next) load(next.tier);
      }
    },
    dispose() {
      disposed = true;
      if (current) {
        current.tex.dispose();
        const src = current.tex.image as Source;
        if ('close' in src) src.close();
      }
      geometry.dispose();
      material.dispose();
    },
  };
}
