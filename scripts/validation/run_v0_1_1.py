"""Run the registered v0.1.1 cases and record every metric (requirements-0.1.1 §5, §7).

    python scripts/validation/run_v0_1_1.py            # the registered cases: run ONCE
    python scripts/validation/run_v0_1_1.py --pilot    # unregistered look-alikes, for testing this script

The registered run writes docs/validation/v0.1.1-results.json; the report
docs/validation/v0.1.1-web-alpha-presets.md is written from it. Exact solutions
come from orbital.analytic, which REF-1 checks against the 50-digit reference.
"""

import argparse
import dataclasses
import json
import math
import platform
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import orbital  # noqa: E402
from orbital import (  # noqa: E402
    MU_EARTH,
    R_EARTH,
    analytic,
    angular_momentum_z,
    first_period,
    propagate,
    radius,
    specific_energy,
    steps_for_duration,
)
from cases_v0_1_1 import CASES, Case  # noqa: E402


def metric(value, gate=None, op="<=", prediction=None, band=None, note=""):
    """One measured quantity with its gate and optional prediction band (fraction)."""
    value = float(value) if not isinstance(value, (bool, str)) else value
    passed = True
    if gate is not None:
        if op == "<=":
            passed = value <= gate
        elif op == "in":
            passed = gate[0] <= value <= gate[1]
        elif op == "==":
            passed = value == gate
    if prediction is not None and band is not None:
        passed = passed and abs(value - prediction) <= band * prediction
    return {"value": value, "gate": gate, "op": op, "prediction": prediction, "band": band, "pass": passed, "note": note}


def recorded(value, note=""):
    return {"value": float(value), "gate": None, "op": None, "prediction": None, "band": None, "pass": None, "note": note}


def rel_dev(values):
    return np.abs(values - values[0]) / abs(values[0])


def run(case: Case, dt=None, n_steps=None):
    return propagate(np.array(case.r0), np.array(case.v0), dt or case.dt, n_steps)


def position_errors(case, traj):
    r_exact, _ = analytic.state_at(np.array(case.r0), np.array(case.v0), traj.t)
    return np.linalg.norm(traj.r - r_exact, axis=1)


def period_of(case):
    return analytic.period(np.array(case.r0), np.array(case.v0))


def max_in_orbit(dev, t, T, orbit):
    mask = (t >= (orbit - 1) * T) & (t < orbit * T)
    return float(np.max(dev[mask]))


# --- cases ------------------------------------------------------------------------------------


def case_v0(case):
    T = period_of(case)
    traj = run(case, n_steps=steps_for_duration(10 * T, case.dt))
    coarse = run(case, dt=10.0, n_steps=steps_for_duration(10 * T, 10.0))
    h = rel_dev(angular_momentum_z(traj.r, traj.v))
    rr = rel_dev(radius(traj.r))
    en = rel_dev(specific_energy(traj.r, traj.v))
    n1 = steps_for_duration(T, case.dt)
    err = position_errors(case, traj)
    return {
        "T3": metric(np.max(h), 1e-10),
        "T4": metric(np.max(rr), 1e-3),
        "T4-growth": metric(max_in_orbit(rr, traj.t, T, 10) / max_in_orbit(rr, traj.t, T, 1), 1.1, note="orbit 10 / orbit 1"),
        "T5": metric(np.max(en), 1e-5),
        "T5-growth": metric(max_in_orbit(en, traj.t, T, 10) / max_in_orbit(en, traj.t, T, 1), 1.1, note="orbit 10 / orbit 1"),
        "T6": metric(abs(first_period(traj) - T) / T, 1e-5),
        "T7": metric(err[n1], 100.0, note=f"m, at n1 = {n1}"),
        "T7-10-orbits": recorded(err[-1], "m, at the last sample"),
        "T8": metric(np.max(rel_dev(radius(coarse.r))) / np.max(rr), (9.0, 11.0), op="in"),
    }


