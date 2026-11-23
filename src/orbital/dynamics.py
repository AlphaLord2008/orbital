"""Equations of motion for the two-body problem (Requirements F2; ADR-0002).

Model: a point-mass central body fixed at the origin of a 2D inertial frame.
Units are SI throughout: positions in m, accelerations in m/s^2, mu in m^3/s^2.
"""

import numpy as np
from numpy.typing import ArrayLike, NDArray

from orbital._validation import as_positive_scalar, as_vector2
from orbital.constants import MU_EARTH


def gravity_accel(r: ArrayLike, mu: float = MU_EARTH) -> NDArray[np.float64]:
    """Gravitational acceleration at position ``r`` due to a point mass at the origin.

        a = -mu * r / |r|^3

    The magnitude is mu / |r|^2 (inverse-square law). The direction is -r / |r|,
    pointing from the spacecraft toward the central body. The spacecraft's mass
    does not appear: it cancels between F = G M m / r^2 and F = m a.

    Args:
        r: Position relative to the central body's centre, shape (2,) [m].
        mu: Gravitational parameter G * M of the central body [m^3/s^2].

    Returns:
        A new float64 array of shape (2,) [m/s^2].

    Raises:
        ValueError: If ``r`` is not a finite real vector of shape (2,), if ``r``
            is the origin, if ``mu`` is not finite and positive, or if ``|r|`` is
            so extreme (beyond about 1e100 m either way) that the result cannot
            be represented in float64.
    """
    r = as_vector2(r, "r")
    mu = as_positive_scalar(mu, "mu")

    r_norm = np.linalg.norm(r)  # |r| = sqrt(x^2 + y^2)
    if r_norm == 0.0:
        raise ValueError("r is the origin, where a point mass's gravity is undefined")

    accel = (-mu / r_norm**3) * r

    if not (np.isfinite(r_norm) and np.all(np.isfinite(accel))):
        raise ValueError(f"gravity_accel cannot be represented in float64 at r = {r} m")
    return accel
