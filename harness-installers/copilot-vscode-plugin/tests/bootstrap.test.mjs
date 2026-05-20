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
  fs.writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'rad-orc-vscode', version }));
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@rad-orchestration/copilot-vscode-plugin', version }));
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({ version, channel: 'copilot-vscode-plugin', files: [] }));
  return dir;
}

test('first invocation runs install and writes a success marker (FR-8, DD-2)', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    const result = spawnSync(process.execPath, [BOOTSTRAP], {
      env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    const marker = JSON.parse(fs.readFileSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json'), 'utf8'));
    assert.strictEqual(marker.status, 'success');
    assert.strictEqual(marker.version, '1.0.0');
    assert.match(marker.at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('second invocation with matching success marker takes the silent noop fast-path (NFR-9, DD-9)', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome } });
    const logBefore = fs.existsSync(join(radHome, 'logs/install.log'))
      ? fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8') : '';
    const result = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome } });
    assert.strictEqual(result.status, 0);
    const logAfter = fs.existsSync(join(radHome, 'logs/install.log'))
      ? fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8') : '';
    // Silent-noop discipline (DD-9): no new line appended on the noop fast-path.
    assert.strictEqual(logAfter, logBefore, 'silent-noop must not append to install.log');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('install failure writes an error marker, exits 1, and retries on next invocation (DD-16, NFR-12)', () => {
  const pluginRoot = makePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    // Sabotage: remove the per-version manifest so loadManifest throws.
    fs.rmSync(join(pluginRoot, 'manifests/v1.0.0.json'));
    const r1 = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome } });
    assert.strictEqual(r1.status, 1, 'bootstrap exits 1 on install failure');
    const marker = JSON.parse(fs.readFileSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json'), 'utf8'));
    assert.strictEqual(marker.status, 'error');
    // Restore manifest; next invocation must retry (DD-16).
    fs.writeFileSync(join(pluginRoot, 'manifests/v1.0.0.json'), JSON.stringify({ version: '1.0.0', channel: 'copilot-vscode-plugin', files: [] }));
    const r2 = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome } });
    assert.strictEqual(r2.status, 0, 'retry succeeds after manifest restored');
    const marker2 = JSON.parse(fs.readFileSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json'), 'utf8'));
    assert.strictEqual(marker2.status, 'success');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('version mismatch (upgrade case) runs install even with a prior success marker (FR-8)', () => {
  const pluginV1 = makePluginRoot('1.0.0');
  const pluginV2 = makePluginRoot('1.1.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-up-'));
  try {
    spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginV1, RAD_HOME: radHome } });
    const logBefore = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8');
    const r = spawnSync(process.execPath, [BOOTSTRAP], { env: { ...process.env, COPILOT_VSCODE_PLUGIN_ROOT: pluginV2, RAD_HOME: radHome } });
    assert.strictEqual(r.status, 0);
    const logAfter = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8');
    assert.notStrictEqual(logAfter, logBefore, 'upgrade appends a new log entry (not silent noop)');
    const marker = JSON.parse(fs.readFileSync(join(radHome, '.copilot-vscode-plugin-bootstrap.json'), 'utf8'));
    assert.strictEqual(marker.version, '1.1.0');
  } finally {
    fs.rmSync(pluginV1, { recursive: true, force: true });
    fs.rmSync(pluginV2, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});
