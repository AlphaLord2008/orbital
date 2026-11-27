"""Exact two-body solutions for a point-mass central body (v0.1.1, AN-1 ... AN-6).

These are the references every v0.1.1 validation case is measured against
(docs/requirements-0.1.1.md §3). They are new code, so before anything trusts
them they are checked against an independent 50-digit implementation
(scripts/reference_mp.py, REF-1).

Model: the same as the propagator (ADR-0002): a point mass at the origin of a
2D inertial frame, SI units, float64. Motion may be clockwise or
counter-clockwise; radial (h = 0) and parabolic (|e - 1| < 1e-9) trajectories
are rejected with ValueError.

Notation: r, v position and velocity; mu gravitational parameter; epsilon
specific energy; h = x v_y - y v_x specific angular momentum; e eccentricity;
a semi-major axis (negative for hyperbolic orbits); p = h^2 / mu semi-latus
rectum; nu true anomaly; E eccentric anomaly; H hyperbolic anomaly; M mean
anomaly; n mean motion.

Package rules I1-I8a apply: standard library and NumPy only, SI units,
ValueError for bad input, no I/O, no printing or plotting.
"""

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import ArrayLike, NDArray

from orbital._validation import as_positive_scalar, as_vector2
from orbital.constants import MU_EARTH

PARABOLIC_TOLERANCE = 1e-9
"""|e - 1| below this is treated as parabolic and rejected (AN-5)."""

KEPLER_TOLERANCE = 1e-15
"""Newton stops when |dE| <= this (elliptic) or |dH| <= this * |H| (hyperbolic, relative)."""

KEPLER_MAX_ITERATIONS = 100


@dataclass(frozen=True)
class Elements:
    """Orbital elements of a 2D two-body state (AN-1).

    Attributes:
        energy: Specific energy epsilon = v^2/2 - mu/r [m^2/s^2].
        h: Specific angular momentum x v_y - y v_x [m^2/s]; positive = counter-clockwise.
        e_vec: Eccentricity vector, shape (2,), pointing at periapsis.
        e: Eccentricity |e_vec|.
        a: Semi-major axis -mu / (2 epsilon) [m]; negative for hyperbolic orbits.
        p: Semi-latus rectum h^2 / mu [m].
        omega: Argument of periapsis, angle of e_vec from +x [rad], in (-pi, pi].
            0 when e is exactly 0.
        nu0: True anomaly of the given state [rad], in (-pi, pi], measured from
            periapsis in the direction of motion. For e exactly 0 periapsis is
            taken at the given position, so nu0 = 0.
    """

    energy: float
    h: float
    e_vec: NDArray[np.float64]
    e: float
    a: float
    p: float
    omega: float
    nu0: float


def _cross(a: NDArray[np.float64], b: NDArray[np.float64]) -> float:
    return float(a[0] * b[1] - a[1] * b[0])


def _state(r: ArrayLike, v: ArrayLike, mu: float) -> tuple[NDArray[np.float64], NDArray[np.float64], float]:
    r = as_vector2(r, "r")
    v = as_vector2(v, "v")
    mu = as_positive_scalar(mu, "mu")
    if math.hypot(r[0], r[1]) == 0.0:
        raise ValueError("r is the origin, where two-body motion is undefined")
    return r, v, mu


def _elements(r: NDArray[np.float64], v: NDArray[np.float64], mu: float) -> Elements:
    r_norm = math.hypot(r[0], r[1])
    v_sq = float(v[0] * v[0] + v[1] * v[1])
    h = _cross(r, v)
    if h == 0.0:
        raise ValueError("radial trajectory (h = 0) is not supported")
    energy = 0.5 * v_sq - mu / r_norm
    r_dot_v = float(r[0] * v[0] + r[1] * v[1])
    e_vec = ((v_sq - mu / r_norm) * r - r_dot_v * v) / mu
    e = math.hypot(e_vec[0], e_vec[1])
    p = h * h / mu
    a = -mu / (2.0 * energy) if energy != 0.0 else math.inf
    sense = 1.0 if h > 0.0 else -1.0
    if e == 0.0:
        omega, nu0 = 0.0, 0.0
    else:
        omega = math.atan2(e_vec[1], e_vec[0])
        p_hat = e_vec / e
        nu0 = math.atan2(sense * _cross(p_hat, r), float(p_hat @ r))
    return Elements(energy=energy, h=h, e_vec=e_vec, e=e, a=a, p=p, omega=omega, nu0=nu0)


