# ORBITAL v0.1.1 — Focused Validation of Web Alpha Scenarios

**Status:** Pre-registered, revision 1 (2026-11-23). Approved scope: Web Alpha proposal rev 2, decisions D2, D3, D14.
**Applies to:** the `orbital` Python package, version 0.1.1.
**Rule:** every tolerance in this document was fixed **before** the case it governs was first run. Nothing here may be loosened after a run to make a case pass (section 7).

## 1. Purpose

Web Alpha exposes six preset scenarios. v0.1.0 validated only one of them, the 400 km circular reference. v0.1.1 measures the engine's error on each preset against an exact two-body solution. A preset may carry the label **Tested condition** (ADR-0008) only after its case passes.

v0.1.1 does **not** add integrators or begin ORBITAL 0.2.

## 2. Preservation rules (gating)

| ID | Rule |
|---|---|
| PR-1 | The `v0.1.0` tag is never moved or recreated. |
| PR-2 | No existing module's behaviour changes. `constants`, `dynamics`, `propagate`, `diagnostics` and `_validation` are untouched. A diff against `v0.1.0` may show changes in these files only to docstrings that point to the new module. |
| PR-3 | All 166 v0.1.0 tests pass **unmodified** on Python 3.11 and 3.12. |
| PR-4 | v0.1.0 tolerances (T1–T12) are unchanged. V0 below re-runs them; it does not redefine them. |
| PR-5 | The new module obeys the core boundary I1–I8a: standard library and NumPy only, SI units, `ValueError` for bad input, no I/O, no plotting. The T12 subprocess check covers it. |
| PR-6 | Version is 0.1.1 (D14). Release notes state that it is additive and changes no existing behaviour. |

## 3. New module: `orbital.analytic`

Exact two-body solutions for a point-mass central body, used as the reference for every case below.

| ID | Function (indicative names) | Requirement |
|---|---|---|
| AN-1 | `elements(r, v, mu)` | Returns ε, h, eccentricity vector and magnitude e, semi-major axis a (negative for hyperbolic), argument of periapsis ω, true anomaly ν₀. Validates as `_validation` does. |
| AN-2 | `classify(r, v, mu)` | `"bound"` if ε < 0, `"escape"` if ε ≥ 0. Impact is a property of a trajectory, not of a state, so it is not decided here. |
| AN-3 | `apsides(r, v, mu)` | r_p = a(1 − e) always; r_a = a(1 + e) only when bound. |
| AN-4 | `period(r, v, mu)` | 2π√(a³/μ) when bound; `ValueError` otherwise. |
| AN-5 | `state_at(r0, v0, t, mu)` | Exact position and velocity at time t (scalar or array). Elliptic: Kepler's equation M = E − e sin E. Hyperbolic: M = e sinh H − H. Both solved by Newton iteration to \|ΔE\| ≤ 10⁻¹⁵ (relative for H), at most 100 iterations, `RuntimeError` if it does not converge. Parabolic (\|e − 1\| < 10⁻⁹): `ValueError`; no preset is near it. |
| AN-6 | `time_to_radius(r0, v0, radius, mu)` | Earliest t > 0 at which \|r(t)\| = radius on the trajectory. `ValueError` if never reached. Used by I1. |

**Unit tests (AN-T):**

1. Circular state: e = 0 within 10⁻¹⁵, a = r₀, period = 2π√(r₀³/μ).
2. Vis-viva v² = μ(2/r − 1/a) holds within 10⁻¹⁴ relative at 50 states sampled along E1 and X1 reference orbits.
3. Round trip: `state_at(r0, v0, 0)` returns (r0, v0) within 10⁻¹² relative.
4. Periodicity: `state_at(r0, v0, T)` returns r0 within 10⁻⁹ relative (bound cases).
5. Hand-checkable apsides: k = 1.10 from periapsis gives r_a = 10,381,703.506 m (closed form a(1+e) with a = r₀/(2 − k²)).
6. Error paths: zero radius, non-finite input, parabolic e, unreachable radius.

## 4. Independent reference (gating)

