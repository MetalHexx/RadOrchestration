import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

test('root package declares a workspaces array', () => {
  assert.ok(Array.isArray(pkg.workspaces), 'workspaces must be an array');
});

test('workspaces include the library and its consumers', () => {
  const ws = pkg.workspaces;
  for (const required of ['lib/repo-registry', 'cli', 'ui']) {
    assert.ok(ws.includes(required), `workspaces missing ${required}`);
  }
});