def elements(r: ArrayLike, v: ArrayLike, mu: float = MU_EARTH) -> Elements:
    """Orbital elements of the state (r, v) (AN-1).

    Raises:
        ValueError: on invalid input, r at the origin, or a radial trajectory.
    """
    return _elements(*_state(r, v, mu))


def classify(r: ArrayLike, v: ArrayLike, mu: float = MU_EARTH) -> Literal["bound", "escape"]:
    """'bound' if epsilon < 0, otherwise 'escape' (AN-2).

    Impact is a property of a trajectory, not of a state, so it is not decided here.
    """
    r, v, mu = _state(r, v, mu)
    r_norm = math.hypot(r[0], r[1])
    energy = 0.5 * float(v[0] * v[0] + v[1] * v[1]) - mu / r_norm
    return "bound" if energy < 0.0 else "escape"


def apsides(r: ArrayLike, v: ArrayLike, mu: float = MU_EARTH) -> tuple[float, float | None]:
    """(r_p, r_a): periapsis radius always; apoapsis radius only when bound (AN-3) [m].

    r_p is computed as p / (1 + e), which equals a (1 - e) but stays exact for
    circular, elliptic and hyperbolic orbits alike.
    """
    el = elements(r, v, mu)
    r_p = el.p / (1.0 + el.e)
    r_a = el.p / (1.0 - el.e) if el.energy < 0.0 else None
    return r_p, r_a


def period(r: ArrayLike, v: ArrayLike, mu: float = MU_EARTH) -> float:
    """Orbital period 2 pi sqrt(a^3 / mu) of a bound orbit (AN-4) [s].

    Raises:
        ValueError: if the orbit is not bound (epsilon >= 0).
    """
    r, v, mu = _state(r, v, mu)
    el = _elements(r, v, mu)
    if el.energy >= 0.0:
        raise ValueError("period is defined only for bound orbits (epsilon < 0)")
    return 2.0 * math.pi * math.sqrt(el.a**3 / mu)


# --- Kepler's equation ----------------------------------------------------------------------


def _x_minus_sin(x: NDArray[np.float64]) -> NDArray[np.float64]:
    """x - sin x without cancellation: its Taylor series for |x| < 1 (12 terms, error < 1e-20 x)."""
    x2 = x * x
    term = x * x2 / 6.0
    series = term.copy()
    for n in range(2, 13):
        term = -term * x2 / ((2 * n) * (2 * n + 1))
        series = series + term
    return np.where(np.abs(x) < 1.0, series, x - np.sin(x))


def _solve_elliptic(mean: NDArray[np.float64], e: float) -> NDArray[np.float64]:
    """E with E - e sin E = M, for M already reduced to [-pi, pi].

    Near periapsis of a highly eccentric orbit (E small, e close to 1) the textbook residual
    E - e sin E - M cancels, and its roundoff divided by the small slope 1 - e cos E kept
    Newton from reaching |dE| <= 1e-15 (it settled into a +-1 ulp cycle). So:
    - residual (1 - e) E + e (E - sin E) - M and slope (1 - e) + e (1 - cos E), both
      cancellation-free, as for the hyperbolic case;
    - the equation is odd in (E, M), so solve for |M| and restore the sign;
    - start at E = min(pi, |M| + e), a bound above the root. f is increasing and convex on
      [0, pi], so Newton from above decreases monotonically to the root with no overshoot.
    The convergence test, iteration limit and RuntimeError are unchanged (AN-5).
    """
    sign = np.where(mean < 0.0, -1.0, 1.0)
    m = np.abs(mean)
    E = np.minimum(math.pi, m + e)
    one_minus_e = 1.0 - e
    for _ in range(KEPLER_MAX_ITERATIONS):
        residual = one_minus_e * E + e * _x_minus_sin(E) - m
        slope = one_minus_e + e * _one_minus_cos(E)
        step = np.where(m == 0.0, E, residual / slope)  # M = 0: E = 0 exactly
        E = E - step
        if np.all(np.abs(step) <= KEPLER_TOLERANCE):
            return sign * E
    raise RuntimeError("Kepler's equation (elliptic) did not converge in 100 iterations")


