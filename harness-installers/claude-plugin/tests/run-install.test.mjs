import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import * as tar from 'tar';
import { runInstall } from '../lib/install/run-install.js';

async function stageInstallSource(dir) {
  fs.mkdirSync(join(dir, '_install-source/templates'), { recursive: true });
  fs.writeFileSync(join(dir, '_install-source/orchestration.yml'), 'pipeline: {}\n');
  fs.writeFileSync(join(dir, '_install-source/templates/medium.yml'), 'name: medium\n');
  // UI ships as a gzipped tarball at _install-source/ui.tgz so node_modules/
  // and .next/ survive the satellite `.gitignore` and `npm pack` strips. Stage
  // a synthetic tree under a temp dir, pack it, then drop the temp dir.
  const uiStage = join(dir, '_install-source/ui.stage');
  fs.mkdirSync(join(uiStage, '.next/static/chunks'), { recursive: true });
  fs.mkdirSync(join(uiStage, 'public'), { recursive: true });
  fs.writeFileSync(join(uiStage, 'server.js'), '// ui\n');
  fs.writeFileSync(join(uiStage, '.next/static/chunks/main.js'), '// chunk\n');
  fs.writeFileSync(join(uiStage, 'public/logo.svg'), '<svg/>\n');
  await tar.c(
    { gzip: true, file: join(dir, '_install-source/ui.tgz'), cwd: uiStage, portable: true },
    ['.'],
  );
  fs.rmSync(uiStage, { recursive: true, force: true });
}

