import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInstallJson, writeInstallJson, cmpSemver } from './install-json.js';

test('install-json — round-trip', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ij-'));
  const file = path.join(tmp, 'install.json');
  const value = {
    package_version: '1.0.0-alpha.8',
    installed_at: '2026-05-13T00:00:00.000Z',
    last_writer_version: '1.0.0-alpha.8',
    state_schema_version: 'v5',
  };
  writeInstallJson(file, value);
  const back = readInstallJson(file);
  assert.deepEqual(back, value);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('cmpSemver — equal', () => {
  assert.equal(cmpSemver('1.0.0', '1.0.0'), 0);
  assert.equal(cmpSemver('1.0.0-alpha.8', '1.0.0-alpha.8'), 0);
});

test('cmpSemver — release > pre-release of same main', () => {
  assert.equal(cmpSemver('1.0.0', '1.0.0-alpha.8'), 1);
  assert.equal(cmpSemver('1.0.0-alpha.8', '1.0.0'), -1);
});

test('cmpSemver — patch ordering', () => {
  assert.equal(cmpSemver('1.0.1', '1.0.0'), 1);
  assert.equal(cmpSemver('1.0.0', '1.0.1'), -1);
});

test('cmpSemver — pre-release ordering', () => {
  assert.equal(cmpSemver('1.0.0-alpha.8', '1.0.0-alpha.7'), 1);
  assert.equal(cmpSemver('1.0.0-alpha.7', '1.0.0-alpha.8'), -1);
});
