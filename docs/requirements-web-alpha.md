# ORBITAL Web Alpha — Requirements

**Revision:** 2 (finalized in WA-0, 2026-11-23)
**Status:** Approved scope. Decisions D1–D14 of the Web Alpha proposal, rev 2, are approved; D7 is provisional until the WA-1 hosting verification.
**Related:** ADR-0003 … ADR-0008; `requirements-0.1.1.md` (pre-registered validation of the presets); `roadmap-web-alpha.md` (milestones and acceptance).

Web Alpha is a public, browser-based simulator for one spacecraft around one point-mass Earth in the equatorial plane. It uses the v0.1 integrator and shows its own evidence. The Python package stays the authoritative physics implementation (ADR-0003).

Requirement IDs are stable. A changed requirement keeps its ID and gets a revision note. A removed one is struck through, never reused.

---

## 1. Preservation and governance

| ID | Requirement |
|---|---|
| WA-G1 | ORBITAL v0.1.0 is preserved: tag, code, 166 tests, tolerances and validation report unchanged (see `requirements-0.1.1.md` PR-1 … PR-6). |
| WA-G2 | Python (`orbital`) is the authoritative physics implementation. Every physics change lands and is validated in Python first (ADR-0003). |
| WA-G3 | The TypeScript engine must pass **both**: (a) analytic validation against independent reference values (`requirements-0.1.1.md` §6), and (b) conformance with Python-generated fixtures (§7 below). Neither substitutes for the other. |
| WA-G4 | No production frontend code is written before gate G1: you approve the high-fidelity designs in writing. |
| WA-G5 | Out of scope (§10) stays out unless a later approved revision adds it. |

## 2. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| WA-F1 | **Scenario inputs.** Altitude 100–100,000 km (default 400); speed factor k = v₀/v_circ 0.50–1.60 (default 1.00), linked to absolute speed in m/s; time step 0.1–300 s (default 1); duration as a time or a multiple of the analytic period (when bound). Every input has a slider and a typed field with units. Typed values are exact; sliders snap to the displayed precision. | MUST |
| WA-F2 | **Initial state** r₀ = (R_E + h, 0), v₀ = (0, k·√(μ/r₀)): periapsis when k ≥ 1, apoapsis when k < 1. Same construction as `circular_initial_state`. | MUST |
| WA-F3 | **Simulation in a Web Worker.** It never blocks the UI. A newer request supersedes a running one. Runs over 150 ms show determinate progress (chunks of 50,000 steps). | MUST |
| WA-F4 | **Step budget.** At most 1,000,000 steps. Above that, the UI explains why and suggests the smallest dt that fits. It never truncates silently. | MUST |
| WA-F5 | **3D view.** Textured Earth at true scale (radius from `R_EARTH`), rotating at the WGS 84 rate from an arbitrary orientation; trajectory; spacecraft marker; ECI x/y axes; km scale bar. Camera presets: Top-down north, Oblique, Fit orbit. Orbit-drag and zoom, minimum camera distance 1,000 km. | MUST |
| WA-F6 | **Playback.** Play/pause; rates 1×, 10×, 60×, 600×, 3,600×, 10,000× and Fit (whole run in 20 s); scrubbable timeline with one tick per revolution; step ±1 sample; jump ±1 revolution. | MUST |
| WA-F7 | **Live readouts** at sample k (the latest computed sample at or before playback time): t and k, altitude, \|r\|, speed, specific energy ε, angular momentum h. Readouts are never interpolated (ADR-0005). | MUST |
| WA-F8 | **Run diagnostics.** Relative drift in ε and h so far; analytic period and apsides (when bound); classification (bound, escape, impact); drift plots for ε and \|r\| with min–max bucketing. Labelled **self-consistency, not accuracy**. | MUST |
| WA-F9 | **Evidence tier** on every run (§4), with the test ID, its gates and its measured results, linked to the methodology page. | MUST |
| WA-F10 | **Impact** is shown at the step boundary where it was detected, labelled "detected at step boundary". The exact crossing can be shown as a reference when the analytic overlay is on. | MUST |
| WA-F11 | **Presets**, each exactly one validated or tested case: ISS 400 km (V0), GEO (P1), Ellipse k = 1.10 (E1), Escape k = 1.42 (X1), Impact k = 0.98 (I1), Coarse step dt = 60 s (P2). Parameters are as in `requirements-0.1.1.md` §5. | MUST |
| WA-F12 | **Share link.** The URL carries the full scenario (schema v1, §8). Opening it reproduces the identical run and tier. | MUST |
| WA-F13 | **Methodology page.** Model and assumptions; constants with sources; evidence tiers; v0.1.0 and v0.1.1 results; conformance report; known limits; NASA imagery credit. | MUST |
| WA-F14 | **Analytic overlay** (toggle): exact two-body trajectory as a dotted reference line plus an exact-position ghost marker at the current time, both from the analytic module, never from the integrator. | MUST |
| WA-F15 | CSV export of the run (t, x, y, vx, vy in SI, full precision). | SHOULD |
| WA-F16 | Pin a run as a faint comparison line. | COULD (first to cut) |
| WA-F17 | Presentation mode: panels hidden, readouts at 1.5×, high-contrast lines. | SHOULD |

