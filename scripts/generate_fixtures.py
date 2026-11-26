"""Write the Python–TypeScript conformance fixtures, fixtures/v1/conformance/C1..C8.json (ADR-0003 §3.3).

C1–C6 are the six Web Alpha presets, propagated by the authoritative Python engine:
samples at fixed indices (0, 1, 2, each orbit or hour boundary, evenly spaced
checkpoints, last) plus run summaries. C7 is the steps_for_duration endpoint table;
C8 is invalid input. Floats are Python repr strings, which parse to the identical
float64 in JavaScript. CI reruns this script and fails on any difference.

Usage: python scripts/generate_fixtures.py
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts" / "validation"))

import orbital  # noqa: E402
from orbital import (  # noqa: E402
    MU_EARTH,
    R_EARTH,
    analytic,
    angular_momentum_z,
    first_period,
    gravity_accel,
    propagate,
    specific_energy,
    steps_for_duration,
)
from cases_v0_1_1 import GEO_ALTITUDE, Case  # noqa: E402

OUT = ROOT / "fixtures" / "v1" / "conformance"
CHECKPOINTS = 21

CONFORMANCE = {
    "C1": (Case("C1", 400_000.0, 1.0, 1.0, "orbits:10"), "400 km circular, dt 1 s, 10 orbits (= V0)"),
    "C2": (Case("C2", GEO_ALTITUDE, 1.0, 10.0, "orbits:1"), "GEO, dt 10 s, 1 orbit"),
    "C3": (Case("C3", 400_000.0, 1.10, 1.0, "orbits:2"), "k = 1.10 ellipse, dt 1 s, 2 orbits (= E1)"),
    "C4": (Case("C4", 400_000.0, 0.98, 1.0, "orbits:1"), "k = 0.98, stops at impact (= I1)"),
    "C5": (Case("C5", 400_000.0, 1.42, 1.0, "steps:86400"), "k = 1.42 escape, dt 1 s, 1 day (= X1)"),
    "C6": (Case("C6", 400_000.0, 1.0, 60.0, "orbits:10"), "400 km, dt 60 s, 10 orbits (= P2)"),
}


def f(x):
    return repr(float(x))


def source_sha256():
    """SHA-256 over the Python engine sources (src/orbital/*.py, sorted by name).

    A content hash, not a commit id: it changes exactly when the engine changes and is the
    same however the branch is merged. CI regenerates the fixtures and fails on any diff.
    """
    digest = hashlib.sha256()
    for path in sorted((ROOT / "src" / "orbital").glob("*.py")):
        digest.update(path.name.encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def engine_info():
    return {"impl": "orbital-py", "version": orbital.__version__, "source_sha256": source_sha256()}


def run_case(cid, case, description):
    r0, v0 = np.array(case.r0), np.array(case.v0)
    kind, _, amount = case.span.partition(":")
    bound = analytic.classify(r0, v0) == "bound"
    period = analytic.period(r0, v0) if bound else None
    if kind == "orbits":
        n_steps = steps_for_duration(int(amount) * period, case.dt)
        marks = [steps_for_duration(m * period, case.dt) for m in range(1, int(amount) + 1)]
    else:
        n_steps = int(amount)
        marks = [int(h * 3600 / case.dt) for h in range(1, 25)]
    traj = propagate(r0, v0, case.dt, n_steps)
    last = len(traj.t) - 1
    idx = {0, 1, 2, last} | {m for m in marks if m <= last}
    idx |= {round(i * last / (CHECKPOINTS - 1)) for i in range(CHECKPOINTS)}
    energy = specific_energy(traj.r, traj.v)
    h = angular_momentum_z(traj.r, traj.v)
    r_p, r_a = analytic.apsides(r0, v0)
    el = analytic.elements(r0, v0)
    try:
        measured_period = first_period(traj)
    except ValueError:
        measured_period = None
    summary = {
        "status": traj.status,
        "samples": len(traj.t),
        "n_steps_requested": traj.n_steps_requested,
        "t_end": f(traj.t_end),
        "first_period": None if measured_period is None else f(measured_period),
        "max_rel_energy_drift": f(np.max(np.abs(energy - energy[0]) / abs(energy[0]))),
        "max_rel_h_drift": f(np.max(np.abs(h - h[0]) / abs(h[0]))),
        "analytic": {
            "classification": analytic.classify(r0, v0),
            "energy": f(el.energy),
            "h": f(el.h),
            "a": f(el.a),
            "e": f(el.e),
            "r_p": f(r_p),
            "r_a": None if r_a is None else f(r_a),
            "period": None if period is None else f(period),
        },
    }
    if traj.status == "impact":
        summary["analytic"]["time_to_surface"] = f(analytic.time_to_radius(r0, v0, R_EARTH))
    samples = [
        {
            "k": k,
            "t": f(traj.t[k]),
            "r": [f(traj.r[k, 0]), f(traj.r[k, 1])],
            "v": [f(traj.v[k, 0]), f(traj.v[k, 1])],
            "energy": f(energy[k]),
            "h": f(h[k]),
        }
        for k in sorted(idx)
    ]
    return {
        "schema": 1,
        "case": cid,
        "description": description,
        "engine": engine_info(),
        "inputs": {
            "r0": [f(c) for c in case.r0],
            "v0": [f(c) for c in case.v0],
            "dt": f(case.dt),
            "n_steps": n_steps,
            "mu": f(MU_EARTH),
            "body_radius": f(R_EARTH),
        },
        "summary": summary,
        "samples": samples,
    }


def c7():
    rows = []
    pairs = [(0.3, 0.1), (2.9999, 1.0), (3.0000001, 1.0), (10.0, 3.0), (1.0, 2.0), (55_536.24, 1.0),
             (5553.624271248518, 1.0), (86164.10063738, 10.0), (0.7, 0.1), (1e6, 0.1), (100.0, 100.0), (99.99999, 100.0)]
    for duration, dt in pairs:
        try:
            n = steps_for_duration(duration, dt)
            rows.append({"duration": f(duration), "dt": f(dt), "n": n, "t_end": f(np.arange(n + 1)[-1] * dt)})
        except ValueError as exc:
            rows.append({"duration": f(duration), "dt": f(dt), "error": "ValueError", "field": str(exc).split()[0]})
    return {"schema": 1, "case": "C7", "description": "steps_for_duration endpoint table (F4, F5)", "engine": engine_info(), "rows": rows}


def enc(x):
    """JSON encoding for invalid inputs: non-finite floats as strings."""
    if isinstance(x, dict):
        return {k: enc(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [enc(y) for y in x]
    if isinstance(x, float) and not math.isfinite(x):
        return "nan" if math.isnan(x) else ("inf" if x > 0 else "-inf")
    return x


def c8():
    good_r, good_v = [R_EARTH + 400_000.0, 0.0], [0.0, 7668.0]
    calls = [
        ("propagate", dict(r0=[math.nan, 0.0], v0=good_v, dt=1.0, n_steps=10)),
        ("propagate", dict(r0=[math.inf, 0.0], v0=good_v, dt=1.0, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=[0.0, math.nan], dt=1.0, n_steps=10)),
        ("propagate", dict(r0=[1.0, 2.0, 3.0], v0=good_v, dt=1.0, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=[1.0], dt=1.0, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=0.0, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=-1.0, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=math.inf, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=True, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=1.0, n_steps=0)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=1.0, n_steps=True)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=1.0, n_steps=2.5)),
        ("propagate", dict(r0=[R_EARTH, 0.0], v0=good_v, dt=1.0, n_steps=10)),
        ("propagate", dict(r0=good_r, v0=good_v, dt=1.0, n_steps=10, mu=-1.0)),
        ("gravity_accel", dict(r=[0.0, 0.0])),
        ("gravity_accel", dict(r=[True, False])),
        ("steps_for_duration", dict(duration=1.0, dt=2.0)),
        ("steps_for_duration", dict(duration=math.nan, dt=1.0)),
        ("steps_for_duration", dict(duration=10.0, dt=0.0)),
    ]
    fns = {"propagate": propagate, "gravity_accel": gravity_accel, "steps_for_duration": steps_for_duration}
    rows = []
    for name, kwargs in calls:
        try:
            fns[name](**kwargs)
            raise AssertionError(f"{name}({kwargs}) did not raise")
        except ValueError as exc:
            rows.append({"fn": name, "args": enc(kwargs), "error": "ValueError", "field": str(exc).split()[0]})
    return {"schema": 1, "case": "C8", "description": "invalid inputs: same error class and field", "engine": engine_info(), "rows": rows}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for cid, (case, description) in CONFORMANCE.items():
        record = run_case(cid, case, description)
        (OUT / f"{cid}.json").write_text(json.dumps(record, indent=1, allow_nan=False) + "\n")
        print(f"{cid}: {record['summary']['status']}, {record['summary']['samples']} samples, {len(record['samples'])} stored")
    for record in (c7(), c8()):
        (OUT / f"{record['case']}.json").write_text(json.dumps(record, indent=1, allow_nan=False) + "\n")
        print(f"{record['case']}: {len(record['rows'])} rows")


if __name__ == "__main__":
    main()
