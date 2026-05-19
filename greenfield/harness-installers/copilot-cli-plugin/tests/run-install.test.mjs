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
  fs.writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'rad-orc', version }));
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

function makePluginRootWithVersionedTemplate(version) {
  const dir = makePluginRoot(version);
  // Add an installer-owned template that is unique per version so the test can
  // observe remove-before-write semantics on upgrade.
  fs.writeFileSync(join(dir, 'templates', `tier-${version}.yml`), `name: tier-${version}\n`);
  // Rewrite the manifest to include the per-version template alongside the
  // standard files. Keep orchestration.yml as user-config so the assertion can
  // verify it survives the upgrade untouched.
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({
    version, channel: 'copilot-cli-plugin', files: [
      { destinationPath: '${RAD_HOME}/orchestration.yml', sourcePath: 'orchestration.yml', ownership: 'user-config' },
      { destinationPath: `\${RAD_HOME}/templates/tier-${version}.yml`, sourcePath: `templates/tier-${version}.yml`, ownership: 'installer-owned' },
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

test('upgrade-complete: version bump removes prior installer-owned files, installs new ones, preserves user-config (FR-14, AD-8, FR-11)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-up-'));
  const pluginOld = makePluginRootWithVersionedTemplate('1.0.0');
  const pluginNew = makePluginRootWithVersionedTemplate('1.1.0');
  try {
    await runInstall({ pluginRoot: pluginOld, radHome });
    assert.ok(fs.existsSync(join(radHome, 'templates/tier-1.0.0.yml')), 'old tier present after fresh install');
    assert.ok(fs.existsSync(join(radHome, 'orchestration.yml')), 'orchestration.yml present after fresh install');
    // Mark orchestration.yml so we can detect rewrite (user-config must be preserved).
    fs.writeFileSync(join(radHome, 'orchestration.yml'), 'pipeline: {}\nuser_edit: keep-me\n');

    const result = await runInstall({ pluginRoot: pluginNew, radHome });
    assert.strictEqual(result.action, 'upgrade-complete', 'version bump emits upgrade-complete');
    assert.ok(!fs.existsSync(join(radHome, 'templates/tier-1.0.0.yml')), 'prior installer-owned template removed');
    assert.ok(fs.existsSync(join(radHome, 'templates/tier-1.1.0.yml')), 'new installer-owned template installed');
    const orchAfter = fs.readFileSync(join(radHome, 'orchestration.yml'), 'utf8');
    assert.match(orchAfter, /user_edit: keep-me/, 'user-config orchestration.yml preserved untouched');
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['copilot-cli-plugin'].version, '1.1.0', 'install.json now records new version');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginOld, { recursive: true, force: true });
    fs.rmSync(pluginNew, { recursive: true, force: true });
  }
});

test('upgrade with stale snapshot falls back to bundled manifest and removes the real prior installer-owned files (R2-2)', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-stale-snap-'));
  const pluginOld = makePluginRootWithVersionedTemplate('1.0.0');
  const pluginNew = makePluginRootWithVersionedTemplate('1.1.0');
  try {
    // Fresh install of v1.0.0 writes the snapshot + installs tier-1.0.0.yml.
    await runInstall({ pluginRoot: pluginOld, radHome });
    assert.ok(fs.existsSync(join(radHome, 'templates/tier-1.0.0.yml')), 'old tier present after fresh install');

    // Corrupt the snapshot — wrong version, wrong file list. If trusted, the
    // upgrade path would remove paths that don't exist and leave tier-1.0.0.yml.
    fs.writeFileSync(join(radHome, '.copilot-cli-plugin-manifest.json'), JSON.stringify({
      version: 'wrong',
      channel: 'copilot-cli-plugin',
      files: [
        { destinationPath: '${RAD_HOME}/templates/nonexistent.yml', sourcePath: 'templates/nonexistent.yml', ownership: 'installer-owned' },
      ],
    }) + '\n', 'utf8');

    // pluginNew also needs the v1.0.0 manifest so loadManifest fallback can find it.
    fs.copyFileSync(
      join(pluginOld, 'manifests/v1.0.0.json'),
      join(pluginNew, 'manifests/v1.0.0.json'),
    );

    const result = await runInstall({ pluginRoot: pluginNew, radHome });
    assert.strictEqual(result.action, 'upgrade-complete', 'version bump still emits upgrade-complete');
    assert.ok(!fs.existsSync(join(radHome, 'templates/tier-1.0.0.yml')),
      'real prior tier was removed via loadManifest fallback (snapshot was stale)');
    assert.ok(fs.existsSync(join(radHome, 'templates/tier-1.1.0.yml')), 'new tier installed');
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['copilot-cli-plugin'].version, '1.1.0', 'install.json records new version');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginOld, { recursive: true, force: true });
    fs.rmSync(pluginNew, { recursive: true, force: true });
  }
});
