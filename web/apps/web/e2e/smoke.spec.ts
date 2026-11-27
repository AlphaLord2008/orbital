import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __cspViolations: { directive: string; blocked: string }[];
    __inlineRan?: boolean;
  }
}

// Record every CSP violation the page reports, from the very first script onwards.
async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI });
    });
  });
}

test('shell renders with the build commit and engine conformance', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await watchCsp(page);

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'ORBITAL' })).toBeVisible();
  await expect(
    page.getByText(/Web Alpha · build [0-9a-f]{7}|Web Alpha · build unknown/),
  ).toBeVisible();
  await expect(page.getByText('Browser engine conformance: Python orbital 0.1.1')).toBeVisible();

  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('production security headers are served', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).not.toContain('unsafe-inline');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cache-control']).toBe('no-cache');
});

test('the CSP is enforced: an injected inline script is blocked and reported', async ({ page }) => {
  await watchCsp(page);
  await page.goto('/');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__inlineRan = true;';
    document.body.appendChild(s);
  });
  await expect
    .poll(() => page.evaluate(() => window.__cspViolations.map((v) => v.directive)))
    .toContain('script-src-elem');
  expect(await page.evaluate(() => window.__inlineRan === true)).toBe(false);
});

test('no automatically detectable accessibility violations (axe)', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
