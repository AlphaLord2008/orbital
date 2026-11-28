/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 8 (rules on the scenario card). Round 2: the content process
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
    console.log(`DIAG8 ${name} ok`);
  } catch (e) {
    console.log(
      `DIAG8 ${name} ${crashed ? 'CRASH' : 'ERROR'} ${(e as Error).message.split('\n')[0] ?? ''}`,
    );
  }
}

const BUILD = process.env['DIAG_BUILD'] ?? 'wa5';

async function plainExcluding(page: Page, exclude: string | null) {
  await ready(page, APP);
  await page.waitForTimeout(500);
  await page.evaluate(AXE);
  return page.evaluate(async (ex) => {
    const axe = (
      window as unknown as { axe: { run: (c: unknown) => Promise<{ violations: unknown[] }> } }
    ).axe;
    return (await axe.run(ex ? { exclude: [ex] } : document)).violations.length;
  }, exclude);
}

async function onCard(page: Page, rules: string[] | null) {
  await ready(page, APP);
  await page.waitForTimeout(500);
  await page.evaluate(AXE);
  return page.evaluate(async (r) => {
    const axe = (
      window as unknown as {
        axe: { run: (c: unknown, o: unknown) => Promise<{ violations: unknown[] }> };
      }
    ).axe;
    return (
      await axe.run({ include: ['.hud-left'] }, r ? { runOnly: { type: 'rule', values: r } } : {})
    ).violations.length;
  }, rules);
}

for (let i = 1; i <= 4; i++)
  test(`card, all rules #${String(i)}`, async ({ page }) => {
    await run(page, 'card all-rules', () => onCard(page, null));
  });

test('card, one rule at a time', async ({ browser }) => {
  test.setTimeout(900_000);
  const c0 = await browser.newContext();
  const p0 = await c0.newPage();
  await p0.goto('/methodology.html');
  await p0.evaluate(AXE);
  const ids = await p0.evaluate(() =>
    (window as unknown as { axe: { getRules: () => { ruleId: string }[] } }).axe
      .getRules()
      .map((r) => r.ruleId),
  );
  await c0.close();
  for (const id of ids) {
    for (let k = 0; k < 2; k++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await run(page, `card rule=${id}`, () => onCard(page, [id]));
      await ctx.close();
    }
  }
});
