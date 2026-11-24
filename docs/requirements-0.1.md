# ORBITAL 0.1 — Requirements

**Status:** rev 3, accepted 2026-11-23 (rev 2 accepted 2026-10-28). Decisions behind these requirements are in [ADR-0001](decisions/ADR-0001-toolchain-and-core-boundary.md) and [ADR-0002](decisions/ADR-0002-frame-units-state.md). Changes are listed in §8.

ORBITAL 0.1 propagates one spacecraft around a point-mass Earth with a fixed-step semi-implicit Euler integrator, plots the result, and proves its numerical accuracy against the analytical circular orbit.

## 1. Constants and reference case

| Item | Value |
| --- | --- |
| μ_E | 3.986004418 × 10¹⁴ m³/s² (WGS 84; citation verified at implementation) |
| R_E | 6.378137 × 10⁶ m (WGS 84 equatorial) |
| Reference orbit | Circular, altitude 400 km, r₀ = R_E + 400,000 m = 6,778,137 m |
| Reference initial state | r₀ = (6,778,137, 0) m; v₀ = (0, √(μ_E/r₀)) m/s, **computed in float64 by `circular_velocity`**; counter-clockwise |
| Reference integrator, timestep | Semi-implicit Euler, Δt = 1 s |

v₀ ≈ 7,668.558175 m/s. That printed value is for reading only. No code or test may contain a rounded speed: rounding to 7,668.56 m/s adds a period error of 7.1 × 10⁻⁷, nearly as large as the 9.1 × 10⁻⁷ integrator error that T6 measures, and raises the one-orbit position error from 38.7 m to 69 m (pre-check).

## 2. Functional requirements

| ID | Requirement |
| --- | --- |
| F1 | `circular_velocity(r)` returns √(μ/r) in float64. `circular_initial_state(altitude)` returns r₀ = (R_E + altitude, 0) exactly on the +x axis and v₀ = (0, `circular_velocity(r₀)`), i.e. counter-clockwise. |
| F2 | `gravity_accel(r)` returns a = −μ r / \|r\|³. |
| F3 | `propagate(r0, v0, dt, n_steps)` validates its inputs (I8), then advances the state n_steps fixed steps of semi-implicit Euler and returns a `Trajectory` containing the initial sample plus one sample per completed step. Sample times are t_k = k·Δt, computed by multiplication in float64, never by repeated addition. |
| F4 | **Duration-to-steps conversion.** `steps_for_duration(duration, dt)` computes q = duration/Δt in float64 and m = the integer nearest to q. If m ≥ 1 and \|q − m\| ≤ 10⁻⁹·m, the duration is treated as an exact multiple of Δt and n = m. Otherwise n = ⌊q⌋. If n = 0 it raises `ValueError`. The snap only ever changes the result when q lies just *below* an integer; a q just above an integer floors to that integer anyway. See the case table below. |
| F5 | **End-time guarantee.** t_end = n·Δt. It falls short of the requested duration by less than one Δt, and it never exceeds the requested duration by more than a relative 10⁻⁹ plus floating-point rounding (the exact worst case is duration/(1 − 10⁻⁹); tests use the bound 2 × 10⁻⁹). In practice an overshoot comes only from floating-point representation (0.3 s at Δt = 0.1 s gives t_end = 0.30000000000000004 s, a relative excess of 1.9 × 10⁻¹⁶). A shortened final step is never taken. `Trajectory.t_end` stores t_end; the metrics script prints the requested duration and t_end side by side. |
| F6 | **Impact policy.** After every step, if \|r_k\| ≤ R_E the run stops, sample k is kept, and `status = "impact"`. Impact is detected only at integration steps: the reported impact time t_k is approximate, and the discrete trajectory crosses the surface somewhere in (t_{k−1}, t_k]. Event interpolation is not implemented in 0.1. |
| F7 | A non-finite value appearing in the state during a run stops it with a `RuntimeError` naming the step index. |
| F8 | **Diagnostics.** Radius, speed, specific energy ε = v²/2 − μ/r, specific angular momentum h = x·v_y − y·v_x, and `first_period(trajectory)`, defined in F8a. |
| F8a | **Period detection.** Precondition: the trajectory starts exactly on the positive x-axis (y₀ = 0, x₀ > 0) and moves counter-clockwise (h₀ > 0); otherwise `ValueError`. The first completed revolution is the first sample pair (k−1, k), k ≥ 1, with y_{k−1} < 0 ≤ y_k and x_k > 0. Its time is linearly interpolated: t* = t_{k−1} + Δt · (−y_{k−1}) / (y_k − y_{k−1}). The initial sample at t = 0 is never a crossing, because a crossing needs a preceding sample with y < 0. If no such pair exists, `ValueError`. Given the precondition, t* is the measured period. |
| F9 | Plot: Earth disk to scale, trajectory in km, equal aspect ratio, axis labels with units, annotation of initial state, integrator, Δt and t_end. Saved as PNG. |
| F10 | `pytest` runs every acceptance test; `scripts/first_orbit.py` prints the §6 metrics for the reference case and saves the plot. |

