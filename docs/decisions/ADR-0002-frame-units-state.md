# ORBITAL ADR-0002: Reference frame, units, constants and state representation

| | |
| --- | --- |
| **Status** | Accepted (2026-10-28) |
| **Date** | 2026-10-28 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude (software architecture); ChatGPT (review) |
| **Scope** | ORBITAL 0.1 physics engine. Unrelated to DELTA ADR-0001. |

**Decision:** model 0.1 in a 2D, non-rotating, Earth-centred inertial frame using SI units and float64; represent the state as separate position and velocity arrays; advance it in a whole number of fixed steps with a reported end time; and detect surface impact at step boundaries only.

## 1. Context

Every later ORBITAL milestone, and every future frontend, will consume the engine's state and outputs. Frame, units, constants and state layout are cheap to choose now and expensive to change later. Two policies also need fixing before implementation: how a requested duration maps onto fixed steps, and how impact with Earth is reported.

## 2. Decisions

### 2.1 Reference frame and model

An **idealised** Earth-centred inertial frame: origin at Earth's centre, axes fixed relative to distant stars, no rotation. Earth is a point mass fixed at the origin, and every external gravitational influence (Sun, Moon, planets) and every non-gravitational force is neglected. Under these idealisations the frame is treated as exactly inertial; the real Earth-centred frame is only approximately inertial, because Earth itself accelerates around the Sun. Two-body motion stays in the plane of r₀ and v₀, so 2D is exact for this model.

### 2.2 Units and precision

SI throughout (m, s, m/s, m/s², J/kg, m²/s); NumPy float64. Unit conversion only at output edges (plot labels, printed tables).

### 2.3 Constants

| Constant | Value | Source |
| --- | --- | --- |
| μ_E | 3.986004418 × 10¹⁴ m³/s² | WGS 84 |
| R_E | 6.378137 × 10⁶ m | WGS 84 equatorial radius |

μ is used directly, never computed as G·M: G is known to about 2 × 10⁻⁵, μ_E to about 10⁻⁹. Both values appear in the WGS 84 definition (NIMA TR8350.2) and in the [ICG summary of WGS 84](https://www.unoosa.org/pdf/icg/2012/template/WGS_84.pdf); `constants.py` cites the document and table.

### 2.4 Derived values are computed, never typed

Any value derived from constants, such as circular speed √(μ/r), is computed in float64 at run time. Rounded literals are not allowed in code or tests. Evidence: rounding v₀ to 7,668.56 m/s changes the first-orbit period error from 9.1 × 10⁻⁷ to 1.6 × 10⁻⁶ and the one-orbit position error from 38.7 m to 69 m (pre-check). The rounding error would be mistaken for integrator error.

### 2.5 State representation

| Item | Representation |
| --- | --- |
| Position, velocity | Separate NumPy float64 arrays, shape (2,) |
| Time | t_k = k·Δt, computed by multiplication, never accumulated |
| Output | Frozen `Trajectory` dataclass: `t` (N,), `r` (N, 2), `v` (N, 2), `dt`, `n_steps_requested`, `status`, `t_end`; arrays marked read-only |
| Spacecraft mass | Not represented (cancels in the acceleration) |

Public functions validate state inputs (shape exactly (2,), finite, real, converted to float64; Requirements I8), return new arrays and never modify their inputs.

### 2.6 Timestep and endpoint policy

- Δt is fixed for the whole run.
- The engine takes an integer step count. `steps_for_duration(duration, Δt)` computes q = duration/Δt; if the nearest integer m ≥ 1 satisfies |q − m| ≤ 10⁻⁹·m, n = m, otherwise n = ⌊q⌋ (0.3/0.1 = 2.9999999999999996 gives 3; 2.9999/1 gives 2). n = 0 is an error.
- t_end = n·Δt is stored in the `Trajectory` and reported beside the requested duration. It falls short by less than one Δt and exceeds the duration by at most a relative 10⁻⁹ plus floating-point rounding (0.3 s at Δt = 0.1 s gives t_end = 0.30000000000000004 s). Exact rules and cases: Requirements F4–F5.
- No shortened final step. A different last Δt would mix two step sizes into the error that 0.1 and 0.2 are trying to measure.
- Validation compares against analytical results at the sample times t_k actually reached, not at the requested duration.

### 2.7 Impact policy

- |r₀| ≤ R_E is invalid input (`ValueError`).
- After each step, |r_k| ≤ R_E ends the run with `status = "impact"`; sample k is kept.
- Impact is detected only at step boundaries. The reported impact time t_k is approximate: the discrete trajectory crosses the surface in (t_{k−1}, t_k], and the integration itself adds error.
- Event interpolation is not implemented in 0.1.

## 3. Options considered

| Choice | Alternative | Why not now |
| --- | --- | --- |
| 2D | 3D (shape (3,)) | Adds nothing for two-body motion; deferred to 0.6. Vector code uses `np.linalg.norm` and avoids hard-coded indices so the change stays small |
| Metres | Kilometres (μ = 398,600.4418 km³/s², common in astrodynamics texts) | Both work in float64; metres match SI physics coursework and avoid mixed-unit formulas |
| Separate r, v | Packed y = [x, y, v_x, v_y] | Semi-implicit Euler treats r and v differently; packing revisited in 0.2 if RK4 needs it |
| float64 | float32 | float32 carries ≈ 7 significant digits. Representable spacing: adjacent values near 7 × 10⁶ m are 0.5 m apart. Accumulated error: per-operation rounding of ≈ 6 × 10⁻⁸ can build up over 55,536 steps to a worst case of order 10⁻³ relative, larger than the 10⁻⁴–10⁻⁶ effects 0.1 must resolve. float64 (rounding ≈ 1.1 × 10⁻¹⁶ per operation) keeps both far below them |
| Floor to whole steps | Shortened final step; round up past the duration | A short final step contaminates error measurement; overshooting simulates time not asked for |
| Step-boundary impact | Interpolated or root-found impact event | Not needed until a milestone uses impact time quantitatively |

## 4. Consequences

**Positive**

- Unambiguous inputs and outputs for every later milestone and frontend.
- Measured errors are dominated by integrator error. Endpoint artefacts are excluded by design (sample-time comparison, no partial step) and rounded literals by §2.4. Floating-point roundoff remains in every result, but in float64 it accumulates at worst to ≈ 10⁻¹¹ relative over the reference run, orders of magnitude below the integrator errors measured in T4–T8. Roundoff dominates only where the exact answer is zero, as in T3, whose tolerance is set from the roundoff bound.

**Negative / accepted costs**

- A run may end up to one Δt before the requested duration; callers must use t_end.
- Impact times carry up to one step of timing error.
- The h formula (x·v_y − y·v_x) is 2D-specific and changes when 3D arrives.

## 5. Revisit when

- 3D motion is scoped (0.6).
- RK4 or another method needs a packed state (0.2).
- A milestone needs precise event times: impact, apsis passage or burn timing (0.4 maneuvers at the latest).

## 6. Validation

Requirements acceptance tests T1–T12, in particular T7 (comparison at sample times), T9 (endpoint policy) and T10 (impact policy).

## 7. Related

- [0.1 Requirements](../requirements-0.1.md), §1, §2 and §6.
- [ORBITAL ADR-0001](ADR-0001-toolchain-and-core-boundary.md) (toolchain and core boundary).

## 8. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-10-28 | Accepted after independent review: frame described as idealised ECI with external influences neglected; float32 rationale covers spacing and accumulated error; error-attribution statement now accounts for floating-point roundoff; constant sources linked |
| 0 | 2026-10-28 | Proposed |
