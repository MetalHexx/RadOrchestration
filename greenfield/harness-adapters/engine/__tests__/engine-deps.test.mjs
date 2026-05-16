import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('engine package.json declares ESM, a single YAML runtime dep, and no TS / bundler tooling', () => {
  const pkg = JSON.parse(readFileSync(resolve('greenfield/harness-adapters/engine/package.json'), 'utf8'));
  assert.strictEqual(pkg.type, 'module', 'engine must be plain ESM (NFR-5)');
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.strictEqual(deps.length, 1, 'exactly one runtime dependency allowed');
  assert.ok(deps[0] === 'yaml' || deps[0] === 'js-yaml', `expected a YAML parser, got ${deps[0]}`);
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const banned of ['typescript', 'tsx', 'esbuild', 'webpack', 'rollup', 'vite', '@types/node']) {
    assert.ok(!(banned in allDeps), `engine must not depend on ${banned} (NFR-5: no bundler, no TS compile)`);
  }
});

test('engine entry modules are importable as ESM', async () => {
  await import('node:fs').then(() => assert.ok(true)); // sanity
  const { discoverAdapters } = await import('../index.js');
  assert.strictEqual(typeof discoverAdapters, 'function', 'engine/index.js must export discoverAdapters');
});
