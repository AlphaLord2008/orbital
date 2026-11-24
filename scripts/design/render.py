"""ORBITAL WA-0 design renderer (design tooling only, not product code).

Renders a true-scale Earth and engine-computed trajectories for the
high-fidelity designs. Physics comes from the released `orbital` package;
this script only projects and draws.

Honesty rules mirrored from ADR-0004/0005:
  * Earth radius = R_EARTH; orbits are engine samples, never drawn curves.
  * Lighting is camera-attached ("headlight"): no Sun is modelled, so no terminator.
  * Earth rotates at the WGS 84 rate from an arbitrary orientation (theta0 = 0).
  * The orbit is hidden where the Earth occludes it.
  * The marker uses cubic Hermite interpolation between computed samples (display only).
"""
import json, math, os, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
import orbital as o

MU, RE = o.MU_EARTH, o.R_EARTH
OMEGA_E = 7.292115e-5
_TEX_PATH = os.environ.get("ORBITAL_EARTH_TEXTURE")
if not _TEX_PATH:
    raise SystemExit("Set ORBITAL_EARTH_TEXTURE to an equirectangular NASA Blue Marble JPEG (see docs/design/README.md).")
TEX = np.asarray(Image.open(_TEX_PATH).convert("RGB"), dtype=np.float32) / 255.0
TEX_LIN = TEX ** 2.2
BG = np.array([0x0B, 0x0E, 0x13], np.float32) / 255.0
ACCENT = (0xFF, 0x95, 0x48)
CYAN = (0x62, 0xC2, 0xE3)
AXIS = (0x9A, 0xA3, 0xB2)


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


class Camera:
    """Pinhole camera in the engine frame (km). z = north."""

    def __init__(self, target_km, dist_km, az_deg, el_deg, fov_deg, w, h, shift_px=(0, 0)):
        az, el = math.radians(az_deg), math.radians(el_deg)
        fwd = -np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
        self.pos = np.asarray(target_km, float) - fwd * dist_km
        up0 = np.array([0, 0, 1.0])
        right = np.cross(fwd, up0); right /= np.linalg.norm(right)
        up = np.cross(right, fwd)
        self.R = np.stack([right, up, fwd])  # world -> camera
        self.w, self.h = w, h
        self.f = (h / 2) / math.tan(math.radians(fov_deg) / 2)
        self.cx, self.cy = w / 2 + shift_px[0], h / 2 + shift_px[1]

    def project(self, P):
        c = (np.atleast_2d(P) - self.pos) @ self.R.T
        x = self.cx + self.f * c[:, 0] / c[:, 2]
        y = self.cy - self.f * c[:, 1] / c[:, 2]
        return np.stack([x, y], 1), c[:, 2]

    def visible(self, P, R=RE / 1000):
        """True where the segment camera->P does not pass through the sphere first."""
        P = np.atleast_2d(P); d = P - self.pos; L = np.linalg.norm(d, axis=1); u = d / L[:, None]
        oc = self.pos
        b = u @ oc; cc = oc @ oc - R * R
        disc = b * b - cc
        hit = disc > 0
        t0 = -b - np.sqrt(np.where(hit, disc, 0))
        return ~(hit & (t0 > 0) & (t0 < L - 1e-6))


def render_earth(cam, theta, ss=1):
    w, h = cam.w, cam.h
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    dirc = np.stack([(xs + 0.5 - cam.cx) / cam.f, -(ys + 0.5 - cam.cy) / cam.f, np.ones_like(xs)], -1)
    dirw = dirc @ cam.R
    dirw /= np.linalg.norm(dirw, axis=-1, keepdims=True)
    R = RE / 1000.0
    oc = cam.pos
    b = dirw @ oc
    cc = oc @ oc - R * R
    disc = b * b - cc
    # distance of closest approach of each ray to the centre, for an anti-aliased limb
    dmin = np.sqrt(np.maximum(cc + R * R - b * b, 0))
    pix_km = np.linalg.norm(oc) / cam.f
    cover = np.clip((R - dmin) / pix_km + 0.5, 0, 1)
    t = -b - np.sqrt(np.maximum(disc, 0))
    P = oc + dirw * t[..., None]
    n = P / R
    # body-fixed: rotate by -theta about z
    c, s = math.cos(-theta), math.sin(-theta)
    bx = c * n[..., 0] - s * n[..., 1]
    by = s * n[..., 0] + c * n[..., 1]
    lat = np.arcsin(np.clip(n[..., 2], -1, 1))
    lon = np.arctan2(by, bx)
    th, tw = TEX.shape[:2]
    u = (lon + math.pi) / (2 * math.pi) * tw - 0.5
    v = (math.pi / 2 - lat) / math.pi * th - 0.5
    col = np.stack([map_coordinates(TEX_LIN[..., k], [v, u % tw], order=1, mode="wrap") for k in range(3)], -1)
    # camera-attached (headlight) shading: no Sun, no terminator
    ndotv = np.clip(-(n * dirw).sum(-1), 0, 1)
    shade = 0.42 + 0.58 * ndotv ** 0.55
    col = col * shade[..., None] * 1.18
    col = np.clip(col, 0, 1) ** (1 / 2.2)
    # whisper of limb definition: thin cool rim so the true-scale edge reads (no glow outside the disc)
    rim = np.clip((dmin - (R - 1.6 * pix_km)) / (1.6 * pix_km), 0, 1) * (cover > 0)
    col = col * (1 - 0.25 * rim[..., None]) + 0.25 * rim[..., None] * np.array([0.55, 0.68, 0.82])
    out = BG * (1 - cover[..., None]) + col * cover[..., None]
    return out


