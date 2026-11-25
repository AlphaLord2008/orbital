# ORBITAL ADR-0006: Hosting and deployment

| | |
| --- | --- |
| **Status** | **Provisionally accepted** (2026-11-23), decision D7. Revision 2 (WA-1, 2026-11-25): product chosen (Workers Static Assets) and the documentation checks in §3 done. Becomes **Accepted** when the remaining account-side checks in §3 pass on a real deployment. |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude; ChatGPT (review) |
| **Scope** | Web Alpha static site. |

**Decision:** deploy Web Alpha as static files on **Cloudflare Workers Static Assets** (assets only, no Worker script), Free plan, built and tested by GitHub Actions, with a Version URL per pull request and production deploys from `main`. Until the custom domain is chosen (before WA-8), production runs on the temporary domain `orbital-web.<account-subdomain>.workers.dev`.

## 1. Options (checked 2026-11-23)

| Option | Cost | Relevant terms | Fit |
| --- | --- | --- | --- |
| **Cloudflare Pages Free** | $0 | Unlimited sites, requests and bandwidth; 500 builds/month; 25 MiB per file; 20,000 files | Preferred |
| Cloudflare Workers Static Assets | $0 tier | Cloudflare's limits page points large static sites here | Alternative from the same provider; chosen in WA-1 |
| Vercel Hobby | $0 | Restricted to non-commercial, personal use | Rejected: the long-term goal is commercial |
| GitHub Pages | $0 | Terms not verified for this decision | Fallback |

### 1a. Pages vs Workers Static Assets (WA-1, checked 2026-11-25)

Workers Static Assets is chosen. Reasons, from Cloudflare's current documentation:

- Cloudflare now points new projects to Workers Static Assets; Pages remains supported but new capabilities land on Workers.
- On Workers, "requests to static assets are free and unlimited" (Workers pricing and Static Assets billing pages). An assets-only project never invokes a Worker script, so the Free plan's 100,000 requests/day limit for Worker invocations does not apply to page loads.
- Same limits that mattered for Pages: 25 MiB per file, 20,000 files per version on Free.
- `_headers` is supported for assets-only projects (up to 100 rules, 2,000 characters per line), so the CSP and caching rules below need no Worker code.
- Every uploaded version can get a Version URL (`wrangler versions upload --preview-alias pr-<n>` gives `pr-<n>-orbital-web.<subdomain>.workers.dev`), and `wrangler rollback` restores any of the 100 most recent versions (versions older than 30 days may be deleted).

Trade-offs accepted: Version URLs are public (fine for a public repository and a non-secret app); preview logs are not available for Version URLs; build-minute limits do not apply because GitHub Actions builds and `wrangler` uploads.

## 2. Pipeline

1. PR → GitHub Actions: Python tests (3.11, 3.12), fixture freshness, typecheck, lint, unit, analytic validation, conformance, build, size-limit, Playwright in three engines.
2. Same repository PR → `.github/workflows/deploy.yml` uploads a Worker version with a scoped API token stored as a GitHub secret, checks the served headers with `curl`, runs Lighthouse CI against the Version URL and comments the URL on the PR. Without the secrets the job is skipped with a notice.
3. Merge to `main` → `wrangler deploy` to production (temporary workers.dev domain until the custom domain). Releases are tagged `web-v*`.
4. Caching: hashed assets `public, max-age=31536000, immutable`; `index.html` `no-cache`.
5. Rollback: `Deploy` workflow run by hand with a version ID (`wrangler rollback <id>`), rehearsed once before WA-1 closes.

## 3. Verification required before acceptance (WA-1)

| Check | Status (2026-11-25) | Evidence |
|---|---|---|
| Terms allow a free-plan site that may later become commercial | **Done (documentation).** The Self-Serve Subscription Agreement (updated 2025-09-12) has no personal or non-commercial restriction; it lets Cloudflare end Free Services at its discretion and forbids undue burden on the network. Risk accepted: no SLA on Free. | cloudflare.com/terms |
| Pages vs Workers Static Assets chosen, reason recorded | **Done.** Workers Static Assets (§1a) | this ADR |
| Largest asset under the per-file cap; file and build limits | **Done (limits).** 25 MiB per file, 20,000 files on Free; no build minutes used. The 8K texture's size is measured in WA-3 and must stay under 25 MiB. | Workers limits page |
| Header rules support the CSP and caching below | **Done locally, pending on Cloudflare.** `web/apps/web/public/_headers`; enforced in Playwright under the same rules locally; the deploy workflow checks the served headers with `curl` | e2e `smoke.spec.ts`; deploy job log |
| Temporary domain and HTTPS; preview deploys from Actions | **Pending: needs the Cloudflare account, `workers.dev` subdomain and API token** (`docs/deploy.md`) | first deploy run |
| Rollback rehearsed | **Pending** (after the first two deploys) | rollback run log |
| Custom domain | **Deferred** to before WA-8 (temporary domain approved 2026-11-25) | roadmap |

If any item fails, take the next option in §1 and record why.

## 4. Security headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

WA-1 must show the stack runs under this policy with no violations. No `'unsafe-inline'` for scripts.

## 5. Cost

About $10–15/year for the domain. Everything else is $0 at Web Alpha scale.

## 6. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Provisionally accepted. |
| 2 | 2026-11-25 | WA-1: Workers Static Assets chosen over Pages; documentation checks done; temporary workers.dev domain; deploy, header check, Lighthouse and rollback workflows. Account-side checks pending. |
