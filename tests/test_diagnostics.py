"""Tests for the diagnostics (F8, F8a) and their input rules (I8a, T9 cases).

Hand-built states and trajectories with exactly known answers, so each test
checks one diagnostic in isolation. The orbit-level acceptance tests that use
these diagnostics (T3-T7) arrive in Task 7.
"""

import math

import numpy as np
import pytest

from orbital import (
    MU_EARTH,
    R_EARTH,
    Trajectory,
    angular_momentum_z,
    circular_initial_state,
    first_period,
    propagate,
    radius,
    specific_energy,
    speed,
)


def make_trajectory(xs, ys, vs=None, dt=1.0):
    """A hand-built Trajectory with positions (xs[k], ys[k]) at t_k = k * dt.

    Velocity defaults to (0, 1) m/s at every sample (counter-clockwise at the start).
    """
    r = np.column_stack([xs, ys]).astype(float)
    v = np.tile([0.0, 1.0], (len(xs), 1)) if vs is None else np.asarray(vs, dtype=float)
    t = np.arange(len(xs)) * dt
    return Trajectory(t=t, r=r, v=v, dt=dt, n_steps_requested=len(xs) - 1, status="completed", t_end=float(t[-1]))


# --- Radius and speed ----------------------------------------------------------------


def test_radius_and_speed_single_state_return_float():
    assert radius([3.0, 4.0]) == 5.0
    assert speed([-6.0, 8.0]) == 10.0
    assert type(radius([3.0, 4.0])) is float


def test_radius_and_speed_many_states_return_arrays():
    np.testing.assert_array_equal(radius([[3.0, 4.0], [0.0, 2.0]]), [5.0, 2.0])
    np.testing.assert_array_equal(speed([[5.0, 12.0], [1.0, 0.0]]), [13.0, 1.0])


# --- Specific energy -------------------------------------------------------------------


def test_energy_of_circular_orbit_is_minus_mu_over_2r():
    r0, v0 = circular_initial_state(400_000.0)
    expected = -MU_EARTH / (2 * (R_EARTH + 400_000.0))
    assert specific_energy(r0, v0) == pytest.approx(expected, rel=1e-12)


def test_energy_by_hand():
    # v = (3, 4) -> v^2/2 = 12.5; r = (0, 2), mu = 10 -> mu/|r| = 5; epsilon = 7.5
    assert specific_energy([0.0, 2.0], [3.0, 4.0], mu=10.0) == 7.5


def test_energy_many_states_matches_row_by_row():
    r = np.array([[7e6, 0.0], [0.0, 8e6], [5e6, 5e6]])
    v = np.array([[0.0, 7.5e3], [-7.0e3, 0.0], [1e3, 2e3]])
    expected = [specific_energy(r[i], v[i]) for i in range(3)]
    np.testing.assert_allclose(specific_energy(r, v), expected, rtol=1e-15)


def test_energy_at_origin_raises():
    with pytest.raises(ValueError, match="origin"):
        specific_energy([[7e6, 0.0], [0.0, 0.0]], [[0.0, 1.0], [0.0, 1.0]])


# --- Angular momentum --------------------------------------------------------------------


def test_angular_momentum_by_hand_and_sign():
    assert angular_momentum_z([2.0, 0.0], [0.0, 3.0]) == 6.0  # counter-clockwise: positive
    assert angular_momentum_z([2.0, 0.0], [0.0, -3.0]) == -6.0  # clockwise: negative
    assert angular_momentum_z([2.0, 3.0], [4.0, 6.0]) == 0.0  # v parallel to r: no rotation


def test_angular_momentum_many_states():
    r = [[2.0, 0.0], [0.0, 2.0], [1.0, 1.0]]
    v = [[0.0, 3.0], [-3.0, 0.0], [1.0, -1.0]]
    np.testing.assert_array_equal(angular_momentum_z(r, v), [6.0, 6.0, -2.0])


# --- First period (F8a) --------------------------------------------------------------------


