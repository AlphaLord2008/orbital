# ORBITAL Web Alpha — Implementation roadmap

**Revision:** 2 (WA-0 complete, 2026-11-25)
**Scope:** `requirements-web-alpha.md` rev 4, ADR-0003 … ADR-0008, `requirements-0.1.1.md` rev 1.
**Rule:** a milestone is done only when every acceptance criterion has linked evidence (a CI run, a report, a recording or a signed-off design). Nothing is ticked on a test that was not run.

## Gates

| Gate | Between | Passes when |
|---|---|---|
| **G1 Design approval** | WA-0 → any production UI (WA-3) | You approve the high-fidelity designs and the design system in writing, including any change requests. **Passed 2026-11-25** (`docs/design/README.md`). |
| **R1 Re-estimate** | after WA-1 | Logged hours vs estimates for WA-0 and WA-1; the remaining estimates are scaled by the ratio and the timeline redrawn |
| **G2 Evidence** | WA-2 → engine output in the scene (WA-3) | v0.1.1 cases pass in Python; the TS engine passes analytic validation, T1–T12 and conformance in four environments |
| **G3 Usability** | WA-7 → release | Every critical or high usability finding is fixed and re-checked, or explicitly accepted by you |

## Milestones

### WA-0 — Decisions and design *(complete 2026-11-25; no production code)*

| Deliverable | Where | Status |
|---|---|---|
| Finalized Web Alpha requirements | `docs/requirements-web-alpha.md` rev 4 | Delivered |
| Pre-registered v0.1.1 validation plan | `docs/requirements-0.1.1.md` rev 1 (SHA-256 `908a3366…db9165`, posted 2026-11-23 23:38 EST) | Delivered, frozen |
| ADR-0003 … ADR-0008 | `docs/decisions/` | Delivered (ADR-0006 provisional) |
| Component design system | ORBITAL Design System artifact v2; tokens in `docs/design/tokens.json` | Approved at G1 |
| High-fidelity desktop and mobile designs | ORBITAL Web Alpha designs artifact (desktop D1–D9, mobile M1–M5), revision 2 | Approved at G1 |
| Realistic visualization concept | Concept board + `docs/design/renders/rev2/` + `scripts/design/` | Approved at G1 |
| Roadmap and acceptance criteria | this file | Delivered |
| Domain name | your decision | **Deferred:** a temporary deployment domain is used from WA-1; the custom domain is chosen before WA-8 |
| Reference devices (named physical devices per class A–D) | your decision | **Carried to WA-4**, where the performance budgets are first measured |
| Time log started | `docs/time-log.md` | Template delivered |

**Accepted when:** you accept the ADRs and requirements, and you approve the designs (**G1**). **Accepted 2026-11-25:** G1 passed with five non-blocking implementation considerations (G1-1 … G1-5, `docs/design/README.md`).

### WA-1 — Scaffold, CI and hosting check (8–12 h)

