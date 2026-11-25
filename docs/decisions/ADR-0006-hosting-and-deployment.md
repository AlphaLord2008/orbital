# ORBITAL ADR-0006: Hosting and deployment

| | |
| --- | --- |
| **Status** | **Provisionally accepted** (2026-11-23), decision D7. Becomes Accepted when the WA-1 verification in §3 passes. |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude; ChatGPT (review) |
| **Scope** | Web Alpha static site. |

**Decision:** deploy Web Alpha as static files on Cloudflare's free static hosting, built and tested by GitHub Actions, with per-PR previews and production deploys from `main`.

## 1. Options (checked 2026-11-23)

| Option | Cost | Relevant terms | Fit |
| --- | --- | --- | --- |
| **Cloudflare Pages Free** | $0 | Unlimited sites, requests and bandwidth; 500 builds/month; 25 MiB per file; 20,000 files | Preferred |
| Cloudflare Workers Static Assets | $0 tier | Cloudflare's limits page points large static sites here | Alternative from the same provider; chosen in WA-1 |
| Vercel Hobby | $0 | Restricted to non-commercial, personal use | Rejected: the long-term goal is commercial |
| GitHub Pages | $0 | Terms not verified for this decision | Fallback |

## 2. Pipeline

1. PR → GitHub Actions: Python tests (3.11, 3.12), fixture freshness, typecheck, lint, unit, analytic validation, conformance, build, size-limit, Playwright in three engines.
2. Green → `wrangler` deploys a preview with a scoped API token stored as a GitHub secret; Lighthouse CI runs against it.
3. Merge to `main` → production on the custom domain. Releases are tagged `web-v*`.
4. Caching: hashed assets `public, max-age=31536000, immutable`; `index.html` `no-cache`.
5. Rollback: re-promote the previous deployment, rehearsed once on a preview.

## 3. Verification required before acceptance (WA-1)

- [ ] Terms allow a free-plan site that may later become commercial, or the paid tier and its cost are known
- [ ] Pages vs Workers Static Assets chosen, and the reason recorded
- [ ] Largest asset (8K texture) under the per-file cap; file count and build limits fine
- [ ] Header rules support the CSP and caching below
- [ ] Custom domain and HTTPS; preview deploys from Actions
- [ ] Rollback rehearsed

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
