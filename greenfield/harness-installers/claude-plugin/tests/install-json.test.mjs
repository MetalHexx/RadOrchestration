import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { readInstallJson, writeInstallJson, migrateInstallJson, isCurrentShape, loadRegistry } from '../lib/install/install-json.js';

test('writeInstallJson uses tmp+rename atomicity and never emits a state_schema_version field', async () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'ij-'));
  try {
    const f = join(dir, 'install.json');
    writeInstallJson(f, { harnesses: { 'claude-plugin': { version: '1.0.0' } } });
    const tmpsAfter = fs.readdirSync(dir).filter((n) => n.includes('.tmp'));
    assert.deepStrictEqual(tmpsAfter, [], 'no leftover .tmp files');
    const raw = fs.readFileSync(f, 'utf8');
    assert.ok(!raw.includes('state_schema_version'),
      'new writes must not carry a state_schema_version field');
    const read = readInstallJson(f);
    assert.strictEqual(read.harnesses['claude-plugin'].version, '1.0.0');
    assert.ok(isCurrentShape(read), 'current shape identified by presence of harnesses object');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('migrateInstallJson lifts a legacy flat single-record into the harnesses-keyed shape and drops the version field', () => {
  // Legacy flat single-record carrying the old state_schema_version: 'v5' field.
  const legacyFlat = { state_schema_version: 'v5', package_version: '0.9.0', installed_at: '2026-01-01T00:00:00Z' };
  const lifted = migrateInstallJson(legacyFlat, 'claude-plugin');
  assert.ok(!('state_schema_version' in lifted),
    'migrated record drops state_schema_version — new shape is unversioned');
  assert.strictEqual(lifted.harnesses['claude-plugin'].version, '0.9.0');
});

test('migrateInstallJson lifts a legacy harnesses-keyed-with-version-field record by dropping the field', () => {
  // Earlier shape variant: harnesses-keyed but still carrying state_schema_version: 'v6'.
  const legacyKeyed = {
    state_schema_version: 'v6',
    harnesses: { 'claude-plugin': { version: '1.0.0', channel: 'claude-plugin', installed_at: 'x', last_writer_version: '1.0.0' } },
  };
  const lifted = migrateInstallJson(legacyKeyed, 'claude-plugin');
  assert.ok(!('state_schema_version' in lifted),
    'state_schema_version field stripped from harnesses-keyed legacy records too');
  assert.strictEqual(lifted.harnesses['claude-plugin'].version, '1.0.0');
});

test('isCurrentShape identifies the current shape structurally by presence of harnesses', () => {
  assert.strictEqual(isCurrentShape({ harnesses: { 'claude-plugin': {} } }), true);
  assert.strictEqual(isCurrentShape({ state_schema_version: 'v5', package_version: '0.9.0' }), false);
  assert.strictEqual(isCurrentShape(null), false);
});

test('loadRegistry returns empty harnesses for missing file', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'lr-missing-'));
  try {
    const result = loadRegistry(join(dir, 'nonexistent.json'));
    assert.deepStrictEqual(result, { harnesses: {} });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadRegistry returns empty harnesses for malformed JSON', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'lr-bad-'));
  const f = join(dir, 'install.json');
  try {
    fs.writeFileSync(f, 'not valid json{{{');
    const result = loadRegistry(f);
    assert.deepStrictEqual(result, { harnesses: {} });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadRegistry returns empty harnesses for old flat-format (non-conforming shape)', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'lr-flat-'));
  const f = join(dir, 'install.json');
  try {
    fs.writeFileSync(f, JSON.stringify({ package_version: '0.9.0', installed_at: 'x' }));
    const result = loadRegistry(f);
    assert.deepStrictEqual(result, { harnesses: {} });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadRegistry preserves all harness entries from a valid current-shape file', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'lr-valid-'));
  const f = join(dir, 'install.json');
  try {
    const data = {
      harnesses: {
        'claude-plugin': { version: '1.0.0', channel: 'claude-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
        'copilot-cli-plugin': { version: '2.0.0', channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: '2.0.0' },
      },
    };
    fs.writeFileSync(f, JSON.stringify(data));
    const result = loadRegistry(f);
    assert.strictEqual(result.harnesses['claude-plugin'].version, '1.0.0');
    assert.strictEqual(result.harnesses['copilot-cli-plugin'].version, '2.0.0');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

