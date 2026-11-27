"""Independent 50-digit reference for the v0.1.1 cases (requirements-0.1.1 §4, REF-1).

Written separately from orbital.analytic on purpose, with a different algorithm:
  * propagation by the universal-variable formulation (Stumpff functions and
    Lagrange f, g coefficients), not perifocal Kepler elements;
  * eccentricity from e = sqrt(1 + 2 epsilon h^2 / mu^2), not the e vector;
  * times of flight to a radius by root-finding |r(t)| = R on the propagated
    trajectory, not by inverting the orbit equation.
It shares only the WGS 84 constants and the case inputs (scripts/validation/cases_v0_1_1.py).

Output: fixtures/v1/reference/<case>.json. Numbers are float64 values written as
Python repr strings (shortest round-trip), after rounding the 50-digit result once.

Usage: python scripts/reference_mp.py [--out fixtures/v1/reference]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import mpmath as mp

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts" / "validation"))

from orbital.constants import MU_EARTH, R_EARTH  # noqa: E402
from cases_v0_1_1 import CASES  # noqa: E402

mp.mp.dps = 50
MU = mp.mpf(MU_EARTH)
SQRT_MU = mp.sqrt(MU)
TOL = mp.mpf(10) ** -40
CHECKPOINTS = 101  # evenly spaced sample indices per span, plus the gate samples


def stumpff(z):
    """C(z), S(z) of the universal-variable formulation."""
    if abs(z) < mp.mpf(10) ** -12:
        return (mp.mpf(1) / 2 - z / 24 + z * z / 720, mp.mpf(1) / 6 - z / 120 + z * z / 5040)
    if z > 0:
        s = mp.sqrt(z)
        return ((1 - mp.cos(s)) / z, (s - mp.sin(s)) / s**3)
    s = mp.sqrt(-z)
    return ((mp.cosh(s) - 1) / (-z), (mp.sinh(s) - s) / s**3)


class Orbit:
    def __init__(self, r0, v0):
        self.x0, self.y0 = mp.mpf(r0[0]), mp.mpf(r0[1])
        self.vx0, self.vy0 = mp.mpf(v0[0]), mp.mpf(v0[1])
        self.r0 = mp.sqrt(self.x0**2 + self.y0**2)
        v_sq = self.vx0**2 + self.vy0**2
        self.alpha = 2 / self.r0 - v_sq / MU  # 1 / a
        self.sigma0 = (self.x0 * self.vx0 + self.y0 * self.vy0) / SQRT_MU
        self.energy = v_sq / 2 - MU / self.r0
        self.h = self.x0 * self.vy0 - self.y0 * self.vx0
        self.e = mp.sqrt(1 + 2 * self.energy * self.h**2 / MU**2)
        self.a = -MU / (2 * self.energy)

    def scalars(self):
        out = {"energy": self.energy, "h": self.h, "e": self.e, "a": self.a, "r_p": self.a * (1 - self.e)}
        if self.energy < 0:
            out["r_a"] = self.a * (1 + self.e)
            out["period"] = 2 * mp.pi * mp.sqrt(self.a**3 / MU)
        return out

    def _chi(self, t):
        """Universal anomaly chi(t) by Newton's method on the universal Kepler equation."""
        if t == 0:
            return mp.mpf(0)
        alpha, r0, s0 = self.alpha, self.r0, self.sigma0
        if alpha > 0:
            chi = SQRT_MU * alpha * t
        else:
            a = 1 / alpha
            sign = 1 if t > 0 else -1
            chi = sign * mp.sqrt(-a) * mp.log(
                (-2 * MU * alpha * t) / (s0 * SQRT_MU + sign * mp.sqrt(-MU * a) * (1 - r0 * alpha))
            )
        for _ in range(500):
            z = alpha * chi * chi
            C, S = stumpff(z)
            F = s0 * chi * chi * C + (1 - alpha * r0) * chi**3 * S + r0 * chi - SQRT_MU * t
            dF = chi * chi * C + s0 * chi * (1 - z * S) + r0 * (1 - z * C)
            step = F / dF
            chi -= step
            if abs(step) <= TOL * max(1, abs(chi)):
                return chi
        raise RuntimeError(f"universal Kepler did not converge at t = {t}")

    def state(self, t):
        t = mp.mpf(t)
        chi = self._chi(t)
        z = self.alpha * chi * chi
        C, S = stumpff(z)
        f = 1 - chi * chi * C / self.r0
        g = t - chi**3 * S / SQRT_MU
        x = f * self.x0 + g * self.vx0
        y = f * self.y0 + g * self.vy0
        r = mp.sqrt(x * x + y * y)
        fdot = SQRT_MU / (r * self.r0) * chi * (z * S - 1)
        gdot = 1 - chi * chi * C / r
        vx = fdot * self.x0 + gdot * self.vx0
        vy = fdot * self.y0 + gdot * self.vy0
        return x, y, vx, vy

    def radius(self, t):
        x, y, _, _ = self.state(t)
        return mp.sqrt(x * x + y * y)

    def crossing(self, radius, scan=10.0, t_max=1.0e6):
        """Earliest t > 0 with |r(t)| = radius: scan for a sign change, then refine."""
        radius = mp.mpf(radius)
        t_lo, f_lo = mp.mpf(0), self.radius(0) - radius
        t = mp.mpf(scan)
        while t <= t_max:
            f = self.radius(t) - radius
            if f_lo * f <= 0 and t > 0:
                lo, hi = t_lo, t
                for _ in range(400):  # bisection: slow but cannot jump to another root
                    mid = (lo + hi) / 2
                    if (self.radius(lo) - radius) * (self.radius(mid) - radius) <= 0:
                        hi = mid
                    else:
                        lo = mid
                    if hi - lo < mp.mpf(10) ** -30:
                        break
                t_star = (lo + hi) / 2
                x, y, vx, vy = self.state(t_star)
                r = mp.sqrt(x * x + y * y)
                v_r = (x * vx + y * vy) / r
                speed = mp.sqrt(vx * vx + vy * vy)
                return {"t": t_star, "radial_speed": v_r, "flight_path_angle_deg": mp.degrees(mp.asin(v_r / speed))}
            t_lo, f_lo = t, f
            t += scan
        raise RuntimeError("radius not reached")


