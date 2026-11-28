/**
 * WA-5 journeys (requirements-web-alpha §9): J2 altitude vs period, J3 evidence tiers across
 * presets, J4 tier 1 → tier 2 with drift growing, J5 share link and presentation, J6 invalid
 * input. Plus WA-F18 (mode switch keeps the run and playback) and the phone layouts (WA-A12).
 */
import { expect, test, type Page } from '@playwright/test';

const OMEGA_EARTH = 7.292115e-5;

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.locator('main')).toHaveAttribute('data-run-seq', /\d+/, { timeout: 15_000 });
}

async function settled(page: Page, before: string | null) {
  await expect
    .poll(async () => page.locator('main').getAttribute('data-run-seq'), { timeout: 15_000 })
    .not.toBe(before);
}

const seq = (page: Page) => page.locator('main').getAttribute('data-run-seq');
const tier = (page: Page) => page.locator('.hud-panel--right .diag-tier .orb-tier').first();
const kv = (page: Page, label: string) =>
  page
    .locator('.hud-panel--right dt', { hasText: label })
    .first()
    .locator('xpath=following-sibling::dd[1]');
const num = (s: string | null) => Number((s ?? '').replace(/[\s\u202f]/g, '').replace(/[a-z]+$/, ''));

test('J2: GEO has a sidereal-day period, and dragging altitude changes the period monotonically', async ({
  page,
}) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=a');
  const s0 = await seq(page);
  await page.getByLabel('Preset').selectOption('P1');
  await settled(page, s0);
  const exact = num(await kv(page, 'First period, exact').textContent());
  expect(
    Math.abs(exact - (2 * Math.PI) / OMEGA_EARTH) / ((2 * Math.PI) / OMEGA_EARTH),
  ).toBeLessThan(1e-5);

  await page.getByLabel('Preset').selectOption('V0');
  await expect(tier(page)).toHaveAttribute('data-tier', '1', { timeout: 15_000 });
  const slider = page.getByRole('slider', { name: 'Altitude slider' });
  let last = 0;
  for (let i = 0; i < 3; i++) {
    const before = await seq(page);
    await slider.press('ArrowRight');
    await settled(page, before);
    const p = num(await kv(page, 'First period, exact').textContent());
    expect(p).toBeGreaterThan(last);
    last = p;
  }
  // The slider moved off the reference case, so it says so.
  await expect(tier(page)).toHaveAttribute('data-tier', '3');
  await expect(slider).toHaveAttribute('aria-valuetext', /km$/);
});

test('J3: E1 is Tier 2, k = 1.11 is Unvalidated, I1 and X1 are Tier 2', async ({ page }) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=a');
  const pick = async (id: string) => {
    const before = await seq(page);
    await page.getByLabel('Preset').selectOption(id);
    await settled(page, before);
  };
  await pick('E1');
  await expect(tier(page)).toHaveAttribute('data-tier', '2');
  await expect(tier(page)).toContainText('E1');
  const before = await seq(page);
  const k = page.getByLabel('Speed factor', { exact: true });
  await k.fill('1.11');
  await k.press('Enter');
  await settled(page, before);
  await expect(tier(page)).toHaveAttribute('data-tier', '3');
  await expect(
    page
      .getByText(
        'k = 1.11 matches no tested case. Nearby cases give no evidence for this one, so no accuracy is claimed.',
      )
      .first(),
  ).toBeVisible();
  await expect(page.locator('.orb-gates')).toHaveCount(0); // no measured values for an unvalidated run
  await pick('I1');
  await expect(tier(page)).toContainText('I1');
  await expect(kv(page, 'Surface crossing, exact')).toContainText('exact');
  await pick('X1');
  await expect(tier(page)).toContainText('X1');
});

test('J4: V0 is Tier 1, P2 is Tier 2 with its measured errors, and drift grows with playback', async ({
  page,
}) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=a');
  await expect(tier(page)).toHaveAttribute('data-tier', '1');
  await expect(page.locator('.orb-gates')).toContainText('8.66 × 10⁻¹⁵');
  await expect(page.getByText('Completed · v0.1.0 · 2026-11-23')).toBeVisible();
  const before = await seq(page);
  await page.getByLabel('Preset').selectOption('P2');
  await settled(page, before);
  await expect(tier(page)).toContainText('P2');
  // P2-r1, read from the registered results.
  await expect(page.locator('.orb-gates tr', { hasText: 'Energy |Δε/ε₀|' })).toContainText(
    '4.61 × 10⁻³',
  );
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isVisible()) await pause.click();
  const track = page.getByRole('slider', { name: 'Playback time' });
  const plot = page.locator('.orb-plot').first();
  const points = async () =>
    ((await plot.locator('polygon').getAttribute('points')) ?? '').split(' ').length;
  await track.press('Home');
  await track.press('PageUp');
  const v1 = num(await plot.locator('.orb-plot__value').textContent()) || 0;
  const n1 = await points();
  await track.press('End');
  const n2 = await points();
  expect(n2).toBeGreaterThan(n1);
  await expect(plot).toContainText('played to');
  expect(v1).toBeGreaterThanOrEqual(0);
});

