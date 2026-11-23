"""Tests for the reference initial state (F1) and the semi-implicit Euler step:
acceptance test T2, one-step angular-momentum conservation, and T9 input cases.

See docs/requirements-0.1.md §6.
"""

import math

import numpy as np
import pytest

from orbital import (
    MU_EARTH,
    R_EARTH,
    circular_initial_state,
    circular_velocity,
    gravity_accel,
    semi_implicit_euler_step,
)

ALTITUDE = 400_000.0  # reference orbit [m]


def angular_momentum_z(r, v):
    """h = x * v_y - y * v_x [m^2/s]. Test helper; the library version arrives in Task 6."""
    return r[0] * v[1] - r[1] * v[0]


# --- F1: circular orbit initial state --------------------------------------------


def test_circular_velocity_matches_formula():
    radius = R_EARTH + ALTITUDE
    assert circular_velocity(radius) == pytest.approx(math.sqrt(MU_EARTH / radius), rel=1e-15)


def test_circular_velocity_unit_sanity_against_reference_value():
    # docs/reference-values.md: v_c = 7,668.558175 m/s at 400 km altitude.
    assert f"{circular_velocity(R_EARTH + ALTITUDE):.10g}" == "7668.558175"


def test_circular_initial_state_on_x_axis_counter_clockwise():
    r0, v0 = circular_initial_state(ALTITUDE)
    assert r0.tolist() == [R_EARTH + ALTITUDE, 0.0]
    assert v0[0] == 0.0
    assert v0[1] == circular_velocity(R_EARTH + ALTITUDE)  # computed, never typed in
    assert angular_momentum_z(r0, v0) > 0  # counter-clockwise


@pytest.mark.parametrize("bad", [0.0, -1.0, np.nan, np.inf, True], ids=["zero", "neg", "nan", "inf", "bool"])
def test_circular_initial_state_rejects_invalid_altitude(bad):
    with pytest.raises(ValueError, match="altitude"):
        circular_initial_state(bad)


# --- T2: one step from the reference state vs an independent hand calculation ----


def test_t2_one_step_matches_hand_calculation():
    dt = 1.0
    r0, v0 = circular_initial_state(ALTITUDE)
    r1, v1 = semi_implicit_euler_step(r0, v0, dt)

    # Hand calculation with plain Python floats, no NumPy, no library functions.
    # On the +x axis gravity points purely in -x with magnitude mu / x0^2.
    x0 = R_EARTH + ALTITUDE
    vy0 = math.sqrt(MU_EARTH / x0)
    ax0 = -MU_EARTH / x0**2
    expected_v1 = (0.0 + dt * ax0, vy0)  # v1 = v0 + dt * a0
    expected_r1 = (x0 + dt * expected_v1[0], 0.0 + dt * expected_v1[1])  # r1 = r0 + dt * v1 (NEW v)

    for got, expected in zip([*v1, *r1], [*expected_v1, *expected_r1]):
        assert got == pytest.approx(expected, rel=1e-9)


def test_position_update_uses_new_velocity():
    # Explicit Euler would leave x unchanged after one step from the reference
    # state (old v_x = 0). Semi-implicit Euler moves x by dt^2 * a_x.
    dt = 1.0
    r0, v0 = circular_initial_state(ALTITUDE)
    r1, _ = semi_implicit_euler_step(r0, v0, dt)
    assert r1[0] - r0[0] == pytest.approx(dt**2 * gravity_accel(r0)[0], rel=1e-9)


# --- Angular momentum: exactly conserved by one step (proof in the docstring) ----


@pytest.mark.parametrize("dt", [1.0, 10.0, 60.0])
def test_one_step_conserves_angular_momentum(dt):
    # A general state: off-axis position, velocity not perpendicular to r.
    r = np.array([5_000_000.0, -4_500_000.0])
    v = np.array([3_100.0, 5_200.0])
    h0 = angular_momentum_z(r, v)
    r1, v1 = semi_implicit_euler_step(r, v, dt)
    # Exact in real arithmetic; float64 roundoff only. Explicit Euler would
    # change h by about 1e-6 (dt = 1 s) to 4e-3 (dt = 60 s) relative here.
    assert angular_momentum_z(r1, v1) == pytest.approx(h0, rel=1e-14)


# --- Interface and T9 input cases --------------------------------------------------


def test_step_returns_new_float64_arrays_and_leaves_inputs_alone():
    r0, v0 = circular_initial_state(ALTITUDE)
    r_in, v_in = r0.copy(), v0.copy()
    r1, v1 = semi_implicit_euler_step(r_in, v_in, 1.0)
    assert r1.dtype == v1.dtype == np.float64
    assert r1.shape == v1.shape == (2,)
    np.testing.assert_array_equal(r_in, r0)
    np.testing.assert_array_equal(v_in, v0)
    for out in (r1, v1):
        for inp in (r_in, v_in):
            assert not np.shares_memory(out, inp)


@pytest.mark.parametrize(
    "bad_dt", [0.0, -1.0, np.nan, np.inf, True, "1"], ids=["zero", "neg", "nan", "inf", "bool", "string"]
)
def test_invalid_dt_raises(bad_dt):
    r0, v0 = circular_initial_state(ALTITUDE)
    with pytest.raises(ValueError, match="dt"):
        semi_implicit_euler_step(r0, v0, bad_dt)


@pytest.mark.parametrize(
    "bad_v", [[0.0, 1.0, 2.0], [[0.0], [7668.0]], [0.0, np.nan], [0j, 7668.0]],
    ids=["shape_3", "shape_2x1", "nan", "complex"],
)
def test_invalid_velocity_raises(bad_v):
    r0, _ = circular_initial_state(ALTITUDE)
    with pytest.raises(ValueError, match="v must"):
        semi_implicit_euler_step(r0, bad_v, 1.0)


def test_step_from_origin_raises():
    with pytest.raises(ValueError, match="origin"):
        semi_implicit_euler_step([0.0, 0.0], [0.0, 1.0], 1.0)
