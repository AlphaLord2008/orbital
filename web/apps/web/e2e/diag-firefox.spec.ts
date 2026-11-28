/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 4 (timing window). Round 2: the content process
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

const METHODS: Record<string, (page: Page) => Promise<unknown>> = {
  'plain+0ms': (page) => plainAt(page, 0),
  'plain+250ms': (page) => plainAt(page, 250),
  'plain+500ms': (page) => plainAt(page, 500),
  'plain+1000ms': (page) => plainAt(page, 1000),
  'plain+3000ms': (page) => plainAt(page, 3000),
  'plain+0ms, no replaceState': async (page) => {
    await page.addInitScript(() => {
      history.replaceState = () => undefined;
    });
    return plainAt(page, 0);
  },
  'plain+0ms, bare URL (no link decode)': async (page) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-run-seq', /\d+/, { timeout: 15_000 });
    await page.evaluate(AXE);
    return page.evaluate(
      async () =>
        (
          await (
            window as unknown as { axe: { run: () => Promise<{ violations: unknown[] }> } }
          ).axe.run()
        ).violations.length,
    );
  },
};

for (let i = 1; i <= 6; i++)
  for (const [name, fn] of Object.entries(METHODS))
    test(`${name} #${String(i)}`, async ({ page }) => {
      let crashed = false;
      page.on('crash', () => {
        crashed = true;
      });
      try {
        await fn(page);
        console.log(`DIAG4 ${name} ok`);
      } catch (e) {
        console.log(
          `DIAG4 ${name} ${crashed ? 'CRASH' : 'ERROR'} ${(e as Error).message.split('\n')[0] ?? ''}`,
        );
      }
    });