The analytic module is new code, so it is checked against a second, independent implementation before anything trusts it:

- `scripts/reference_mp.py` recomputes every reference quantity in this document with **mpmath at 50 significant digits**. It is written separately: its own element and Kepler code, sharing nothing with `orbital.analytic` except the WGS 84 constants. mpmath becomes a development dependency only; runtime stays NumPy-only.
- **REF-1:** every reference value used by a case agrees between `orbital.analytic` (float64) and `reference_mp.py` (rounded to float64) within 10⁻¹² relative. Times-of-flight agree within 10⁻⁶ s.
- The fixtures store the mpmath values. The TypeScript engine is validated against these stored values (section 6), not against Python engine output, so analytic validation of the TS port is independent of Python–TS conformance.

## 5. Validation cases

Initial state for every case (WA-F2): r₀ = (R_E + altitude, 0), v₀ = (0, k·√(μ/r₀)). Positions are compared with the exact solution **at the same sample times t_k** (as T7). "n₁" means `steps_for_duration(T, dt)`, the last whole step at or before one period.

Throughout, h = ω·Δt is the dimensionless step. ω is the circular angular rate for V0, P1 and P2, and the periapsis angular rate for E1.

### V0 — ISS preset (the v0.1.0 reference)

400 km, k = 1, Δt = 1 s, 10 orbits. **Gates: T3–T8 exactly as in `requirements-0.1.md` rev 3.** No new tolerances.

### P1 — GEO preset

Altitude (μ/ω_E²)^(1/3) − R_E = 35,786,035.931157 m in float64 (ω_E = 7.292115 × 10⁻⁵ rad/s, WGS 84). k = 1, Δt = 10 s, 2 orbits (17,232 steps). Period T = 2π/ω_E = 86,164.100637 s.

**Scale invariance.** Written in units of r₀ and 1/ω, the semi-implicit Euler map for a circular orbit depends only on h = ω·Δt. Every relative error of P1 therefore equals V0's error function evaluated at h₁ = 7.292115 × 10⁻⁴ instead of h₀ = 1.131367 × 10⁻³ (ratio ρ = 0.64454). This gives P1 quantitative **predictions**, not just bounds.

| ID | Metric | Gate | Prediction (gated: measured within ±10%) | Basis |
|---|---|---|---|---|
| P1-a | max \|Δh/h₀\| | ≤ 10⁻¹⁰ | — | T3 analogue; h is conserved exactly in exact arithmetic |
| P1-b | max \|r − r₀\|/r₀ | ≤ 10⁻³ | 3.646 × 10⁻⁴ | Theory h/2 (order 1), as T4 |
| P1-c | max \|Δε/ε₀\| | ≤ 10⁻⁵ | 5.318 × 10⁻⁷ | V0 1.28 × 10⁻⁶ × ρ² (order 2) |
| P1-d | first-period relative error | ≤ 10⁻⁵ | 3.768 × 10⁻⁷ | V0 9.07 × 10⁻⁷ × ρ² (order 2) |
| P1-e | position error at n₁ = 8,616 steps | ≤ 1.5 × 10⁻⁵ · r₀ (632 m) | 100.0 m | V0 T7 38.7 m / r₀(V0) × ρ² × r₀(P1); T7's relative gate |

A prediction miss beyond ±10% fails the case even if the gate passes: it would mean the error behaviour is not understood.

### E1 — Ellipse preset

400 km, k = 1.10 (starts at periapsis), Δt = 1 s, 2 orbits (15,818 steps). a = 8,579,920.253 m, e = 0.210000, r_a = 10,381,703.506 m, T = 7,909.2601 s. h at periapsis = 1.2445 × 10⁻³.

**Energy error is first order for eccentric orbits.** Semi-implicit Euler conserves a modified energy H̃ = H ± (Δt/2)·v·∇V + O(Δt²). On a circle v·∇V = 0, which is why V0's energy error is O(h²). With e > 0, the leading-order energy oscillation is (Δt/2)·max(μ\|ṙ\|/r²)/\|ε\|. For E1 that is **2.016 × 10⁻⁴**, so v0.1's 10⁻⁵ energy gate does not apply.