**F4 case table** (verified with float64 arithmetic):

| duration | Δt | q = duration/Δt | n | t_end | Why |
| --- | --- | --- | --- | --- | --- |
| 0.3 s | 0.1 s | 2.9999999999999996 | 3 | 0.30000000000000004 s | Just below an integer, within 10⁻⁹·m: snapped |
| 2.9999 s | 1 s | 2.9999 | 2 | 2 s | Below an integer by more than 10⁻⁹·m: floored |
| 3.0000001 s | 1 s | 3.0000001 | 3 | 3 s | Above an integer: floor gives 3 |
| 10 s | 3 s | 3.333… | 3 | 9 s | Not a multiple: floored, short by 1 s |
| 1 s | 2 s | 0.5 | 0 | — | Less than one step: `ValueError` |

## 3. Interface requirements (physics-core boundary)

These keep the engine usable by any future frontend without building for one now (ADR-0001).

| ID | Requirement |
| --- | --- |
| I1 | The `orbital` package imports only the Python standard library and NumPy. Matplotlib is used only in `scripts/`. |
| I2 | Public functions accept and return only Python scalars, NumPy float64 arrays and frozen dataclasses of those. |
| I3 | No file I/O, printing, plotting, global mutable state, randomness or clock reads inside the package. Same inputs on the same platform and library versions give identical outputs. |
| I4 | SI units at every public interface; every docstring states the unit of each argument and field. |
| I5 | Invalid inputs raise `ValueError`. Physical outcomes (completed, impact) are returned as data in `Trajectory.status`, never printed. |
| I6 | The public interface is exactly what `orbital/__init__.py` exports; everything else is internal and may change freely. |
| I7 | No web server, serialisation layer, async code or frontend dependency in 0.1. |
| I8 | **Input validation at every public entry point.** Position and velocity must convert to a NumPy float64 array of shape exactly (2,). Any other shape — (3,), (2, 1), (1, 2), a scalar — raises `ValueError` before any computation; NumPy broadcasting is never relied on. Complex, non-numeric or non-finite values raise `ValueError`. Real numeric input of another type (a list, integers) is accepted and converted. Inputs are copied into new float64 arrays, so a caller's arrays are never modified or aliased. Scalars Δt, μ, body radius and duration must be finite and > 0; n_steps must be an integer ≥ 1 (Python or NumPy integer; `bool` rejected). `propagate` validates once at entry; its internal loop may use unvalidated helpers for speed. |
| I8a | **Diagnostics accept one state or many.** `radius`, `speed`, `specific_energy` and `angular_momentum_z` accept position and velocity of shape exactly (2,) (one state) or (N, 2) with N ≥ 1 (one state per row). Every other shape raises `ValueError`; broadcasting is still never relied on, and r and v must have the same shape. All other I8 rules apply. One state returns a Python float; N states return a float64 array of shape (N,). |

Planned public interface (names may be refined during implementation; units SI):

