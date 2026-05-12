import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RETIRED = [
  'installer/lib/prompts/default-template.js',
  'installer/lib/prompts/pipeline-limits.js',
  'installer/lib/prompts/gate-behavior.js',
  'installer/lib/prompts/getting-started.js',
  'installer/lib/prompts/ui-install.js',
  'installer/lib/prompts/source-control.js',
  'installer/lib/ui-builder.js',
  'installer/lib/no-docker.test.js',
];
for (const f of RETIRED) {
  test(`retired installer file does not exist: ${f} (FR-18, FR-19)`, () => {
    assert.ok(!fs.existsSync(path.join(repoRoot, f)), `${f} still on disk`);
  });
}
