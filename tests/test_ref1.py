"""REF-1 (requirements-0.1.1 §4): orbital.analytic agrees with the independent 50-digit
reference (scripts/reference_mp.py, stored in fixtures/v1/reference) within 1e-12
relative for every reference value a case uses, and within 1e-6 s for times of flight.

These tests only read committed fixture files; CI separately regenerates the fixtures
and fails on any difference.
"""

import json
import math
from pathlib import Path

import numpy as np
import pytest

from orbital import R_EARTH, analytic

REFERENCE = Path(__file__).resolve().parents[1] / "fixtures" / "v1" / "reference"
CASE_FILES = sorted(REFERENCE.glob("*.json"))
REL = 1e-12


def load(path):
    record = json.loads(path.read_text())
    r0 = np.array([float(c) for c in record["inputs"]["r0"]])
    v0 = np.array([float(c) for c in record["inputs"]["v0"]])
    return record, r0, v0


def rel(a, b):
    return abs(a - b) / abs(b)


def test_reference_files_exist():
    assert {p.stem for p in CASE_FILES} == {"V0", "P1", "E1", "X1", "I1", "P2"}


@pytest.mark.parametrize("path", CASE_FILES, ids=lambda p: p.stem)
def test_ref1_scalars(path):
    record, r0, v0 = load(path)
    s = {k: float(v) for k, v in record["scalars"].items()}
    el = analytic.elements(r0, v0)
    r_p, r_a = analytic.apsides(r0, v0)
    assert rel(el.energy, s["energy"]) <= REL
    assert rel(el.h, s["h"]) <= REL
    assert rel(el.a, s["a"]) <= REL
    assert rel(r_p, s["r_p"]) <= REL
    if "period" in s:
        assert rel(analytic.period(r0, v0), s["period"]) <= REL
        assert rel(r_a, s["r_a"]) <= REL
    else:
        assert r_a is None
    # e is compared absolutely: for V0, P1 and P2 it is roundoff around 0.
    assert abs(el.e - s["e"]) <= REL * max(1.0, s["e"])


@pytest.mark.parametrize("path", CASE_FILES, ids=lambda p: p.stem)
def test_ref1_states(path):
    record, r0, v0 = load(path)
    t = np.array([float(st["t"]) for st in record["states"]])
    r_ref = np.array([[float(c) for c in st["r"]] for st in record["states"]])
    v_ref = np.array([[float(c) for c in st["v"]] for st in record["states"]])
    r, v = analytic.state_at(r0, v0, t)
    r_err = np.linalg.norm(r - r_ref, axis=1) / np.linalg.norm(r_ref, axis=1)
    v_err = np.linalg.norm(v - v_ref, axis=1) / np.linalg.norm(v_ref, axis=1)
    assert float(np.max(r_err)) <= REL
    assert float(np.max(v_err)) <= REL


def test_ref1_time_of_flight_i1():
    record, r0, v0 = load(REFERENCE / "I1.json")
    t_ref = float(record["crossing"]["t"])
    assert abs(analytic.time_to_radius(r0, v0, R_EARTH) - t_ref) <= 1e-6
    assert math.isclose(t_ref, 1822.294, abs_tol=5e-4)  # value registered in requirements-0.1.1 §5
