import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Hardware rendering (WA-6): the same e2e files, but each browser draws with the machine's GPU
 * instead of CI's software rasteriser, so 3D rendering and the amendment-A1 interactive figures
 * are measured on real hardware. Use it on the reference devices (requirements §6.1):
 *
 *   pnpm exec playwright test -c playwright.hw.config.ts                     # local build
 *   ORBITAL_BASE_URL=https://… pnpm exec playwright test -c playwright.hw.config.ts perf
 *
 * Chromium uses its full (new-headless) build with GPU compositing; on macOS through Metal.
 * Firefox and WebKit use their own WebGL as shipped. Each test records the renderer string, so a
 * report always says which GPU produced it. A software renderer is never a device class.
 */
const angle = process.platform === 'darwin' ? ['--use-angle=metal'] : [];

export default defineConfig({
  ...base,
  // One test at a time: parallel workers contend for the CPU and GPU and inflate the latency
  // figures (measured: worst input 216 ms with five workers, 32 ms alone, same build and GPU).
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: { args: [...angle, '--enable-gpu', '--ignore-gpu-blocklist'] },
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