WA-F14 was added in rev 2. The WA-0 close-up render showed that on the V0 reference case the integrated marker runs about 15 km along-track from the exact position mid-orbit, while the two paths lie within metres of each other. Only a ghost marker makes that visible.

## 3. Trajectory display rules (ADR-0005)

| ID | Rule |
|---|---|
| WA-D1 | Numbers on screen come only from computed samples. |
| WA-D2 | The spacecraft marker uses cubic Hermite interpolation between samples k and k+1, for display only. |
| WA-D3 | The trajectory line is a subset of computed samples chosen by Ramer–Douglas–Peucker with ε = 100 m (vertex cap 20,000; ε doubles if needed and the achieved ε is reported). |
| WA-D4 | **Past and future.** For bound orbits: computed past is drawn solid from the start of the current revolution; computed future is dashed to its end. Revolutions are counted at crossings of the +x axis, the same rule as `first_period`. For escape and impact: past solid from t = 0, future dashed to t_end. |
| WA-D5 | The line is hidden where the Earth occludes it. |
| WA-D6 | Lighting is camera-attached; there is no terminator, because no Sun is modelled. |

## 4. Evidence tiers (ADR-0008)

| Tier | Label | Applies when | Claims |
|---|---|---|---|
| 1 | Validated reference | Exactly V0: 400 km, k = 1, dt = 1 s, duration ≤ 10 orbits | Meets T3–T8 at the v0.1.0 tolerances |
| 2 | Tested condition · ID | Altitude, k and dt bit-identical to a v0.1.1 case that has **passed**, and duration ≤ its tested duration | That case's measured errors, shown with its gates |
| 3 | Unvalidated | Everything else | No accuracy claim |

- Matching is on the canonical float64 values after URL or field parsing.
- A preset whose v0.1.1 case has not passed shows **Unvalidated** until it does.
- Run diagnostics can never raise a tier.

## 5. Nonfunctional requirements

| ID | Requirement |
|---|---|
| WA-N1 | Correctness: WA-G3 (a) and (b) pass in Node, Chromium, Firefox and WebKit. |
| WA-N2 | Performance: every budget in §6 for each scenario size and device class. |
| WA-N3 | Accessibility: WCAG 2.2 AA; a complete keyboard path; text equivalent of the 3D view (§7). |
| WA-N4 | Compatibility: last two major versions of Chrome, Edge, Firefox, Safari on macOS and iOS. WebGL 2 required; 2D fallback if unavailable (SHOULD). |
| WA-N5 | Privacy: no cookies, accounts, telemetry, or third-party requests at runtime. |
| WA-N6 | Security: CSP and headers per ADR-0006; schema validation of URL and worker inputs (§8). |
| WA-N7 | Maintainability: TypeScript strict; no `any` in `@orbital/engine`; ESLint clean; engine line coverage ≥ 95%. |
| WA-N8 | Reproducibility: every result records engine implementation, version, git commit and conformance reference. |
| WA-N9 | Honesty: no visual element implies unmodelled physics; no label implies evidence that does not exist. |
| WA-N10 | Responsiveness invariant (§6.3). |

## 6. Performance budgets

### 6.1 Device classes (reference devices confirmed at WA-0 sign-off)

| Class | Reference device | Render quality |
|---|---|---|
| A | Your Mac | 8K Earth, pixel ratio ≤ 2 |
| B | ~5-year-old Windows laptop, Intel integrated graphics | 4K Earth, pixel ratio ≤ 1.5 |
| C | Recent mid-range phone | 4K Earth, pixel ratio ≤ 2 |
| D | 4+-year-old Android, ~4 GB RAM | 2K Earth, pixel ratio 1.5, no MSAA |

### 6.2 Budgets

| Metric | A | B | C | D |
|---|---|---|---|---|
| Input → updated orbit, normal (≤ 100,000 steps), p95 | **≤ 100 ms** | ≤ 200 ms | ≤ 200 ms | ≤ 400 ms |
| Input → updated orbit, large (10⁶ steps), p95 | ≤ 400 ms | ≤ 1.0 s | ≤ 1.5 s | ≤ 3.0 s |
| Frame rate | 60 fps | ≥ 30 | ≥ 30 | ≥ 24 |
| Orbit visible after navigation | ≤ 3.0 s | — | — | ≤ 5.0 s |

Plus, on all classes: first-route JS ≤ 300 KB gzip; fonts ≤ 120 KB; first Earth texture ≤ 400 KB; transfer before first orbit ≤ 1.2 MB; LCP ≤ 2.5 s and CLS ≤ 0.1 on class A; JS heap ≤ 250 MB at the step cap; GPU texture ≤ 64 MB on C/D and ≤ 192 MB on A; Lighthouse performance ≥ 90 and accessibility 100.

