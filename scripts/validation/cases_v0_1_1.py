"""The six registered v0.1.1 cases (docs/requirements-0.1.1.md §5), as data.

Shared by the case runner, the mpmath reference and the fixture generator so all
three start from the identical float64 initial state. Initial state (WA-F2):
r0 = (R_E + altitude, 0), v0 = (0, k * sqrt(mu / r0)), computed in float64.
"""

import math
from dataclasses import dataclass

from orbital import MU_EARTH, R_EARTH

OMEGA_EARTH = 7.292115e-5  # WGS 84 nominal Earth rotation rate [rad/s]
GEO_ALTITUDE = (MU_EARTH / OMEGA_EARTH**2) ** (1.0 / 3.0) - R_EARTH  # 35,786,035.931157 m


@dataclass(frozen=True)
class Case:
    id: str
    altitude: float  # [m]
    k: float  # speed factor v0 / v_circ
    dt: float  # [s]
    span: str  # how n_steps is chosen: "orbits:<n>", "steps:<n>" or "until-impact"

    @property
    def r0(self) -> tuple[float, float]:
        return (R_EARTH + self.altitude, 0.0)

    @property
    def v0(self) -> tuple[float, float]:
        radius = R_EARTH + self.altitude
        return (0.0, self.k * math.sqrt(MU_EARTH / radius))


CASES = {
    "V0": Case("V0", 400_000.0, 1.0, 1.0, "orbits:10"),
    "P1": Case("P1", GEO_ALTITUDE, 1.0, 10.0, "orbits:2"),
    "E1": Case("E1", 400_000.0, 1.10, 1.0, "orbits:2"),
    "X1": Case("X1", 400_000.0, 1.42, 1.0, "steps:86400"),
    "I1": Case("I1", 400_000.0, 0.98, 1.0, "until-impact"),
    "P2": Case("P2", 400_000.0, 1.0, 60.0, "orbits:10"),
}
