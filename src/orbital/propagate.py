"""Fixed-step orbit propagation (Requirements F3-F7; ADR-0002 §2.5-2.7).

Units are SI throughout: positions in m, velocities in m/s, times in s.
"""

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import ArrayLike, NDArray

from orbital._validation import as_positive_int, as_positive_scalar, as_vector2
from orbital.constants import MU_EARTH, R_EARTH
from orbital.dynamics import semi_implicit_euler_step

# F4: a duration within this relative distance of a whole number of steps
# counts as exactly that many steps, so 0.3 s / 0.1 s gives 3 steps, not 2.
_STEP_SNAP_TOLERANCE = 1e-9


@dataclass(frozen=True)
class Trajectory:
    """The result of a propagation: one sample per step, plus the initial state.

    Attributes:
        t: Sample times t_k = k * dt, shape (N,) [s].
        r: Positions, shape (N, 2) [m].
        v: Velocities, shape (N, 2) [m/s].
        dt: Timestep [s].
        n_steps_requested: Steps asked for. N - 1 is smaller if the run stopped early.
        status: "completed" (all steps taken) or "impact" (stopped at the surface).
        t_end: Time of the last sample [s]. For "impact" it is approximate: the
            crossing happened somewhere in the last step (F6).

    The dataclass is frozen and its arrays are read-only, so a result cannot be
    changed after the fact by plotting or analysis code.
    """

    t: NDArray[np.float64]
    r: NDArray[np.float64]
    v: NDArray[np.float64]
    dt: float
    n_steps_requested: int
    status: Literal["completed", "impact"]
    t_end: float


def steps_for_duration(duration: float, dt: float) -> int:
    """Number of whole fixed steps of size ``dt`` that fit in ``duration`` (F4).

    Computes q = duration / dt. If q is within a relative 1e-9 of a whole number
    m >= 1, returns m; otherwise returns floor(q). The run then ends at
    t_end = n * dt, which is less than one step short of ``duration`` and never
    more than a relative ~1e-9 beyond it (F5). A shortened final step is never
    used.

    Args:
        duration: Requested simulated time [s].
        dt: Timestep [s].

    Returns:
        The step count n >= 1.

    Raises:
        ValueError: If an argument is not finite and positive, or if
            ``duration`` is shorter than one step.
    """
    duration = as_positive_scalar(duration, "duration")
    dt = as_positive_scalar(dt, "dt")
    q = duration / dt
    if not math.isfinite(q):
        raise ValueError(f"duration / dt is too large to represent: {duration} / {dt}")

    nearest = round(q)
    if nearest >= 1 and abs(q - nearest) <= _STEP_SNAP_TOLERANCE * nearest:
        n = nearest
    else:
        n = math.floor(q)

    if n < 1:
        raise ValueError(f"duration ({duration} s) is shorter than one step (dt = {dt} s)")
    return int(n)


def propagate(
    r0: ArrayLike,
    v0: ArrayLike,
    dt: float,
    n_steps: int,
    mu: float = MU_EARTH,
    body_radius: float = R_EARTH,
) -> Trajectory:
    """Propagate a two-body orbit with ``n_steps`` fixed steps of semi-implicit Euler.

    After every step:
      * a non-finite position or velocity raises RuntimeError naming the step (F7);
      * |r| <= body_radius stops the run with status "impact", keeping that
        sample. Impact is detected only at steps, so its time is approximate (F6).

    Args:
        r0: Initial position, shape (2,) [m]. Must be outside the body.
        v0: Initial velocity, shape (2,) [m/s].
        dt: Timestep [s].
        n_steps: Number of steps to take, an integer >= 1. Use
            ``steps_for_duration`` to convert a duration.
        mu: Gravitational parameter of the central body [m^3/s^2].
        body_radius: Radius of the central body, for impact detection [m].

    Returns:
        A ``Trajectory`` holding the initial sample plus one sample per step taken.

    Raises:
        ValueError: If any input fails validation (Requirement I8), or the
            initial position is at or inside the body.
        RuntimeError: If the state becomes non-finite during the run.
    """
    r = as_vector2(r0, "r0")
    v = as_vector2(v0, "v0")
    dt = as_positive_scalar(dt, "dt")
    n_steps = as_positive_int(n_steps, "n_steps")
    mu = as_positive_scalar(mu, "mu")
    body_radius = as_positive_scalar(body_radius, "body_radius")
    if np.linalg.norm(r) <= body_radius:
        raise ValueError(f"r0 is at or inside the central body: |r0| <= {body_radius} m")

    # Preallocate one row per sample: the initial state plus n_steps steps.
    r_hist = np.empty((n_steps + 1, 2))
    v_hist = np.empty((n_steps + 1, 2))
    r_hist[0], v_hist[0] = r, v

    status = "completed"
    last = n_steps  # index of the last sample kept
    for k in range(1, n_steps + 1):
        r, v = semi_implicit_euler_step(r, v, dt, mu)
        if not (np.all(np.isfinite(r)) and np.all(np.isfinite(v))):
            raise RuntimeError(f"state became non-finite at step {k}: r = {r}, v = {v}")
        r_hist[k], v_hist[k] = r, v
        if np.linalg.norm(r) <= body_radius:
            status, last = "impact", k
            break

    count = last + 1
    t = np.arange(count) * dt  # t_k = k * dt by multiplication, never accumulated
    r_out = r_hist[:count].copy()
    v_out = v_hist[:count].copy()
    for array in (t, r_out, v_out):
        array.flags.writeable = False

    return Trajectory(
        t=t,
        r=r_out,
        v=v_out,
        dt=dt,
        n_steps_requested=n_steps,
        status=status,
        t_end=float(t[-1]),
    )
