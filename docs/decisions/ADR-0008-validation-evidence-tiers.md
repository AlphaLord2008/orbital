# ORBITAL ADR-0008: Validation evidence tiers

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decision D3 |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude; ChatGPT (review) |
| **Scope** | How Web Alpha labels the evidence behind any simulation run. |

**Decision:** every run shows exactly one of three tiers, decided by an exact match of its parameters against validated or tested cases. Similarity earns nothing.

## 1. Context

v0.1.0 validated one configuration. Web Alpha lets users run millions. The proposal's first draft had a single "envelope" badge using a dimensionless step criterion, which implied accuracy for configurations that were never tested. Review rejected it.

## 2. Tiers

| Tier | Label | Applies when | What it claims |
| --- | --- | --- | --- |
| 1 | **Validated reference** | Exactly V0: altitude 400 km, k = 1, Δt = 1 s, duration ≤ 10 orbits | Meets T3–T8 at the v0.1.0 tolerances |
| 2 | **Tested condition · ID** | Altitude, k and Δt bit-identical to a v0.1.1 case that has passed, and duration ≤ its tested duration | That case's measured errors against an exact solution, shown with its gates. Not that the error is small: P2 exists to show a large error |
| 3 | **Unvalidated** | Everything else | No accuracy claim |

## 3. Rules

1. **Exact match** on canonical float64 values after parsing. Altitude 401 km is Unvalidated even though 400 km is validated.
2. **Prefix inheritance.** A shorter duration of a tested configuration produces exactly a prefix of the tested trajectory (same samples, same t_k, bit for bit), so it keeps the tier. A longer one does not.
3. **Conservation cannot raise a tier.** v0.1 showed that a 0.01% error in μ passes every conservation test (T3–T5) and is caught only by analytic comparison (T6–T8).
4. **Not passed yet = Unvalidated.** A preset whose v0.1.1 case has not passed displays Unvalidated until it does.
5. Each tier label links to the methodology page entry for its test, with gates, measured values and the date of the run.

## 4. Cases (from `requirements-0.1.1.md`)

V0 (ISS), P1 (GEO), E1 (ellipse k = 1.10), X1 (escape k = 1.42, Δt = 1 s), I1 (impact k = 0.98), P2 (coarse step Δt = 60 s). All tolerances were pre-registered before the cases were run (SHA-256 of rev 1 posted 2026-11-23, 23:38 EST).

## 5. Why not a dimensionless criterion?

For circular orbits, scale invariance makes the error depend only on h = ω·Δt. P1 uses this to make *predictions*. A prediction is not a measurement, though, and eccentricity, escape and impact break the invariance. The pilot runs showed first-order energy error once e > 0. Labelling by similarity would claim exactly what review rejected.

## 6. Consequences

- Tier 2 is rare by design. Users exploring freely will mostly see Unvalidated, alongside run diagnostics that are clearly labelled self-consistency.
- Adding a tested condition means adding a pre-registered case to Python, passing it, and regenerating fixtures. Tiers grow with evidence.

## 7. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Accepted. |
