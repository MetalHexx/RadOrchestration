// adapters/discover.test.js — Discovery walker contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverAdapters } from './discover.js';

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adapters-'));
  const writeAdapter = (name, body) => {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
    fs.writeFileSync(path.join(dir, name, 'adapter.js'), body, 'utf8');
  };
  writeAdapter('alpha', "export const adapter = { name: 'alpha', targetDir: '.alpha' };\n");
  writeAdapter('beta', "export const adapter = { name: 'beta', targetDir: '.beta' };\n");
  writeAdapter('_template', "export const adapter = { name: '_template', targetDir: '.skip' };\n");
  // a non-folder file at adapters root must be ignored too
  fs.writeFileSync(path.join(dir, 'README.md'), '# adapters', 'utf8');
  return dir;
}

test('discoverAdapters returns every non-underscore-prefixed adapter folder', async () => {
  const root = makeRoot();
  const adapters = await discoverAdapters(root);
  const names = adapters.map((a) => a.name).sort();
  assert.deepStrictEqual(names, ['alpha', 'beta']);
});

test('discoverAdapters skips underscore-prefixed folders', async () => {
  const root = makeRoot();
  const adapters = await discoverAdapters(root);
  assert.ok(!adapters.some((a) => a.name === '_template'));
});

test('discoverAdapters ignores non-directory entries at adapters root', async () => {
  const root = makeRoot();
  const adapters = await discoverAdapters(root);
  assert.strictEqual(adapters.length, 2);
});
