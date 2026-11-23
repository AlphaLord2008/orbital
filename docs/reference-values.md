# ORBITAL 0.1 — Reference values

**Task 1, completed 2026-11-21.** Computed in Python float64 (not derived by hand); all values agree with the 0.1 proposal. These are human-readable reference values. Tests compute their expected values from formulas (ADR-0002 §2.4); this file feeds only the T1 unit-sanity check.

A spacecraft in a 400 km circular orbit moves at 7,668.56 m/s and goes around once every 92.56 minutes.

## 1. Constants

| Constant | Value | Unit | Source |
| --- | --- | --- | --- |
| μ_E (GM, atmosphere included) | 3.986004418 × 10¹⁴ | m³/s² | WGS 84 defining parameter: NIMA TR8350.2; [ICG summary of WGS 84](https://www.unoosa.org/pdf/icg/2012/template/WGS_84.pdf) |
| R_E (semi-major axis) | 6,378,137.0 | m | Same |

Both values were confirmed on 2026-11-22 against NGA's [WGS 84 page](https://earth-info.nga.mil/GandG/wgs84/). The current WGS 84 standard is NGA.STND.0036_1.0.0_WGS84 (2014), which supersedes TR8350.2; `src/orbital/constants.py` cites it.

GPS uses a slightly different GM, 3.9860050 × 10¹⁴ m³/s². The two differ by 1.5 × 10⁻⁷ relative, about a sixth of the 9.1 × 10⁻⁷ integrator error that T6 measures. Mixing them would visibly bias the result, so ORBITAL uses one documented value everywhere.

## 2. Acceleration

Gravity pulls toward Earth's centre and **r** points away from it, so the force direction is −**r**/|**r**|:

```
F = −(G M m / |r|²) · (r / |r|)
a = F / m = −μ r / |r|³          (μ = G M)
a_x = −μ x / r³,   a_y = −μ y / r³
```

Checks: on the +x axis a_x = −μ/r², a_y = 0; on the +y axis a_x = 0, a_y = −μ/r²; units (m³/s²)·m / m³ = m/s².

## 3. Circular orbit

Gravity supplies exactly the centripetal acceleration:

```
v² / r = μ / r²   ⇒   v_c = √(μ / r),   T = 2π r / v_c = 2π √(r³ / μ)
```

Valid only for ideal two-body motion, with velocity exactly perpendicular to **r** and exactly equal to v_c.

## 4. Values at 400 km altitude

| Quantity | Formula | Value | Unit |
| --- | --- | --- | --- |
| Orbital radius r | R_E + 400 km | 6,778,137.0 | m |
| Circular speed v_c | √(μ/r) | 7,668.558175 | m/s |
| Period T | 2π√(r³/μ) | 5,553.624271 | s |
| Period T | T / 60 | 92.560405 | min |
| Gravitational acceleration \|a\| | μ/r² | 8.675951 | m/s² |
| Surface gravity g₀ | μ/R_E² | 9.798285 | m/s² |
| Ratio \|a\| / g₀ | — | 0.885456 | — |
| Specific energy ε | v_c²/2 − μ/r | −2.940339 × 10⁷ | J/kg |
| Specific angular momentum h | r·v_c | 5.197854 × 10¹⁰ | m²/s |

## 5. Checks

| Check | Result | Pass? |
| --- | --- | --- |
| ε equals −μ/(2r) | Agree to 1.3 × 10⁻¹⁶ relative (float64 roundoff) | Yes |
| Geostationary period at r = 42,164 km vs one sidereal day (86,164.1 s) | 86,163.57 s, relative difference 6.1 × 10⁻⁶ | Yes (< 10⁻⁴) |

The geostationary check uses the sidereal day, not the 86,400 s solar day: a geostationary satellite matches Earth's rotation relative to the stars.

**Altitude trap.** Using r = 400 km instead of R_E + 400 km gives v = 31,567 m/s (4.1× too fast) and puts the spacecraft 5,978 km inside Earth. `propagate` rejects that state with a `ValueError` because |r₀| ≤ R_E (Requirements T9, ADR-0002 §2.7).

## 6. Things to be able to explain

1. **Why spacecraft mass disappears.** The same m appears in the gravity law and in F = ma; a heavier craft is pulled harder but is equally harder to accelerate, so m cancels.
2. **Why 2D is exact.** A central force conserves **h** = **r** × **v**; its direction is fixed, so motion stays in the plane of r₀ and v₀.
3. **Why μ instead of G × M.** G is known to about 2 parts in 10⁵; μ_E, from satellite tracking, to about 1 part in 10⁹.
4. **Altitude vs radius.** r = R_E + altitude. Confusing them makes the speed 4× too fast and the start point inside Earth.
5. **Why a circular-looking plot proves nothing.** Explicit Euler's first orbit looks circular but its period is already off by 1%. Correctness is shown by tests T3–T7.
