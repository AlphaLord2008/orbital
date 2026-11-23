"""Tests for steps_for_duration and propagate: endpoint policy (F4, F5), sample
times (F3), impact (F6, T10), non-finite state (F7), T9 input cases, and the
N4 performance requirement.

See docs/requirements-0.1.md §2 and §6.
"""

import dataclasses
import math
import time

import numpy as np
import pytest

from orbital import (
    MU_EARTH,
    R_EARTH,
    circular_initial_state,
    propagate,
    semi_implicit_euler_step,
    steps_for_duration,
)

ALTITUDE = 400_000.0  # reference orbit [m]


def reference_period():
    radius = R_EARTH + ALTITUDE
    return 2 * math.pi * math.sqrt(radius**3 / MU_EARTH)


# --- F4/F5: steps_for_duration -----------------------------------------------------


@pytest.mark.parametrize(
    "duration, dt, expected_n",
    [
        (0.3, 0.1, 3),  # q = 2.9999999999999996: just below 3, snapped
        (2.9999, 1.0, 2),  # well below 3: floored
        (3.0000001, 1.0, 3),  # just above 3: floor already gives 3
        (10.0, 3.0, 3),  # not a multiple: floored, ends 1 s short
    ],
    ids=["snap_below", "floor_below", "just_above", "not_multiple"],
)
def test_f4_case_table(duration, dt, expected_n):
    assert steps_for_duration(duration, dt) == expected_n


def test_f4_shorter_than_one_step_raises():
    with pytest.raises(ValueError, match="shorter than one step"):
        steps_for_duration(1.0, 2.0)


_DURATIONS = [0.3, 1.0, 59.9, 60.0, 100.0, 5553.6, 55536.24]
_TIMESTEPS = [0.1, 0.3, 1.0, 7.0, 60.0]


@pytest.mark.parametrize(
    "duration, dt", [(d, dt) for d in _DURATIONS for dt in _TIMESTEPS if d >= dt]
)
def test_f5_end_time_bound(duration, dt):
    t_end = steps_for_duration(duration, dt) * dt
    assert duration - dt < t_end <= duration * (1 + 2e-9)


@pytest.mark.parametrize("bad", [0.0, -1.0, np.nan, np.inf, True], ids=["zero", "neg", "nan", "inf", "bool"])
def test_steps_for_duration_rejects_invalid_arguments(bad):
    with pytest.raises(ValueError):
        steps_for_duration(bad, 1.0)
    with pytest.raises(ValueError):
        steps_for_duration(10.0, bad)


# --- F3: the trajectory itself -------------------------------------------------------


def test_trajectory_shape_times_and_metadata():
    r0, v0 = circular_initial_state(ALTITUDE)
    traj = propagate(r0, v0, dt=2.0, n_steps=100)
    assert traj.status == "completed"
    assert traj.t.shape == (101,)
    assert traj.r.shape == traj.v.shape == (101, 2)
    np.testing.assert_array_equal(traj.t, np.arange(101) * 2.0)  # t_k = k * dt exactly
    assert traj.t_end == 200.0
    assert traj.dt == 2.0
    assert traj.n_steps_requested == 100
    np.testing.assert_array_equal(traj.r[0], r0)
    np.testing.assert_array_equal(traj.v[0], v0)


def test_propagate_matches_repeated_single_steps():
    r0, v0 = circular_initial_state(ALTITUDE)
    traj = propagate(r0, v0, dt=1.0, n_steps=5)
    r, v = r0, v0
    for k in range(1, 6):
        r, v = semi_implicit_euler_step(r, v, 1.0)
        np.testing.assert_array_equal(traj.r[k], r)
        np.testing.assert_array_equal(traj.v[k], v)


def test_end_time_follows_endpoint_policy():
    # 10 s requested with dt = 3 s: three steps, ends at 9 s (F4 case table).
    r0, v0 = circular_initial_state(ALTITUDE)
    traj = propagate(r0, v0, 3.0, steps_for_duration(10.0, 3.0))
    assert traj.t_end == 9.0


