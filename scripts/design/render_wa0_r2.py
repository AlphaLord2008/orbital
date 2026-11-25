"""Reproduce the WA-0 revision-2 design renders (docs/design/renders/rev2/) from orbital v0.1.0 output.

Usage:  ORBITAL_EARTH_TEXTURE=/path/to/blue-marble.jpg python scripts/design/render_wa0_r2.py OUT_DIR
Design tooling only; not product code and not a validation runner.
Revision 2 (2026-11-24): sizes in CSS px (dpr), selection ring, velocity arrow, analytical crossing diamond,
impact detail inset, ghost marker, osculating elements in readouts.
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
T0 = Tk(1.0); iss = run(1.0, 1.0, 10 * T0); fe = rev_end(iss, T0)
# Explore: Earth slightly larger and centred in the open scene
A["d1_explore"] = scene("d1_explore", iss, place(Camera([0, 0, 0], 37000, 60, 28, 30, 2880, 1800), [0, 0, 0], (1440, 860)), 1851.0, out, future_to=fe); RO["d1"] = readouts(iss, 1851.0)
A["d1_analyze"] = scene("d1_analyze", iss, place(Camera([0, 0, 0], 41000, 60, 28, 30, 2880, 1800), [0, 0, 0], (1424, 880)), 1851.0, out, future_to=fe, velocity=True)
A["d8_present"] = scene("d8_present", iss, place(Camera([0, 0, 0], 33000, 60, 28, 30, 2880, 1800), [0, 0, 0], (1600, 820)), 1851.0, out, future_to=fe)
A["m1_explore"] = scene("m1_explore", iss, place(Camera([0, 0, 0], 44000, 60, 28, 50, 780, 1688), [0, 0, 0], (390, 640)), 1851.0, out, future_to=fe)
A["m4_playback"] = scene("m4_playback", iss, place(Camera([0, 0, 0], 44000, 60, 28, 50, 780, 1688), [0, 0, 0], (390, 600)), 3130.0, out, future_to=fe); RO["m4"] = readouts(iss, 3130.0)
T1 = Tk(1.10); e1 = run(1.10, 1.0, 2 * T1); el = elements(r0, np.array([0.0, 1.10 * vc]), MU)
ex = np.array([state_at(el, t, MU) for t in np.linspace(0, T1, 1500)])
ia = int(np.argmax(np.hypot(*e1.r[e1.t <= T1].T))); tp = 2600.0
ep = {"periapsis": (e1.r[0], "apsis"), "apoapsis": (e1.r[ia], "apsis")}
A["d2_e1"] = scene("d2_e1", e1, place(Camera([-1800, 0, 0], 43000, 262, 52, 30, 2880, 1800), [-1800, 0, 0], (1424, 880)), tp, out, show_analytic=ex, future_to=rev_end(e1, T1), extra_points=ep, velocity=True); RO["e1"] = readouts(e1, tp)
A["m3_e1"] = scene("m3_e1", e1, place(Camera([-1800, 0, 0], 56000, 262, 52, 50, 780, 1688), [-1800, 0, 0], (390, 330)), tp, out, show_analytic=ex, future_to=rev_end(e1, T1), extra_points=ep)
T3 = Tk(1.11); u = run(1.11, 1.0, 2 * T3)
A["d3_k111"] = scene("d3_k111", u, place(Camera([-1950, 0, 0], 44000, 262, 52, 30, 2880, 1800), [-1950, 0, 0], (1424, 880)), tp, out, future_to=rev_end(u, T3), velocity=True); RO["k111"] = readouts(u, tp)
imp = run(0.98, 1.0, 6000.0); eli = elements(r0, np.array([0.0, 0.98 * vc]), MU)
a_, e_ = eli["a"], eli["e"]; E = 2 * math.pi - math.acos((1 - RE / a_) / e_); tstar = (E - e_ * math.sin(E) - math.pi) / math.sqrt(MU / a_ ** 3)
exi = np.array([state_at(eli, t, MU) for t in np.linspace(0, tstar, 1600)]); xs = state_at(eli, tstar, MU)
pts = {"impact": (imp.r[-1], "impact"), "crossing": (xs, "crossing"), "start": (imp.r[0], "apsis")}
A["d4_impact"] = scene("d4_impact", imp, place(Camera([0, 0, 0], 34000, 62, 30, 30, 2880, 1800), [0, 0, 0], (1360, 900)), float(imp.t[-1]), out, show_analytic=exi, extra_points=pts); RO["i1"] = readouts(imp, float(imp.t[-1]))
mid = (imp.r[-1] + xs) / 2 / 1000; ang = math.degrees(math.atan2(mid[1], mid[0]))
cam = place(Camera([mid[0], mid[1], 0], 1300, ang - 10, 58, 30, 960, 600), [mid[0], mid[1], 0], (480, 330))
A["d4_inset"] = scene("d4_inset", imp, cam, float(imp.t[-1]), out, show_analytic=exi, extra_points={"impact": (imp.r[-1], "impact"), "crossing": (xs, "crossing")}, axes=False, past_from=max(0, len(imp.t) - 400))
RO["i1"].update(t_star=tstar, sep_km=float(np.hypot(*(imp.r[-1] - xs))) / 1000, dt_s=tstar - float(imp.t[-1]))
aG = (MU / OMEGA_E ** 2) ** (1 / 3); TG = 2 * math.pi / OMEGA_E
geo = o.propagate(np.array([aG, 0.0]), np.array([0.0, math.sqrt(MU / aG)]), 10.0, o.steps_for_duration(2 * TG, 10.0))
A["d5_geo"] = scene("d5_geo", geo, place(Camera([0, 0, 0], 190000, 40, 30, 30, 2880, 1800), [0, 0, 0], (1440, 860)), 0.31 * TG, out, future_to=rev_end(geo, TG)); RO["geo"] = readouts(geo, 0.31 * TG)
x1 = run(1.42, 1.0, 86400.0)
A["d6_escape"] = scene("d6_escape", x1, place(Camera([25000, 45000, 0], 150000, 15, 58, 30, 2880, 1800), [0, 0, 0], (1080, 900)), 10800.0, out); RO["x1"] = readouts(x1, 10800.0)
elc = elements(r0, np.array([0.0, vc]), MU); tc = T0 / 2
exc = np.array([state_at(elc, t, MU) for t in np.arange(tc - 300, tc + 300, 1.0)]); p = iss.r[int(tc)] / 1000
A["c1_closeup"] = scene("c1_closeup", iss, Camera([p[0], p[1], 0], 1000, 350, 22, 30, 1600, 1000, dpr=1.6667), tc, out, show_analytic=exc, axes=False, future_to=int(tc) + 400, past_from=int(tc) - 400, extra_points={"exact_now": (state_at(elc, tc, MU), "ghost")})
json.dump(A, open(out / "anchors.json", "w"), indent=1); json.dump(RO, open(out / "readouts.json", "w"), indent=1)
print("rendered", len(A), "stills to", out); print(json.dumps({k: RO[k]["osc"] for k in RO}, indent=0)); print(RO["i1"]["sep_km"], RO["i1"]["dt_s"])
