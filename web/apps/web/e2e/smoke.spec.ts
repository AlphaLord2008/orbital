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
  await expect(page.getByText(/browser engine conformance: Python orbital 0\.1\.1/)).toBeVisible();

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

test('the worker computes the ISS preset and the readouts show sample values (J1)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await watchCsp(page);
  await page.goto('/');
  // J1: orbit visible within 3 s on class A (CI runners are slower; the budget is measured in WA-6).
  await expect(page.getByText(/Bound · circular/)).toBeVisible({ timeout: 10_000 });
  // The 3D view itself is tested in render.spec.ts (it needs WebGL 2); this test needs only the worker.
  await expect(page.locator('main')).toHaveAttribute('data-run-steps', '55536');
  await page.getByLabel('Preset').selectOption('I1');
  await expect(page.getByText('Bound · reaches the surface')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/until impact/)).toBeVisible();
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('rapid inputs: the last input wins and every run is timed (WA-F3, WA-N2)', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.getByText(/Bound · circular/)).toBeVisible({ timeout: 10_000 });
  const main = page.locator('main');
  const seq = async () => Number((await main.getAttribute('data-run-seq')) ?? 0);
  const alt = page.getByLabel('Altitude', { exact: true });
  const times: number[] = [];
  for (let i = 0; i < 12; i++) {
    const before = await seq();
    await alt.fill((500 + 37 * i).toFixed(3)); // a new input every time: no cache hits
    await alt.press('Enter');
    await expect.poll(seq, { timeout: 10_000 }).toBeGreaterThan(before);
    expect(await main.getAttribute('data-run-cached')).toBe('false');
    times.push(Number(await main.getAttribute('data-run-ms')));
  }
  // Superseding inputs without waiting: the last accepted input must be the run shown.
  const seqBefore = await seq();
  for (const km of ['700.000', '800.000', '900.000']) {
    await alt.fill(km);
    await alt.press('Enter');
  }
  // The run on screen was built from r0 = R_E + 900 km (6,378,137 m + 900,000 m)…
  await expect(main).toHaveAttribute('data-run-r0', '7278137', { timeout: 10_000 });
  // …and no later run replaces it (a stale 700/800 km result arriving last would change r0).
  const seqWinner = await seq();
  expect(seqWinner).toBeGreaterThan(seqBefore);
  await page.waitForTimeout(1500);
  expect(await seq()).toBe(seqWinner);
  await expect(main).toHaveAttribute('data-run-r0', '7278137');
  // Deterministic readout: pause and go to sample 0, where the altitude is exactly the input.
  // (During playback the sample-k altitude moves, a few km below 900 on this circular orbit.)
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isVisible()) await pause.click();
  await page.getByRole('slider', { name: 'Playback time' }).press('Home');
  await expect(page.getByText(/sample 0 · t = 0 s/)).toBeVisible();
  await expect(page.locator('.orb-primary__item dd').first()).toHaveText('900.00km');
  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(0.95 * times.length) - 1] ?? NaN;
  const list = times.map((t) => t.toFixed(0)).join(', ');
  info.annotations.push({ type: 'input→orbit ms', description: list });
  console.log(
    `[${info.project.name}] input→orbit p95 ${p95.toFixed(0)} ms over ${String(times.length)} runs: ${list}`,
  );
  // Regression guard on CI runners; the class A–D budgets (§6.2) are measured on reference devices.
  expect(p95).toBeLessThan(1000);
});

test('near-escape inputs compute, and a failed input never passes the old run off as new (Batch B)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText(/Bound · circular/)).toBeVisible({ timeout: 15_000 });
  const k = page.getByLabel('Speed factor', { exact: true });
  const kind = page.locator('.hud-kind');
  await page.getByLabel('Preset').selectOption('X1'); // 1-day run, so near-escape ellipses fit the budget
  await expect(kind).toContainText('Escape', { timeout: 15_000 });
  for (const [value, shown, e] of [
    ['1.41', '1.410', '0.98810'],
    ['1.4142', '1.4142', '0.99996164'],
  ] as const) {
    await k.fill(value);
    await k.press('Enter');
    await expect(kind).toContainText(`e = ${e}`, { timeout: 15_000 });
    await expect(k).toHaveValue(shown); // precision kept: 1.4142 is not shown as 1.414
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
  // Inside the parabolic band the computed run is shown, the exact solution is declared absent.
  await k.fill('1.41421356237');
  await k.press('Enter');
  await expect(kind).toContainText('Parabolic', { timeout: 15_000 });
  await expect(page.getByText(/outside the exact solution's domain/)).toBeVisible();
  // A failed input (over the step budget) keeps the old run visibly labelled as the old run.
  await page.getByLabel('Preset').selectOption('V0');
  await expect(kind).toContainText('circular', { timeout: 15_000 });
  await k.fill('1.4142');
  await k.press('Enter');
  await expect(page.getByText('These inputs were not run')).toBeVisible();
  await expect(page.getByText(/last valid run \(k = 1\.000, 400 km\), dimmed/)).toBeVisible();
});
