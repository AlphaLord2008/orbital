/**
 * Rendering (WA-D1, WA-N4): the 3D view at pixel ratios 1 and 2 and after a resize, checked from
 * the actually rendered pixels, and the no-WebGL fallback.
 *
 * The 3D tests need WebGL 2. Where the browser under test has none (CI's headless Firefox
 * blocklists WebGL 2 on software rendering), they are reported as skipped with that reason:
 * 3D rendering is then NOT verified in that browser. The fallback test runs everywhere.
 */
import { expect, type Page, test } from '@playwright/test';

async function webgl2Renderer(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'webgl2';
  });
}

/** Spacecraft-accent pixels (#ff9548 lines) within `r` CSS px of (x, y) in the rendered canvas alone. */
async function accentPixelsNear(page: Page, x: number, y: number, r: number): Promise<number> {
  // Hide every DOM layer above the canvas so only WebGL output is sampled.
  // (CSSOM, not a <style> tag: the production CSP forbids inline style elements.)
  await page.evaluate(() => {
    const sel =
      '.scene-overlay,.scene-inset,header,.hud-left,.hud-right,.hud-legend,.hud-bottom,.hud-panel,.scene-banner';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(100);
  const shot = await page.screenshot({ scale: 'css' });
  await test.info().attach('canvas-only', { body: shot, contentType: 'image/png' });
  const png = shot.toString('base64');
  return page.evaluate(
    async ({ png, x, y, r }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return -1;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(Math.round(x - r), Math.round(y - r), 2 * r + 1, 2 * r + 1).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [R, G, B] = [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0];
        if (R > 190 && G > 100 && G < 200 && B < 130) n++;
      }
      return n;
    },
    { png, x, y, r },
  );
}

async function markerCentre(page: Page): Promise<{ x: number; y: number }> {
  const t = await page.locator('.mk-craft').getAttribute('transform');
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t ?? '');
  if (!m) throw new Error(`marker transform: ${String(t)}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

async function checkView(page: Page, dpr: number, label: string) {
  const geo = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.scene canvas');
    const host = c?.parentElement;
    if (!c || !host) return null;
    const r = c.getBoundingClientRect();
    return {
      css: [r.width, r.height],
      host: [host.clientWidth, host.clientHeight],
      buffer: [c.width, c.height],
    };
  });
  expect(geo, label).not.toBeNull();
  if (!geo) return;
  // The canvas element covers exactly its container, and its buffer is container × pixel ratio.
  expect(geo.css, `${label}: canvas CSS size`).toEqual(geo.host);
  const ratio = Math.min(2, dpr);
  const [hostW = 0, hostH = 0] = geo.host;
  expect(geo.buffer[0], `${label}: buffer width`).toBe(Math.floor(hostW * ratio));
  expect(geo.buffer[1], `${label}: buffer height`).toBe(Math.floor(hostH * ratio));
  // The overlay marker sits on the rendered trajectory: accent line pixels within 4 px of it.
  const m = await markerCentre(page);
  expect(m.x, `${label}: marker on screen`).toBeGreaterThan(0);
  expect(m.x).toBeLessThan(hostW);
  expect(
    await accentPixelsNear(page, m.x, m.y, 4),
    `${label}: rendered line under the marker`,
  ).toBeGreaterThan(3);
}

for (const dpr of [1, 2]) {
  test.describe(`pixel ratio ${String(dpr)}`, () => {
    test.use({ deviceScaleFactor: dpr, viewport: { width: 1280, height: 800 } });

    test('the 3D view fills the window, the marker sits on the rendered orbit, and both survive a resize', async ({
      page,
      browserName,
    }, info) => {
      test.setTimeout(120_000); // software rendering at 2× is slow
      await page.goto('/');
      const renderer = await webgl2Renderer(page);
      info.annotations.push({ type: 'renderer', description: renderer ?? 'none' });
      test.skip(
        renderer === null,
        `${browserName} here has no WebGL 2: 3D rendering is not verified in this browser`,
      );

      await expect(page.getByText(/Bound · circular/)).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole('application', {
          name: /Orbit view: bound orbit, completed, 55,537 computed samples/,
        }),
      ).toBeVisible();
      // Deterministic frame: top-down camera (nothing hidden behind the Earth), paused at sample 555.
      await page.getByRole('button', { name: 'Top-down' }).click();
      const pause = page.getByRole('button', { name: 'Pause' });
      if (await pause.isVisible()) await pause.click();
      await page.getByRole('slider', { name: 'Playback time' }).press('Home');
      await page.getByRole('slider', { name: 'Playback time' }).press('PageUp'); // sample 555: the solid past line ends at the marker
      await page.waitForTimeout(1200); // camera flight (700 ms) settles
      await checkView(page, dpr, `${String(dpr)}x 1280×800`);

      await page.reload();
      await page.setViewportSize({ width: 900, height: 700 });
      await expect(page.getByText(/Bound · circular/)).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Top-down' }).click();
      const pause2 = page.getByRole('button', { name: 'Pause' });
      if (await pause2.isVisible()) await pause2.click();
      await page.getByRole('slider', { name: 'Playback time' }).press('Home');
      await page.getByRole('slider', { name: 'Playback time' }).press('PageUp'); // sample 555: the solid past line ends at the marker
      await page.setViewportSize({ width: 1100, height: 760 }); // resize with a live view
      await page.waitForTimeout(1200);
      await checkView(page, dpr, `${String(dpr)}x resized to 1100×760`);
    });
  });
}

test('without WebGL the app says so and every readout still works (WA-N4)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    // Simulate a browser without WebGL: every WebGL context request fails.
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => unknown;
    };
    const orig = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/i.test(type) ? null : orig.call(this, type, ...rest);
    };
  });
  await page.goto('/');
  await expect(
    page.getByText(/The 3D view could not start because WebGL is unavailable/),
  ).toBeVisible();
  await expect(page.getByText(/Bound · circular/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.orb-stamp')).toHaveText(/sample \d/);
  await page.getByLabel('Preset').selectOption('I1');
  await expect(page.getByText('Bound · reaches the surface')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
