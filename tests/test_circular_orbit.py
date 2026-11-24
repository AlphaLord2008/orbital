"""Acceptance tests T3-T8: the reference circular orbit against its analytical solution.

Reference case (docs/requirements-0.1.md §1): circular orbit at 400 km altitude,
r0 = (R_E + 400 km, 0), v0 = (0, sqrt(mu / r0)), semi-implicit Euler, dt = 1 s,
10 orbits (55,536 steps). Exact solution: r(t) = r0 (cos wt, sin wt), w = 2 pi / T.

Tolerances are the accepted ones from docs/requirements-0.1.md §6. Measured values
go in the validation report (Task 9).
"""

import math

import numpy as np
import pytest

from orbital import (
    MU_EARTH,
    R_EARTH,
    angular_momentum_z,
    circular_initial_state,
    first_period,
    propagate,
    radius,
    specific_energy,
    steps_for_duration,
)

ALTITUDE = 400_000.0  # [m]
R0 = R_EARTH + ALTITUDE  # reference orbital radius [m]
PERIOD = 2 * math.pi * math.sqrt(R0**3 / MU_EARTH)  # analytical period T [s]
N_ORBITS = 10


def run_reference(dt):
    """Propagate the reference orbit for 10 orbital periods at timestep dt."""
    r0, v0 = circular_initial_state(ALTITUDE)
    return propagate(r0, v0, dt, steps_for_duration(N_ORBITS * PERIOD, dt))


@pytest.fixture(scope="module")
def reference():
    """The 10-orbit reference run at dt = 1 s, computed once for all tests here."""
    traj = run_reference(1.0)
    assert traj.status == "completed"
    return traj


def relative_deviation(values):
    """|values - values[0]| / |values[0]| for every sample."""
    return np.abs(values - values[0]) / abs(values[0])


def max_in_orbit(deviation, t, orbit):
    """Largest deviation during orbit number ``orbit`` (1-based): t in [(orbit-1) T, orbit T)."""
    in_orbit = (t >= (orbit - 1) * PERIOD) & (t < orbit * PERIOD)
    return float(np.max(deviation[in_orbit]))


# --- T3: angular momentum -----------------------------------------------------------


def test_t3_angular_momentum_conserved(reference):
    deviation = relative_deviation(angular_momentum_z(reference.r, reference.v))
    assert np.max(deviation) <= 1e-10


# --- T4: radius -------------------------------------------------------------------------


def test_t4_radius_stays_near_circular(reference):
    deviation = relative_deviation(radius(reference.r))
    assert np.max(deviation) <= 1e-3


def test_t4_radius_error_is_bounded_not_growing(reference):
    deviation = relative_deviation(radius(reference.r))
    first = max_in_orbit(deviation, reference.t, 1)
    last = max_in_orbit(deviation, reference.t, N_ORBITS)
    assert last <= 1.1 * first


# --- T5: specific energy ------------------------------------------------------------------


def test_t5_energy_stays_near_initial(reference):
    deviation = relative_deviation(specific_energy(reference.r, reference.v))
    assert np.max(deviation) <= 1e-5


def test_t5_energy_error_is_bounded_not_drifting(reference):
    deviation = relative_deviation(specific_energy(reference.r, reference.v))
    first = max_in_orbit(deviation, reference.t, 1)
    last = max_in_orbit(deviation, reference.t, N_ORBITS)
    assert last <= 1.1 * first


# --- T6: orbital period ---------------------------------------------------------------------


def test_t6_first_period_matches_analytical(reference):
    assert abs(first_period(reference) - PERIOD) / PERIOD <= 1e-5


# --- T7: position against the exact solution, at the sample times actually reached --------


def exact_position(t):
    omega = 2 * math.pi / PERIOD
    return R0 * np.column_stack([np.cos(omega * t), np.sin(omega * t)])


def test_t7_position_error_after_one_orbit(reference):
    k = steps_for_duration(PERIOD, 1.0)  # 5,553 steps: t_k = 5,553 s, just short of T
    assert k == 5553
    error = np.linalg.norm(reference.r[k] - exact_position(reference.t[k : k + 1])[0])
    assert error <= 100.0  # [m]


def test_t7_position_error_after_ten_orbits_is_recorded(reference, record_property):
    # Recorded for the validation report, not gated (requirements §6).
    error = float(np.linalg.norm(reference.r[-1] - exact_position(reference.t[-1:])[0]))
    record_property("t7_position_error_10_orbits_m", error)
    assert math.isfinite(error)


# --- T8: first-order convergence --------------------------------------------------------------


def test_t8_radius_error_scales_linearly_with_dt(reference):
    coarse = run_reference(10.0)
    ratio = np.max(relative_deviation(radius(coarse.r))) / np.max(relative_deviation(radius(reference.r)))
    assert 9.0 <= ratio <= 11.0
