import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Two projects (ADR-0003 §3.3: conformance runs in Node and in Chromium, Firefox and WebKit).
//   node:    every unit test, including Node-only ones (*.node.test.ts, scripts)
//   browser: the engine suites in real browsers. --browser=<name> picks one engine.
// LOCAL_CHROMIUM=<path> points the browser project at an already-installed Chromium.
const localChromium = process.env.LOCAL_CHROMIUM;

export default defineConfig({
  server: { fs: { allow: ['..'] } }, // fixtures/ lives at the repository root
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'packages/*/test/**/*.test.ts',
            'apps/*/src/**/*.test.{ts,tsx}',
            'scripts/**/*.test.mjs',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['packages/engine/test/**/*.test.ts'],
          exclude: ['**/*.node.test.ts'],
          testTimeout: 60_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(
              localChromium ? { launchOptions: { executablePath: localChromium } } : {},
            ),
            instances: localChromium
              ? [{ browser: 'chromium' }]
              : [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
});