def hermite(r0, v0, r1, v1, dt, s):
    h00 = 2 * s ** 3 - 3 * s ** 2 + 1; h10 = s ** 3 - 2 * s ** 2 + s
    h01 = -2 * s ** 3 + 3 * s ** 2; h11 = s ** 3 - s ** 2
    return h00 * r0 + h10 * dt * v0 + h01 * r1 + h11 * dt * v1


def rdp(points, eps):
    """Ramer-Douglas-Peucker on engine samples (indices kept), iterative."""
    keep = np.zeros(len(points), bool); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        p, q = points[a], points[b]
        seg = points[a + 1:b]
        d = q - p; L = np.hypot(*d)
        if L == 0:
            dist = np.hypot(*(seg - p).T)
        else:
            dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / L
        i = int(np.argmax(dist))
        if dist[i] > eps:
            m = a + 1 + i; keep[m] = True; stack += [(a, m), (m, b)]
    return np.flatnonzero(keep)


def to3(xy_m):
    xy = np.atleast_2d(xy_m) / 1000.0
    return np.column_stack([xy, np.zeros(len(xy))])


def draw_polyline(draw, pts_px, vis, color, width, alpha=255, dash=None, scale=1):
    """Draw visible runs; dashes measured in screen px."""
    col = color + (alpha,)
    run = []
    acc = 0.0
    for i in range(len(pts_px)):
        if vis[i]:
            run.append(tuple(pts_px[i] * scale))
        else:
            if len(run) > 1:
                acc = _emit(draw, run, col, width * scale, dash, scale, acc)
            run = []
    if len(run) > 1:
        _emit(draw, run, col, width * scale, dash, scale, acc)


