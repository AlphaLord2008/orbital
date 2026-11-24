# ORBITAL ADR-0005: Display fidelity policy

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decision D6 |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude; ChatGPT (review) |
| **Scope** | Everything the Web Alpha UI draws or prints from a simulation result. |

**Decision:** numbers come only from computed samples. Motion may be interpolated. Lines are made of computed samples. The display never implies physics or evidence that does not exist.

## 1. Rules

| ID | Rule | Reason |
| --- | --- | --- |
| R1 | Readouts show sample k = min(⌊t_play/Δt⌋, N − 1), labelled with its time and index. Scrubbing while paused snaps to samples. | Every number can be reproduced from the CSV export or the Python engine |
| R2 | The marker uses cubic Hermite interpolation between samples k and k+1 (positions and velocities). It is display only and never feeds a number. | A linear marker would leave the line: chord sagitta 3.9 km at Δt = 60 s, against 0.37 m for Hermite |
| R3 | The line is drawn through samples chosen by Ramer–Douglas–Peucker, ε = 100 m (about 1/6 px at the closest zoom). Vertex cap 20,000; ε doubles until the line fits, and the achieved ε is reported. | Never invents a point; adapts to curvature |
| R4 | Bound orbits: past solid from the start of the current revolution, future dashed to its end, revolutions counted at +x-axis crossings (same rule as `first_period`). Unbound or impact: past from t = 0, future to t_end. | On closed orbits all revolutions overlap; a per-revolution split keeps past and future readable |
| R5 | The only non-sample vertex is the join at the playhead, which is the Hermite marker position. | Keeps R3 true except at one disclosed point |
| R6 | Drift plots use min–max bucketing per pixel column. | Peaks are the finding and must never be decimated away |
| R7 | Impact is drawn at the detecting sample (\|r\| ≤ R_E), labelled "detected at step boundary"; no extrapolation to the surface. | v0.1 semantics |
| R8 | The analytic overlay (WA-F14) is computed by the analytic module, drawn dotted in the reference colour, with a ghost marker at the exact position for t_play. It never uses integrator output. | Shows integration error honestly |
| R9 | No Sun lighting, terminator, starfield, ground track or real-date implication. | Not modelled (ADR-0004) |
| R10 | Evidence labels follow ADR-0008 exactly. Run diagnostics are captioned "self-consistency, not accuracy". | v0.1 finding: a wrong μ passes conservation checks |

## 2. Evidence from WA-0 (design renders, 2026-11-23)

The V0 reference case, at mid-orbit (t = T/2) at the closest camera distance:

- integrated and exact **positions at the same instant** differ by 15.3 km along-track;
- the radius differs by 9 m, so the two **paths** overlap on screen.

Without R8's ghost marker this error would be invisible. With it, the user sees about 25 px of separation at the closest zoom on a 900 px-tall viewport. The same error falls to 38.7 m after a full revolution (T7). This is a property of semi-implicit Euler that the methodology page must explain.

## 3. Consequences

The display layer needs its own tests: decimation (max deviation ≤ ε, first and last samples kept, indices increasing), Hermite (exact at endpoints, error bound on a circle), clock (clamp, rates), formatting (units, minus sign, significant figures), and revolution splitting.

## 4. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Accepted. R4 (revolution rule) and R8 (ghost marker) added from WA-0 design findings. |
