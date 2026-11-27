// Node-only: reads package files. The browser project excludes *.node.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_PACKAGE } from '../src/index';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<
  string,
  unknown
>;
const tsconfig = JSON.parse(readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8')) as {
  compilerOptions: { lib: string[]; types: string[] };
};

describe('@orbital/engine package boundary (TS T12)', () => {
  it('exports its name', () => {
    expect(ENGINE_PACKAGE).toBe(pkg['name']);
  });
  it('has zero runtime dependencies', () => {
    expect(pkg['dependencies']).toBeUndefined();
    expect(pkg['peerDependencies']).toBeUndefined();
  });
  it('compiles without DOM or ambient types', () => {
    expect(tsconfig.compilerOptions.lib.some((l) => l.toLowerCase().startsWith('dom'))).toBe(false);
    expect(tsconfig.compilerOptions.types).toEqual([]);
  });
});