def case_p1(case):
    T = period_of(case)
    traj = run(case, n_steps=steps_for_duration(2 * T, case.dt))
    n1 = steps_for_duration(T, case.dt)
    r0 = case.r0[0]
    return {
        "P1-a": metric(np.max(rel_dev(angular_momentum_z(traj.r, traj.v))), 1e-10),
        "P1-b": metric(np.max(rel_dev(radius(traj.r))), 1e-3, prediction=3.646e-4, band=0.10),
        "P1-c": metric(np.max(rel_dev(specific_energy(traj.r, traj.v))), 1e-5, prediction=5.318e-7, band=0.10),
        "P1-d": metric(abs(first_period(traj) - T) / T, 1e-5, prediction=3.768e-7, band=0.10),
        "P1-e": metric(position_errors(case, traj)[n1], 1.5e-5 * r0, prediction=100.0, band=0.10, note=f"m, at n1 = {n1}"),
    }


def case_e1(case):
    T = period_of(case)
    traj = run(case, n_steps=steps_for_duration(2 * T, case.dt))
    fine = run(case, dt=0.1, n_steps=steps_for_duration(T, 0.1))
    n1 = steps_for_duration(T, case.dt)
    _, r_a = analytic.apsides(np.array(case.r0), np.array(case.v0))
    in1 = traj.t < T
    err = position_errors(case, traj)
    err_fine = position_errors(case, fine)
    max1 = float(np.max(err[in1]))
    max1_fine = float(np.max(err_fine[fine.t < T]))
    return {
        "E1-a": metric(np.max(rel_dev(angular_momentum_z(traj.r, traj.v))), 1e-10),
        "E1-b": metric(np.max(rel_dev(specific_energy(traj.r, traj.v))), 4.0e-4, prediction=2.016e-4, band=0.05),
        "E1-c": metric(abs(first_period(traj) - T) / T, 1e-5),
        "E1-d": metric(abs(np.max(radius(traj.r[in1])) - r_a) / r_a, 1e-4),
        "E1-e": metric(err[n1], 500.0, note=f"m, at n1 = {n1}"),
        "E1-f": metric(max1 / max1_fine, (9.0, 11.0), op="in", note="max error over orbit 1, dt 1 s / 0.1 s"),
        "E1-r": recorded(max1, "m, max position error over orbit 1"),
    }


def case_x1(case):
    traj = run(case, n_steps=86_400)
    fine = run(case, dt=0.1, n_steps=36_000)
    r0 = case.r0[0]
    energy = specific_energy(traj.r, traj.v)
    r_exact, _ = analytic.state_at(np.array(case.r0), np.array(case.v0), traj.t)
    err = np.linalg.norm(traj.r - r_exact, axis=1)
    rel_err = err / np.linalg.norm(r_exact, axis=1)
    hour = traj.t <= 3600.0
    err_fine = position_errors(case, fine)
    out = {
        "X1-a": metric(np.max(rel_dev(angular_momentum_z(traj.r, traj.v))), 1e-10),
        "X1-b": metric(np.max(np.abs(energy - energy[0])) / (MU_EARTH / r0), 1e-3, prediction=2.089e-4, band=0.10),
        "X1-c": metric(bool(np.all(energy > 0.0) and traj.status == "completed"), True, op="=="),
    }
    for label, k in (("1h", 3_600), ("6h", 21_600), ("24h", 86_400)):
        out[f"X1-d-{label}"] = metric(rel_err[k], 2e-3)
    out["X1-e"] = metric(float(np.max(err[hour])) / float(np.max(err_fine)), (9.0, 11.0), op="in", note="max error over the first hour, dt 1 s / 0.1 s")
    return out


def case_i1(case):
    T = period_of(case)
    r0, v0 = np.array(case.r0), np.array(case.v0)
    t_star = analytic.time_to_radius(r0, v0, R_EARTH)
    traj = run(case, n_steps=steps_for_duration(T, case.dt))
    fine = run(case, dt=0.1, n_steps=steps_for_duration(T, 0.1))
    rn = radius(traj.r)
    err_b = abs(traj.t_end - t_star)
    err_c = abs(fine.t_end - t_star)
    return {
        "I1-a": metric(bool(traj.status == "impact" and rn[-1] <= R_EARTH < rn[-2]), True, op="==", note=f"N = {len(traj.t) - 1}"),
        "I1-b": metric(err_b, 30.0, note=f"s; t_N = {traj.t_end}, t* = {t_star:.6f}"),
        "I1-c": metric(err_c, 3.0, note=f"s; t_N = {fine.t_end:.1f}"),
        "I1-d": metric(err_b / err_c, (7.0, 14.0), op="in"),
        "I1-e": metric(np.max(rel_dev(angular_momentum_z(traj.r, traj.v))), 1e-10),
        "I1-f": metric(np.max(rel_dev(specific_energy(traj.r, traj.v))), 1.0e-4, prediction=4.783e-5, band=0.10),
    }