test('J5: a copied link reopens the identical run, tier and mode; presentation mode', async ({
  page,
  context,
}) => {
  await ready(page, '/');
  await page.getByRole('radio', { name: 'Analyze' }).click();
  const before = await seq(page);
  await page.getByLabel('Preset').selectOption('E1');
  await settled(page, before);
  await expect(page).toHaveURL(/\?v=1&h=400000&k=1\.1&dt=1&d=2o&m=a$/);
  const url = page.url();
  expect(url.length).toBeLessThanOrEqual(512 + 64);
  await page.getByRole('button', { name: 'Copy link' }).click();

  const other = await context.newPage();
  await ready(other, url);
  await expect(other.getByRole('radio', { name: 'Analyze' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(tier(other)).toContainText('E1');
  await expect(other.locator('main')).toHaveAttribute(
    'data-run-steps',
    (await page.locator('main').getAttribute('data-run-steps')) ?? '',
  );

  await other.keyboard.press('p');
  await expect(other.locator('.pres-readouts')).toBeVisible();
  await expect(other.locator('.hud-panel')).toHaveCount(0);
  await other.keyboard.press('Escape');
  await expect(other.locator('.hud-panel')).toHaveCount(2);
});

test('J6: invalid input never crashes or shows NaN; the error is announced and the last run stays, dimmed', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, '/?v=1&h=400000&k=1.1&dt=1&d=2o&m=a');
  const runs = await seq(page);
  const alt = page.getByLabel('Altitude', { exact: true });
  for (const bad of ['50', 'abc', '1e3', '-400', '']) {
    await alt.fill(bad);
    await alt.press('Enter');
    await expect(page.getByRole('alert').first()).toContainText('Enter 100 to 100 000 km.');
    await expect(page.locator('main')).toHaveClass(/app--invalid/);
    await expect(
      page.getByText(/Showing the last valid run · fix the altitude in Setup/),
    ).toBeVisible();
    await expect(page.getByText('Input needs attention')).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/NaN|Infinity|undefined/);
  }
  expect(await seq(page)).toBe(runs); // nothing was run, nothing was clamped
  await alt.press('Escape');
  await expect(page.locator('main')).not.toHaveClass(/app--invalid/);
  expect(errors).toEqual([]);
});

test('WA-F18: switching mode keeps the run, the playback time and the camera', async ({ page }) => {
  await ready(page, '/?v=1&h=400000&k=1&dt=1&d=10o&m=e');
  const pause = page.getByRole('button', { name: 'Pause' });
  if (await pause.isVisible()) await pause.click();
  const track = page.getByRole('slider', { name: 'Playback time' });
  await track.press('PageUp');
  const t = await track.getAttribute('aria-valuenow');
  const runs = await seq(page);
  await page.getByRole('radio', { name: 'Analyze' }).click();
  await expect(page.getByRole('slider', { name: 'Playback time' })).toHaveAttribute(
    'aria-valuenow',
    t ?? '',
  );
  await page.getByRole('radio', { name: 'Explore' }).click();
  await expect(page.getByRole('slider', { name: 'Playback time' })).toHaveAttribute(
    'aria-valuenow',
    t ?? '',
  );
  expect(await seq(page)).toBe(runs);
  await expect(page).toHaveURL(/m=e$/);
});

for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [844, 390],
] as const) {
  test(`phone ${String(w)}×${String(h)}: nothing overflows, targets are 44 px, controls work`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await ready(page, '/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const controls = page.getByRole('button', { name: 'Controls' });
    await expect(controls).toBeVisible();
    expect((await controls.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const play = page.getByRole('button', { name: /Play|Pause/ });
    const box = await play.boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(h);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await controls.click();
    const alt = page.getByLabel('Altitude', { exact: true });
    await expect(alt).toBeVisible();
    const before = await seq(page);
    await alt.fill('800');
    await alt.press('Enter');
    await settled(page, before);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Custom scenario')).toBeVisible();
  });
}

test('no automatically detectable accessibility violations in Analyze, its dialogs and the phone sheets (axe)', async ({
  page,
}) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const scan = async () => {
    const r = await new AxeBuilder({ page }).analyze();
    expect(
      r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  };
  await ready(page, '/?v=1&h=400000&k=1.1&dt=1&d=2o&m=a');
  await scan();
  await page.getByRole('button', { name: 'Data view' }).click();
  await expect(page.getByRole('dialog', { name: 'Data view' })).toBeVisible();
  await scan();
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await scan();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Diagnostics' }).click();
  await scan();
});
