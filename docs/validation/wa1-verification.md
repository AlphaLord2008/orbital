# WA-1 verification: scaffold, CI and hosting check

**Branch:** `wa1/scaffold-ci-hosting` (PR #2) · **Date:** 2026-11-25 · **Roadmap:** WA-1 items 1–6
**Rule:** an item is ticked only with linked evidence. Nothing here was run on Cloudflare yet; those items are marked Pending.

## Acceptance criteria

| Criterion (roadmap WA-1) | Status | Evidence |
|---|---|---|
| A PR with green CI | **Met** | [CI run 45707384367](https://github.com/AlphaLord2008/orbital/actions/runs/45707384367) on `339d802`: 8 of 8 jobs passed |
| …produces a preview URL | **Pending: Cloudflare secrets** | Deploy workflow ran and skipped with a notice ([run 45707382444](https://github.com/AlphaLord2008/orbital/actions/runs/45707382444)); setup steps in `docs/deploy.md` |
| Zero CSP violations in the console | **Met locally and in CI (production headers via `serve-dist.mjs`); Pending on Cloudflare** | e2e `shell renders…` asserts no `securitypolicyviolation` events and no console errors in Chromium, Firefox and WebKit; the deploy job re-checks the served headers |
| ADR-0006 moves to Accepted (or is revised) | **Revised (rev 2); Accepted after the account-side checks** | ADR-0006 §3 table |
| Then R1 (re-estimate) | **Needs your WA-0 and WA-1 hours** in `docs/time-log.md` | — |

## Items

| # | Item | Result |
|---|---|---|
| 1 | pnpm workspace `web/` with `packages/engine` (empty, boundary rules) and `apps/web` (strict TS shell, "ORBITAL" only) | Done. The shell also shows the build commit and "Browser engine conformance: Pending" (G1-5). |
| 2 | CI: Python 3.11/3.12; typecheck; lint; Vitest; build; size-limit baseline; Playwright smoke in Chromium, Firefox, WebKit | Done. Python 166 passed on CPython 3.11.18 and 3.12.16; Node 26.13.1; Vitest 8 passed; Playwright 4 passed in each engine. Added: frozen-hash check on `requirements-0.1.1.md`, Prettier check, engine boundary script, Lighthouse. |
| 3 | Engine boundary fails CI on DOM, React, three or app imports | Done and shown failing on purpose (below). |
| 4 | Hosting: D7 checklist; preview deploy per PR; `_headers` with the CSP | Checklist done where documentation decides it (ADR-0006 §3); `_headers` done; deploy pipeline written and **pending the Cloudflare account** |
| 5 | Lighthouse CI baseline on the preview | Baseline on the production build with production headers: CI assertions (performance ≥ 90, accessibility = 100) pass; the local run scored 100 / 100 / 100 / 100 (performance, accessibility, best practices, SEO), LCP 0.20–0.46 s, CLS 0, TBT 0. **Preview-URL baseline pending** (the deploy job runs Lighthouse against it). |
| 6 | Radix vs React Aria by accessibility of slider and number field | React Aria Components (ADR-0007 §1b, `web/spikes/controls-a11y/`). Chromium only; Firefox, WebKit and screen readers in WA-6. |

## Baselines

| Metric | Value | Budget |
|---|---|---|
| JS, gzip (React 19 + shell) | 67.9 KB | first-route JS ≤ 300 KB |
| CSS, gzip | 342 B | — |
| Lighthouse, local production build | 100 / 100 / 100 / 100 | performance ≥ 90, accessibility 100 |

## Deliberate-bug checks

Each rule was broken on purpose. Every break was caught, then reverted.

| Mutation | Caught by |
|---|---|
| Engine imports `react` | boundary script; ESLint `no-restricted-imports` |
| Engine re-exports app code via `../../../apps/web/src/App` | boundary script |
| Engine reads `document.title` | `tsc` (no DOM lib: TS2584); ESLint `no-restricted-globals` |
| Engine `package.json` gains a dependency | boundary script; Vitest `has zero runtime dependencies` |
| `'unsafe-inline'` added to `script-src` | Vitest `never allows inline scripts or styles` |
| CSP line removed from `_headers` | Playwright `production security headers` and `CSP is enforced` (2 failures) |
| Inline `<script>` added to `index.html` | Playwright `shell renders…` (CSP violation recorded) |
| `dangerouslySetInnerHTML` in the app | ESLint (WA-E7 rule) |
| **In CI:** engine imports `three` and reads `document` | [run 45707801181](https://github.com/AlphaLord2008/orbital/actions/runs/45707801181) failed at `pnpm lint` with `no-restricted-imports` and `no-restricted-globals` (temporary branch `wa1/mutation-check-tmp`) |

## Found and fixed during WA-1

- The first e2e run failed on a 404 for `/favicon.ico`, which made a console error. Fixed with `public/favicon.svg` and a `<link rel="icon">`.
- pnpm 12 quietly added `minimumReleaseAgeExclude` entries for packages younger than its default age. I replaced them with an explicit 7-day policy and chose versions that satisfy it, with no exclusions.

## Open items for you

1. Cloudflare account, `workers.dev` subdomain, API token and the two GitHub secrets (`docs/deploy.md`). After that, push any commit to this PR to get the preview URL, the header check and Lighthouse on Cloudflare.
2. After merge and a second production deploy: the rollback rehearsal (`docs/deploy.md`).
3. Branch protection for `main` with the required checks (`docs/deploy.md` step 6). This is a repository setting, so it's left to you.
4. Delete the temporary branch `wa1/mutation-check-tmp`. My session can't delete remote branches.
5. Log your WA-0 and WA-1 hours for checkpoint R1.
