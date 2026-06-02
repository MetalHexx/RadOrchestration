import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(uiRoot, '..');
const standalone = path.join(uiRoot, '.next/standalone');

function findFirst(...candidates: string[]): string | null {
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

before(() => {
  execSync('npm run build -w @rad-orchestration/repo-registry', { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  execSync('npm run build-standalone', { cwd: uiRoot, stdio: 'inherit', shell: process.platform === 'win32' });
});

test('standalone ships the lib dist index plus a sibling dist module', () => {
  const idx = findFirst(
    path.join(standalone, 'lib/repo-registry/dist/index.js'),
    path.join(standalone, 'node_modules/@rad-orchestration/repo-registry/dist/index.js'),
  );
  assert.ok(idx, 'lib dist/index.js not traced into standalone');
  const distDir = path.dirname(idx);
  assert.ok(fs.existsSync(path.join(distDir, 'io.js')), 'sibling dist module not traced');
});

test('standalone ships the lib package.json so exports resolve', () => {
  const pkg = findFirst(
    path.join(standalone, 'lib/repo-registry/package.json'),
    path.join(standalone, 'node_modules/@rad-orchestration/repo-registry/package.json'),
  );
  assert.ok(pkg, 'lib package.json not traced into standalone');
});

test('standalone ships a reachable js-yaml (the make-or-break check)', () => {
  let found = false;
  const stack = [standalone];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (!e.isDirectory()) continue;
      if (e.name === 'js-yaml' && fs.existsSync(path.join(abs, 'lib')) && fs.existsSync(path.join(abs, 'package.json'))) {
        found = true; break;
      }
      stack.push(abs);
    }
    if (found) break;
  }
  assert.ok(found, 'js-yaml lib + package.json not reachable in standalone — route would throw at runtime');
});
