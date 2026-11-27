"""Analytic solution across the escape threshold (Batch B): high-eccentricity ellipses,
near-parabolic conics on both sides of the parabolic band, and hyperbolae.

References are independent: mpmath at 50 digits with universal variables
(scripts/reference_mp.py build_domain, stored in fixtures/v1/domain/conics.json), which has
no Kepler-equation code in common with orbital.analytic.

Accuracy model (from conditioning, not fitted). The inputs are float64, so:
- 1 - e is known only to about eps / |1 - e| relative: the elements of a near-parabolic
  state are ill-conditioned (energy = v^2/2 - mu/r cancels);
- a time t enters as M = M0 + n t, rounded: about eps * |v| * |t| / |r| relative in position.
Tolerance: REF-1 (1e-12) plus 4 eps / |1 - e| plus 8 eps |v| |t| / |r|. Velocity errors are
relative to max(|v|, sqrt(mu / p)), the conic's own speed scale (v = sqrt(mu/p) (-sin nu, e + cos nu)):
at the apoapsis of a near-escape ellipse |v| is a few m/s while the solution's speed scale is km/s.
"""

import json
import math
from pathlib import Path

import mpmath as mp
import numpy as np
import pytest

from orbital import MU_EARTH, R_EARTH, analytic, propagate
from orbital.analytic import _solve_elliptic

EPS = np.finfo(np.float64).eps
DOMAIN = json.loads((Path(__file__).parent.parent / "fixtures" / "v1" / "domain" / "conics.json").read_text())


def _f(xs):
    return np.array([float(x) for x in xs])


@pytest.mark.parametrize("case", DOMAIN["cases"], ids=[c["name"] for c in DOMAIN["cases"]])
def test_state_at_matches_reference(case):
    r0, v0 = _f(case["inputs"]["r0"]), _f(case["inputs"]["v0"])
    e = float(case["scalars"]["e"])
    h = float(case["scalars"]["h"])
    v_scale = math.sqrt(MU_EARTH / (h * h / MU_EARTH))
    for s in case["states"]:
        t = float(s["t"])
        r_ref, v_ref = _f(s["r"]), _f(s["v"])
        r, v = analytic.state_at(r0, v0, t)
        rn, vn = np.linalg.norm(r_ref), np.linalg.norm(v_ref)
        tol = 1e-12 + 4 * EPS / abs(1 - e) + 8 * EPS * vn * abs(t) / rn
        assert np.linalg.norm(r - r_ref) / rn <= tol, (case["name"], t)
        assert np.linalg.norm(v - v_ref) / max(vn, v_scale) <= tol, (case["name"], t)


@pytest.mark.parametrize("case", DOMAIN["cases"], ids=[c["name"] for c in DOMAIN["cases"]])
def test_elements_match_reference(case):
    r0, v0 = _f(case["inputs"]["r0"]), _f(case["inputs"]["v0"])
    el = analytic.elements(r0, v0)
    assert abs(el.e - float(case["scalars"]["e"])) <= 4 * EPS
    assert analytic.classify(r0, v0) == ("bound" if float(case["scalars"]["energy"]) < 0 else "escape")


@pytest.mark.parametrize("e", [0.5, 0.9, 0.99, 0.9999, 0.999999, 1 - 1e-8, 1 - 2e-9])
def test_elliptic_solver_against_mpmath_at_the_same_mean_anomaly(e):
    """The solver itself, isolated from element conditioning: E for a given float64 M."""
    mp.mp.dps = 50
    means = np.concatenate([-np.logspace(-15, math.log10(math.pi), 40), [0.0], np.logspace(-15, math.log10(math.pi), 40)])
    E = _solve_elliptic(means, e)
    for m, got in zip(means, E):
        ref = mp.findroot(lambda x: x - mp.mpf(e) * mp.sin(x) - mp.mpf(float(m)), mp.mpf(float(got)))
        assert abs(got - float(ref)) <= 4 * EPS * max(abs(float(ref)), 1e-300), (e, m)


def test_previously_failing_case_k_1_41_over_a_full_period():
    r0 = np.array([R_EARTH + 400_000.0, 0.0])
    v0 = np.array([0.0, 1.41 * math.sqrt(MU_EARTH / r0[0])])
    period = analytic.period(r0, v0)
    r, _ = analytic.state_at(r0, v0, np.linspace(0.0, period, 20_001))  # raised RuntimeError before
    assert np.all(np.isfinite(r))


def test_parabolic_band_is_rejected_on_both_sides_and_accepted_outside():
    radius = R_EARTH + 400_000.0
    v_c = math.sqrt(MU_EARTH / radius)
    r0 = np.array([radius, 0.0])
    with pytest.raises(ValueError, match="parabolic"):
        analytic.state_at(r0, np.array([0.0, math.sqrt(2.0) * v_c]), 60.0)
    for k in (math.sqrt(2.0 - 2e-9), math.sqrt(2.0 + 2e-9)):  # e = 1 -+ 2e-9, just outside
        analytic.state_at(r0, np.array([0.0, k * v_c]), 60.0)


def test_numerical_propagator_is_independent_of_the_kepler_solver():
    """The integrator never calls Kepler's equation: a near-escape run completes either way."""
    r0 = np.array([R_EARTH + 400_000.0, 0.0])
    v0 = np.array([0.0, 1.41 * math.sqrt(MU_EARTH / r0[0])])
    traj = propagate(r0, v0, 1.0, 86_400)
    assert traj.status == "completed" and np.all(np.isfinite(traj.r))
