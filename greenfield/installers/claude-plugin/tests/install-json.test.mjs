import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { readInstallJson, writeInstallJson, migrateInstallJson, isCurrentShape } from '../lib/install/install-json.js';

test('writeInstallJson uses tmp+rename atomicity and never emits a state_schema_version field (FR-14, FR-18, AD-13)', async () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'ij-'));
  try {
    const f = join(dir, 'install.json');
    writeInstallJson(f, { harnesses: { 'claude-plugin': { version: '1.0.0' } } });
    const tmpsAfter = fs.readdirSync(dir).filter((n) => n.includes('.tmp'));
    assert.deepStrictEqual(tmpsAfter, [], 'no leftover .tmp files');
    const raw = fs.readFileSync(f, 'utf8');
    assert.ok(!raw.includes('state_schema_version'),
      'new writes must not carry a state_schema_version field (FR-18)');
    const read = readInstallJson(f);
    assert.strictEqual(read.harnesses['claude-plugin'].version, '1.0.0');
    assert.ok(isCurrentShape(read), 'current shape identified by presence of harnesses object (FR-18)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('migrateInstallJson lifts a legacy flat single-record into the harnesses-keyed shape and drops the version field (FR-18, AD-12)', () => {
  // Legacy flat single-record carrying the old state_schema_version: 'v5' field.
  const legacyFlat = { state_schema_version: 'v5', package_version: '0.9.0', installed_at: '2026-01-01T00:00:00Z' };
  const lifted = migrateInstallJson(legacyFlat, 'claude-plugin');
  assert.ok(!('state_schema_version' in lifted),
    'migrated record drops state_schema_version — new shape is unversioned (FR-18)');
  assert.strictEqual(lifted.harnesses['claude-plugin'].version, '0.9.0');
});

test('migrateInstallJson lifts a legacy harnesses-keyed-with-version-field record by dropping the field (FR-18)', () => {
  // Earlier shape variant: harnesses-keyed but still carrying state_schema_version: 'v6'.
  const legacyKeyed = {
    state_schema_version: 'v6',
    harnesses: { 'claude-plugin': { version: '1.0.0', channel: 'claude-plugin', installed_at: 'x', last_writer_version: '1.0.0' } },
  };
  const lifted = migrateInstallJson(legacyKeyed, 'claude-plugin');
  assert.ok(!('state_schema_version' in lifted),
    'state_schema_version field stripped from harnesses-keyed legacy records too (FR-18)');
  assert.strictEqual(lifted.harnesses['claude-plugin'].version, '1.0.0');
});

test('isCurrentShape identifies the current shape structurally by presence of harnesses (FR-18)', () => {
  assert.strictEqual(isCurrentShape({ harnesses: { 'claude-plugin': {} } }), true);
  assert.strictEqual(isCurrentShape({ state_schema_version: 'v5', package_version: '0.9.0' }), false);
  assert.strictEqual(isCurrentShape(null), false);
});