async function makePluginRoot(version) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'plugin-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', version }));
  await stageInstallSource(dir);
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`),
    JSON.stringify({ version, files: [
      { destinationPath: '${RAD_HOME}/orchestration.yml', sourcePath: '_install-source/orchestration.yml', ownership: 'user-config' },
      { destinationPath: '${RAD_HOME}/templates/medium.yml', sourcePath: '_install-source/templates/medium.yml', ownership: 'installer-owned' },
    ]}));
  return dir;
}

test('fresh install hydrates ~/.radorch/, stamps install.json under claude-plugin, logs fresh-install', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'fresh-install');
    assert.ok(fs.existsSync(join(radHome, 'orchestration.yml')), 'orchestration.yml hydrated');
    assert.ok(fs.existsSync(join(radHome, 'templates/medium.yml')), 'tier template hydrated');
    assert.ok(fs.existsSync(join(radHome, 'ui/server.js')), 'UI hydrated');
    assert.ok(!fs.existsSync(join(pluginRoot, '_install-source')), 'staging dir removed after hydration');
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['claude-plugin'].version, '1.0.0');
    assert.ok(!('state_schema_version' in ij),
      'fresh install.json carries no state_schema_version field — current shape is unversioned');
    const log = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8').trim();
    assert.strictEqual(JSON.parse(log).action, 'fresh-install');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('same-version re-run takes the noop fast path with no writes besides best-effort log', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-noop-'));
  const pluginRoot = await makePluginRoot('1.0.0');
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

test('sentinel missing forces fresh-install even on version match', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-sentinel-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    fs.rmSync(join(pluginRoot, 'skills/rad-orchestration/scripts/radorch.mjs'));
    await stageInstallSource(pluginRoot); // real reinstall re-extracts the tarball
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'fresh-install', 'missing sentinel forces re-install');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('downgrade emits downgrade-noop and warns, never refuses', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-down-'));
  const pluginNew = await makePluginRoot('1.1.0');
  const pluginOld = await makePluginRoot('1.0.0');
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

test('cross-channel coexistence warning fires when claude key is present alongside claude-plugin', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-coex-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    // Pre-existing install.json in the current shape — identified structurally by
    // presence of the harnesses object; no state_schema_version field.
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'claude': { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' } },
    }));
    const warns = [];
    await runInstall({ pluginRoot, radHome, stderr: (msg) => warns.push(msg) });
    const joined = warns.join('\n');
    assert.match(joined, /legacy.*installer|standard.*installer|claude.*coexist/i,
      'multi-line stderr warning naming both installs');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('--force bypasses the same-version noop short-circuit', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-force-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    await stageInstallSource(pluginRoot); // real reinstall re-extracts the tarball
    const result = await runInstall({ pluginRoot, radHome, force: true });
    assert.notStrictEqual(result.action, 'noop', '--force must not short-circuit on same-version re-run');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('fresh install copies ui/ tree to ~/.radorch/ui/', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ui-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    assert.ok(fs.existsSync(join(radHome, 'ui/server.js')),                'ui/server.js hydrated via tree-copy');
    assert.ok(fs.existsSync(join(radHome, 'ui/.next/static/chunks/main.js')), 'ui/.next static asset hydrated');
    assert.ok(fs.existsSync(join(radHome, 'ui/public/logo.svg')),         'ui/public/ asset hydrated');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('foreign harness entries in install.json are preserved — only own entry is updated', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-foreign-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    fs.mkdirSync(radHome, { recursive: true });
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: {
        'copilot-cli-plugin': { version: '2.0.0', channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: '2.0.0' },
        'copilot-cli': { version: '1.5.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '1.5.0' },
      },
    }));
    await runInstall({ pluginRoot, radHome });
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['claude-plugin'].version, '1.0.0', 'own entry written');
    assert.strictEqual(ij.harnesses['copilot-cli-plugin'].version, '2.0.0', 'copilot-cli-plugin entry preserved untouched');
    assert.strictEqual(ij.harnesses['copilot-cli'].version, '1.5.0', 'legacy copilot-cli entry preserved untouched');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});


test('legacy top-level templates/, orchestration.yml, ui/ shadow paths from prior payloads are removed on install', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-legacy-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  // Simulate a pre-relocation payload that shipped these at the plugin root.
  fs.writeFileSync(join(pluginRoot, 'orchestration.yml'), 'legacy: shadow\n');
  fs.mkdirSync(join(pluginRoot, 'templates'), { recursive: true });
  fs.writeFileSync(join(pluginRoot, 'templates/legacy.yml'), 'legacy: tier\n');
  fs.mkdirSync(join(pluginRoot, 'ui'), { recursive: true });
  fs.writeFileSync(join(pluginRoot, 'ui/legacy.js'), '// legacy ui\n');
  try {
    await runInstall({ pluginRoot, radHome });
    assert.ok(!fs.existsSync(join(pluginRoot, 'orchestration.yml')), 'legacy orchestration.yml shadow removed');
    assert.ok(!fs.existsSync(join(pluginRoot, 'templates')), 'legacy templates/ shadow removed');
    assert.ok(!fs.existsSync(join(pluginRoot, 'ui')), 'legacy ui/ shadow removed');
    assert.ok(!fs.existsSync(join(pluginRoot, '_install-source')), 'current staging dir removed');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('shadow cleanup also runs on the noop fast path so re-installs cleanse pre-existing shadows', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-noop-clean-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    // Simulate a fresh tarball re-extraction that re-brought the staging dir AND
    // dropped a legacy top-level shadow on disk. Bootstrap fires, hits the noop
    // short-circuit because the version matches, and must still clean both.
    await stageInstallSource(pluginRoot);
    fs.writeFileSync(join(pluginRoot, 'orchestration.yml'), 'legacy: shadow\n');
    const result = await runInstall({ pluginRoot, radHome });
    assert.strictEqual(result.action, 'noop');
    assert.ok(!fs.existsSync(join(pluginRoot, '_install-source')), 'staging dir removed on noop');
    assert.ok(!fs.existsSync(join(pluginRoot, 'orchestration.yml')), 'legacy shadow removed on noop');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('hydration scope — no config.yml / registry.yml / .harness / .gitignore / runtime/ writes', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ad8-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({ pluginRoot, radHome });
    for (const banned of ['config.yml', 'registry.yml', '.harness', '.gitignore']) {
      assert.ok(!fs.existsSync(join(radHome, banned)), `installer must not write ${banned}`);
    }
    assert.ok(!fs.existsSync(join(radHome, 'runtime')), 'installer must not mkdir ~/.radorch/runtime/');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});
