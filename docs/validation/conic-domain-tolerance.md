# Conic-domain tolerance (frozen 2026-11-26)

**Applies to:** the analytic solution (`orbital.analytic.state_at`, TS `analytic.keplerOrbit`) against the 50-digit universal-variable references in `fixtures/v1/domain/`. It does not apply to the registered v0.1.1 cases, which keep REF-1 (1e-12) unchanged.

**Tolerance** (relative):

    tol = 1e-12 + 4 ε / |1 − e| + 8 ε |v| |t| / |r|,   ε = 2.220446e-16

- **Position** error is relative to |r|.
- **Velocity** error is relative to max(|v|, √(μ/p)).

**Rationale (conditioning of float64 inputs, not the solver):**
- **4 ε / |1 − e|:** 1 − e is determined by the float64 state only to about ε/|1 − e|, because the energy v²/2 − μ/r cancels.
- **8 ε |v| |t| / |r|:** time enters through the rounded product M = M₀ + n t.
- **Velocity scale:** the velocity is √(μ/p) · (−sin ν, e + cos ν), so √(μ/p) is its natural scale. It matters at the apoapsis of a near-escape ellipse, where |v| is only metres per second.
- **The solver itself** is tested separately: E matches mpmath to 4 ε relative at the same M.

**Provenance (disclosed).** This tolerance was set **after** observing the errors on the 11 cases in `fixtures/v1/domain/conics.json` (Batch B, a307875).
- The model came from the conditioning argument above.
- Its constants (4 and 8) were chosen with those observations in view.
- It is frozen from this commit: neither the formula nor the constants change to make a case pass.

**Hold-out check.** After freezing, `fixtures/v1/domain/conics-holdout.json` was generated with cases not used in choosing the tolerance: other altitudes, retrograde motion, non-perpendicular starts and other times. It is evaluated once against this tolerance, and its result is recorded in the commit that adds it. A hold-out failure is reported and root-caused, never absorbed by changing the tolerance.

**Hold-out result (evaluated once, 2026-11-26).** All 9 hold-out cases pass in Python, and in TS under both Node and Chromium; nothing was changed after the run. The table gives the worst error as a fraction of the tolerance:

| Case | e | err / tol |
|---|---|---|
| 2000 km, k = 1.405 | 0.97403 | 0.88 (1.0e-12) |
| GEO, k = 1.4141 | 0.99968 | 0.09 |
| 150 km, k = 1.41419 | 0.99993 | 0.05 |
| 10 000 km, e = 1 + 5e-9 | 1.000000005 | 0.11 (2.0e-8) |
| 400 km, k = 1.4145 | 1.00081 | 0.04 |
| 800 km, 120°, γ = 20°, k = 1.413 | 0.99697 | 0.07 |
| 600 km, retrograde, k = 1.4141 | 0.99968 | 0.02 |
| 1200 km, −45°, γ = −10°, k = 1.45 | 1.09955 | 0.00 |
| 300 km, 200°, e = 1 − 5e-9 | 0.999999995 | 0.06 |

The 2000 km case uses 88 % of its tolerance. Its tolerance is close to plain REF-1 because e is far from 1. This shows the REF-1 floor is not loose for e ≈ 0.97 at long times.
