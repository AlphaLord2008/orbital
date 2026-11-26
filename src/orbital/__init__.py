"""ORBITAL: a two-body orbital mechanics simulator.

Version 0.1.1: the validated v0.1.0 propagator ("First Orbit"), unchanged, plus
orbital.analytic, the exact two-body reference used to validate the Web Alpha
presets. See docs/requirements-0.1.md, docs/requirements-0.1.1.md and
docs/validation/.

Package rules (docs/requirements-0.1.md, I1-I8a): this package imports only
the Python standard library and NumPy, uses SI units at every public
interface, and performs no file I/O, printing or plotting. The public
interface is exactly what this module exports (I6).
"""

from orbital.constants import MU_EARTH, R_EARTH
from orbital.dynamics import (
    circular_initial_state,
    circular_velocity,
    gravity_accel,
    semi_implicit_euler_step,
)
from orbital.diagnostics import (
    angular_momentum_z,
    first_period,
    radius,
    specific_energy,
    speed,
)
from orbital.propagate import Trajectory, propagate, steps_for_duration
from orbital import analytic

__version__ = "0.1.1"

__all__ = [
    "MU_EARTH",
    "R_EARTH",
    "Trajectory",
    "analytic",
    "angular_momentum_z",
    "circular_initial_state",
    "circular_velocity",
    "first_period",
    "gravity_accel",
    "propagate",
    "radius",
    "semi_implicit_euler_step",
    "specific_energy",
    "speed",
    "steps_for_duration",
    "__version__",
]
