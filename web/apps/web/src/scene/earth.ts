/**
 * True-scale Earth (ADR-0004 §2): radius from R_EARTH, WGS 84 rotation from an arbitrary
 * θ₀ = 0, camera-attached headlight (no Sun, no terminator), a 1.6 px inner limb at 25%.
 * Texture: 2K first (≤ 400 KB), then 4K on capable devices.
 */
import {
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  type WebGLRenderer,
} from 'three';
import earth2k from '../assets/earth-2k.jpg?url';
import earth4k from '../assets/earth-4k.jpg?url';
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
  float ndv = max(dot(n, normalize(-vViewPos)), 0.0);
  // Headlight shade as in the approved renders, applied in display space (≈ pow 2.2 in linear).
  float shade = 0.42 + 0.58 * pow(ndv, 0.55);
  vec3 color = texture2D(map, vUv).rgb * pow(shade, 2.2);
  // 1.6 px inner limb at 25% opacity.
  float w = max(fwidth(ndv) * 1.6, 1e-4);
  float rim = 1.0 - smoothstep(0.0, w, ndv);
  color = mix(color, rimColor, 0.25 * rim);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

/** Device class C/D heuristics (requirements §6.1): small or low-memory devices keep the 2K texture. */
function wantsHighRes(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const small = Math.min(screen.width, screen.height) < 600;
  return !small && (mem === undefined || mem >= 4);
}

/**
 * Load an image and decode it before it reaches WebGL. `decode()` lets the browser decode the JPEG
 * off the main thread, so the texture upload does not also pay for decoding. Same pixels, same
 * colour handling as TextureLoader; falls back to the load event where decode() is unavailable or fails.
 */
function loadDecoded(url: string, onReady: (tex: Texture) => void): void {
  const img = new Image();
  img.decoding = 'async';
  const done = () => {
    const tex = new Texture(img);
    tex.needsUpdate = true;
    onReady(tex);
  };
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
  dispose(): void;
}

export function createEarth(renderer: WebGLRenderer, onTexture: () => void): Earth {
  const geometry = new SphereGeometry(EARTH_RADIUS_KM, 192, 96);
  const material = new ShaderMaterial({
    uniforms: {
      map: { value: null },
      rimColor: { value: new Color('#e6e9ef').convertSRGBToLinear() },
    },
    vertexShader,
    fragmentShader,
  });
  const mesh = new Mesh(geometry, material);
  mesh.visible = false; // until the first texture arrives: never an untextured sphere
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures: Texture[] = [];
  let disposed = false;
  const apply = (tex: Texture) => {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = anisotropy;
    textures.push(tex);
    if (disposed) return;
    material.uniforms['map'] = { value: tex };
    material.needsUpdate = true;
    mesh.visible = true;
    onTexture();
  };
  loadDecoded(earth2k, (tex) => {
    apply(tex);
    if (wantsHighRes()) loadDecoded(earth4k, apply);
  });
  return {
    mesh,
    update(t) {
      mesh.rotation.y = earthAngle(t);
    },
    dispose() {
      disposed = true;
      textures.forEach((x) => {
        x.dispose();
      });
      geometry.dispose();
      material.dispose();
    },
  };
}
