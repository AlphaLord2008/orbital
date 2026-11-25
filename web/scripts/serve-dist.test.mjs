import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headersFor, parseHeaders } from './serve-dist.mjs';

// The local server must apply _headers the way Cloudflare does, or e2e and Lighthouse
// would test a different policy from production.
const rules = parseHeaders(
  readFileSync(new URL('../apps/web/public/_headers', import.meta.url), 'utf8'),
);

describe('serve-dist _headers handling', () => {
  it('applies the CSP to every path', () => {
    for (const path of ['/', '/index.html', '/assets/index-abc.js', '/404.html']) {
      expect(headersFor(rules, path).get('content-security-policy')).toMatch(/^default-src 'self'/);
    }
  });

  it('never allows inline scripts or styles', () => {
    const csp = headersFor(rules, '/').get('content-security-policy') ?? '';
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('caches hashed assets immutably and revalidates the HTML entry', () => {
    expect(headersFor(rules, '/assets/index-abc.js').get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(headersFor(rules, '/').get('cache-control')).toBe('no-cache');
    expect(headersFor(rules, '/index.html').get('cache-control')).toBe('no-cache');
  });

  it('joins a header set by several matching rules with ", " (Cloudflare semantics)', () => {
    const r = parseHeaders('/*\n  X-Test: a\n/x\n  X-Test: b\n');
    expect(headersFor(r, '/x').get('x-test')).toBe('a, b');
    expect(headersFor(r, '/y').get('x-test')).toBe('a');
  });
});
