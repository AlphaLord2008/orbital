/**
 * Physical constants, SI units (port of orbital/constants.py; ADR-0002 §2.3).
 * WGS 84 defining parameters, NGA.STND.0036_1.0.0_WGS84. Only defining values are typed in.
 */

/** Earth's gravitational parameter GM [m^3/s^2]. */
export const MU_EARTH = 3.986004418e14;

/** Earth's equatorial radius, the WGS 84 ellipsoid semi-major axis [m]. */
export const R_EARTH = 6_378_137.0;
