import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DRIFT_CHECK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/drift-check.mjs');

function makeCase(pluginVer, installedVer) {
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'cli-dc-pr-'));
  fs.writeFileSync(join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'rad-orc', version: pluginVer }));
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'cli-dc-rh-'));
  if (installedVer) {
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'copilot-cli-plugin': { version: installedVer, channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: installedVer } },
    }));
  }
  return { pluginRoot, radHome };
}

test('drift-check emits a single stdout line on version mismatch naming both versions', () => {
  const { pluginRoot, radHome } = makeCase('1.1.0', '1.0.0');
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

test('drift-check emits bare-JSON additionalContext under Copilot CLI (COPILOT_CLI=1)', () => {
  const { pluginRoot, radHome } = makeCase('1.1.0', '1.0.0');
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome, COPILOT_CLI: '1' }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.match(parsed.additionalContext, /1\.0\.0/);
  assert.match(parsed.additionalContext, /1\.1\.0/);
  assert.match(parsed.additionalContext, /copilot plugin update/);
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

test('drift-check is silent on version match', () => {
  const { pluginRoot, radHome } = makeCase('1.0.0', '1.0.0');
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, '');
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});
