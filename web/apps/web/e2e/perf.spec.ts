/**
 * Interactive performance (requirements-web-alpha §6.2, amendment A1): frame rate, frame pacing,
 * input latency and main-thread blocking during real playback.
 *
 * Two kinds of criteria, kept apart:
 * - Liveness (every renderer, CI included): the rendered canvas keeps changing during autoplay
 *   and the browser never stalls for more than 1 s between frames. A frozen renderer fails this
 *   (verified below by freezing WebGL draws in the page). It says nothing about speed.
 * - Performance (§6.2 budgets and amendment A1): frame rate, pacing, long tasks and INP. These are
 *   judged on reference devices; CI has software rendering (not a device class), so there they are
 *   recorded only. INP ≤ 200 ms (§6.3.5) is also gated whenever the renderer is hardware. On reference devices run the same file against the
 * live site with a GPU browser, e.g.
 *   ORBITAL_BASE_URL=https://orbital-web.harshuvaibhav.workers.dev pnpm exec playwright test perf --project=chromium --headed
 * and compare the printed report with the class budgets.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Pixels that differ between two screenshots of the WebGL canvas alone, `ms` apart. Every DOM layer
 * over the canvas (overlay, panels, readouts, transport) is hidden, so only rendered output counts.
 */
async function canvasChange(page: Page, ms: number): Promise<number> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      '.scene-overlay,.scene-inset,header,.hud-left,.hud-right,.hud-legend,.hud-bottom,.hud-panel,.scene-banner',
    )) {
      el.style.visibility = 'hidden';
    }
  });
  const canvas = page.locator('.scene canvas');
  const a = (await canvas.screenshot({ scale: 'css' })).toString('base64');
  await page.waitForTimeout(ms);
  const b = (await canvas.screenshot({ scale: 'css' })).toString('base64');
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
      '.scene-overlay,.scene-inset,header,.hud-left,.hud-right,.hud-legend,.hud-bottom,.hud-panel,.scene-banner',
    )) {
      el.style.visibility = '';
    }
  });
  return page.evaluate(
    async ({ a, b }) => {
      const load = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('2d context');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [pa, pb] = await Promise.all([load(a), load(b)]);
      let n = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d =
          Math.abs((pa[i] ?? 0) - (pb[i] ?? 0)) +
          Math.abs((pa[i + 1] ?? 0) - (pb[i + 1] ?? 0)) +
          Math.abs((pa[i + 2] ?? 0) - (pb[i + 2] ?? 0));
        if (d > 24) n++;
      }
      return n;
    },
    { a, b },
  );
}

/** Liveness thresholds: renderer-independent, far below any performance budget. */
const LIVE = { changedPixels: 50, windowMs: 2000, maxFrameGapMs: 1000 } as const;

declare global {
  interface Window {
    __perf: { frames: number[]; long: number[]; events: { name: string; duration: number }[] };
  }
}

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Event Timing and Long Tasks APIs: Chromium',
);

test('playback: frame rate, pacing, long tasks and input latency', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const perf = {
      frames: [] as number[],
      long: [] as number[],
      events: [] as { name: string; duration: number }[],
    };
    window.__perf = perf;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) perf.long.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as PerformanceEventTiming[]) {
        if (e.interactionId) perf.events.push({ name: e.name, duration: e.duration });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  await page.goto('/');
  await expect(page.locator('.hud-kind').getByText(/Bound · circular/)).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1500); // past the camera flight and the 4K texture

  // Steady playback (autoplay, as shipped) for 8 s: frame intervals and long tasks.
  await page.evaluate(() => {
    window.__perf.long.length = 0;
    const frames = window.__perf.frames;
    let last = performance.now();
    const t0 = last;
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      if (now - t0 < 8000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(8300);
  const playback = await page.evaluate(() => ({
    frames: [...window.__perf.frames],
    long: [...window.__perf.long],
  }));

  // Interactions during playback: pause/play, scrub by keyboard, change rate, change preset.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  const track = page.getByRole('slider', { name: 'Playback time' });
  for (let i = 0; i < 5; i++) await track.press('ArrowRight');
  await page.getByRole('button', { name: '600×' }).click();
  await page.getByLabel('Preset').selectOption('E1');
  await expect(page.locator('.hud-kind').getByText(/Bound · ellipse/)).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(500);
  const events = await page.evaluate(() => window.__perf.events);

  const q = (a: number[], p: number) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] ?? NaN;
  };
  const intervals = playback.frames.slice(1);
  const seconds = intervals.reduce((a, b) => a + b, 0) / 1000;
  const report = {
    renderer: await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    }),
    fps: intervals.length / seconds,
    frameIntervalMs: {
      p50: q(intervals, 0.5),
      p95: q(intervals, 0.95),
      p99: q(intervals, 0.99),
      max: Math.max(...intervals),
    },
    framesOver2xBudget: intervals.filter((d) => d > 33.4).length,
    longTasks: {
      count: playback.long.length,
      blockingMs: playback.long.reduce((a, d) => a + Math.max(0, d - 50), 0),
      maxMs: Math.max(0, ...playback.long),
    },
    inputLatencyMs: {
      worst: Math.max(0, ...events.map((e) => e.duration)),
      interactions: events.length,
    },
  };
  const text = JSON.stringify(report);
  info.annotations.push({ type: 'interactive performance', description: text });
  console.log(`[perf] ${text}`);

  // Liveness (every renderer): frames keep coming and the rendered image keeps changing.
  expect(report.frameIntervalMs.max, 'longest gap between frames').toBeLessThanOrEqual(
    LIVE.maxFrameGapMs,
  );
  const changed = await canvasChange(page, LIVE.windowMs);
  info.annotations.push({
    type: 'liveness',
    description: `${String(changed)} canvas pixels changed in 2 s`,
  });
  expect(changed, 'rendered canvas changes during autoplay').toBeGreaterThanOrEqual(
    LIVE.changedPixels,
  );
  // Performance: recorded above for every renderer; budgets are judged on reference devices.
  const software = /SwiftShader|llvmpipe|softpipe|software/i.test(report.renderer);
  if (!software)
    expect(report.inputLatencyMs.worst).toBeLessThanOrEqual(200); // §6.3.5
  else
    info.annotations.push({
      type: 'software rendering',
      description: 'INP recorded, not gated (not a device class)',
    });
});

test('liveness check: a frozen renderer fails it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hud-kind').getByText(/Bound · circular/)).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1500);
  expect(await canvasChange(page, LIVE.windowMs), 'live renderer passes').toBeGreaterThanOrEqual(
    LIVE.changedPixels,
  );
  // Freeze the renderer: WebGL draw calls stop doing anything (the page and playback keep running).
  await page.evaluate(() => {
    const proto = WebGL2RenderingContext.prototype as unknown as Record<string, unknown>;
    for (const name of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
    ]) {
      proto[name] = () => undefined;
    }
  });
  await page.waitForTimeout(500);
  expect(await canvasChange(page, LIVE.windowMs), 'frozen renderer is detected').toBeLessThan(
    LIVE.changedPixels,
  );
});
