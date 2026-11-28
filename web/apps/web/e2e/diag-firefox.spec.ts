/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 2. Round 1 showed plain axe.run
 * passes on every page, region and rule in Firefox, so this isolates what differs in the failing
 * test: AxeBuilder (runPartial), the fixture page, and time since load.
 */
import { expect, test, type Page } from '@playwright/test';

const E1A = '/?v=1&h=400000&k=1.1&dt=1&d=2o&m=a';

async function ready(page: Page, url: string) {
  page.on('console', (m) => {
    console.log(`DIAG console ${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('crash', () => {
    console.log(`DIAG crash event at ${new Date().toISOString()}`);
  });
  await page.goto(url);
  await expect(page.locator('main')).toHaveAttribute('data-run-seq', /\d+/, { timeout: 15_000 });
  console.log(`DIAG ready at ${new Date().toISOString()}`);
}

async function builder(page: Page, legacy = false) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const b = new AxeBuilder({ page });
  if (legacy) b.setLegacyMode(true);
  const r = await b.analyze();
  return r.violations.length;
}

test('A: exact failing flow (AxeBuilder, Analyze E1)', async ({ page }) => {
  await ready(page, E1A);
  console.log(`DIAG A violations ${String(await builder(page))}`);
});

test('B: AxeBuilder legacy mode, Analyze E1', async ({ page }) => {
  await ready(page, E1A);
  console.log(`DIAG B violations ${String(await builder(page, true))}`);
});

test('C: no axe at all, Analyze E1 idle 8 s', async ({ page }) => {
  await ready(page, E1A);
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(500);
    console.log(
      `DIAG C t+${String((i + 1) * 0.5)}s alive=${String(await page.evaluate(() => 1 + 1))}`,
    );
  }
});

test('D: AxeBuilder on Explore V0 (control)', async ({ page }) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=e');
  console.log(`DIAG D violations ${String(await builder(page))}`);
});

test('E: AxeBuilder on Analyze V0', async ({ page }) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=a');
  console.log(`DIAG E violations ${String(await builder(page))}`);
});

test('F: Analyze E1 paused, then AxeBuilder', async ({ page }) => {
  await ready(page, E1A);
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isVisible()) await pause.click();
  console.log(`DIAG F violations ${String(await builder(page))}`);
});

test('G: Explore V0 idle 8 s (control for C)', async ({ page }) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=e');
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(500);
    console.log(
      `DIAG G t+${String((i + 1) * 0.5)}s alive=${String(await page.evaluate(() => 1 + 1))}`,
    );
  }
});