def _emit(draw, run, col, w, dash, scale, acc):
    if dash is None:
        draw.line(run, fill=col, width=max(1, round(w)), joint="curve")
        return acc
    on, off = dash[0] * scale, dash[1] * scale
    period = on + off
    for (x0, y0), (x1, y1) in zip(run[:-1], run[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        pos = 0.0
        while pos < seg:
            phase = (acc + pos) % period
            if phase < on:
                l = min(on - phase, seg - pos)
                a0, a1 = pos / seg, (pos + l) / seg
                draw.line([(x0 + (x1 - x0) * a0, y0 + (y1 - y0) * a0), (x0 + (x1 - x0) * a1, y0 + (y1 - y0) * a1)], fill=col, width=max(1, round(w)))
                pos += l
            else:
                pos += period - phase
        acc += seg
    return acc


def scene(name, traj, cam, t_play, out_dir, show_analytic=None, rev_bounds=None, dim=1.0,
          axes=True, marker=True, extra_points=None, past_from=None, future_to=None):
    """Render one still; return screen-space anchors (in CSS px at 1x) for HTML overlays."""
    theta = OMEGA_E * t_play
    img = render_earth(cam, theta)
    W, H = cam.w, cam.h
    SS = 2
    overlay = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    dr = ImageDraw.Draw(overlay)
    anchors = {}
    k = min(int(math.floor(t_play / traj.dt)), len(traj.t) - 1)
    s = (t_play - traj.t[k]) / traj.dt if k + 1 < len(traj.t) else 0.0
    if k + 1 < len(traj.t):
        mpos = hermite(traj.r[k], traj.v[k], traj.r[k + 1], traj.v[k + 1], traj.dt, s)
    else:
        mpos = traj.r[k]
    a = past_from if past_from is not None else 0
    b = future_to if future_to is not None else len(traj.t) - 1
    # analytic reference (dotted cyan)
    if show_analytic is not None:
        P = to3(show_analytic); px, z = cam.project(P); vis = cam.visible(P) & (z > 0)
        draw_polyline(dr, px, vis, CYAN, 1.0, 200, dash=(2, 4), scale=SS)
    # future (dashed, 45%)
    fut_idx = np.arange(k + 1, b + 1)
    if len(fut_idx) > 1:
        sel = fut_idx[rdp(traj.r[fut_idx], 100.0)]
        P = to3(np.vstack([mpos, traj.r[sel]])); px, z = cam.project(P); vis = cam.visible(P) & (z > 0)
        draw_polyline(dr, px, vis, ACCENT, 1.5, int(255 * 0.55 * dim), dash=(6, 5), scale=SS)
    # past (solid)
    past_idx = np.arange(a, k + 1)
    if len(past_idx) > 1:
        sel = past_idx[rdp(traj.r[past_idx], 100.0)]
        P = to3(np.vstack([traj.r[sel], mpos])); px, z = cam.project(P); vis = cam.visible(P) & (z > 0)
        draw_polyline(dr, px, vis, ACCENT, 2.0, int(255 * dim), scale=SS)
    # ECI axes (hairline) from the surface outward, hidden behind the Earth
    if axes:
        for lab, d in (("x", np.array([1, 0, 0.0])), ("y", np.array([0, 1, 0.0]))):
            pts = np.array([d * (RE / 1000) * f for f in np.linspace(1.0, 1.55, 40)])
            px, z = cam.project(pts); vis = cam.visible(pts)
            draw_polyline(dr, px, vis, AXIS, 1.0, 150, scale=SS)
            tip, _ = cam.project(pts[-1]); anchors[f"axis_{lab}"] = [round(float(tip[0][0]), 1), round(float(tip[0][1]), 1)]
    # marker
    mp3 = to3(mpos); mpx, mz = cam.project(mp3); mvis = bool(cam.visible(mp3)[0])
    anchors["marker"] = [round(float(mpx[0][0]), 1), round(float(mpx[0][1]), 1)]
    anchors["marker_visible"] = mvis
    if marker and mvis:
        cx, cy = mpx[0] * SS; r = 5 * SS
        dr.ellipse([cx - r - SS, cy - r - SS, cx + r + SS, cy + r + SS], fill=(0x0B, 0x0E, 0x13, 255))
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT + (255,))
    if extra_points:
        for key, (xy, kind) in extra_points.items():
            p3 = to3(xy); p, z = cam.project(p3)
            anchors[key] = [round(float(p[0][0]), 1), round(float(p[0][1]), 1)]
            if kind == "impact":
                cx, cy = p[0] * SS; r = 6 * SS
                dr.line([cx - r, cy - r, cx + r, cy + r], fill=(0xF2, 0x68, 0x5B, 255), width=2 * SS)
                dr.line([cx - r, cy + r, cx + r, cy - r], fill=(0xF2, 0x68, 0x5B, 255), width=2 * SS)
            if kind == "apsis":
                cx, cy = p[0] * SS; r = 3.5 * SS
                dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0xE6, 0xE9, 0xEF, 230), width=SS)
    ov = overlay.resize((W, H), Image.LANCZOS)
    base = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGB").convert("RGBA")
    base.alpha_composite(ov)
    earth_c, _ = cam.project(np.zeros(3))
    anchors["earth_center"] = [round(float(earth_c[0][0]), 1), round(float(earth_c[0][1]), 1)]
    anchors["sample_k"] = int(k)
    out = Path(out_dir) / f"{name}.jpg"
    base.convert("RGB").save(out, quality=88, optimize=True, progressive=True)
    return anchors


def readouts(traj, t_play):
    k = min(int(math.floor(t_play / traj.dt)), len(traj.t) - 1)
    r, v = traj.r[k], traj.v[k]
    rn = float(np.hypot(*r)); vn = float(np.hypot(*v))
    eps = float(o.specific_energy(r, v, MU)); hz = float(o.angular_momentum_z(r, v))
    eps0 = float(o.specific_energy(traj.r[0], traj.v[0], MU)); h0 = float(o.angular_momentum_z(traj.r[0], traj.v[0]))
    E = o.specific_energy(traj.r[: k + 1], traj.v[: k + 1], MU)
    return {"k": k, "t": float(traj.t[k]), "alt_km": (rn - RE) / 1000, "r_km": rn / 1000, "speed": vn,
            "eps": eps, "h": hz, "eps_drift_now": abs(eps - eps0) / abs(eps0),
            "eps_drift_max_sofar": float(np.max(np.abs((E - eps0) / eps0))), "h_drift": abs(hz - h0) / abs(h0),
            "n_samples": len(traj.t), "status": traj.status, "t_end": float(traj.t[-1])}
