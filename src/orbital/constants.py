"""Physical constants used by ORBITAL, in SI units (ADR-0002 §2.3).

Source: the WGS 84 defining parameters, NGA.STND.0036_1.0.0_WGS84
(National Geospatial-Intelligence Agency, 2014; supersedes NIMA TR8350.2),
as listed by NGA at https://earth-info.nga.mil/GandG/wgs84/ (checked 2026-11-22).

Only these defining values are typed in. Anything derived from them, such as
circular speed or orbital period, is computed at run time (ADR-0002 §2.4).
"""

MU_EARTH: float = 3.986004418e14
"""Earth's gravitational parameter GM, mass of the atmosphere included [m^3/s^2].

Used directly instead of G * M: G is known to about 2e-5 relative, GM to
about 2e-9. This is not the GPS value (3.9860050e14), which differs by
1.5e-7 relative; ORBITAL uses this one value everywhere.
"""

R_EARTH: float = 6_378_137.0
"""Earth's equatorial radius: the WGS 84 ellipsoid semi-major axis a [m]."""
