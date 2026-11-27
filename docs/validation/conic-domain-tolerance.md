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
