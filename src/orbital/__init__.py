"""ORBITAL: a two-body orbital mechanics simulator.

Version 0.1 ("First Orbit") is in development; docs/requirements-0.1.md
describes what it will provide.

Package rules (docs/requirements-0.1.md, I1-I8): this package imports only
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

__version__ = "0.1.0.dev0"

__all__ = [
    "MU_EARTH",
    "R_EARTH",
    "circular_initial_state",
    "circular_velocity",
    "gravity_accel",
    "semi_implicit_euler_step",
    "__version__",
]