def steps_for_duration(duration, dt):
    """Same rule as orbital.steps_for_duration (F4), restated here to keep the script standalone."""
    q = duration / dt
    nearest = round(q)
    return nearest if nearest >= 1 and abs(q - nearest) <= 1e-9 * nearest else math.floor(q)


def f64(value):
    return repr(float(value))


def spans(case, orbit):
    """(dt, n_steps, gate sample indices) for every run a case's metrics need."""
    period = float(orbit.scalars().get("period", 0.0))
    if case.id in ("V0", "P2", "P1", "E1"):
        n_orbits = int(case.span.split(":")[1])
        runs = [(case.dt, steps_for_duration(n_orbits * period, case.dt), [steps_for_duration(period, case.dt)])]
        if case.id == "V0":  # T8 coarse run
            runs.append((10.0, steps_for_duration(n_orbits * period, 10.0), []))
        if case.id == "E1":  # E1-f: orbit 1 at dt = 0.1 s
            runs.append((0.1, steps_for_duration(period, 0.1), []))
        return runs
    if case.id == "X1":
        return [(1.0, 86_400, [3_600, 21_600, 86_400]), (0.1, 36_000, [])]
    if case.id == "I1":
        t_star = float(orbit.crossing(R_EARTH)["t"])
        return [(1.0, math.ceil(t_star / 1.0) + 1, []), (0.1, math.ceil(t_star / 0.1) + 1, [])]
    raise KeyError(case.id)