```
circular_velocity(r, mu=MU_EARTH) -> float
circular_initial_state(altitude, mu=MU_EARTH, body_radius=R_EARTH) -> (r0, v0)
gravity_accel(r, mu=MU_EARTH) -> ndarray (2,)
semi_implicit_euler_step(r, v, dt, mu=MU_EARTH) -> (r_new, v_new)
steps_for_duration(duration, dt) -> int
propagate(r0, v0, dt, n_steps, mu=MU_EARTH, body_radius=R_EARTH) -> Trajectory
Trajectory: t (N,), r (N, 2), v (N, 2), dt, n_steps_requested, status, t_end   # arrays read-only
radius(r), speed(v), specific_energy(r, v, mu), angular_momentum_z(r, v), first_period(trajectory)
```

## 4. Nonfunctional requirements

| ID | Requirement |
| --- | --- |
| N1 | Correctness: every acceptance test in §6 passes. |
| N2 | Reproducibility: the validation report records initial state, constants with sources, integrator, Δt, n_steps, requested duration, t_end, Git commit, Python and NumPy versions, and every §6 metric. |
| N3 | Units: SI internally; km only in plot labels and printed output. |
| N4 | Performance: the 10-orbit reference case (55,536 steps) runs in under 10 s on a laptop with a plain Python loop. |
| N5 | Readability: small functions, type hints, unit-stating docstrings; the author can explain every line. |
| N6 | Dependencies: runtime NumPy; development Matplotlib and pytest. Nothing else. |

## 5. Product-direction constraint

ORBITAL's long-term direction is web-first and desktop-capable (selected 2026-10-28). React, TypeScript, Three.js, React Three Fiber, FastAPI and Tauri are **candidates, not approved dependencies**. 0.1 has no dependency on any of them, and no 0.1 requirement may be shaped around one of them beyond §3.

## 6. Acceptance tests

All tolerances are provisional until reproduced by the implementation and recorded in the validation report. "Pre-check" values come from a throwaway script run during planning, using the full-precision v₀.

| ID | Test | Acceptance criterion | Basis |
| --- | --- | --- | --- |
| T1 | Gravity: magnitude μ/r₀² = 8.676 m/s², direction toward the origin, a(2r) = a(r)/4 | Relative error ≤ 10⁻¹² for each, against the formulas. Plus one unit-sanity check: \|a(r₀)\| matches the reference value 8.676 m/s² ([reference-values.md](reference-values.md)) to 4 significant figures | Exact formula; roundoff only |
| T2 | One step from the reference state vs hand calculation | Relative error ≤ 10⁻⁹ in r and v | Arithmetic |
| T3 | Angular momentum: **accumulated** deviation over the full 10-orbit run | max over all samples of \|Δh/h₀\| ≤ 10⁻¹⁰ | Exact conservation proved for semi-implicit Euler. Tolerance ≈ 8× the worst-case accumulated roundoff over 55,536 steps (55,536 × 2.2 × 10⁻¹⁶ ≈ 1.2 × 10⁻¹¹); pre-check 6.9 × 10⁻¹⁵. For scale: explicit Euler changes h by ≈ 1.3 × 10⁻⁶ relative **per step** in the reference case, accumulating to ≈ 6.1 × 10⁻² over 10 orbits |
| T4 | Radius over 10 orbits | max \|r − r₀\|/r₀ ≤ 10⁻³, and max in orbit 10 ≤ 1.1 × max in orbit 1 | Pre-check 5.66 × 10⁻⁴; theory ωΔt/2 |
| T5 | Specific energy over 10 orbits | max \|Δε/ε₀\| ≤ 10⁻⁵, and max in orbit 10 ≤ 1.1 × max in orbit 1 | Pre-check 1.28 × 10⁻⁶ |
| T6 | First orbital period, detected per F8a | \|t* − T\|/T ≤ 10⁻⁵, T = 2π√(r₀³/μ) | Pre-check 9.1 × 10⁻⁷ |
| T7 | Position vs exact solution r₀(cos ωt_k, sin ωt_k), evaluated at the **same sample times t_k** | After n = `steps_for_duration(T, 1 s)` = 5,553 steps (t_end = 5,553 s): error ≤ 100 m. After 10 orbits (55,536 steps): recorded, not gated | Pre-check 38.7 m and 386 m |
| T8 | First-order behaviour | T4 metric at Δt = 10 s ÷ T4 metric at Δt = 1 s lies in [9, 11] | Pre-check 10.1 |
| T9 | Input, endpoint and diagnostic preconditions | Every case in the T9 case table behaves as specified | F4, F5, F7, F8a, I5, I8 |
| T10 | Impact | From r₀ = (R_E + 400 km, 0), v₀ = 0, Δt = 1 s: `status == "impact"`, last sample has \|r\| ≤ R_E, the one before has \|r\| > R_E | F6 |
| T11 | Plot integrity | Plotted line data equal `trajectory.r / 1000` element by element | F9 |
| T12 | Core boundary | In a fresh subprocess, `import orbital` leaves `matplotlib` absent from `sys.modules` (a subprocess, because other tests import Matplotlib) | I1 |

