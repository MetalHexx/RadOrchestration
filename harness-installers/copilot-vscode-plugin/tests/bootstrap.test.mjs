import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const BOOTSTRAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/bootstrap.mjs');

function makePluginRoot(version) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'vsc-bp-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(join(dir, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'rad-orc-vs', version }));
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@rad-orchestration/copilot-vscode-plugin', version }));
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({ version, channel: 'copilot-vscode-plugin', files: [] }));
  // hooks.json starts with both events; selfUninstall should remove UserPromptSubmit on success.
  fs.mkdirSync(join(dir, 'hooks'), { recursive: true });
  fs.writeFileSync(join(dir, 'hooks/hooks.json'), JSON.stringify({
    hooks: {
      UserPromptSubmit: [{ type: 'command', command: 'node -e "/* bootstrap shim */"' }],
      SessionStart: [{ type: 'command', command: 'node -e "/* drift-check shim */"' }],
    },
  }, null, 2) + '\n');
  return dir;
}

test('first invocation runs install successfully, exits 0, removes UserPromptSubmit from hooks.json', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    const result = spawnSync(process.execPath, [BOOTSTRAP], {
      env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    const hooksJson = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.strictEqual(hooksJson.hooks.UserPromptSubmit, undefined, 'UserPromptSubmit removed by selfUninstall');
    assert.ok(hooksJson.hooks.SessionStart, 'SessionStart preserved for drift-check');
    // No marker file written under the new design.
    assert.ok(!fs.existsSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json')),
      'no bootstrap marker file under the self-uninstall design');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('install failure leaves UserPromptSubmit intact for retry on next prompt', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    // Sabotage: remove the per-version manifest so loadManifest throws inside runInstall.
    fs.rmSync(join(pluginRoot, 'manifests/v1.0.0.json'));
    const r1 = spawnSync(process.execPath, [BOOTSTRAP], {
      env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(r1.status, 1, 'bootstrap exits 1 on install failure');
    const hooksJson = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(hooksJson.hooks.UserPromptSubmit, 'UserPromptSubmit retained for retry');
    // Restore manifest and retry — should succeed and remove UserPromptSubmit this time.
    fs.writeFileSync(join(pluginRoot, 'manifests/v1.0.0.json'),
      JSON.stringify({ version: '1.0.0', channel: 'copilot-vscode-plugin', files: [] }));
    const r2 = spawnSync(process.execPath, [BOOTSTRAP], {
      env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(r2.status, 0, 'retry succeeds after manifest restored');
    const hooksJsonAfter = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.strictEqual(hooksJsonAfter.hooks.UserPromptSubmit, undefined,
      'UserPromptSubmit removed after successful retry');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('upgrade case: bootstrap with a newer plugin payload triggers upgrade install', () => {
  const pluginV1 = makePluginRoot('1.0.0');
  const pluginV2 = makePluginRoot('1.1.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-up-'));
  try {
    spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginV1, RAD_HOME: radHome } });
    const logBefore = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8');
    const r = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginV2, RAD_HOME: radHome } });
    assert.strictEqual(r.status, 0);
    const logAfter = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8');
    assert.notStrictEqual(logAfter, logBefore, 'upgrade appends a new log entry');
    const installJson = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(installJson.harnesses['copilot-vscode-plugin'].version, '1.1.0');
    const hooksV2 = JSON.parse(fs.readFileSync(join(pluginV2, 'hooks/hooks.json'), 'utf8'));
    assert.strictEqual(hooksV2.hooks.UserPromptSubmit, undefined, 'UserPromptSubmit removed from v2 hooks.json post-upgrade');
  } finally {
    fs.rmSync(pluginV1, { recursive: true, force: true });
    fs.rmSync(pluginV2, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('legacy bootstrap marker file is cleaned up on first successful install', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-cleanup-'));
  try {
    // Pre-seed the legacy marker from the previous idempotency design.
    fs.writeFileSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json'),
      JSON.stringify({ version: '0.9.0', status: 'success', at: '2026-05-01T00:00:00Z' }));
    assert.ok(fs.existsSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json')), 'sanity: legacy marker pre-seeded');
    const r = spawnSync(process.execPath, [BOOTSTRAP], {
      env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0);
    assert.ok(!fs.existsSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json')),
      'legacy marker removed best-effort');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});
