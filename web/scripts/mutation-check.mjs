#!/usr/bin/env node
// Mutation check for @orbital/engine (ADR-0003 §6). Each mutation is a deliberate bug; the
// engine test suite (Node project) must fail for every one. Source files are restored after
// each run, also on error. Exit 1 if any mutation survives.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = (f) => join(root, 'packages', 'engine', 'src', f);

const MUTATIONS = [
  {
    id: 'M1',
    what: 'mu x (1 + 1e-9)',
    file: 'constants.ts',
    from: 'MU_EARTH = 3.986004418e14;',
    to: 'MU_EARTH = 3.986004418e14 * (1 + 1e-9);',
  },
  {
    id: 'M2',
    what: 'force law 1/r^2 -> 1/r^2.000001 (propagator)',
    file: 'dynamics.ts',
    from: 'const c = -mu / rNorm ** 3;',
    to: 'const c = -mu / rNorm ** 3.000001;',
  },
  {
    id: 'M3',
    what: 'update order swapped (position uses the old velocity)',
    file: 'dynamics.ts',
    from: 'out[0] = x + dt * vxNew;\n  out[1] = y + dt * vyNew;',
    to: 'out[0] = x + dt * vx;\n  out[1] = y + dt * vy;',
  },
  {
    id: 'M4',
    what: 'off-by-one time (t_k = (k + 1) dt)',
    file: 'propagate.ts',
    from: 't[k] = k * h;',
    to: 't[k] = (k + 1) * h;',
  },
  {
    id: 'M5',
    what: 'impact test <= -> <',
    file: 'propagate.ts',
    from: 'if (Math.sqrt(cx * cx + cy * cy) <= body) {',
    to: 'if (Math.sqrt(cx * cx + cy * cy) < body) {',
  },
  {
    id: 'M6',
    what: 'gravity sign flipped (validated step)',
    file: 'dynamics.ts',
    from: 'const c = -m / rNorm ** 3;',
    to: 'const c = m / rNorm ** 3;',
  },
  {
    id: 'M7',
    what: 'Kepler tolerance 1e-15 -> 1e-6 (analytic)',
    file: 'analytic.ts',
    from: 'KEPLER_TOLERANCE = 1e-15;',
    to: 'KEPLER_TOLERANCE = 1e-6;',
  },
];

let survived = 0;
const rows = [];
for (const m of MUTATIONS) {
  const path = src(m.file);
  const original = readFileSync(path, 'utf8');
  if (!original.includes(m.from)) throw new Error(`${m.id}: pattern not found in ${m.file}`);
  writeFileSync(path, original.replace(m.from, m.to));
  let failed = 0;
  let files = [];
  const out = join(mkdtempSync(join(tmpdir(), 'mut-')), 'report.json');
  try {
    execFileSync(
      'npx',
      [
        'vitest',
        'run',
        '--project',
        'node',
        'packages/engine',
        '--reporter=json',
        `--outputFile=${out}`,
      ],
      {
        cwd: root,
        stdio: 'ignore',
      },
    );
  } catch {
    try {
      const report = JSON.parse(readFileSync(out, 'utf8'));
      failed = report.numFailedTests;
      files = [
        ...new Set(
          report.testResults
            .filter((r) => r.status === 'failed')
            .map((r) => r.name.split('/').pop()),
        ),
      ];
    } catch {
      failed = -1;
    }
  } finally {
    writeFileSync(path, original);
  }
  const caught = failed !== 0;
  if (!caught) survived++;
  rows.push(
    `| ${m.id} | ${m.what} | ${caught ? `caught: ${failed} failing test(s) in ${files.join(', ') || 'collection'}` : '**SURVIVED**'} |`,
  );
}
console.log('| ID | Mutation | Result |\n|---|---|---|\n' + rows.join('\n'));
if (survived > 0) {
  console.error(`${survived} mutation(s) survived`);
  process.exit(1);
}
