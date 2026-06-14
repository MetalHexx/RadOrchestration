// Build the CLI's dist/ exactly once before the suite runs.
//
// Several tests exec the compiled binary at dist/bin/radorch.js (help, smoke,
// e2e-bundle) or bundle from dist/ (bundle-cli). Each of those used to run its
// own `npx tsc` into the shared cli/dist/. Under vitest's parallel file pool
// those concurrent tsc runs raced on the same directory — one process reading
// dist/bin/radorch.js (→ dist/lib/pipeline-engine/engine.js → validator.js)
// while another was mid-rewrite of those files — which surfaced in CI as
// intermittent "module does not provide an export named 'validateState'"
// SyntaxErrors.
//
// Building once here, combined with fileParallelism:false in vitest.config.ts,
// keeps the shared dist/ stable for every test and removes the redundant
// per-test compiles.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  execFileSync('npx', ['tsc'], {
    cwd: cliRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
