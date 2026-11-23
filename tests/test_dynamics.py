"""Tests for gravity_accel: acceptance test T1 and its T9 input cases.

See docs/requirements-0.1.md §6.
"""

import numpy as np
import pytest

from orbital import MU_EARTH, R_EARTH, gravity_accel

R0 = np.array([R_EARTH + 400_000.0, 0.0])  # reference orbit start, 400 km altitude [m]
OFF_AXIS = np.array([3_000_000.0, -6_500_000.0])  # both components non-zero and unequal [m]


# --- T1: magnitude, direction, inverse-square law, unit sanity -------------------


@pytest.mark.parametrize("r", [R0, OFF_AXIS], ids=["on_x_axis", "off_axis"])
def test_t1_magnitude_is_mu_over_r_squared(r):
    expected = MU_EARTH / (r[0] ** 2 + r[1] ** 2)
    assert np.linalg.norm(gravity_accel(r)) == pytest.approx(expected, rel=1e-12)


@pytest.mark.parametrize("r", [R0, OFF_AXIS], ids=["on_x_axis", "off_axis"])
def test_t1_points_toward_origin(r):
    # a . r_hat = -|a| holds only if a points exactly opposite to r.
    # Off-axis, a sign error or swapped x/y components would break it.
    a = gravity_accel(r)
    r_hat = r / np.linalg.norm(r)
    assert np.dot(a, r_hat) == pytest.approx(-np.linalg.norm(a), rel=1e-12)


def test_t1_inverse_square_law():
    ratio = np.linalg.norm(gravity_accel(2 * OFF_AXIS)) / np.linalg.norm(gravity_accel(OFF_AXIS))
    assert ratio == pytest.approx(0.25, rel=1e-12)


def test_t1_unit_sanity_against_reference_value():
    # docs/reference-values.md: |a| = 8.676 m/s^2 at 400 km altitude.
    # A metre/kilometre mix-up would miss by a factor of 1000 or more.
    assert f"{np.linalg.norm(gravity_accel(R0)):.4g}" == "8.676"


def test_acceleration_is_linear_in_mu():
    np.testing.assert_allclose(gravity_accel(R0, mu=2 * MU_EARTH), 2 * gravity_accel(R0), rtol=1e-15)


# --- T9 cases that apply to gravity_accel ----------------------------------------


def test_origin_raises():
    with pytest.raises(ValueError, match="origin"):
        gravity_accel([0.0, 0.0])


@pytest.mark.parametrize(
    "bad_r",
    [[1.0, 2.0, 3.0], [[1.0], [2.0]], [[1.0, 2.0]], 7e6, []],
    ids=["shape_3", "shape_2x1", "shape_1x2", "scalar", "empty"],
)
def test_wrong_shape_raises(bad_r):
    with pytest.raises(ValueError, match="shape"):
        gravity_accel(bad_r)


@pytest.mark.parametrize("bad_r", [[np.nan, 1.0], [np.inf, 1.0], [1.0, -np.inf]], ids=["nan", "inf", "neg_inf"])
def test_non_finite_raises(bad_r):
    with pytest.raises(ValueError, match="finite"):
        gravity_accel(bad_r)


@pytest.mark.parametrize(
    "bad_r", [[1 + 2j, 0.0], ["7e6", "0"], [True, False]], ids=["complex", "strings", "booleans"]
)
def test_non_real_raises(bad_r):
    with pytest.raises(ValueError, match="real"):
        gravity_accel(bad_r)


def test_integer_list_is_accepted_as_float64():
    a = gravity_accel([6_778_137, 0])
    assert a.dtype == np.float64
    np.testing.assert_array_equal(a, gravity_accel(R0))


def test_caller_array_not_modified_or_shared():
    r = R0.copy()
    a = gravity_accel(r)
    np.testing.assert_array_equal(r, R0)
    assert not np.shares_memory(a, r)


@pytest.mark.parametrize(
    "bad_mu",
    [0.0, -MU_EARTH, np.nan, np.inf, True, "3.986e14", None],
    ids=["zero", "negative", "nan", "inf", "bool", "string", "none"],
)
def test_invalid_mu_raises(bad_mu):
    with pytest.raises(ValueError, match="mu"):
        gravity_accel(R0, mu=bad_mu)


@pytest.mark.filterwarnings("ignore:overflow encountered:RuntimeWarning")
def test_unrepresentably_large_r_raises():
    # |r| overflows to infinity (NumPy warns, expected here), which would
    # otherwise return a = 0 silently.
    with pytest.raises(ValueError, match="float64"):
        gravity_accel([1e200, 0.0])
