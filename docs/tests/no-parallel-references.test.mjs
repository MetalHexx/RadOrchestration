import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../..');

const SURFACES = [
  'docs/skills.md',
  'docs/getting-started.md',
  'docs/harnesses.md',
  'CHANGELOG.md',
  'ui/lib/launch-claude-project.js',
];

for (const rel of SURFACES) {
  test(`${rel} carries no rad-execute-parallel reference (FR-17)`, () => {
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.doesNotMatch(body, /rad-execute-parallel/,
      `${rel} must not reference the retired skill`);
  });
}
