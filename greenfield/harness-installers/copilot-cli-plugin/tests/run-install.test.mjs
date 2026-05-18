import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { runInstall } from '../lib/install/run-install.js';

function makePluginRoot(version) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'plugin-cli-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'rad-orchestration-copilot-cli', version }));
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@rad-orchestration/copilot-cli-plugin', version }));
  fs.writeFileSync(join(dir, 'orchestration.yml'), 'pipeline: {}\n');
  fs.mkdirSync(join(dir, 'templates'), { recursive: true });
  fs.writeFileSync(join(dir, 'templates/medium.yml'), 'name: medium\n');
  fs.mkdirSync(join(dir, 'ui'), { recursive: true });
  fs.writeFileSync(join(dir, 'ui/server.js'), '// ui\n');
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({
    version, channel: 'copilot-cli-plugin', files: [
      { destinationPath: '${RAD_HOME}/orchestration.yml', sourcePath: 'orchestration.yml', ownership: 'user-config' },
      { destinationPath: '${RAD_HOME}/templates/medium.yml', sourcePath: 'templates/medium.yml', ownership: 'installer-owned' },
      { destinationPath: '${RAD_HOME}/ui/server.js', sourcePath: 'ui/server.js', ownership: 'installer-owned' },
    ],
  }));
  return dir;
}

test('fresh install hydrates ~/.radorch/, stamps install.json under copilot-cli-plugin, logs fresh-install', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'fresh-install');
    assert.ok(fs.existsSync(join(radHome, 'orchestration.yml')));
    assert.ok(fs.existsSync(join(radHome, 'templates/medium.yml')));
    assert.ok(fs.existsSync(join(radHome, 'ui/server.js')));
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['copilot-cli-plugin'].version, '1.0.0');
    assert.ok(!('state_schema_version' in ij));
    const log = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8').trim();
    assert.strictEqual(JSON.parse(log).action, 'fresh-install');
    assert.strictEqual(JSON.parse(log).channel, 'copilot-cli-plugin');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('noop fast path: same-version re-run does not rewrite orchestration.yml (FR-11 preservation)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-noop-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    const mtimeBefore = fs.statSync(join(radHome, 'orchestration.yml')).mtimeMs;
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'noop');
    assert.strictEqual(fs.statSync(join(radHome, 'orchestration.yml')).mtimeMs, mtimeBefore);
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('sentinel-missing forces fresh-install even on version match (self-heal)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-sentinel-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    fs.rmSync(join(pluginRoot, 'skills/rad-orchestration/scripts/radorch.mjs'));
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'fresh-install');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('downgrade emits downgrade-noop and accepts the downgrade (FR-21)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-down-'));
  const pluginNew = makePluginRoot('1.1.0');
  const pluginOld = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot: pluginNew, radHome });
    const result = await runInstall({ pluginRoot: pluginOld, radHome });
    assert.strictEqual(result.action, 'downgrade-noop');
    const lines = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8').trim().split('\n');
    assert.strictEqual(JSON.parse(lines.at(-1)).action, 'downgrade-noop');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginNew, { recursive: true, force: true });
    fs.rmSync(pluginOld, { recursive: true, force: true });
  }
});

test('bidirectional coexistence warning names both partners when copilot-cli and copilot-vscode are present (FR-19)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-coex-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: {
        'copilot-cli': { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' },
        'copilot-vscode': { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' },
      },
    }));
    const warns = [];
    await runInstall({ pluginRoot, radHome, stderr: (m) => warns.push(m) });
    const joined = warns.join('\n');
    assert.match(joined, /copilot-cli\b/, 'names copilot-cli partner');
    assert.match(joined, /copilot-vscode\b/, 'names copilot-vscode partner');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('hydration drop-list — installer never writes config.yml, registry.yml, .harness, .gitignore, runtime/ (FR-12)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-drop-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    for (const banned of ['config.yml', 'registry.yml', '.harness', '.gitignore']) {
      assert.ok(!fs.existsSync(join(radHome, banned)), `must not write ${banned}`);
    }
    assert.ok(!fs.existsSync(join(radHome, 'runtime')), 'must not mkdir runtime/');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});