| ID | Metric | Gate | Prediction | Basis |
|---|---|---|---|---|
| E1-a | max \|Δh/h₀\| | ≤ 10⁻¹⁰ | — | Central force: h conserved |
| E1-b | max \|Δε/ε₀\| | ≤ 4.0 × 10⁻⁴ (2× prediction) | 2.016 × 10⁻⁴, gated ±5% | Modified-energy theory above |
| E1-c | first-period relative error | ≤ 10⁻⁵ | — | T6 gate; pilots 0.9–1.4 × 10⁻⁶ |
| E1-d | \|max\|r\| in orbit 1 − r_a\| / r_a | ≤ 10⁻⁴ | — | Pilots 1.5–2.5 × 10⁻⁶ |
| E1-e | position error at n₁ = 7,909 steps | ≤ 500 m | — | Pilots 48–173 m; sub-pixel at the closest zoom (≈ 600 m/px) |
| E1-f | max position error over orbit 1, ratio Δt = 1 s ÷ Δt = 0.1 s | in [9, 11] | — | First order (pilots 9.99, 9.98) |
| E1-r | max position error over orbit 1 | recorded | — | Mid-orbit error is first order and large (pilots 16–23 km); it nearly cancels each revolution |

### X1 — Escape preset

400 km, k = 1.42 (starts at periapsis), Δt = 1 s, 1 day (86,400 steps). ε = +4.822 × 10⁵ J/kg (0.00820 μ/r₀), v∞ = 982.05 m/s, e = 1.0164. Reaches r ≈ 244,246 km at 1 day. ε₀ is small, so energy error is normalised by μ/r₀.

Δt is 1 s, not the 10 s the proposal used for X1 and C5: 86,400 steps is within the normal-size budget, and the smaller step keeps the preset accurate. This is a routine change recorded here.

| ID | Metric | Gate | Prediction | Basis |
|---|---|---|---|---|
| X1-a | max \|Δh/h₀\| | ≤ 10⁻¹⁰ | — | Central force |
| X1-b | max \|Δε\| / (μ/r₀) | ≤ 1.0 × 10⁻³ | 2.089 × 10⁻⁴ (leading order), gated ±10% | Modified energy; pilot k = 1.45 predicted 2.184 × 10⁻⁴, measured 2.188 × 10⁻⁴ |
| X1-c | ε_k > 0 for every sample; status `completed` | exact | — | Escape classification |
| X1-d | \|Δr\|/\|r_exact\| at t = 1 h, 6 h, 24 h | ≤ 2 × 10⁻³ | — | Pilot ≈ 7 × 10⁻⁴; far below a pixel at fit-to-orbit zoom |
| X1-e | max position error over the first hour, ratio Δt = 1 s ÷ Δt = 0.1 s | in [9, 11] | — | First order (pilot 10.00) |

### I1 — Impact preset

400 km, k = 0.98 (starts at apoapsis), Δt = 1 s. a = 6,519,947.095 m, e = 0.039600, r_p = 6,261,757.190 m (116.4 km below the surface). Exact surface crossing t* = **1,822.294 s**, radial speed there 264.50 m/s, flight-path angle 1.897°.

**Grazing amplifies timing error.** At 1.9°, a radial position error δr shifts the crossing time by δr / v_r = 0.378 s per 100 m. The integrator's first-order mid-orbit errors are kilometres (E1-r), so a timing error of several seconds is expected. The pilot at k = 0.97 detected impact 8.37 s early at Δt = 1 s and 0.77 s early at Δt = 0.1 s.

