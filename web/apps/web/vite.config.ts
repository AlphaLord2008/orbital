import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Every web build shows the commit it was built from (proposal §14).
function buildCommit(): string {
  const fromCi = process.env['GITHUB_SHA'];
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __ORBITAL_COMMIT__: JSON.stringify(buildCommit()),
  },
  build: {
    // No inline scripts or styles may reach index.html: the CSP forbids them (ADR-0006 §4).
    assetsInlineLimit: 0,
    sourcemap: true,
    target: 'es2023',
    rolldownOptions: {
      // WA-F13: the methodology page is a second entry; it shares the design system, not the app.
      input: { main: 'index.html', methodology: 'methodology.html' },
    },
  },
});
