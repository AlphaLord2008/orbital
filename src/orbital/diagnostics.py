"""Orbital diagnostics: quantities used to check a simulation (Requirements F8, F8a).

Each state function accepts one state, shape (2,), or a whole trajectory,
shape (N, 2), one state per row (Requirement I8a). It returns a Python float
for one state, or a float64 array of shape (N,) for N states.

Units are SI: positions in m, velocities in m/s, mu in m^3/s^2.
"""

import numpy as np
from numpy.typing import ArrayLike, NDArray

from orbital._validation import as_positive_scalar, as_states
from orbital.constants import MU_EARTH
from orbital.propagate import Trajectory

FloatOrArray = float | NDArray[np.float64]


def _unwrap(values: NDArray[np.float64]) -> FloatOrArray:
    """Return a plain float for a single result, the array otherwise."""
    return float(values) if values.ndim == 0 else values


def _matching_states(r: ArrayLike, v: ArrayLike) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    r = as_states(r, "r")
    v = as_states(v, "v")
    if r.shape != v.shape:
        raise ValueError(f"r and v must have the same shape, got {r.shape} and {v.shape}")
    return r, v


def radius(r: ArrayLike) -> FloatOrArray:
    """Distance from the central body's centre, |r| [m]."""
    r = as_states(r, "r")
    return _unwrap(np.linalg.norm(r, axis=-1))


def speed(v: ArrayLike) -> FloatOrArray:
    """Magnitude of the velocity, |v| [m/s]."""
    v = as_states(v, "v")
    return _unwrap(np.linalg.norm(v, axis=-1))


def specific_energy(r: ArrayLike, v: ArrayLike, mu: float = MU_EARTH) -> FloatOrArray:
    """Specific mechanical energy: epsilon = |v|^2 / 2 - mu / |r| [J/kg = m^2/s^2].

    Kinetic plus gravitational potential energy per unit spacecraft mass.
    Constant in exact two-body motion; negative for a bound orbit. For a
    circular orbit it equals -mu / (2 r).

    Raises:
        ValueError: If any position is the origin, where the potential is undefined.
    """
    r, v = _matching_states(r, v)
    mu = as_positive_scalar(mu, "mu")
    r_norm = np.linalg.norm(r, axis=-1)
    if np.any(r_norm == 0.0):
        raise ValueError("r includes the origin, where the gravitational potential is undefined")
    v_sq = np.sum(v * v, axis=-1)
    return _unwrap(0.5 * v_sq - mu / r_norm)


def angular_momentum_z(r: ArrayLike, v: ArrayLike) -> FloatOrArray:
    """Specific angular momentum, z-component of r x v: h = x * v_y - y * v_x [m^2/s].

    Constant in exact two-body motion (and, up to roundoff, under
    semi-implicit Euler). Positive for counter-clockwise motion.
    """
    r, v = _matching_states(r, v)
    return _unwrap(r[..., 0] * v[..., 1] - r[..., 1] * v[..., 0])


def first_period(trajectory: Trajectory) -> float:
    """Time of the first completed counter-clockwise revolution (Requirement F8a) [s].

    The trajectory must start exactly on the positive x-axis (y0 = 0, x0 > 0)
    and move counter-clockwise (h0 > 0). The revolution completes at the first
    sample pair (k-1, k), k >= 1, with y[k-1] < 0 <= y[k] and x[k] > 0, i.e.
    crossing the +x axis upward. The crossing time is linearly interpolated:

        t* = t[k-1] + dt * (-y[k-1]) / (y[k] - y[k-1])

    The sample at t = 0 can never count: a crossing needs a preceding y < 0.

    Raises:
        ValueError: If ``trajectory`` is not a Trajectory, the precondition
            fails, or no complete revolution is present.
    """
    if not isinstance(trajectory, Trajectory):
        raise ValueError(f"first_period needs a Trajectory, got {type(trajectory).__name__}")
    x, y = trajectory.r[:, 0], trajectory.r[:, 1]
    if not (y[0] == 0.0 and x[0] > 0.0):
        raise ValueError(f"trajectory must start on the +x axis (y0 = 0, x0 > 0), got r0 = {trajectory.r[0]}")
    if angular_momentum_z(trajectory.r[0], trajectory.v[0]) <= 0.0:
        raise ValueError("trajectory must move counter-clockwise (h0 > 0)")

    # Boolean mask over sample pairs (k-1, k) for k = 1 .. N-1.
    upward_crossing = (y[:-1] < 0.0) & (y[1:] >= 0.0) & (x[1:] > 0.0)
    pairs = np.flatnonzero(upward_crossing)
    if pairs.size == 0:
        raise ValueError("trajectory does not contain a complete revolution")

    k = int(pairs[0]) + 1
    fraction = -y[k - 1] / (y[k] - y[k - 1])  # in (0, 1]: how far into the step y reaches 0
    return float(trajectory.t[k - 1] + trajectory.dt * fraction)
