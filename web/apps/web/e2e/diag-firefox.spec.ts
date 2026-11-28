/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 3. Round 2: the content process
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

async function builder(page: Page, legacy: boolean) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const b = new AxeBuilder({ page });
  if (legacy) b.setLegacyMode(true);
  return (await b.analyze()).violations.length;
}

const METHODS: Record<string, (page: Page) => Promise<unknown>> = {
  'builder-app': async (page) => {
    await ready(page, APP);
    return builder(page, false);
  },
  'legacy-app': async (page) => {
    await ready(page, APP);
    return builder(page, true);
  },
  'plain-app': async (page) => {
    await ready(page, APP);
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
  'builder-static': async (page) => {
    await ready(page, '/methodology.html');
    return builder(page, false);
  },
  'newpage-app': async (page) => {
    await ready(page, APP);
    const p2 = await page.context().newPage();
    await p2.close();
    await page.waitForTimeout(500);
    return page.evaluate(() => 1 + 1);
  },
};

for (let i = 1; i <= 8; i++)
  for (const [name, fn] of Object.entries(METHODS))
    test(`${name} #${String(i)}`, async ({ page }) => {
      let crashed = false;
      page.on('crash', () => {
        crashed = true;
      });
      try {
        await fn(page);
        console.log(`DIAG3 ${name} ok`);
      } catch (e) {
        console.log(
          `DIAG3 ${name} ${crashed ? 'CRASH' : 'ERROR'} ${(e as Error).message.split('\n')[0] ?? ''}`,
        );
      }
    });