| ID | Metric | Gate | Prediction | Basis |
|---|---|---|---|---|
| I1-a | status `impact`; \|r_N\| ≤ R_E < \|r_(N−1)\| | exact | — | v0.1 step-boundary semantics |
| I1-b | \|t_N − t*\| at Δt = 1 s | ≤ 30 s | — | Pilot 8.4 s at a steeper angle; grazing amplification |
| I1-c | \|t_N − t*\| at Δt = 0.1 s | ≤ 3 s | — | First order + 0.1 s quantisation |
| I1-d | ratio of I1-b to I1-c errors | in [7, 14] | — | First order with step quantisation (pilot 10.9) |
| I1-e | max \|Δh/h₀\| up to impact | ≤ 10⁻¹⁰ | — | Central force |
| I1-f | max \|Δε/ε₀\| up to impact | ≤ 1.0 × 10⁻⁴ (2× prediction) | 4.783 × 10⁻⁵ (leading order), gated ±10% | Modified energy over the arc from apoapsis to ν = 301.40° |

### P2 — Coarse-step preset

400 km, k = 1, Δt = 60 s, 10 orbits (925 steps). h = 0.0679. It is no longer small, so leading-order predictions are only indicative. P2 exists to show a large error, not to bound one.

| ID | Metric | Gate | Recorded with indicative prediction |
|---|---|---|---|
| P2-a | max \|Δh/h₀\| | ≤ 10⁻¹⁰ | — |
| P2-r1 | max \|Δε/ε₀\| | recorded | h² ≈ 4.6 × 10⁻³ |
| P2-r2 | max \|r − r₀\|/r₀ | recorded | h/2 ≈ 0.034 |
| P2-r3 | first-period relative error | recorded | — |
| P2-r4 | position error at n₁ and after 10 orbits | recorded | — |

**Disclosure:** P2's energy and period errors over 2 orbits (4.61 × 10⁻³ and 3.26 × 10⁻³) were observed during the Web Alpha proposal spike, before this plan existed. That is why only h is gated for P2.

## 6. TypeScript analytic validation (WA-2, independent of conformance)

The TS engine must pass every gate in section 5 on its own, against the mpmath reference values stored in fixtures. It must not compare against Python engine output. Cases TS-V0 … TS-P2 carry the same IDs, gates and predictions. TS's own `analytic` port must reproduce the stored reference values within REF-1's tolerances.

Python–TS conformance (proposal §9: C1–C8, relative 10⁻¹¹) is a separate, additional requirement. Passing one does not excuse the other.

## 7. Procedure

1. **Freeze.** This document is committed before `orbital.analytic` or any case runner exists in the repository. Its SHA-256 was also posted in the project conversation on 2026-11-23, before any registered configuration was propagated.
2. **Implement** `orbital.analytic`, AN-T tests and `reference_mp.py`; pass REF-1.
3. **Run each case once** and record every metric, gated or not, in `docs/validation/v0.1.1-web-alpha-presets.md`.
4. **On a failure:** root cause first (engine, reference, test harness, or the theory behind the tolerance). A tolerance may change only through a new revision of this document that states what was wrong with the original reasoning. The affected preset ships as **Unvalidated** until a case passes under a revision justified before its own run.
5. **Release** v0.1.1 only when PR-1 … PR-6, REF-1 and every gated metric pass.

### Pilot evidence used to set tolerances

These configurations were run to calibrate the theory. None is a registered case, and none can earn a tier.

| Pilot | Δt | Result |
|---|---|---|
| Ellipse k = 1.05 | 1 s | energy 1.040 × 10⁻⁴ (prediction 1.033 × 10⁻⁴); period 9.04 × 10⁻⁷; apoapsis 2.46 × 10⁻⁶; position at n₁ 47.7 m; max over orbit 16.25 km; convergence ratio 9.99 |
| Ellipse k = 1.20 | 1 s | energy 4.619 × 10⁻⁴ (prediction 4.608 × 10⁻⁴); period 1.42 × 10⁻⁶; apoapsis 1.52 × 10⁻⁶; position at n₁ 173.3 m; max over orbit 22.78 km; ratio 9.98 |
| Escape k = 1.45 | 1 s | relative position error 6.96–7.43 × 10⁻⁴ at 1 h / 6 h / 24 h; energy 2.188 × 10⁻⁴ μ/r₀ (prediction 2.184 × 10⁻⁴); ratio 10.00 |
| Impact k = 0.97 | 1 s, 0.1 s | detected 8.37 s and 0.77 s before the exact crossing |

## 8. Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-23 | Pre-registered. |
