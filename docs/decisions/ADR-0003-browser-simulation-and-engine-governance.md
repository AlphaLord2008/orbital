# ORBITAL ADR-0003: Browser-side simulation runtime and engine governance

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decisions D1 and D2 of the Web Alpha proposal rev 2 |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude (architecture); ChatGPT (review) |
| **Scope** | ORBITAL Web Alpha and later web or desktop frontends. Resolves the open question in ADR-0001 §6. |

**Decision:** Web Alpha simulates in the browser, in a Web Worker, with a TypeScript port of the v0.1 core (`@orbital/engine`). There is no backend. Python (`orbital`) stays the authoritative implementation: every physics change lands and is validated in Python first, and the TS port must pass both independent analytic validation and conformance with Python-generated fixtures.

## 1. Context

ADR-0001 §6 left open how a frontend reaches the validated Python engine. Web Alpha's core interaction is *change an input, see the orbit change*. Its scope needs no server: no accounts, no persistence, no AI.

## 2. Options considered

| Option | Consistency with v0.1.0 | Input-to-orbit latency | Running cost | Offline / Tauri |
| --- | --- | --- | --- | --- |
| A. FastAPI service running `orbital` | Identical code | Round trip + ~0.8 s compute; 30–60 s free-tier cold start | ~$53–84/year always on | Needs a bundled Python sidecar |
| B. Pyodide (Python compiled to WebAssembly) | Same code, different libm | Python loop in WASM; ~6–10 MB runtime + ~3 MB NumPy to load | $0 | Heavy |
| **C. TypeScript port + fixtures (chosen)** | Roundoff-level (measured 3.6 µm after 10 orbits) | ~5 ms per 10-orbit run (measured, Node 22) | $0 | Native |
| D. Rust core → WASM and Python | Roundoff-level; rewrites Python too | ~5 ms expected | $0 | Native |

Measurements: proposal appendix (throwaway spike, 2026-11-23).

## 3. Decision details

### 3.1 Runtime

- `@orbital/engine` is a line-for-line port of `constants`, `_validation`, `dynamics`, `propagate`, `diagnostics` and (from v0.1.1) `analytic`. It uses the same floating-point operations as Python (`Math.sqrt(x*x + y*y)` for `np.linalg.norm`, `r ** 3` for `r_norm**3`).
- `@orbital/engine` has zero runtime dependencies, compiles without DOM types, and may not import React, three or app code (ESLint `no-restricted-imports` plus a CI check). This is the TS equivalent of v0.1's T12 core boundary.
- `propagate` validates once at its boundary and then runs an unchecked inner step, proven bit-identical to the public validated step over 10⁴ random states.
- Propagation runs in 50,000-step chunks so the worker can report progress; chunked and unchunked results are proven bit-identical.

### 3.2 Contract (schema version 1)

`Scenario` → `SimulationResult | SimulationProgress | SimulationError`, as specified in the proposal §6. Arrays are float64 structure-of-arrays, transferred, not copied. Every result carries `engine: {impl, version, commit, conforms_to}`. The contract does not depend on its transport. A future HTTP service would implement the same shapes, so adding one later does not change the frontend.

### 3.3 Governance (D2)

1. Physics changes start in Python with requirements, tests and validation, exactly as v0.1.
2. `scripts/generate_fixtures.py` writes `fixtures/v1/*.json`: inputs, engine version and git commit, samples at fixed indices, summaries, and error cases. Values are stored as Python `repr` strings, which round-trip exactly to float64 in JavaScript.
3. CI regenerates the fixtures and fails on any difference (`git diff --exit-code fixtures/`).
4. The TS engine must pass:
   - **Analytic validation**: every v0.1.1 case with the same gates, against mpmath reference values stored in fixtures (`requirements-0.1.1.md` §6). It is never compared with Python engine output for this purpose.
   - **Ported acceptance**: T1–T12 with the v0.1.0 tolerances.
   - **Conformance**: cases C1–C8 against Python output. Position and velocity within 10⁻¹¹ relative; derived scalars 10⁻¹²; statuses, step counts, classifications and error codes exact. It runs in Node, Chromium, Firefox and WebKit.
5. A tolerance miss is root-caused, never loosened to pass.

## 4. Consequences

- **Positive:** sub-frame interactivity, $0 hosting, offline and Tauri reach, a small attack surface, and a verifiable cross-implementation discipline.
- **Negative:** physics exists in two languages. Every future physics feature costs a port plus fixtures.
- **Neutral:** no server means no persistence or analytics in Web Alpha.

## 5. Revisit when

- **Add a server** when a feature needs one anyway: accounts, saved scenarios, the AI tutor, or batch computation too heavy for a laptop.
- **Move to a Rust core (option D)** when the physics passes about 1,500 lines, or one feature's port costs more than a week.
- **Retire the port** if any release has a conformance failure that roundoff cannot explain.

## 6. Validation of this decision

WA-2 acceptance: v0.1.1 cases pass in Python; the TS engine passes analytic validation, T1–T12 and C1–C8 in four environments; every planned mutation (μ × (1 + 10⁻⁹), 1/r² force scaling, swapped update order, off-by-one time, `≤` → `<` at impact) is caught.

## 7. Related

ADR-0001 §6 (resolved here), ADR-0002, ADR-0005, ADR-0008; `requirements-web-alpha.md`; `requirements-0.1.1.md`.

## 8. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Accepted. |
