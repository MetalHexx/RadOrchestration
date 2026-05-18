import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { readInstallJson, writeInstallJson, migrateInstallJson, isCurrentShape } from '../lib/install/install-json.js';

test('writeInstallJson uses tmp+rename atomicity and strips state_schema_version', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'ij-cli-'));
  try {
    const f = join(dir, 'install.json');
    writeInstallJson(f, { harnesses: { 'copilot-cli-plugin': { version: '1.0.0' } } });
    assert.deepStrictEqual(fs.readdirSync(dir).filter((n) => n.includes('.tmp')), []);
    const raw = fs.readFileSync(f, 'utf8');
    assert.ok(!raw.includes('state_schema_version'), 'new writes carry no version field');
    const read = readInstallJson(f);
    assert.strictEqual(read.harnesses['copilot-cli-plugin'].version, '1.0.0');
    assert.ok(isCurrentShape(read), 'shape identified by presence of harnesses');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('migrateInstallJson lifts both legacy shapes into harnesses-keyed unversioned', () => {
  const flat = { state_schema_version: 'v5', package_version: '0.9.0', installed_at: '2026-01-01T00:00:00Z' };
  const liftedFlat = migrateInstallJson(flat, 'copilot-cli-plugin');
  assert.ok(!('state_schema_version' in liftedFlat));
  assert.strictEqual(liftedFlat.harnesses['copilot-cli-plugin'].version, '0.9.0');

  const keyed = { state_schema_version: 'v6', harnesses: { 'copilot-cli-plugin': { version: '1.0.0', channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: '1.0.0' } } };
  const liftedKeyed = migrateInstallJson(keyed, 'copilot-cli-plugin');
  assert.ok(!('state_schema_version' in liftedKeyed));
  assert.strictEqual(liftedKeyed.harnesses['copilot-cli-plugin'].version, '1.0.0');
});
