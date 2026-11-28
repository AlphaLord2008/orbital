/**
 * TEMPORARY diagnostic (diag branch only, never merged): isolate which page state, DOM region and
 * axe rule crash Firefox's content process. Every attempt runs in a fresh context so one crash
 * does not hide the rest; results are printed as a table.
 */
import { test, type Browser } from '@playwright/test';
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

async function attempt(
  browser: Browser,
  url: string,
  opts: { rules?: string[]; include?: string },
): Promise<string> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url);
    await page.locator('main[data-run-seq]').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await page.evaluate(AXE);
    const n = await page.evaluate(
      async ({ rules, include }) => {
        const w = window as unknown as {
          axe: { run: (c: unknown, o: unknown) => Promise<{ violations: unknown[] }> };
        };
        const r = await w.axe.run(
          include ? { include: [include] } : document,
          rules ? { runOnly: { type: 'rule', values: rules } } : {},
        );
        return r.violations.length;
      },
      { rules: opts.rules, include: opts.include },
    );
    return `ok (${String(n)} violations)`;
  } catch (e) {
    return `FAIL: ${(e as Error).message.split('\n')[0] ?? ''}`;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

const E1A = '/?v=1&h=400000&k=1.1&dt=1&d=2o&m=a';
const PAGES: Record<string, string> = {
  'explore V0': '/?v=1&h=400000&k=1&dt=1&d=10o&m=e',
  'analyze V0': '/?v=1&h=400000&k=1&dt=1&d=10o&m=a',
  'analyze E1': E1A,
  'analyze k1.11': '/?v=1&h=400000&k=1.11&dt=1&d=2o&m=a',
};

test('diag: which page crashes a full axe run', async ({ browser }) => {
  test.setTimeout(300_000);
  for (const [name, url] of Object.entries(PAGES))
    console.log(`DIAG page | ${name} | ${await attempt(browser, url, {})}`);
});

test('diag: which region of Analyze E1 crashes', async ({ browser }) => {
  test.setTimeout(300_000);
  for (const sel of [
    '.hud-header',
    '#controls',
    '#diagnostics',
    '.hud-bottom',
    '.hud-legend',
    '#scene',
    '.scene-overlay',
    '#diagnostics .orb-disclosure',
    '#diagnostics .orb-plot',
    '#diagnostics .orb-gates',
    '#controls .orb-slider',
    '#controls .setup-view',
  ])
    console.log(`DIAG region | ${sel} | ${await attempt(browser, E1A, { include: sel })}`);
});

test('diag: which axe rule crashes on Analyze E1', async ({ browser }) => {
  test.setTimeout(900_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(AXE);
  const rules = await page.evaluate(() =>
    (window as unknown as { axe: { getRules: () => { ruleId: string }[] } }).axe
      .getRules()
      .map((r) => r.ruleId),
  );
  await ctx.close();
  for (const id of rules) {
    const r = await attempt(browser, E1A, { rules: [id] });
    if (!r.startsWith('ok')) console.log(`DIAG rule | ${id} | ${r}`);
  }
  console.log(`DIAG rule | (${String(rules.length)} rules tried; only failures listed)`);
});