def test_trajectory_is_immutable():
    r0, v0 = circular_initial_state(ALTITUDE)
    traj = propagate(r0, v0, 1.0, 3)
    for array in (traj.t, traj.r, traj.v):
        with pytest.raises(ValueError, match="read-only"):
            array[0] = 0.0
    with pytest.raises(dataclasses.FrozenInstanceError):
        traj.status = "impact"


def test_caller_arrays_not_modified_or_shared():
    r0, v0 = circular_initial_state(ALTITUDE)
    r_in, v_in = r0.copy(), v0.copy()
    traj = propagate(r_in, v_in, 1.0, 10)
    np.testing.assert_array_equal(r_in, r0)
    np.testing.assert_array_equal(v_in, v0)
    for out in (traj.r, traj.v):
        for inp in (r_in, v_in):
            assert not np.shares_memory(out, inp)


# --- T10 / F6: impact ------------------------------------------------------------------


def test_t10_impact_from_rest():
    # Released at rest 400 km up, the spacecraft falls straight down.
    r0 = np.array([R_EARTH + ALTITUDE, 0.0])
    traj = propagate(r0, [0.0, 0.0], dt=1.0, n_steps=10_000)
    radii = np.linalg.norm(traj.r, axis=1)
    assert traj.status == "impact"
    assert radii[-1] <= R_EARTH
    assert radii[-2] > R_EARTH
    assert len(traj.t) < 10_001  # stopped early
    assert traj.t_end == traj.t[-1]


# --- F7: non-finite state ------------------------------------------------------------------


@pytest.mark.filterwarnings("ignore:overflow encountered:RuntimeWarning")
def test_f7_non_finite_state_raises_runtime_error():
    # A finite but absurd velocity overflows the position to infinity in step 1.
    with pytest.raises(RuntimeError, match="step 1"):
        propagate([7e6, 0.0], [1e300, 0.0], dt=1e10, n_steps=5)


# --- T9 input cases -----------------------------------------------------------------------


@pytest.mark.parametrize("bad", [0, -1, True, 1.5, 3.0, "10", None], ids=["zero", "neg", "bool", "float", "float_whole", "string", "none"])
def test_invalid_n_steps_raises(bad):
    r0, v0 = circular_initial_state(ALTITUDE)
    with pytest.raises(ValueError, match="n_steps"):
        propagate(r0, v0, 1.0, bad)


def test_numpy_integer_n_steps_accepted():
    r0, v0 = circular_initial_state(ALTITUDE)
    assert propagate(r0, v0, 1.0, np.int64(3)).t.shape == (4,)


@pytest.mark.parametrize("bad", [0.0, -1.0, np.nan, np.inf, True], ids=["zero", "neg", "nan", "inf", "bool"])
def test_invalid_dt_raises(bad):
    r0, v0 = circular_initial_state(ALTITUDE)
    with pytest.raises(ValueError, match="dt"):
        propagate(r0, v0, bad, 10)


@pytest.mark.parametrize(
    "r0", [[R_EARTH, 0.0], [R_EARTH / 2, 0.0], [0.0, 0.0]], ids=["on_surface", "inside", "centre"]
)
def test_start_at_or_inside_body_raises(r0):
    with pytest.raises(ValueError, match="inside the central body"):
        propagate(r0, [0.0, 7_000.0], 1.0, 10)


@pytest.mark.parametrize("bad", [[1.0, 2.0, 3.0], [[7e6], [0.0]], [np.nan, 0.0]], ids=["shape_3", "shape_2x1", "nan"])
def test_invalid_initial_vectors_raise(bad):
    r0, v0 = circular_initial_state(ALTITUDE)
    with pytest.raises(ValueError, match="r0 must"):
        propagate(bad, v0, 1.0, 10)
    with pytest.raises(ValueError, match="v0 must"):
        propagate(r0, bad, 1.0, 10)


# --- N4: performance ------------------------------------------------------------------------


def test_n4_ten_orbit_reference_run_under_ten_seconds():
    r0, v0 = circular_initial_state(ALTITUDE)
    n = steps_for_duration(10 * reference_period(), 1.0)
    assert n == 55_536
    start = time.perf_counter()
    traj = propagate(r0, v0, 1.0, n)
    elapsed = time.perf_counter() - start
    assert traj.status == "completed"
    assert elapsed < 10.0
