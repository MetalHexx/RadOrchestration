import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ci = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const cli = fs.readFileSync(path.join(repoRoot, '.github/workflows/cli.yml'), 'utf8');

test('ci.yml builds and tests the library', () => {
  assert.match(ci, /repo-registry/);
  assert.match(ci, /npm run build -w @rad-orchestration\/repo-registry/);
  assert.match(ci, /(vitest run|npm test -w @rad-orchestration\/repo-registry)/);
});

test('ci.yml repo-registry job uses npm install (not npm ci) for root workspace', () => {
  assert.match(ci, /run: npm install/, 'ci.yml root-install step must use npm install');
  assert.ok(!/run: npm ci/.test(ci), 'ci.yml must not use npm ci (no committed lockfile)');
});

test('cli.yml watches lib/repo-registry and uses a root install', () => {
  assert.match(cli, /lib\/repo-registry\/\*\*/);
  assert.ok(!/Install repo-registry deps/.test(cli), 'stale lib-deps install step still present');
});

test('cli.yml cli job uses npm install (not npm ci) for root workspace', () => {
  assert.match(cli, /run: npm install/, 'cli.yml root-install step must use npm install');
  assert.ok(!/run: npm ci/.test(cli), 'cli.yml must not use npm ci (no committed lockfile)');
});
