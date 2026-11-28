/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 5 (tracing). Round 2: the content process
 * segfaults (signal 11) nondeterministically, on Explore as well as Analyze. This measures crash
 * rates per method, interleaved so position in the run cannot explain a difference.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
const AXE = readFileSync(
  require.resolve('axe-core/axe.min.js', {
    paths: [dirname(require.resolve('@axe-core/playwright'))],
  }),
  'utf8',
);
const APP = '/?v=1&h=400000&k=1&dt=1&d=10o&m=e';

async function ready(page: Page, url: string) {
  await page.goto(url);
  if (url.includes('methodology')) await expect(page.locator('h1')).toBeVisible();
  else
    await expect(page.locator('main')).toHaveAttribute('data-run-seq', /\d+/, { timeout: 15_000 });
}

async function plainAt(page: Page, delay: number) {
  await ready(page, APP);
  if (delay) await page.waitForTimeout(delay);
  await page.evaluate(AXE);
  return page.evaluate(
    async () =>
      (
        await (
          window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }
        ).axe.run()
      ).violations.length,
  );
}

async function run(page: Page, name: string, fn: () => Promise<unknown>) {
  let crashed = false;
  page.on('crash', () => {
    crashed = true;
  });
  try {
    await fn();
    console.log(`DIAG5 ${name} ok`);
  } catch (e) {
    console.log(
      `DIAG5 ${name} ${crashed ? 'CRASH' : 'ERROR'} ${(e as Error).message.split('\n')[0] ?? ''}`,
    );
  }
}

for (let i = 1; i <= 8; i++) {
  test.describe(`trace on #${String(i)}`, () => {
    test.use({ trace: 'retain-on-failure' });
    test('fixture page', async ({ page }) => {
      await run(page, 'trace=retain-on-failure (config)', () => plainAt(page, 500));
    });
  });
  test.describe(`trace off #${String(i)}`, () => {
    test.use({ trace: 'off' });
    test('fixture page', async ({ page }) => {
      await run(page, 'trace=off', () => plainAt(page, 500));
    });
  });
  test.describe(`trace on, own context #${String(i)}`, () => {
    test.use({ trace: 'retain-on-failure' });
    test('browser.newContext', async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await run(page, 'trace=retain-on-failure, browser.newContext', () => plainAt(page, 500));
      await ctx.close();
    });
  });
}