def case_p2(case):
    T = period_of(case)
    traj = run(case, n_steps=steps_for_duration(10 * T, case.dt))
    n1 = steps_for_duration(T, case.dt)
    err = position_errors(case, traj)
    return {
        "P2-a": metric(np.max(rel_dev(angular_momentum_z(traj.r, traj.v))), 1e-10),
        "P2-r1": recorded(np.max(rel_dev(specific_energy(traj.r, traj.v))), "indicative h^2 = 4.6e-3"),
        "P2-r2": recorded(np.max(rel_dev(radius(traj.r))), "indicative h/2 = 0.034"),
        "P2-r3": recorded(abs(first_period(traj) - T) / T),
        "P2-r4-n1": recorded(err[n1], f"m, at n1 = {n1}"),
        "P2-r4-10": recorded(err[-1], "m, after 10 orbits"),
    }


RUNNERS = {"V0": case_v0, "P1": case_p1, "E1": case_e1, "X1": case_x1, "I1": case_i1, "P2": case_p2}

# Unregistered look-alikes for exercising this script (requirements-0.1.1 §7: pilots earn no tier).
PILOTS = {
    "P1": Case("P1", 20_000_000.0, 1.0, 10.0, "orbits:2"),
    "E1": Case("E1", 400_000.0, 1.05, 1.0, "orbits:2"),
    "X1": Case("X1", 400_000.0, 1.45, 1.0, "steps:86400"),
    "I1": Case("I1", 400_000.0, 0.97, 1.0, "until-impact"),
    "P2": Case("P2", 400_000.0, 1.0, 30.0, "orbits:10"),
}


def git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:  # noqa: BLE001
        return "unknown"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pilot", action="store_true", help="run unregistered look-alikes only")
    parser.add_argument(
        "--check", action="store_true", help="CI rerun of the registered cases: write nothing, exit 1 on any FAIL"
    )
    parser.add_argument("--out", default=str(ROOT / "docs" / "validation" / "v0.1.1-results.json"))
    args = parser.parse_args()
    cases = PILOTS if args.pilot else CASES
    results = {
        "kind": "pilot (unregistered, earns no tier)" if args.pilot else "registered v0.1.1 run",
        "commit": git_commit(),
        "orbital": orbital.__version__,
        "python": platform.python_version(),
        "numpy": np.__version__,
        "platform": platform.platform(),
        "cases": {},
    }
    for cid, case in cases.items():
        metrics = RUNNERS[cid](case)
        gated = [m for m in metrics.values() if m["pass"] is not None]
        results["cases"][cid] = {
            "inputs": {**dataclasses.asdict(case), "r0": list(case.r0), "v0": list(case.v0)},
            "metrics": metrics,
            "pass": all(m["pass"] for m in gated),
        }
        print(f"{cid}: {'PASS' if results['cases'][cid]['pass'] else 'FAIL'}")
        for name, m in metrics.items():
            flag = "" if m["pass"] is None else ("ok " if m["pass"] else "FAIL ")
            print(f"   {flag}{name:14s} {m['value']!r:>26}  gate {m['op']} {m['gate']}  pred {m['prediction']}  {m['note']}")
    if args.pilot:
        print("pilot run: results not written")
        return
    if args.check:
        failed = [cid for cid, c in results["cases"].items() if not c["pass"]]
        print(f"check: {len(cases) - len(failed)}/{len(cases)} cases pass; registered results not rewritten")
        sys.exit(1 if failed else 0)
    Path(args.out).write_text(json.dumps(results, indent=1, default=float) + "\n")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
