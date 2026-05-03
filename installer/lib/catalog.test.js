import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadBundledManifest, manifestPathForHarnessAndVersion } from './catalog.js';

function fixtureCatalog(version) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-'));
  const dir = path.join(root, 'src', 'claude', 'manifests');
  fs.mkdirSync(dir, { recursive: true });
  const m = { harness: 'claude', version, files: [
    { bundlePath: 'agents/coder.md', sourcePath: 'agents/coder.md', ownership: 'orchestration-system', version, harness: 'claude', sha256: 'a'.repeat(64) },
  ] };
  fs.writeFileSync(path.join(dir, `v${version}.json`), JSON.stringify(m, null, 2) + '\n', 'utf8');
  return root;
}

test('manifestPathForHarnessAndVersion joins <installerRoot>/src/<harness>/manifests/v<version>.json', () => {
  const got = manifestPathForHarnessAndVersion('/inst', 'claude-code', '1.0.0-alpha.9');
  assert.strictEqual(got, path.join('/inst', 'src', 'claude', 'manifests', 'v1.0.0-alpha.9.json'));
});

test('loadBundledManifest reads the per-version manifest from the bundled catalog', () => {
  const root = fixtureCatalog('1.0.0-alpha.9');
  const manifest = loadBundledManifest(root, 'claude-code', '1.0.0-alpha.9');
  assert.strictEqual(manifest.harness, 'claude');
  assert.strictEqual(manifest.version, '1.0.0-alpha.9');
  assert.strictEqual(manifest.files.length, 1);
  assert.strictEqual(manifest.files[0].bundlePath, 'agents/coder.md');
});

test('loadBundledManifest throws a structured error when the version is missing from the catalog', () => {
  const root = fixtureCatalog('1.0.0-alpha.9');
  assert.throws(
    () => loadBundledManifest(root, 'claude-code', '1.0.0-alpha.99'),
    /not found in bundled catalog/,
  );
});

test('loadBundledManifest throws on unknown harness tool', () => {
  const root = fixtureCatalog('1.0.0-alpha.9');
  assert.throws(
    () => loadBundledManifest(root, 'unknown-tool', '1.0.0-alpha.9'),
    /unknown harness tool/,
  );
});
