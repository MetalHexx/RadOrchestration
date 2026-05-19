import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DRIFT_CHECK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/drift-check.mjs');

function makeCase(pluginVer, installedVer, markerStatus) {
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'cli-dc-pr-'));
  fs.writeFileSync(join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'rad-orc', version: pluginVer }));
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'cli-dc-rh-'));
  if (installedVer) {
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'copilot-cli-plugin': { version: installedVer, channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: installedVer } },
    }));
  }
  if (markerStatus) {
    fs.writeFileSync(join(radHome, '.copilot-cli-plugin-bootstrap.json'), JSON.stringify({ version: pluginVer, status: markerStatus, at: '2026-05-18T00:00:00Z' }));
  }
  return { pluginRoot, radHome };
}

test('drift-check emits a single stdout line on version mismatch naming both versions (DD-11)', () => {
  const { pluginRoot, radHome } = makeCase('1.1.0', '1.0.0', null);
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /1\.0\.0/);
  assert.match(lines[0], /1\.1\.0/);
  assert.match(lines[0], /copilot plugin update/);
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

test('drift-check is silent on version match (FR-5)', () => {
  const { pluginRoot, radHome } = makeCase('1.0.0', '1.0.0', null);
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, '');
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

test('drift-check surfaces a stale-error marker on its own line (DD-11)', () => {
  const { pluginRoot, radHome } = makeCase('1.0.0', '1.0.0', 'error');
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  assert.ok(lines.some((l) => /stale.*bootstrap.*error/i.test(l) || /bootstrap.*error/i.test(l)),
    'stale bootstrap error surfaced');
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});
