"""Equations of motion for the two-body problem (Requirements F1, F2; ADR-0002).

Model: a point-mass central body fixed at the origin of a 2D inertial frame.
Units are SI throughout: positions in m, velocities in m/s, accelerations in
m/s^2, times in s, mu in m^3/s^2.
"""

import math

import numpy as np
from numpy.typing import ArrayLike, NDArray

from orbital._validation import as_positive_scalar, as_vector2
from orbital.constants import MU_EARTH, R_EARTH


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


def circular_velocity(r: float, mu: float = MU_EARTH) -> float:
    """Speed of a circular orbit of radius ``r``: v_c = sqrt(mu / r).

    From gravity supplying exactly the centripetal acceleration: v^2 / r = mu / r^2.

    Args:
        r: Orbital radius, measured from the central body's centre (not altitude) [m].
        mu: Gravitational parameter of the central body [m^3/s^2].

    Returns:
        Circular speed [m/s], computed in float64 (ADR-0002 §2.4: never typed in).

    Raises:
        ValueError: If ``r`` or ``mu`` is not finite and positive.
    """
    r = as_positive_scalar(r, "r")
    mu = as_positive_scalar(mu, "mu")
    return math.sqrt(mu / r)


def circular_initial_state(
    altitude: float, mu: float = MU_EARTH, body_radius: float = R_EARTH
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Initial state for a counter-clockwise circular orbit at ``altitude``.

    The spacecraft starts exactly on the +x axis, moving in the +y direction:
    r0 = (body_radius + altitude, 0), v0 = (0, circular_velocity(r0)).

    Args:
        altitude: Height above the central body's surface [m]. Must be > 0.
        mu: Gravitational parameter of the central body [m^3/s^2].
        body_radius: Radius of the central body [m].

    Returns:
        ``(r0, v0)``: new float64 arrays of shape (2,) [m], [m/s].

    Raises:
        ValueError: If any argument is not finite and positive.
    """
    altitude = as_positive_scalar(altitude, "altitude")
    body_radius = as_positive_scalar(body_radius, "body_radius")
    radius = body_radius + altitude
    r0 = np.array([radius, 0.0])
    v0 = np.array([0.0, circular_velocity(radius, mu)])
    return r0, v0


def semi_implicit_euler_step(
    r: ArrayLike, v: ArrayLike, dt: float, mu: float = MU_EARTH
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Advance position and velocity by one step of semi-implicit (symplectic) Euler.

        v_new = v + dt * a(r)
        r_new = r + dt * v_new        <- uses the NEW velocity

    Using v_new in the position update is what distinguishes this method from
    explicit Euler (which uses the old v). It makes the method symplectic and
    conserves angular momentum h = r x v exactly, apart from roundoff:
    r_new x v_new = (r + dt v_new) x v_new = r x v_new = r x v + dt (r x a) = r x v,
    because v_new x v_new = 0 and a is parallel to r for a central force.

    Args:
        r: Position, shape (2,) [m].
        v: Velocity, shape (2,) [m/s].
        dt: Timestep, > 0 [s].
        mu: Gravitational parameter of the central body [m^3/s^2].

    Returns:
        ``(r_new, v_new)``: new float64 arrays of shape (2,) [m], [m/s]. The
        inputs are never modified.

    Raises:
        ValueError: If an input fails validation (Requirement I8) or ``r`` is
            the origin.
    """
    r = as_vector2(r, "r")
    v = as_vector2(v, "v")
    dt = as_positive_scalar(dt, "dt")

    v_new = v + dt * gravity_accel(r, mu)
    r_new = r + dt * v_new
    return r_new, v_new
