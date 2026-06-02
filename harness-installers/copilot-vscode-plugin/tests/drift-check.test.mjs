import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const DRIFT_CHECK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/drift-check.mjs');

function makeCase(pluginVer, installedVer) {
  const pluginRoot = fs.mkdtempSync(join(os.tmpdir(), 'vsc-dc-pr-'));
  // drift-check reads the synthesized package.json for the delivering version (always at payload root).
  fs.writeFileSync(join(pluginRoot, 'package.json'), JSON.stringify({ name: '@rad-orchestration/copilot-vscode-plugin', version: pluginVer }));
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'vsc-dc-rh-'));
  if (installedVer) {
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'copilot-vscode-plugin': { version: installedVer, channel: 'copilot-vscode-plugin', installed_at: 'x', last_writer_version: installedVer } },
    }));
  }
  return { pluginRoot, radHome };
}

test('drift-check emits a single stdout line on version mismatch naming both versions (DD-11, FR-6)', () => {
  const { pluginRoot, radHome } = makeCase('1.1.0', '1.0.0');
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /1\.0\.0/);
  assert.match(lines[0], /1\.1\.0/);
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

test('drift-check emits nested hookSpecificOutput.additionalContext on mismatch (VS Code injection contract)', () => {
  const { pluginRoot, radHome } = makeCase('1.1.0', '1.0.0');
  const result = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /1\.0\.0/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /1\.1\.0/);
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
});

test('drift-check is silent on version match and absent install.json (FR-6)', () => {
  const { pluginRoot, radHome } = makeCase('1.0.0', '1.0.0');
  const r1 = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8',
  });
  assert.strictEqual(r1.status, 0);
  assert.strictEqual(r1.stdout, '');
  // Also silent on absent install.json.
  const { pluginRoot: pr2, radHome: rh2 } = makeCase('1.0.0', null);
  const r2 = spawnSync(process.execPath, [DRIFT_CHECK], {
    env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pr2, RAD_HOME: rh2 }, encoding: 'utf8',
  });
  assert.strictEqual(r2.status, 0);
  assert.strictEqual(r2.stdout, '');
  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.rmSync(radHome, { recursive: true, force: true });
  fs.rmSync(pr2, { recursive: true, force: true });
  fs.rmSync(rh2, { recursive: true, force: true });
});

