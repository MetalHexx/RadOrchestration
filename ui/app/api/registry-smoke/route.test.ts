import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('smoke route consumes the library by name and returns its API surface', async () => {
  const mod = await import('./route.ts');
  const res = await mod.GET();
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.operations));
  assert.ok(body.operations.includes('readRegistry'));
});

test('next.config sets outputFileTracingRoot to the repo root', async () => {
  const cfgText = fs.readFileSync(path.join(uiRoot, 'next.config.mjs'), 'utf8');
  assert.match(cfgText, /outputFileTracingRoot/);
  assert.match(cfgText, /\.\.['"]?\)/); // resolved one level above ui/
});

test('ui declares the library dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(uiRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies['@rad-orchestration/repo-registry']);
});
