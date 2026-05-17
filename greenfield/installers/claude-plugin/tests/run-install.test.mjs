import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { runInstall } from '../lib/install/run-install.js';

function makePluginRoot(version) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'plugin-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', version }));
  fs.writeFileSync(join(dir, 'orchestration.yml'), 'pipeline: {}\n');
  fs.mkdirSync(join(dir, 'templates'), { recursive: true });
  fs.writeFileSync(join(dir, 'templates/medium.yml'), 'name: medium\n');
  fs.mkdirSync(join(dir, 'ui'), { recursive: true });
  fs.writeFileSync(join(dir, 'ui/server.js'), '// ui\n');
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`),
    JSON.stringify({ version, files: [
      { destinationPath: '${RAD_HOME}/orchestration.yml', sourcePath: 'orchestration.yml', ownership: 'user-config' },
      { destinationPath: '${RAD_HOME}/templates/medium.yml', sourcePath: 'templates/medium.yml', ownership: 'installer-owned' },
      { destinationPath: '${RAD_HOME}/ui/server.js', sourcePath: 'ui/server.js', ownership: 'installer-owned' },
    ]}));
  return dir;
}

test('fresh install hydrates ~/.radorch/, stamps install.json under claude-plugin, logs fresh-install (FR-7, FR-17, NFR-8)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'fresh-install');
    assert.ok(fs.existsSync(join(radHome, 'orchestration.yml')), 'orchestration.yml hydrated');
    assert.ok(fs.existsSync(join(radHome, 'templates/medium.yml')), 'tier template hydrated');
    assert.ok(fs.existsSync(join(radHome, 'ui/server.js')), 'UI hydrated');
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['claude-plugin'].version, '1.0.0');
    assert.ok(!('state_schema_version' in ij),
      'fresh install.json carries no state_schema_version field — current shape is unversioned (FR-18)');
    const log = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8').trim();
    assert.strictEqual(JSON.parse(log).action, 'fresh-install');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('same-version re-run takes the noop fast path with no writes besides best-effort log (FR-9 short-circuit, NFR-8)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-noop-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    const ymlMtimeBefore = fs.statSync(join(radHome, 'orchestration.yml')).mtimeMs;
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'noop');
    const ymlMtimeAfter = fs.statSync(join(radHome, 'orchestration.yml')).mtimeMs;
    assert.strictEqual(ymlMtimeBefore, ymlMtimeAfter, 'no re-write on noop path');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('sentinel missing forces fresh-install even on version match (FR-9, AD-13)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-sentinel-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    fs.rmSync(join(pluginRoot, 'skills/rad-orchestration/scripts/radorch.mjs'));
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'fresh-install', 'missing sentinel forces re-install');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('downgrade emits downgrade-noop and warns, never refuses (FR-19)', async () => {
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

test('cross-channel coexistence warning fires when claude key is present alongside claude-plugin (FR-20, AD-12)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-coex-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    // Pre-existing install.json in the current shape — identified structurally by
    // presence of the harnesses object; no state_schema_version field (FR-18).
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'claude': { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' } },
    }));
    const warns = [];
    await runInstall({ pluginRoot, radHome, stderr: (msg) => warns.push(msg) });
    const joined = warns.join('\n');
    assert.match(joined, /legacy.*installer|standard.*installer|claude.*coexist/i,
      'multi-line stderr warning naming both installs (FR-20)');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('AD-8 hydration scope — no config.yml / registry.yml / .harness / .gitignore / runtime/ writes (FR-8)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ad8-'));
  const pluginRoot = makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    for (const banned of ['config.yml', 'registry.yml', '.harness', '.gitignore']) {
      assert.ok(!fs.existsSync(join(radHome, banned)), `installer must not write ${banned} (FR-8)`);
    }
    assert.ok(!fs.existsSync(join(radHome, 'runtime')), 'installer must not mkdir ~/.radorch/runtime/ (FR-8)');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});
