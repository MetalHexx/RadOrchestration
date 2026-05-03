import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInstalledPackageVersion } from './installed-version.js';

function makeRoot(yml) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iv-'));
  const dir = path.join(root, 'skills', 'rad-orchestration', 'config');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'orchestration.yml'), yml, 'utf8');
  return root;
}

test('returns null when orchestration.yml is absent (no prior install at this orchRoot)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iv-'));
  assert.strictEqual(readInstalledPackageVersion(root), null);
});

test('returns { packageVersion: null } when file exists but field is absent (pre-manifest install)', () => {
  const root = makeRoot('version: "1.0"\nsystem:\n  orch_root: .claude\n');
  assert.deepStrictEqual(readInstalledPackageVersion(root), { packageVersion: null });
});

test('returns { packageVersion: <value> } when field is present', () => {
  const root = makeRoot('version: "1.0"\npackage_version: 1.0.0-alpha.9\nsystem:\n  orch_root: .claude\n');
  assert.deepStrictEqual(readInstalledPackageVersion(root), { packageVersion: '1.0.0-alpha.9' });
});

test('handles quoted package_version values', () => {
  const root = makeRoot('version: "1.0"\npackage_version: "1.0.0-alpha.9"\nsystem:\n  orch_root: .claude\n');
  assert.deepStrictEqual(readInstalledPackageVersion(root), { packageVersion: '1.0.0-alpha.9' });
});
