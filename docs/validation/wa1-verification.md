# WA-1 verification: scaffold, CI and hosting check

**Branch:** `wa1/scaffold-ci-hosting` (PR #2) · **Date:** 2026-11-25 · **Roadmap:** WA-1 items 1–6
**Rule:** an item is ticked only with linked evidence.

**Live:** production https://orbital-web.harshuvaibhav.workers.dev · PR #2 preview https://pr-2-orbital-web.harshuvaibhav.workers.dev

## Acceptance criteria

| Criterion (roadmap WA-1) | Status | Evidence |
|---|---|---|
| A PR with green CI | **Met** | [CI run 45707384367](https://github.com/AlphaLord2008/orbital/actions/runs/45707384367) on `339d802`: 8 of 8 jobs passed |
| …produces a preview URL | **Met** | `https://pr-2-orbital-web.harshuvaibhav.workers.dev` ([Deploy run 45711741434](https://github.com/AlphaLord2008/orbital/actions/runs/45711741434)); comment posted on PR #2 |
| Zero CSP violations in the console | **Met, including live** | e2e (no `securitypolicyviolation` events, no console errors, CSP blocks injected inline script, axe clean): Chromium/Firefox/WebKit in CI, and Chromium against the live preview and production (4 passed each) |
| ADR-0006 moves to Accepted | **Met** (rev 3) | ADR-0006 §3: every check passed |
| Then R1 (re-estimate) | **Needs your WA-0 and WA-1 hours** in `docs/time-log.md` | — |

## Items

| # | Item | Result |
|---|---|---|
| 1 | pnpm workspace `web/` with `packages/engine` (empty, boundary rules) and `apps/web` (strict TS shell, "ORBITAL" only) | Done. The shell also shows the build commit and "Browser engine conformance: Pending" (G1-5). |
| 2 | CI: Python 3.11/3.12; typecheck; lint; Vitest; build; size-limit baseline; Playwright smoke in Chromium, Firefox, WebKit | Done. Python 166 passed on CPython 3.11.18 and 3.12.16; Node 26.13.1; Vitest 8 passed; Playwright 4 passed in each engine. Added: frozen-hash check on `requirements-0.1.1.md`, Prettier check, engine boundary script, Lighthouse. |
| 3 | Engine boundary fails CI on DOM, React, three or app imports | Done and shown failing on purpose (below). |
| 4 | Hosting: D7 checklist; preview deploy per PR; `_headers` with the CSP | Done. Live headers verified with `curl`; rollback rehearsed both ways |
| 5 | Lighthouse CI baseline on the preview | Done. Live, 3 runs each: preview 100 / 100 / 100 / 63 (SEO 63 because previews send `x-robots-tag: noindex`), LCP 237–437 ms; production 100 / 100 / 100 / 100, LCP 223–242 ms; CLS 0, TBT 0 everywhere |
| 6 | Radix vs React Aria by accessibility of slider and number field | React Aria Components (ADR-0007 §1b, `web/spikes/controls-a11y/`). Chromium only; Firefox, WebKit and screen readers in WA-6. |

## Baselines

| Metric | Value | Budget |
|---|---|---|
| JS, gzip (React 19 + shell) | 67.9 KB | first-route JS ≤ 300 KB |
| CSS, gzip | 342 B | — |
| Lighthouse, local production build | 100 / 100 / 100 / 100 | performance ≥ 90, accessibility 100 |
| Lighthouse, live production | 100 / 100 / 100 / 100, LCP ≈ 0.23 s | same |

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

## Deployment record

| Run | What | Result |
|---|---|---|
| [45711317381](https://github.com/AlphaLord2008/orbital/actions/runs/45711317381) | First production deploy (creates the Worker; `versions upload` cannot) | version `c03f930f`, headers OK, Lighthouse pass |
| [45711741434](https://github.com/AlphaLord2008/orbital/actions/runs/45711741434) | PR #2 preview | Version URL alias `pr-2`, headers OK, e2e 4/4, Lighthouse 100/100/100/63 |
| [45712039445](https://github.com/AlphaLord2008/orbital/actions/runs/45712039445) | Second production deploy | version `7d353ef9`, headers OK, e2e 4/4, Lighthouse 100/100/100/100 |
| 45712365837 | Rollback to `c03f930f` | production served `index-BwQ6K86h.js` (v1). Logs deleted: `wrangler deployments list` printed the account e-mail; that command is now removed |
| [45712559926](https://github.com/AlphaLord2008/orbital/actions/runs/45712559926) | Roll forward to `7d353ef9` | production served `index-TJX_3Go5.js` (v2) |

Credentials: both secrets appear only as `***` in every log checked; no token or account ID in output.

## Open items for you

1. Branch protection for `main` (exact settings in the PR #2 description).
2. Delete the temporary branch `wa1/mutation-check-tmp`.
3. Log your WA-0 and WA-1 hours for checkpoint R1.
