import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(repoRoot, 'package.json'));

before(() => {
  execSync('npm install', { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  execSync('npm run build -w @rad-orchestration/repo-registry', { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
});

test('library symlink exists in hoisted root node_modules', () => {
  const linked = path.join(repoRoot, 'node_modules/@rad-orchestration/repo-registry/package.json');
  assert.ok(fs.existsSync(linked), 'workspace symlink not present');
});

test('library resolves by name and exposes its API', async () => {
  const mod = await import('@rad-orchestration/repo-registry');
  assert.equal(typeof mod.readRegistry, 'function');
});

test('transitive js-yaml resolves from the root install', () => {
  const resolved = require.resolve('js-yaml');
  assert.ok(fs.existsSync(resolved), 'js-yaml not reachable from root install');
});
