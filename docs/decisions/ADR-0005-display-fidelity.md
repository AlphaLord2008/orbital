# ORBITAL ADR-0005: Display fidelity policy

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decision D6; revision 2 accepted with design approval G1 (2026-11-25); revision 3 records the G1 implementation considerations |
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
| R7 | Numerical impact is drawn at the detecting sample (\|r\| ≤ R_E) and labelled "Numerical impact detected · sample N"; the run is never extrapolated to the surface. (Rev 2: see R14 for the analytical crossing.) | v0.1 semantics |
| R8 | The analytic overlay (WA-F14) is computed by the analytic module, drawn dotted in the reference colour, with a ghost marker at the exact position for t_play. It never uses integrator output. | Shows integration error honestly |
| R9 | No Sun lighting, terminator, starfield, ground track or real-date implication. | Not modelled (ADR-0004) |
| R10 | Evidence labels follow ADR-0008 exactly. Run diagnostics are captioned "self-consistency, not accuracy". | v0.1 finding: a wrong μ passes conservation checks |
| R11 | Explore and Analyze (WA-F18) render the same run, the same sample k and the same camera. A mode switch changes only panel density. | One truth; no mode can show a different number |
| R12 | The spacecraft marker has a constant screen size: 12 px disc, 2 px dark outline, 26 px accent selection ring, and a permanent "not to scale" label. When the Earth occludes it, it is hidden (ADR-0004), and a dashed ring with a "behind Earth" label marks its position. That indicator is the one intentional exception to occlusion: it is drawn on top of the Earth, always dashed and always labelled, so it cannot be read as a visible spacecraft. | Review: the marker was hard to find; true size is far below a pixel |
| R13 | The optional velocity arrow points along v at sample k, from the ring edge, at a fixed 40 px length. Direction only; no scale and no number. | Same sample rule as R1; a scaled arrow would imply a magnitude reading |
| R14 | The analytical surface crossing is computed by the analytic module (time of flight to R_E) and drawn as an open cyan diamond labelled with its exact time. When it is under 24 px from the numerical impact cross, an inset view shows both at a zoom where they separate, with the gap in seconds and kilometres labelled as this run's own comparison. Validation results for impact (I1) appear only in the evidence card. | Review: the two events must not be confused |
| R15 | Orbital elements presented as the orbit's properties are closed-form values for the configured initial state, tagged *exact*. Osculating elements computed from an integrator state (r_k, v_k) are not presented as the orbit's elements. Run-measured quantities (first period, altitude range) are shown under Advanced, labelled *run*. | Semi-implicit Euler's stored r and v are effectively half a step apart (§2b) |
| R16 | Simplification and interpolation never hide an event or a discrepancy. RDP (R3) always keeps: the first and last samples; every revolution-boundary sample (R4); the samples on either side of each local extremum of \|r\| (apsides); the impact-detecting sample (R7); and any sample where a run flag changes. Decimation is per display only and never touches the data behind readouts, plots, CSV or the analytic comparison. The ghost marker and the exact path come from the analytic module at full resolution and are never decimated against the computed path, so the computed-vs-exact gap is shown at its true size. Hermite interpolation (R2) only moves the marker between samples k and k+1; it never feeds a readout, an event time or the ghost comparison. | G1 consideration G1-2 |
| R17 | Every scene element is either **computed** (from engine samples or the analytic module) or **illustrative** (a rendering aid). Computed: trajectory vertices, marker position (Hermite between computed samples), velocity direction, impact cross, analytical crossing, exact path, ghost marker, all numbers. Illustrative: Earth texture and its starting orientation, camera-attached lighting, marker size and ring, arrow length, the behind-Earth indicator, axes styling, colours. The methodology page lists both, the Data view contains only computed values, and no illustrative element carries a number. | G1 consideration G1-4 |

## 2. Evidence from WA-0 (design renders, 2026-11-23)

The V0 reference case, at mid-orbit (t = T/2) at the closest camera distance:

- integrated and exact **positions at the same instant** differ by 15.3 km along-track;
- the radius differs by 9 m, so the two **paths** overlap on screen.

Without R8's ghost marker this error would be invisible. With it, the user sees about 25 px of separation at the closest zoom on a 900 px-tall viewport. The same error falls to 38.7 m after a full revolution (T7). This is a property of semi-implicit Euler that the methodology page must explain.

### 2b. Evidence from WA-0 revision 2 (2026-11-24)

On the circular V0 case (k = 1, Δt = 1 s), osculating elements computed from the integrator's stored state at sample 1 851 give e = 0.000 981, periapsis altitude 393.36 km and apoapsis altitude 406.65 km. The exact values are e = 0 and 400.000 km. The error is of order ω·Δt = 1.13 × 10⁻³ and comes from the half-step stagger between r and v in semi-implicit Euler, not from orbit drift: h is conserved to 10⁻¹⁶ and the altitude readout oscillates between 396.17 and 403.84 km once per revolution over all 10 orbits without growing. Displaying osculating values as "the orbit" would show a circular orbit as eccentric, hence R15.

## 3. Consequences

The display layer needs its own tests: mode switching preserves run, sample and camera (R11); the velocity arrow matches v at sample k (R13); secondary elements equal the closed-form values (R15); decimation (max deviation ≤ ε, first and last samples kept, indices increasing), Hermite (exact at endpoints, error bound on a circle), clock (clamp, rates), formatting (units, minus sign, significant figures), and revolution splitting.

## 4. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Accepted. R4 (revolution rule) and R8 (ghost marker) added from WA-0 design findings. |
| 3 | 2026-11-25 | G1: R12 states the behind-Earth exception; R16 event-preserving simplification and interpolation; R17 computed vs illustrative. |
| 2 | 2026-11-24 | WA-0 design review: R7 reworded; R11 modes share state; R12 marker visibility; R13 velocity arrow; R14 numerical impact vs analytical crossing and inset; R15 exact elements, with the osculating-element evidence in §2b. |
