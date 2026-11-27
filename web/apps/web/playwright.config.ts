import { defineConfig, devices } from '@playwright/test';

// Smoke tests run against the production build, served with the production _headers
// (CSP included), in all three engines (requirements §11; roadmap WA-1 item 2).
// ORBITAL_BASE_URL (e.g. a deployed Version URL) runs the same tests against a live deployment.
const liveUrl = process.env['ORBITAL_BASE_URL'];
// LOCAL_CHROMIUM=<path> runs the chromium project with an already-installed browser (local only).
const localChromium = process.env['LOCAL_CHROMIUM'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: { baseURL: liveUrl ?? 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  ...(liveUrl
    ? {}
    : {
        webServer: {
          command: 'node ../../scripts/serve-dist.mjs dist 4173',
          url: 'http://127.0.0.1:4173/',
          reuseExistingServer: !process.env['CI'],
          timeout: 30_000,
        },
      }),
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(localChromium ? { launchOptions: { executablePath: localChromium } } : {}),
      },
    },
    {
      name: 'firefox',
      // Headless Firefox on CI runners blocklists WebGL 2 on software rendering ("AllowWebgl2:false").
      // Real Firefox with a GPU has it; force it so the scene is tested, not the no-WebGL fallback.
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
