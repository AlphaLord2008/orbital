# ORBITAL ADR-0007: Frontend stack and repository layout

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decisions D8 and D9 |
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
| Controls | Radix Primitives or React Aria Components, chosen in WA-1 by accessibility of slider and number field | Unstyled; the design system styles them |
| Styling | CSS Modules over the design-system tokens (`tokens.css`) | No utility-class framework |
| Plots | Hand-written SVG or uPlot, chosen in WA-5 by bundle size | Min–max bucketing (ADR-0005 R6) |
| Tests | Vitest, fast-check, Playwright (+ axe-core), size-limit, Lighthouse CI | |
| Lint | ESLint + Prettier; `no-restricted-imports` for the engine boundary; ban `dangerouslySetInnerHTML` | |

Versions are pinned exactly in WA-1. Each new runtime dependency needs a one-line justification in its PR.

## 2. Repository layout

```
orbital/
├─ src/orbital/            Python reference (unchanged location; + analytic.py in v0.1.1)
├─ tests/                  166 v0.1.0 tests (unmodified) + v0.1.1 cases
├─ scripts/                first_orbit.py, generate_fixtures.py, reference_mp.py, design/
├─ fixtures/v1/            generated, committed, freshness-checked
├─ web/
│  ├─ packages/engine/     @orbital/engine (no DOM, no deps)
│  └─ apps/web/            React application
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