**T9 case table**

| Case | Expected |
| --- | --- |
| `gravity_accel` at the origin | `ValueError` |
| Position or velocity of shape (3,), (2, 1), (1, 2) or a scalar | `ValueError` |
| NaN, infinity or complex value in position or velocity | `ValueError` |
| `[6778137, 0]` as a list of integers | Accepted; stored as float64 |
| Caller's input arrays after `propagate` | Unchanged and not shared with the `Trajectory` |
| Δt ≤ 0, non-finite Δt, n_steps = 0, n_steps = `True` | `ValueError` |
| \|r₀\| ≤ R_E | `ValueError` |
| Each row of the F4 case table | n and t_end exactly as listed |
| Any `steps_for_duration` result | duration − Δt < t_end ≤ duration·(1 + 2 × 10⁻⁹) |
| `first_period` on a trajectory starting off the +x axis, or moving clockwise | `ValueError` |
| `first_period` on a trajectory shorter than one revolution | `ValueError` |

### If T3 fails

A T3 failure means something is wrong, but not necessarily the integrator. Investigate in this order before changing any code or tolerance:

1. Check `angular_momentum_z` on a hand-computable state.
2. Check that h₀ comes from exactly the state passed to `propagate`.
3. Check the update order: position must use the **new** velocity.
4. Check that `gravity_accel` is exactly parallel to r (no swapped components or sign errors).
5. Check for in-place mutation or aliasing of input arrays.
6. Plot \|Δh/h₀\| against step number. Steady growth of order k·10⁻¹⁶ suggests roundoff accumulation (a tolerance question); a jump or a growth rate near 10⁻⁶ per step suggests a logic error.

A tolerance may change only after this investigation, with the reason written in the validation report.

## 7. Out of scope for 0.1

3D motion; N-body; perturbations (J2, drag, solar radiation pressure, third bodies); orbital elements; maneuvers; adaptive timesteps; event interpolation for impact; the integrator comparison (0.2); animation, GUI, web or desktop frontends; serialisation or HTTP APIs; AI, voice and lessons. New ideas go to [`BACKLOG.md`](../BACKLOG.md).

## 8. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 3 | 2026-11-23 | I8a added: diagnostics accept shape (2,) or (N, 2), so a whole trajectory can be checked in one vectorised call (needed by T3–T7). Approved with Task 6. Scope unchanged |
| 2 | 2026-10-28 | F4/F5: tolerance rule and end-time guarantee made precise, resolving rev 1's contradiction (snapping 0.3/0.1 to 3 steps gives t_end slightly above 0.3); case table added. F8a: period detection defined, t = 0 excluded. I8: shape, finiteness and float64 validation. T3: per-step vs accumulated drift distinguished. T9: cases enumerated. T1: unit-sanity check against the reference value. Scope unchanged. Accepted 2026-10-28 |
| 1 | 2026-10-28 | First requirements after direction approval |
