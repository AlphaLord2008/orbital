/**
 * TEMPORARY diagnostic (diag branch only, never merged), round 9 (which element). Round 2: the content process
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
    console.log(`DIAG9 ${name} ok`);
  } catch (e) {
    console.log(
      `DIAG9 ${name} ${crashed ? 'CRASH' : 'ERROR'} ${(e as Error).message.split('\n')[0] ?? ''}`,
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

type Ctx = { include: string[]; exclude?: string[] };
async function ruleOn(page: Page, ctx: Ctx, rule: string) {
  await ready(page, APP);
  await page.waitForTimeout(500);
  await page.evaluate(AXE);
  return page.evaluate(
    async ({ c, r }) => {
      const axe = (
        window as unknown as {
          axe: { run: (c: unknown, o: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      return (await axe.run(c, { runOnly: { type: 'rule', values: [r] } })).violations.length;
    },
    { c: ctx, r: rule },
  );
}

const TARGETS: Record<string, Ctx> = {
  'card section only (descendants excluded)': {
    include: ['.hud-left'],
    exclude: ['.hud-left section > *'],
  },
  h2: { include: ['.hud-left h2'] },
  'preset select': { include: ['#preset'] },
  'number inputs': { include: ['.hud-left input[inputmode="decimal"]'] },
  'range inputs': { include: ['.hud-left input[type="range"]'] },
  'field labels': { include: ['.hud-left label'] },
  'camera buttons': { include: ['.hud-left .cam-seg'] },
  'help text': { include: ['.hud-left .orb-field__msg'] },
};

for (const rule of ['aria-allowed-attr', 'nested-interactive', 'landmark-unique'])
  for (const [name, ctx] of Object.entries(TARGETS))
    for (let k = 1; k <= 2; k++)
      test(`elem ${rule} on ${name} #${String(k)}`, async ({ page }) => {
        await run(page, `${rule} on ${name}`, () => ruleOn(page, ctx, rule));
      });
