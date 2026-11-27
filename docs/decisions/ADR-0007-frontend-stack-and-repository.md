# ORBITAL ADR-0007: Frontend stack and repository layout

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decisions D8 and D9. Revision 2 (WA-1, 2026-11-25): versions pinned; controls library chosen (§1b) |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude; ChatGPT (review) |
| **Scope** | Web Alpha source code and repository. |

**Decision:** React 19 + TypeScript (strict) + Vite, with React Three Fiber 9 and drei for the scene, Zustand for state, headless accessible primitives for controls, and CSS Modules over design tokens. Everything lives in the existing `orbital` repository; the released Python stays at the root.

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| UI | React 19 | R3F 9 pairs with React 19 |
| Language | TypeScript strict; no `any` in `@orbital/engine` | |
| Build | Vite; pnpm workspaces | Current Node LTS pinned in `.nvmrc` at WA-1 |
| 3D | three, @react-three/fiber 9, @react-three/drei | Fat lines (`Line2`) for screen-space widths |
| State | Zustand | Scenario, result and playback stores |
| Controls | **React Aria Components** (chosen in WA-1, §1b) | Unstyled; the design system styles them |
| Styling | CSS Modules over the design-system tokens (`tokens.css`) | No utility-class framework |
| Plots | Hand-written SVG or uPlot, chosen in WA-5 by bundle size | Min–max bucketing (ADR-0005 R6) |
| Tests | Vitest, fast-check, Playwright (+ axe-core), size-limit, Lighthouse CI | |
| Lint | ESLint + Prettier; `no-restricted-imports` for the engine boundary; ban `dangerouslySetInnerHTML` | |

Versions are pinned exactly in WA-1. Each new runtime dependency needs a one-line justification in its PR.

### 1a. Toolchain pinned in WA-1 (2026-11-25)

| Tool | Version | Note |
| --- | --- | --- |
| Node | 26.13.1 (`.nvmrc`) | Current LTS line (v26 "Lithium") |
| pnpm | 12.23.0 (`packageManager`) | `minimumReleaseAge: 10080`: no package version younger than 7 days is installed, direct or transitive; Dependabot uses the same 7-day cooldown |
| TypeScript | 6.0.3 | **Not 7.0.** TypeScript 7 (the native compiler) is out, but typescript-eslint 8.73 supports `typescript <6.1`, and type-aware lint rules are part of our checks. Revisit when typescript-eslint supports 7. |
| React / React DOM | 19.3.1 | |
| Vite / @vitejs/plugin-react | 8.3.8 / 6.3.0 | |
| ESLint / typescript-eslint | 10.15.0 / 8.73.0 | `strictTypeChecked` |
| Vitest / Playwright | 5.1.1 / 1.65.1 | |
| size-limit / Lighthouse CI | 14.3.0 / 0.16.1 | |
| wrangler | 4.165.0 (deploy job only) | |
| GitHub Actions | pinned to full commit SHAs | |

three, @react-three/fiber, drei, Zustand and React Aria Components are added in the milestone that first uses them (WA-3 to WA-5), each with its one-line justification.

### 1b. Controls: React Aria Components over Radix (WA-1 item 6)

Requirement: an accessible slider *paired with* a typed number field (WA-F1, WA-A4), where an out-of-range entry stays visible with a linked error and is never clamped or committed (design D4, WA-E2).

Spike: `web/spikes/controls-a11y/` builds the same altitude slider + field with each library and runs one script of checks (`evaluate.mjs`; results in `results-chromium.json`).

| Check (Chromium, 2026-11-25) | Radix | React Aria Components |
| --- | --- | --- |
| axe violations | 0 | 0 |
| Slider: name, `aria-valuetext` with unit, Arrow / Home / End / PageDown | all pass | all pass |
| Field ↔ slider stay in sync | pass | pass |
| Number field primitive | **none**: a plain `<input>` with hand-written parsing, stepping, `aria-invalid` and `aria-describedby` | `NumberField`: label, error and description wiring, `aria-roledescription="Number field"`, Arrow stepping |
| Grouped input "12,500" parsed | fails (our hand-written parser) | pass (locale-aware) |
| Out-of-range "−50" kept visible, flagged invalid, error linked, not committed | pass (all our code) | pass (`validate` + `validationBehavior="aria"`, no clamping) |
| Bundle, slider + field, gzip (React included) | 78.8 KB | 93.7 KB |

Decision: React Aria Components. Radix passes only where we wrote the behaviour ourselves; the number field is the control users type validated physics inputs into, so its parsing, stepping and error semantics should come from a tested library. The ~15 KB gzip difference is about 5% of the 300 KB first-route budget.

Not yet verified: Firefox and WebKit (only Chromium was available to the spike) and real screen readers. Both are WA-6 acceptance items (VoiceOver and NVDA passes).

## 2. Repository layout

```
orbital/
├─ src/orbital/            Python reference (unchanged location; + analytic.py in v0.1.1)
├─ tests/                  166 v0.1.0 tests (unmodified) + v0.1.1 cases
├─ scripts/                first_orbit.py, generate_fixtures.py, reference_mp.py, design/
├─ fixtures/v1/            generated, committed, freshness-checked
├─ web/                   pnpm workspace (WA-1)
│  ├─ packages/engine/     @orbital/engine (no DOM, no deps)
│  ├─ apps/web/            React application
│  ├─ scripts/             engine boundary check, local static server with production headers
│  └─ spikes/              throwaway evaluations, outside the workspace
├─ docs/                   requirements, decisions, design, validation, roadmap, time-log
└─ .github/                CI, deploy, Dependabot, PR template
```

## 3. Workflow

- One branch per task; changes reach `main` only by pull request with required checks (from WA-1).
- Claude drafts on the branch and runs tests and mutation checks. Harshith reviews the PR and merges.
- Tags: Python `v*` (next: `v0.1.1`); web `web-v*`.
- Hours are logged per milestone in `docs/time-log.md` for re-estimation.

## 4. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Accepted. |
| 3 | 2026-11-25 | WA-3+4: **React Three Fiber and drei dropped; the scene is plain three.js** driven from the Zustand store. With R3F the first-route JS was 333 KB gzip against the 300 KB budget (§6.2), because R3F imports `* as THREE` and defeats tree-shaking; plain three with named imports measures 227 KB. three's `Line2` and `OrbitControls` are used directly. Reversible if the budget changes. |
| 2 | 2026-11-25 | WA-1: toolchain pinned (TypeScript 6.0 for lint compatibility; Node 26 LTS; pnpm 12 with a 7-day minimum release age); React Aria Components chosen for controls. |
