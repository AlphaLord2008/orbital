import { defineConfig } from 'vitest/config';

// Unit tests only. Playwright specs (apps/web/e2e) are run by Playwright, not Vitest.
export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
      'scripts/**/*.test.mjs',
    ],
    environment: 'node',
  },
});
