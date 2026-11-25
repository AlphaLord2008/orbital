# Deploying ORBITAL Web Alpha

Hosting: Cloudflare Workers Static Assets, assets only, Free plan (ADR-0006 rev 2).
Temporary production domain until the custom domain is chosen: `https://orbital-web.<your-subdomain>.workers.dev`.

## One-time setup (Harshith, about 10 minutes)

These steps need your own Cloudflare login, so Claude cannot do them.

1. **Account.** Sign up or log in at dash.cloudflare.com. The Free plan is enough.
2. **workers.dev subdomain.** In the dashboard, open **Workers & Pages**. On first visit Cloudflare asks you to pick a `workers.dev` subdomain (for example `alphalord2008`). This becomes part of every URL, so pick something you're happy to show.
3. **API token.** Go to **My Profile → API Tokens → Create Token** and use the **Edit Cloudflare Workers** template. Under *Account Resources*, choose only your account. Under *Zone Resources*, choose **All zones from an account**, which is enough for workers.dev. Create the token and copy it. Cloudflare shows it only once.
4. **Account ID.** Find it in the dashboard (**Workers & Pages → Overview**, right-hand column, or the account home page).
5. **GitHub secrets.** In `AlphaLord2008/orbital`, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 3
   - `CLOUDFLARE_ACCOUNT_ID`: the ID from step 4
6. **Recommended: protect `main`.** Go to **Settings → Branches → Add branch ruleset** for `main`. Require a pull request, and require these status checks to pass: `Python 3.11 (v0.1 suite)`, `Python 3.12 (v0.1 suite)`, `Pre-registration integrity (requirements-0.1.1 frozen)`, `Web (format, lint, typecheck, unit, boundary, build, size)`, the three `E2E smoke (…)` checks and `Lighthouse (local build, production headers)`.

Never commit the token. It belongs only in GitHub secrets.

## What happens after setup

| Event | Result |
|---|---|
| Pull request from this repository | A new Worker *version* is uploaded but not made live. The PR gets a comment with `https://pr-<n>-orbital-web.<subdomain>.workers.dev`. The job checks the served CSP and caching headers with `curl` and runs Lighthouse against that URL. |
| Push to `main` (a merged PR) | `wrangler deploy` makes that build live at `https://orbital-web.<subdomain>.workers.dev`, then checks headers and runs Lighthouse. |
| **Actions → Deploy → Run workflow** with a version ID | Production rolls back to that version (`wrangler rollback`). |

Without the secrets, the Deploy workflow runs but every job is skipped with a notice. CI is unaffected.

## Rollback rehearsal (once, to close ADR-0006)

1. After two production deploys exist, list the versions with `npx wrangler versions list --name orbital-web`. You can also get it from **Workers & Pages → orbital-web → Deployments**.
2. Run **Actions → Deploy → Run workflow** with the older version ID.
3. Check that the production URL serves the older build. The commit shown under the ORBITAL title changes back.
4. Roll forward the same way to the newer version ID, then record both run links in `docs/validation/wa1-verification.md`.
