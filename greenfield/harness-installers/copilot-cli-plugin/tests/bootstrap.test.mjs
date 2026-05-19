import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const BOOTSTRAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/bootstrap.mjs');

function makePluginRoot(version) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'cli-bp-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'rad-orc', version }));
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@rad-orchestration/copilot-cli-plugin', version }));
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({ version, channel: 'copilot-cli-plugin', files: [] }));
  fs.mkdirSync(join(dir, 'hooks'), { recursive: true });
  fs.writeFileSync(join(dir, 'hooks/hooks.json'), JSON.stringify({
    version: 1,
    hooks: { userPromptSubmitted: [{ type: 'command', command: 'node hooks/launcher.cjs bootstrap.mjs' }], sessionStart: [] },
  }));
  return dir;
}

test('first invocation runs install and self-uninstalls userPromptSubmitted from hooks.json', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    const result = spawnSync(process.execPath, [BOOTSTRAP], {
      env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    // install ran
    assert.ok(fs.existsSync(join(radHome, 'install.json')), 'install.json written');
    // self-uninstall removed userPromptSubmitted
    const hooks = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(!hooks.hooks?.userPromptSubmitted, 'userPromptSubmitted removed from hooks.json after success');
    assert.ok(Array.isArray(hooks.hooks?.sessionStart), 'sessionStart hook preserved');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('second invocation is a noop via runInstall idempotency (install.json + sentinel check)', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome } });
    const logBefore = fs.existsSync(join(radHome, 'logs/install.log'))
      ? fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8') : '';
    // Restore userPromptSubmitted so the hook can fire again (simulates a new session after upgrade)
    const hooksJson = join(pluginRoot, 'hooks/hooks.json');
    const hooksManifest = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
    hooksManifest.hooks.userPromptSubmitted = [{ type: 'command', command: 'node hooks/launcher.cjs bootstrap.mjs' }];
    fs.writeFileSync(hooksJson, JSON.stringify(hooksManifest, null, 2) + '\n');
    const result = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8' });
    assert.strictEqual(result.status, 0);
    // Noop discipline: second run must not re-run fresh-install — only a noop action may be logged.
    const logAfter = fs.existsSync(join(radHome, 'logs/install.log'))
      ? fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8') : '';
    const logLines = logAfter.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const actions = logLines.map((l) => l.action);
    assert.ok(!actions.slice(1).includes('fresh-install'), `second run must not re-run fresh-install; got actions=${JSON.stringify(actions)}`);
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('install failure exits 1 and does NOT self-uninstall (hook preserved for retry)', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    // Sabotage: remove the per-version manifest so loadManifest throws.
    fs.rmSync(join(pluginRoot, 'manifests/v1.0.0.json'));
    const r1 = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8' });
    assert.strictEqual(r1.status, 1, 'bootstrap exits 1 on install failure');
    // hooks.json must still have userPromptSubmitted so the next session can retry.
    const hooks = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(hooks.hooks?.userPromptSubmitted, 'userPromptSubmitted preserved in hooks.json after failure (retry possible)');
    // Restore manifest; next invocation must retry and succeed.
    fs.writeFileSync(join(pluginRoot, 'manifests/v1.0.0.json'), JSON.stringify({ version: '1.0.0', channel: 'copilot-cli-plugin', files: [] }));
    const r2 = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_CLI_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome }, encoding: 'utf8' });
    assert.strictEqual(r2.status, 0, 'retry succeeds after manifest restored');
    const hooks2 = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(!hooks2.hooks?.userPromptSubmitted, 'userPromptSubmitted removed after successful retry');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});
