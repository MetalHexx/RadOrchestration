import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadBundledManifest, manifestPathForVersion } from './catalog.js';

test('catalog — manifestPathForVersion', () => {
  const p = manifestPathForVersion('/x/plugin', '1.2.3');
  assert.equal(p, path.normalize('/x/plugin/manifests/v1.2.3.json'));
});

test('catalog — loadBundledManifest reads existing JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-'));
  const manifestDir = path.join(tmp, 'manifests');
  fs.mkdirSync(manifestDir, { recursive: true });
  const body = { harness: 'claude', version: '1.0.0', files: [] };
  fs.writeFileSync(path.join(manifestDir, 'v1.0.0.json'), JSON.stringify(body), 'utf8');

  const loaded = loadBundledManifest(tmp, '1.0.0');
  assert.deepEqual(loaded, body);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('catalog — loadBundledManifest throws on missing version', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-'));
  assert.throws(() => loadBundledManifest(tmp, '9.9.9'), /not found in bundled catalog/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