def _one_minus_cos(x: NDArray[np.float64]) -> NDArray[np.float64]:
    """1 - cos x without cancellation: 2 sin^2(x / 2)."""
    half = np.sin(0.5 * x)
    return 2.0 * half * half


def _sinh_minus_x(x: NDArray[np.float64]) -> NDArray[np.float64]:
    """sinh x - x without cancellation: its Taylor series for |x| < 1 (12 terms, error < 1e-20 x)."""
    x2 = x * x
    term = x * x2 / 6.0
    series = term.copy()
    for n in range(2, 13):
        term = term * x2 / ((2 * n) * (2 * n + 1))
        series = series + term
    return np.where(np.abs(x) < 1.0, series, np.sinh(x) - x)


def _cosh_minus_one(x: NDArray[np.float64]) -> NDArray[np.float64]:
    """cosh x - 1 without cancellation: 2 sinh^2(x / 2)."""
    half = np.sinh(0.5 * x)
    return 2.0 * half * half


def _solve_hyperbolic(mean: NDArray[np.float64], e: float) -> NDArray[np.float64]:
    """H with e sinh H - H = M.

    Written as (e - 1) H + e (sinh H - H) - M so that nothing cancels when H is
    small and e is close to 1; otherwise the residual's roundoff, divided by the
    small slope e cosh H - 1, keeps Newton from reaching the relative tolerance.
    """
    H = np.arcsinh(mean / e)
    e_minus_1 = e - 1.0
    for _ in range(KEPLER_MAX_ITERATIONS):
        residual = e_minus_1 * H + e * _sinh_minus_x(H) - mean
        step = residual / (e_minus_1 + e * _cosh_minus_one(H))
        H = H - step
        if np.all(np.abs(step) <= KEPLER_TOLERANCE * np.abs(H)):
            return H
    raise RuntimeError("Kepler's equation (hyperbolic) did not converge in 100 iterations")


def _anomaly_to_mean(nu: float, e: float, elliptic: bool) -> float:
    if elliptic:
        E = 2.0 * math.atan2(math.sqrt(1.0 - e) * math.sin(nu / 2.0), math.sqrt(1.0 + e) * math.cos(nu / 2.0))
        return E - e * math.sin(E)
    H = 2.0 * math.atanh(math.sqrt((e - 1.0) / (e + 1.0)) * math.tan(nu / 2.0))
    return e * math.sinh(H) - H


def _check_conic(el: Elements) -> bool:
    if abs(el.e - 1.0) < PARABOLIC_TOLERANCE:
        raise ValueError(f"parabolic trajectory (e = {el.e}) is not supported")
    return el.e < 1.0


