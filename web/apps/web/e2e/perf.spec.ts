/**
 * Interactive performance (requirements-web-alpha §6.2, amendment A1): frame rate, frame pacing,
 * input latency and main-thread blocking during real playback.
 *
 * CI runs this with software rendering (no GPU). Software rendering is not a reference device
 * class, so there the test gates that the scene keeps producing frames and every input completes,
 * and records frame and latency figures without judging them. On a hardware renderer it also
 * gates INP ≤ 200 ms (§6.3.5). On reference devices run the same file against the
 * live site with a GPU browser, e.g.
 *   ORBITAL_BASE_URL=https://orbital-web.harshuvaibhav.workers.dev pnpm exec playwright test perf --project=chromium --headed
 * and compare the printed report with the class budgets.
 */
import { expect, test } from '@playwright/test';

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
  await expect(page.getByText('Bound · circular orbit')).toBeVisible({ timeout: 15_000 });
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
  await expect(page.getByText('Bound · elliptical orbit')).toBeVisible({ timeout: 15_000 });
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

  expect(intervals.length).toBeGreaterThan(40); // the scene keeps rendering during autoplay (≥ 5 fps)
  const software = /SwiftShader|llvmpipe|softpipe|software/i.test(report.renderer);
  if (!software)
    expect(report.inputLatencyMs.worst).toBeLessThanOrEqual(200); // §6.3.5
  else
    info.annotations.push({
      type: 'software rendering',
      description: 'INP recorded, not gated (not a device class)',
    });
});
