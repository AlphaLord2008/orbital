// Runs the same accessibility checks against both builds and prints a results table.
// Usage: node evaluate.mjs   (CHROMIUM_PATH=... to use a specific Chromium build)
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = join('dist', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!existsSync(p)) return res.writeHead(404).end();
  res.setHeader('content-type', types[extname(p)] ?? 'application/octet-stream');
  res.end(readFileSync(p));
}).listen(4300);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const results = {};
for (const lib of ['radix', 'rac']) {
  const r = (results[lib] = {});
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4300/${lib}/${lib}.html`);
  const field = page.getByLabel('Altitude (km)');
  const slider = page.getByRole('slider');
  const state = page.locator('#state');
  const committed = async () => Number((await state.textContent()).split('=')[1]);

  r.axeViolations = (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id);
  r.fieldRole = await field.evaluate((el) => el.getAttribute('role') ?? el.tagName.toLowerCase() + '[type=' + el.type + ']');
  r.fieldAriaRoleDescription = await field.getAttribute('aria-roledescription');
  r.sliderName = await slider.evaluate((el) => el.getAttribute('aria-label') ?? (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby').split(' ')[0])?.textContent : null));
  r.sliderValueText = await slider.getAttribute('aria-valuetext');

  await field.click();
  await page.keyboard.press('ArrowUp');
  r.fieldArrowUpCommits = (await committed()) === 401;

  await field.fill('12,500');
  await page.keyboard.press('Tab');
  r.groupedNumberParsed = (await committed()) === 12500;

  const beforeInvalid = await committed();
  await field.fill('-50');
  await page.keyboard.press('Tab');
  r.outOfRangeKeptVisible = (await field.inputValue()).replace(/[\s−]/g, (c) => (c === '−' ? '-' : '')) === '-50';
  r.outOfRangeNotCommitted = (await committed()) === beforeInvalid;
  r.invalidFlagged = (await field.getAttribute('aria-invalid')) === 'true';
  const described = await field.getAttribute('aria-describedby');
  r.errorLinkedByDescribedBy = described
    ? (await page.evaluate((ids) => ids.split(' ').map((i) => document.getElementById(i)?.textContent ?? '').join(' '), described)).includes('100 to 100')
    : false;

  await slider.focus();
  const before = await committed();
  await page.keyboard.press('ArrowRight');
  r.sliderArrowRight = (await committed()) === before + 1;
  await page.keyboard.press('Home');
  r.sliderHome = (await committed()) === 100;
  await page.keyboard.press('End');
  r.sliderEnd = (await committed()) === 100000;
  await page.keyboard.press('PageDown');
  r.sliderPageDownMoves = (await committed()) < 100000;
  r.sliderSyncsField = (await field.inputValue()).replace(/\D/g, '') === String(await committed());
  r.sliderValueTextAfter = await slider.getAttribute('aria-valuetext');
  await context.close();
}
await browser.close();
server.close();

console.log(JSON.stringify(results, null, 2));