def state_at(
    r0: ArrayLike, v0: ArrayLike, t: ArrayLike, mu: float = MU_EARTH
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Exact position and velocity at time(s) t after the state (r0, v0) (AN-5).

    Args:
        r0, v0: Initial state, shape (2,) [m], [m/s].
        t: Time or times since the initial state [s]; any finite real values.
        mu: Gravitational parameter [m^3/s^2].

    Returns:
        (r, v): shape (2,) for scalar t, else (N, 2).

    Raises:
        ValueError: invalid input, radial or parabolic trajectory.
        RuntimeError: Kepler's equation did not converge (never expected).
    """
    r0, v0, mu = _state(r0, v0, mu)
    t_arr = np.asarray(t, dtype=np.float64)
    if not np.all(np.isfinite(t_arr)):
        raise ValueError("t must be finite")
    el = _elements(r0, v0, mu)
    elliptic = _check_conic(el)
    e = el.e
    sense = 1.0 if el.h > 0.0 else -1.0
    if e == 0.0:
        p_hat = r0 / math.hypot(r0[0], r0[1])
    else:
        p_hat = el.e_vec / e
    q_hat = sense * np.array([-p_hat[1], p_hat[0]])
    alpha = abs(el.a)
    n = math.sqrt(mu / alpha**3)
    mean0 = _anomaly_to_mean(el.nu0, e, elliptic)
    mean = mean0 + n * np.atleast_1d(t_arr)
    if elliptic:
        turns = np.round(mean / (2.0 * math.pi))
        E = _solve_elliptic(mean - 2.0 * math.pi * turns, e)
        cos_nu_num = np.cos(E) - e
        sin_nu_num = math.sqrt(1.0 - e * e) * np.sin(E)
        radius = alpha * (1.0 - e * np.cos(E))
    else:
        H = _solve_hyperbolic(mean, e)
        cosh_m1 = _cosh_minus_one(H)
        cos_nu_num = (e - 1.0) - cosh_m1
        sin_nu_num = math.sqrt(e * e - 1.0) * np.sinh(H)
        radius = alpha * ((e - 1.0) + e * cosh_m1)
    # cos nu = cos_nu_num * a / r etc.; normalise instead, to avoid an extra rounding source
    norm = np.hypot(cos_nu_num, sin_nu_num)
    cos_nu, sin_nu = cos_nu_num / norm, sin_nu_num / norm
    vp = math.sqrt(mu / el.p)
    r_out = radius[:, None] * (cos_nu[:, None] * p_hat + sin_nu[:, None] * q_hat)
    v_out = vp * ((-sin_nu)[:, None] * p_hat + (e + cos_nu)[:, None] * q_hat)
    if t_arr.ndim == 0:
        return r_out[0], v_out[0]
    return r_out, v_out


def time_to_radius(r0: ArrayLike, v0: ArrayLike, radius: float, mu: float = MU_EARTH) -> float:
    """Earliest t > 0 at which |r(t)| = radius on the exact trajectory (AN-6) [s].

    Raises:
        ValueError: invalid input, radial or parabolic trajectory, or a radius
            the trajectory never reaches after t = 0.
    """
    r0, v0, mu = _state(r0, v0, mu)
    radius = as_positive_scalar(radius, "radius")
    el = _elements(r0, v0, mu)
    elliptic = _check_conic(el)
    e = el.e
    r_p = el.p / (1.0 + e)
    if radius < r_p or (elliptic and radius > el.p / (1.0 - e)):
        raise ValueError(f"the trajectory never reaches radius {radius} m")
    if e == 0.0:
        raise ValueError(f"a circular trajectory stays at radius {r_p} m")
    cos_target = min(1.0, max(-1.0, (el.p / radius - 1.0) / e))
    nu_target = math.acos(cos_target)
    n = math.sqrt(mu / abs(el.a) ** 3)
    mean0 = _anomaly_to_mean(el.nu0, e, elliptic)
    candidates = []
    for nu in (nu_target, -nu_target):
        dm = _anomaly_to_mean(nu, e, elliptic) - mean0
        if elliptic:
            dm = math.fmod(dm, 2.0 * math.pi)
            if dm <= 0.0:
                dm += 2.0 * math.pi
        if dm > 0.0:
            candidates.append(dm / n)
    if not candidates:
        raise ValueError(f"the trajectory never reaches radius {radius} m after t = 0")
    return min(candidates)