*Complete on branch `wa1/scaffold-ci-hosting` (PR #2), 2026-11-25; online at https://orbital-web.harshuvaibhav.workers.dev; evidence in `docs/validation/wa1-verification.md`.*

1. pnpm workspace `web/` with `packages/engine` (empty, boundary rules) and `apps/web` (strict TS shell rendering only "ORBITAL", no product UI).
2. CI (GitHub Actions): Python 3.11/3.12 suite; typecheck; lint; Vitest; build; size-limit baseline; Playwright smoke in Chromium, Firefox, WebKit.
3. Engine boundary check: `@orbital/engine` fails CI if it imports DOM, React, three or app code.
4. Hosting: the D7 verification checklist (ADR-0006 §3); preview deploy per PR; `_headers` with the CSP. Deploys use a temporary provider domain until the custom domain is chosen.
5. Lighthouse CI baseline on the preview.
6. Choose Radix vs React Aria by the accessibility of slider and number field (ADR-0007).

**Accepted when:** a PR with green CI produces a preview URL; zero CSP violations in the console; ADR-0006 moves to Accepted (or is revised); then **R1**.

### WA-2 — Python v0.1.1 and the TypeScript engine (22–30 h)

1. `orbital.analytic` (AN-1 … AN-6) and its tests AN-T1 … AN-T6.
2. `scripts/reference_mp.py` (mpmath, 50 digits; development dependency only); REF-1 passes.
3. Run V0, P1, E1, X1, I1, P2 **once**; record every metric in `docs/validation/v0.1.1-web-alpha-presets.md`.
4. Release v0.1.1 (PR-1 … PR-6).
5. `scripts/generate_fixtures.py`; fixtures `v1`; freshness check in CI.
6. `@orbital/engine`: port with chunked propagation; unchecked inner step proven bit-identical to the validated step.
7. TS analytic validation (TS-V0 … TS-P2); ported T1–T12; conformance C1–C8 in Node + 3 browsers; mutation table.

**Accepted when:** every item above passes. A failed v0.1.1 case does not block WA-2, but that preset ships as Unvalidated (requirements-0.1.1 §7). Then **G2**.

### WA-3 — Scene foundation (14–20 h; needs G1 and G2)

`frame.ts` and its tests; Earth (NASA texture from NASA, quality per device class, WGS 84 rotation, credit); logarithmic depth; axes and scale bar; camera presets (Top-down, Oblique, Fit orbit; minimum distance 1,000 km); static trajectory from an engine result.

**Accepted when:** the frame tests pass; the occlusion test scene shows no wrongly hidden LEO line; class A holds 60 fps; texture memory is within the class budgets; the scene matches the approved Concept board.

### WA-4 — Worker, playback and display rules (16–22 h)

Worker protocol (progress, supersession, watchdog); result cache; RDP decimation; revolution splitting (WA-D4); clock; Hermite marker; analytic overlay with ghost marker (WA-F14); timeline; impact display.

**Accepted when:** normal-size p95 ≤ 100 ms on class A; large-size budgets and the responsiveness invariant measured on classes A–D; property tests for decimation, Hermite, revolution splitting and the clock pass.

### WA-5 — Controls and diagnostics (24–32 h)

Design tokens and components in code (from the design system); Setup and Diagnostics panels; schema validation and errors; drift plots; evidence tiers (ADR-0008); presets; share URL; methodology page; CSV export.

**Accepted when:** journeys J2–J6 pass; every on-screen number equals its fixture or engine value; side-by-side review against the approved designs is signed off.

### WA-6 — Hardening (16–24 h)

Accessibility (axe zero, keyboard and screen-reader passes); responsive layouts; 2D fallback; performance pass per class; real Safari; J1–J7 automated.

**Accepted when:** every budget in requirements §6 is met or has an exception you approved; accessibility evidence is recorded.

### WA-7 — Usability test (8–12 h)

About five moderated think-aloud sessions on the release candidate (protocol in the proposal §15), with tasks from J1–J5. Report in `docs/validation/usability-alpha.md`.

**Accepted when:** five sessions are done; findings are rated by severity; **G3**.

### WA-8 — Release (6–10 h)

Release-quality checklist (proposal §18); production deploy; `web-v0.1.0` tag and notes; 60 s demo recording; PROJECT_INDEX update.

## Estimate and schedule

Total 130–186 h. At about 9 h/week, the midpoint projection is mid-April 2027. **This is a forecast, not a deadline.** It is replaced at R1 with your measured pace, and again after WA-4 if that pace shifts by more than 25%.

## Changes made in WA-0 that you should review

| Change | Why | Where |
|---|---|---|
| E1, X1, I1 tolerances differ from v0.1's (first-order energy for e > 0; grazing timing) | Theory plus disclosed pilot runs on non-registered configurations; copying v0.1 gates would have failed for understood reasons | requirements-0.1.1 §5, §7 |
| X1 uses dt = 1 s (proposal said 10 s) | 86,400 steps is still normal size; better accuracy | requirements-0.1.1 X1 |
| New MUST WA-F14: exact-solution overlay with a ghost marker | The WA-0 close-up showed a 15.3 km along-track error that the dotted line alone hides | requirements-web-alpha, ADR-0005 R8 |
| New rule WA-D4: past/future split per revolution | On closed orbits all revolutions overlap; per-revolution keeps past and future readable | ADR-0005 R4 |
| P1 gated scaling-law predictions (±10%) | Scale invariance of the circular map makes exact predictions possible | requirements-0.1.1 P1 |
| mpmath as a development dependency | Independent high-precision reference (REF-1) | requirements-0.1.1 §4 |