def test_first_period_interpolates_the_crossing():
    # y goes -3 -> +1 between t = 3 and t = 4: crossing 3/4 of the way, t* = 3.75.
    traj = make_trajectory(xs=[10, 8, 5, 9, 10], ys=[0, 5, -5, -3, 1])
    assert first_period(traj) == 3.75


def test_first_period_crossing_exactly_on_a_sample():
    traj = make_trajectory(xs=[10, 8, 5, 9, 10], ys=[0, 5, -5, -3, 0])
    assert first_period(traj) == 4.0


def test_first_period_uses_dt():
    traj = make_trajectory(xs=[10, 8, 5, 9, 10], ys=[0, 5, -5, -3, 1], dt=2.0)
    assert first_period(traj) == 7.5


def test_first_period_ignores_the_start_and_takes_the_first_crossing():
    # The start (y = 0) is not a crossing; of two later crossings, the first wins.
    traj = make_trajectory(xs=[10] * 7, ys=[0, -1, 1, 2, -2, -1, 1])
    assert first_period(traj) == 1.5


def test_first_period_ignores_crossings_on_the_negative_x_side():
    # y goes - to + while x < 0 (sample 2): not the +x axis, so not a revolution.
    traj = make_trajectory(xs=[10, -5, -5, 8, 10], ys=[0, -1, 1, -2, 2])
    assert first_period(traj) == 3.5


def test_first_period_on_a_real_orbit_is_near_the_analytical_period():
    # Sanity check only; the formal tolerance test (T6) is part of Task 7.
    r0, v0 = circular_initial_state(400_000.0)
    period = 2 * math.pi * math.sqrt((R_EARTH + 400_000.0) ** 3 / MU_EARTH)
    traj = propagate(r0, v0, 1.0, 6000)
    assert first_period(traj) == pytest.approx(period, rel=1e-4)


@pytest.mark.parametrize(
    "xs, ys, vs, message",
    [
        ([10, 8, 10], [1, -1, 1], None, "start on the"),  # y0 != 0
        ([-10, -8, -10], [0, -1, 1], None, "start on the"),  # x0 < 0
        ([10, 8, 10], [0, -1, 1], [[0, -1]] * 3, "counter-clockwise"),  # clockwise
        ([10, 8, 5], [0, 5, 8], None, "complete revolution"),  # never crosses back
    ],
    ids=["off_axis_start", "negative_x_start", "clockwise", "too_short"],
)
def test_first_period_preconditions(xs, ys, vs, message):
    with pytest.raises(ValueError, match=message):
        first_period(make_trajectory(xs, ys, vs))


def test_first_period_rejects_non_trajectory():
    with pytest.raises(ValueError, match="Trajectory"):
        first_period(np.zeros((5, 2)))


# --- Input rules (I8a) ---------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad",
    [[1.0, 2.0, 3.0], [[1.0, 2.0, 3.0]], np.zeros((0, 2)), np.zeros((2, 2, 1)), 5.0, [[1.0], [2.0]]],
    ids=["shape_3", "shape_1x3", "empty", "3d", "scalar", "shape_2x1"],
)
def test_bad_shapes_raise(bad):
    with pytest.raises(ValueError, match="shape"):
        radius(bad)


@pytest.mark.parametrize("bad", [[np.nan, 1.0], [[1.0, 2.0], [np.inf, 0.0]], [1j, 0.0]], ids=["nan", "inf_row", "complex"])
def test_non_finite_or_non_real_raise(bad):
    with pytest.raises(ValueError):
        speed(bad)


def test_mismatched_r_and_v_shapes_raise():
    with pytest.raises(ValueError, match="same shape"):
        angular_momentum_z([[1.0, 0.0], [2.0, 0.0]], [0.0, 1.0])


def test_diagnostics_do_not_modify_inputs():
    r = np.array([[7e6, 1.0], [3.0, 4.0]])
    v = np.array([[0.0, 7e3], [1.0, 1.0]])
    r_copy, v_copy = r.copy(), v.copy()
    specific_energy(r, v)
    angular_momentum_z(r, v)
    np.testing.assert_array_equal(r, r_copy)
    np.testing.assert_array_equal(v, v_copy)