### 6.3 Responsiveness invariant (every class, every size)

1. Physics never runs on the main thread. No main-thread task > 50 ms results from receiving or drawing a result.
2. While computing, the previous result keeps rendering at the class frame budget; camera and playback stay usable.
3. Runs over 150 ms show determinate progress; chunked and unchunked runs are bit-identical (tested).
4. A new input supersedes a running computation within one frame.
5. INP ≤ 200 ms.

## 7. Accessibility

| ID | Requirement |
|---|---|
| WA-A1 | Canvas has `role="img"` and a label updated per result (scenario, period, classification, status). |
| WA-A2 | **Data view**: summary and samples at each revolution, as a table; CSV export. |
| WA-A3 | Polite live region for run completion, tier changes and errors; never continuous playback narration. |
| WA-A4 | Every slider has a typed field; `aria-valuetext` with units; errors tied with `aria-describedby`. |
| WA-A5 | Logical tab order; skip link to controls; focused canvas supports arrows (rotate) and +/− (zoom); shortcut sheet on `?`. |
| WA-A6 | Text ≥ 4.5:1, control boundaries and focus ring ≥ 3:1 (measured values in the design system). |
| WA-A7 | `prefers-reduced-motion`: instant camera moves, no auto-rotation, playback paused on load. |
| WA-A8 | Status uses colour + icon + word; past/future differ by dash pattern; palette checked for protanopia and deuteranopia. |
| WA-A9 | Works at 200% zoom; touch targets ≥ 44 × 44 px. |
| WA-A10 | axe-core reports zero violations in every journey; VoiceOver and NVDA passes recorded at WA-6. |

## 8. Errors, validation and security

| ID | Requirement |
|---|---|
| WA-E1 | One schema defines every input's type, range and unit; used by fields, URL codec and worker. |
| WA-E2 | Invalid input never replaces a valid result: the previous orbit stays, dimmed, with the field error. |
| WA-E3 | Engine errors are typed (`OrbitalInputError(field)`, `OrbitalNumericalError(step)`) and match Python's error class and field for every conformance case C8. |
| WA-E4 | Worker crash or a hang over 5 s: one automatic restart, then a banner. |
| WA-E5 | WebGL context loss: 2D fallback or message; restore on `webglcontextrestored`. |
| WA-E6 | URL: ≤ 512 characters, strict decimal grammar, `v=1` schema version, out-of-range values rejected with a message (never clamped), unknown keys ignored. |
| WA-E7 | No `dangerouslySetInnerHTML` (ESLint rule). No runtime third-party requests. |
| WA-E8 | "Copy diagnostic report" button: scenario, engine version, browser, error text. Shared only by the user. |

## 9. User journeys (become Playwright tests in WA-6; usability tasks in WA-7)

| ID | Journey | Done when |
|---|---|---|
| J1 | First visit: orbit already playing; one-line explanation; methodology one click away | Orbit visible ≤ 3.0 s (class A); no console errors |
| J2 | Altitude vs period, then GEO preset | Every drag value produces a run; GEO period = 2π/ω_E within 10⁻⁵; Earth turns once per orbit |
| J3 | Ellipse preset (Tier 2 E1) → nudge k to 1.11 (Tier 3) → Impact (I1) → Escape (X1) | Correct classification for each; impact at step boundary; any change from a tested case shows Unvalidated |
| J4 | ISS (Tier 1) → Coarse step (Tier 2 P2) | P2's measured error shown; drift plots grow |
| J5 | Educator copies a link; presentation mode | Link reproduces inputs and tier exactly |
| J6 | Invalid input | No crash, no NaN on screen, error announced, previous orbit dimmed |
| J7 | Phone viewer | ≥ 30 fps (class C); all controls reachable; targets ≥ 44 px |

## 10. Out of scope for Web Alpha

AI tutoring, lessons, payments, accounts, server-side saved scenarios, mission planning and manoeuvres, inclined/3D orbits, perturbations, real satellites/TLEs, ground tracks, Sun lighting and day/night, multiple spacecraft, light theme, localisation, native desktop builds, the ORBITAL 0.2 integrator roadmap, and any integrator choice in the UI.

## 11. Conformance (summary; detail in ADR-0003)

C1–C6 are the six presets; C7 the F4/F5 endpoint cases; C8 invalid inputs. Positions and velocities agree within 10⁻¹¹ relative; derived scalars within 10⁻¹²; statuses, step counts, classifications and error codes exactly. If one browser engine exceeds a bound, the cause is found first; bounds are never loosened to pass.

## Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-23 | Proposal rev 1 requirements (in the proposal document). |
| 2 | 2026-11-23 | Finalized in WA-0: evidence tiers by exact match; v0.1.1 dependency; performance by size × device class; usability milestone; WA-F14 analytic overlay with ghost marker (from WA-0 render finding); WA-D4 past/future revolution rule; X1 uses dt = 1 s. |