def build(case):
    orbit = Orbit(case.r0, case.v0)
    record = {
        "case": case.id,
        "generator": "scripts/reference_mp.py (mpmath 50 digits, universal variables)",
        "mpmath": mp.__version__,
        "inputs": {"r0": [f64(c) for c in case.r0], "v0": [f64(c) for c in case.v0], "mu": f64(MU_EARTH), "r_earth": f64(R_EARTH)},
        "scalars": {k: f64(v) for k, v in orbit.scalars().items()},
        "states": [],
    }
    if case.id == "I1":
        record["crossing"] = {k: f64(v) for k, v in orbit.crossing(R_EARTH).items()}
    for dt, n_steps, gates in spans(case, orbit):
        idx = sorted(set([round(i * n_steps / (CHECKPOINTS - 1)) for i in range(CHECKPOINTS)] + gates))
        for k in idx:
            t = k * dt  # the same float64 product as numpy's arange(count) * dt
            x, y, vx, vy = orbit.state(t)
            record["states"].append({"dt": f64(dt), "k": k, "t": f64(t), "r": [f64(x), f64(y)], "v": [f64(vx), f64(vy)]})
    return record


# Conic-domain reference (Batch B): circular-start states with speed factor k around the escape
# threshold sqrt(2), from high-eccentricity ellipses through near-parabolic to hyperbolic. The two
# k values next to sqrt(2) put e just outside the parabolic band |e - 1| < 1e-9 on either side.
DOMAIN_K = [
    ("k=1.39", 1.39),
    ("k=1.41", 1.41),
    ("k=1.414", 1.414),
    ("k=1.4142", 1.4142),
    ("k=1.41421", 1.41421),
    ("e=1-2e-9", math.sqrt(2.0 - 2e-9)),
    ("e=1+2e-9", math.sqrt(2.0 + 2e-9)),
    ("k=1.41422", 1.41422),
    ("k=1.4143", 1.4143),
    ("k=1.42", 1.42),
    ("k=1.6", 1.6),
]
DOMAIN_TIMES = [-1.0e4, -100.0, 0.0, 1.0, 60.0, 600.0, 3600.0, 21600.0, 86400.0, 1.0e6, 3.0e8]


def build_domain():
    radius = R_EARTH + 400_000.0
    cases = []
    for name, k in DOMAIN_K:
        r0 = (radius, 0.0)
        v0 = (0.0, k * math.sqrt(MU_EARTH / radius))  # the app's initial-state construction
        orbit = Orbit(r0, v0)
        times = list(DOMAIN_TIMES)
        if orbit.energy < 0:
            period = float(orbit.scalars()["period"])
            times += [t for t in (period / 4, period / 2, period - 60.0) if t < 3.0e8]
        states = []
        for t in sorted(times):
            x, y, vx, vy = orbit.state(t)
            states.append({"t": f64(t), "r": [f64(x), f64(y)], "v": [f64(vx), f64(vy)]})
        cases.append({
            "name": name,
            "k": f64(k),
            "inputs": {"r0": [f64(c) for c in r0], "v0": [f64(c) for c in v0]},
            "scalars": {key: f64(val) for key, val in orbit.scalars().items()},
            "states": states,
        })
    return {
        "generator": "scripts/reference_mp.py build_domain (mpmath 50 digits, universal variables)",
        "mpmath": mp.__version__,
        "mu": f64(MU_EARTH),
        "cases": cases,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", default=str(ROOT / "fixtures" / "v1" / "reference"))
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for case in CASES.values():
        record = build(case)
        (out / f"{case.id}.json").write_text(json.dumps(record, indent=1, allow_nan=False) + "\n")
        print(f"{case.id}: {len(record['states'])} reference states")
    domain = build_domain()
    domain_dir = out.parent / "domain"  # kept apart from the registered REF-1 case files
    domain_dir.mkdir(parents=True, exist_ok=True)
    (domain_dir / "conics.json").write_text(json.dumps(domain, indent=1, allow_nan=False) + "\n")
    print(f"domain: {len(domain['cases'])} conics around the escape threshold")


if __name__ == "__main__":
    main()
