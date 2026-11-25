#!/usr/bin/env node
// Engine boundary check (ADR-0003, ADR-0007): the TypeScript equivalent of v0.1's T12.
// @orbital/engine must have zero runtime dependencies, compile without DOM types, and
// import nothing outside its own src/ directory (no React, three, app code or packages).
// Runs in CI next to ESLint's no-restricted-imports, so a rule disabled by an inline
// comment is still caught here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'engine');
const src = join(root, 'src');
const failures = [];

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  if (pkg[field] && Object.keys(pkg[field]).length > 0) {
    failures.push(`package.json declares ${field}: ${Object.keys(pkg[field]).join(', ')}`);
  }
}

const tsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
const lib = tsconfig.compilerOptions?.lib ?? [];
if (lib.length === 0 || lib.some((l) => l.toLowerCase().startsWith('dom'))) {
  failures.push(`tsconfig.json lib must be set and DOM-free (found ${JSON.stringify(lib)})`);
}
if (JSON.stringify(tsconfig.compilerOptions?.types) !== '[]') {
  failures.push('tsconfig.json must set "types": [] (no ambient Node or DOM types)');
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(c|m)?[jt]sx?$/.test(name)) yield p;
  }
}

// static imports/exports, `import x = require()`, dynamic import() and require()
const patterns = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
];

let files = 0;
for (const file of walk(src)) {
  files += 1;
  const text = readFileSync(file, 'utf8');
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const spec = m[1];
      const where = relative(root, file);
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        failures.push(
          `${where}: imports '${spec}' (only relative imports inside src/ are allowed)`,
        );
        continue;
      }
      const target = resolve(dirname(file), spec);
      if (target !== src && !target.startsWith(src + sep)) {
        failures.push(`${where}: imports '${spec}', which leaves packages/engine/src`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Engine boundary check FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Engine boundary check passed (${files} source file(s) scanned).`);
