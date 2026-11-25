"""Reproduce the WA-0 design renders (docs/design/renders/) from orbital v0.1.0 output.

Usage:  ORBITAL_EARTH_TEXTURE=/path/to/blue-marble.jpg python scripts/design/render_wa0.py OUT_DIR
Design tooling only; not product code and not a validation runner.
Note (2026-11-24): render.py rev 2 sizes strokes and markers in CSS px, so this script no longer
reproduces the rev-1 stills bit for bit. Use render.py from commit fe8dd4a for that.
"""
import json, math, sys
from pathlib import Path
import numpy as np
from render import Camera, scene, readouts, o, MU, RE, OMEGA_E
from kepler_design import elements, state_at

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
r0n = RE + 400e3; vc = math.sqrt(MU / r0n); r0 = np.array([r0n, 0.0])
def run(k, dt, dur): return o.propagate(r0, np.array([0.0, k * vc]), dt, o.steps_for_duration(dur, dt))
def Tk(k): a = r0n / (2 - k * k); return 2 * math.pi * math.sqrt(a ** 3 / MU)
def rev_end(tr, T): return min(o.steps_for_duration(T, tr.dt), len(tr.t) - 1)
def place(cam, world_km, want):
    p, _ = cam.project(np.asarray(world_km, float)); cam.cx += want[0] - p[0][0]; cam.cy += want[1] - p[0][1]; return cam
A, RO = {}, {}
T0 = Tk(1.0); iss = run(1.0, 1.0, 10 * T0)
A["d1_iss"] = scene("d1_iss", iss, Camera([0, 0, 0], 41000, 60, 28, 30, 2880, 1800, shift_px=(0, -20)), 1851.0, out, future_to=rev_end(iss, T0)); RO["d1_iss"] = readouts(iss, 1851.0)
A["m1_iss"] = scene("m1_iss", iss, Camera([0, 0, 0], 44000, 60, 28, 50, 780, 1688, shift_px=(0, -250)), 1851.0, out, future_to=rev_end(iss, T0))
T1 = Tk(1.10); e1 = run(1.10, 1.0, 2 * T1); el = elements(r0, np.array([0.0, 1.10 * vc]), MU)
ex = np.array([state_at(el, t, MU) for t in np.linspace(0, T1, 1500)])
ia = int(np.argmax(np.hypot(*e1.r[e1.t <= T1].T))); tp = 2600.0
ep = {"periapsis": (e1.r[0], "apsis"), "apoapsis": (e1.r[ia], "apsis")}
A["d2_e1"] = scene("d2_e1", e1, place(Camera([-1800, 0, 0], 43000, 262, 52, 30, 2880, 1800), [-1800, 0, 0], (1440, 880)), tp, out, show_analytic=ex, future_to=rev_end(e1, T1), extra_points=ep); RO["d2_e1"] = readouts(e1, tp)
A["m3_e1"] = scene("m3_e1", e1, place(Camera([-1800, 0, 0], 56000, 262, 52, 50, 780, 1688), [-1800, 0, 0], (390, 330)), tp, out, show_analytic=ex, future_to=rev_end(e1, T1), extra_points=ep)
T3 = Tk(1.11); u = run(1.11, 1.0, 2 * T3)
A["d3_k111"] = scene("d3_k111", u, place(Camera([-1950, 0, 0], 44000, 262, 52, 30, 2880, 1800), [-1950, 0, 0], (1440, 880)), tp, out, future_to=rev_end(u, T3)); RO["d3_k111"] = readouts(u, tp)
imp = run(0.98, 1.0, 6000.0); eli = elements(r0, np.array([0.0, 0.98 * vc]), MU)
a_, e_ = eli["a"], eli["e"]; E = 2 * math.pi - math.acos((1 - RE / a_) / e_); tstar = (E - e_ * math.sin(E) - math.pi) / math.sqrt(MU / a_ ** 3)
exi = np.array([state_at(eli, t, MU) for t in np.linspace(0, tstar, 800)])
A["d4_impact"] = scene("d4_impact", imp, place(Camera([0, 0, 0], 34000, 62, 30, 30, 2880, 1800), [0, 0, 0], (1440, 900)), float(imp.t[-1]), out, show_analytic=exi, extra_points={"impact": (imp.r[-1], "impact"), "impact_exact": (exi[-1], "apsis"), "start": (imp.r[0], "apsis")}); RO["d4_impact"] = readouts(imp, float(imp.t[-1]))
aG = (MU / OMEGA_E ** 2) ** (1 / 3); TG = 2 * math.pi / OMEGA_E
geo = o.propagate(np.array([aG, 0.0]), np.array([0.0, math.sqrt(MU / aG)]), 10.0, o.steps_for_duration(2 * TG, 10.0))
A["d5_geo"] = scene("d5_geo", geo, Camera([0, 0, 0], 205000, 40, 30, 30, 2880, 1800, shift_px=(0, -20)), 0.31 * TG, out, future_to=rev_end(geo, TG)); RO["d5_geo"] = readouts(geo, 0.31 * TG)
x1 = run(1.42, 1.0, 86400.0)
A["d6_escape"] = scene("d6_escape", x1, place(Camera([25000, 45000, 0], 150000, 15, 58, 30, 2880, 1800), [0, 0, 0], (1000, 900)), 10800.0, out); RO["d6_escape"] = readouts(x1, 10800.0)
elc = elements(r0, np.array([0.0, vc]), MU); tc = T0 / 2
exc = np.array([state_at(elc, t, MU) for t in np.arange(tc - 300, tc + 300, 1.0)]); p = iss.r[int(tc)] / 1000
A["c1_closeup"] = scene("c1_closeup", iss, Camera([p[0], p[1], 0], 1000, 350, 22, 30, 1600, 1000), tc, out, show_analytic=exc, axes=False, future_to=int(tc) + 400, past_from=int(tc) - 400, extra_points={"exact_now": (state_at(elc, tc, MU), "apsis")})
json.dump(A, open(out / "anchors.json", "w"), indent=1); json.dump(RO, open(out / "readouts.json", "w"), indent=1)
print("rendered", len(A), "stills to", out)
