import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverAdapters } from '../index.js';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'adapters-disc-'));
  mkdirSync(join(root, 'alpha'), { recursive: true });
  writeFileSync(join(root, 'alpha/adapter.js'),
    `export const adapter = { name: 'alpha', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: {} };\n`);
  mkdirSync(join(root, 'beta'), { recursive: true });
  writeFileSync(join(root, 'beta/adapter.js'),
    `export const adapter = { name: 'beta', filenames: { agent: '{name}.md', skill: 'SKILL.md' }, bodyTokens: {} };\n`);
  mkdirSync(join(root, '_template'), { recursive: true });
  writeFileSync(join(root, '_template/adapter.js'),
    `export const adapter = { name: '_template', filenames: { agent: 'x', skill: 'x' }, bodyTokens: {} };\n`);
  return root;
}

test('discoverAdapters walks direct subfolders and skips underscore-prefixed scaffolds', async () => {
  const root = makeFixture();
  try {
    const adapters = await discoverAdapters(root);
    const names = adapters.map((a) => a.name).sort();
    assert.deepStrictEqual(names, ['alpha', 'beta'], 'underscore-prefixed folders are excluded (AD-4, FR-10)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverAdapters fails fast when adapter.js is missing or does not export an adapter', async () => {
  const root = mkdtempSync(join(tmpdir(), 'adapters-bad-'));
  try {
    mkdirSync(join(root, 'broken'), { recursive: true });
    // No adapter.js file at all.
    await assert.rejects(discoverAdapters(root), /broken[\\/]adapter\.js/, 'error message names the missing path');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
