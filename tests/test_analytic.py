"""AN-T1 ... AN-T6: the exact two-body module (docs/requirements-0.1.1.md §3)."""

import math

import numpy as np
import pytest

from orbital import MU_EARTH, R_EARTH, analytic

R0 = R_EARTH + 400_000.0


def preset_state(k, altitude=400_000.0):
    r0 = R_EARTH + altitude
    return np.array([r0, 0.0]), np.array([0.0, k * math.sqrt(MU_EARTH / r0)])


# --- AN-T1: circular state -------------------------------------------------------------------
def test_an_t1_circular_state():
    r, v = preset_state(1.0)
    el = analytic.elements(r, v)
    assert el.e <= 1e-15
    assert el.a == pytest.approx(R0, rel=1e-15)
    assert analytic.period(r, v) == pytest.approx(2 * math.pi * math.sqrt(R0**3 / MU_EARTH), rel=1e-15)
    assert analytic.classify(r, v) == "bound"


# --- AN-T2: vis-viva along E1 and X1 ------------------------------------------------------------
@pytest.mark.parametrize("k, t_max", [(1.10, 7909.26), (1.42, 86_400.0)])
def test_an_t2_vis_viva(k, t_max):
    r0, v0 = preset_state(k)
    a = analytic.elements(r0, v0).a
    t = np.linspace(0.0, t_max, 50)
    r, v = analytic.state_at(r0, v0, t)
    r_norm = np.linalg.norm(r, axis=1)
    lhs = np.sum(v * v, axis=1)
    rhs = MU_EARTH * (2.0 / r_norm - 1.0 / a)
    assert np.max(np.abs(lhs - rhs) / np.abs(rhs)) <= 1e-14


# --- AN-T3: round trip at t = 0 ---------------------------------------------------------------
@pytest.mark.parametrize("k", [1.0, 1.10, 0.98, 1.42])
def test_an_t3_round_trip(k):
    r0, v0 = preset_state(k)
    r, v = analytic.state_at(r0, v0, 0.0)
    assert np.linalg.norm(r - r0) / np.linalg.norm(r0) <= 1e-12
    assert np.linalg.norm(v - v0) / np.linalg.norm(v0) <= 1e-12


# --- AN-T4: periodicity ---------------------------------------------------------------------------
@pytest.mark.parametrize("k", [1.0, 1.10, 0.98])
def test_an_t4_periodicity(k):
    r0, v0 = preset_state(k)
    r, _ = analytic.state_at(r0, v0, analytic.period(r0, v0))
    assert np.linalg.norm(r - r0) / np.linalg.norm(r0) <= 1e-9


# --- AN-T5: hand-checkable apsides ---------------------------------------------------------------
def test_an_t5_apsides_k_1_10():
    r0, v0 = preset_state(1.10)
    r_p, r_a = analytic.apsides(r0, v0)
    a = R0 / (2.0 - 1.10**2)
    assert r_a == pytest.approx(10_381_703.506, abs=1e-3)
    assert r_a == pytest.approx(a * (1 + (1.10**2 - 1)), rel=1e-14)
    assert r_p == pytest.approx(R0, rel=1e-14)


def test_apsides_escape_has_no_apoapsis():
    r0, v0 = preset_state(1.42)
    r_p, r_a = analytic.apsides(r0, v0)
    assert r_a is None
    assert r_p == pytest.approx(R0, rel=1e-14)
    assert analytic.classify(r0, v0) == "escape"


# --- AN-T6: error paths ---------------------------------------------------------------------------
def test_an_t6_zero_radius():
    with pytest.raises(ValueError, match="origin"):
        analytic.elements([0.0, 0.0], [0.0, 1.0])


@pytest.mark.parametrize("bad", [[math.nan, 1.0], [math.inf, 1.0], [1.0], [True, False], "xy"])
def test_an_t6_non_finite_or_malformed(bad):
    with pytest.raises(ValueError):
        analytic.state_at(bad, [0.0, 7000.0], 1.0)


def test_an_t6_non_finite_time():
    r0, v0 = preset_state(1.0)
    with pytest.raises(ValueError):
        analytic.state_at(r0, v0, math.nan)


def test_an_t6_parabolic():
    r0, v0 = preset_state(math.sqrt(2.0))
    with pytest.raises(ValueError, match="parabolic"):
        analytic.state_at(r0, v0, 10.0)


def test_an_t6_unreachable_radius():
    r0, v0 = preset_state(1.10)
    with pytest.raises(ValueError, match="never reaches"):
        analytic.time_to_radius(r0, v0, R_EARTH)  # periapsis is above the surface
    with pytest.raises(ValueError, match="never reaches"):
        analytic.time_to_radius(r0, v0, 2.0e7)  # beyond apoapsis


def test_an_t6_period_of_escape_orbit():
    r0, v0 = preset_state(1.42)
    with pytest.raises(ValueError, match="bound"):
        analytic.period(r0, v0)


def test_radial_trajectory_rejected():
    with pytest.raises(ValueError, match="radial"):
        analytic.elements([R0, 0.0], [100.0, 0.0])


# --- consistency checks beyond the registered AN-T list --------------------------------------
def test_clockwise_motion_mirrors_counter_clockwise():
    r0, v0 = preset_state(1.10)
    t = np.linspace(0.0, 5000.0, 7)
    r_ccw, _ = analytic.state_at(r0, v0, t)
    r_cw, _ = analytic.state_at(r0, -v0, t)
    np.testing.assert_allclose(r_cw[:, 0], r_ccw[:, 0], rtol=1e-12)
    np.testing.assert_allclose(r_cw[:, 1], -r_ccw[:, 1], rtol=1e-12, atol=1e-6)


def test_state_at_is_consistent_with_restarting():
    # Propagating 1000 s then 2000 s equals propagating 3000 s directly.
    for k in (1.10, 1.42, 0.98):
        r0, v0 = preset_state(k)
        r1, v1 = analytic.state_at(r0, v0, 1000.0)
        r2, _ = analytic.state_at(r1, v1, 2000.0)
        r3, _ = analytic.state_at(r0, v0, 3000.0)
        assert np.linalg.norm(r2 - r3) / np.linalg.norm(r3) <= 1e-12


def test_time_to_radius_lands_on_the_radius():
    r0, v0 = preset_state(0.98)
    t_star = analytic.time_to_radius(r0, v0, R_EARTH)
    r, _ = analytic.state_at(r0, v0, t_star)
    assert np.linalg.norm(r) == pytest.approx(R_EARTH, rel=1e-13)
    assert t_star == pytest.approx(1822.294, abs=1e-3)  # registered value, requirements-0.1.1 §5 I1
