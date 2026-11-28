/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 7 (inside the scenario card). Round 2: the content process
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
    console.log(`DIAG7 ${name} ok`);
  } catch (e) {
    console.log(
      `DIAG7 ${name} ${crashed ? 'CRASH' : 'ERROR'} ${(e as Error).message.split('\n')[0] ?? ''}`,
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

const EXCLUDES = [
  null,
  '.hud-left',
  '#preset',
  '.hud-left input[inputmode="decimal"]',
  '.hud-left input[type="range"]',
  '.hud-left .orb-slider',
  '.hud-left .cam-seg',
  '.hud-left .orb-field__msg',
  '.hud-left .orb-card__title',
];
for (let i = 1; i <= 4; i++)
  for (const ex of EXCLUDES)
    test(`exclude ${ex ?? 'nothing'} #${String(i)}`, async ({ page }) => {
      await run(page, `build=${BUILD} exclude=${ex ?? 'nothing'}`, () => plainExcluding(page, ex));
    });
