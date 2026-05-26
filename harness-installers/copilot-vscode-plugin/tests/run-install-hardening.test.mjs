// Hardening behaviors on top of the base run-install flow:
//   - Pre-flight UI gate (auto-stop or fail-fast)
//   - install.json upsert on NOOP / downgrade-noop when entry is shape-drifted
//   - Retry-safe staging (failures leave _install-source/ intact)
//
// Tests exercise runInstall directly via the `_detectAndStopUi` seam so we
// never spawn a real UI process or send a real SIGTERM during the suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import * as tar from 'tar';
import { runInstall, UiLockError } from '../lib/install/run-install.js';

async function stageInstallSource(dir) {
  fs.mkdirSync(join(dir, '_install-source/templates'), { recursive: true });
  fs.writeFileSync(join(dir, '_install-source/orchestration.yml'), 'pipeline: {}\n');
  fs.writeFileSync(join(dir, '_install-source/templates/medium.yml'), 'name: medium\n');
  const uiStage = join(dir, '_install-source/ui.stage');
  fs.mkdirSync(uiStage, { recursive: true });
  fs.writeFileSync(join(uiStage, 'server.js'), '// ui\n');
  await tar.c(
    { gzip: true, file: join(dir, '_install-source/ui.tgz'), cwd: uiStage, portable: true },
    ['.'],
  );
  fs.rmSync(uiStage, { recursive: true, force: true });
}

async function makePluginRoot(version) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'plugin-vscode-hardening-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: 'rad-orc', version }));
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@rad-orchestration/copilot-vscode-plugin', version }));
  await stageInstallSource(dir);
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({
    version, channel: 'copilot-vscode-plugin', files: [
      { destinationPath: '${RAD_HOME}/orchestration.yml', sourcePath: '_install-source/orchestration.yml', ownership: 'user-config' },
      { destinationPath: '${RAD_HOME}/templates/medium.yml', sourcePath: '_install-source/templates/medium.yml', ownership: 'installer-owned' },
    ],
  }));
  return dir;
}

// Fake `detectAndStopUi` that returns a caller-supplied outcome.
function fakeDetect(outcome) {
  return async () => outcome;
}

test('UI gate: no UI running -> install proceeds, uiStopped=false', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ui-none-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    const result = await runInstall({
      pluginRoot, radHome,
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    assert.strictEqual(result.action, 'fresh-install');
    assert.strictEqual(result.uiStopped, false);
    assert.ok(fs.existsSync(join(radHome, 'install.json')));
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('UI gate: UI running and stopped -> install proceeds, uiStopped=true', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ui-stopped-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    const result = await runInstall({
      pluginRoot, radHome,
      _detectAndStopUi: fakeDetect({
        wasRunning: true, stopped: true,
        status: { pid: 12345, port: 3001, url: 'http://localhost:3001' },
        reason: null,
      }),
    });
    assert.strictEqual(result.action, 'fresh-install');
    assert.strictEqual(result.uiStopped, true);
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('UI gate: stop fails -> UiLockError; install.json untouched; staging intact for retry', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ui-lock-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    let threw = null;
    try {
      await runInstall({
        pluginRoot, radHome,
        _detectAndStopUi: fakeDetect({
          wasRunning: true, stopped: false,
          status: { pid: 99999, port: 3000, url: 'http://localhost:3000' },
          reason: 'SIGTERM sent but PID 99999 still alive after 5000ms',
        }),
      });
    } catch (err) { threw = err; }
    assert.ok(threw instanceof UiLockError);
    assert.match(threw.message, /PID 99999/);
    assert.match(threw.message, /http:\/\/localhost:3000/);
    assert.strictEqual(threw.uiStatus.pid, 99999);
    // install.json untouched (never created)
    assert.ok(!fs.existsSync(join(radHome, 'install.json')));
    // staging still intact for retry
    assert.ok(fs.existsSync(join(pluginRoot, '_install-source')));
    assert.ok(fs.existsSync(join(pluginRoot, '_install-source/ui.tgz')));
    // log captures the error action
    const log = fs.readFileSync(join(radHome, 'logs/install.log'), 'utf8').trim();
    assert.strictEqual(JSON.parse(log).action, 'error');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('UI gate runs AFTER NOOP fast path — same-version re-run skips UI stop entirely', async () => {
  // A noop install must not stop the UI; only branches that actually touch files do.
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-ui-skip-noop-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  let detectCalls = 0;
  try {
    await runInstall({ pluginRoot, radHome, _detectAndStopUi: async () => { detectCalls++; return { wasRunning: false, stopped: false, status: null, reason: null }; } });
    await stageInstallSource(pluginRoot); // re-stage; first install consumed the staging dir on success
    const detectBeforeNoop = detectCalls;
    const result = await runInstall({ pluginRoot, radHome, _detectAndStopUi: async () => { detectCalls++; return { wasRunning: true, stopped: false, status: { pid: 1, port: 3000, url: 'http://localhost:3000' }, reason: 'should not be reached' }; } });
    assert.strictEqual(result.action, 'noop');
    assert.strictEqual(detectCalls, detectBeforeNoop, 'UI gate must not run on noop');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('install.json upsert on NOOP when entry shape is drifted', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-upsert-noop-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    // Seed install.json with a shape-drifted entry (missing last_writer_version).
    fs.mkdirSync(radHome, { recursive: true });
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: {
        'copilot-vscode-plugin': { version: '1.0.0', channel: 'copilot-vscode-plugin', installed_at: '2020-01-01T00:00:00.000Z' /* last_writer_version missing */ },
      },
    }, null, 2));
    const result = await runInstall({
      pluginRoot, radHome,
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    assert.strictEqual(result.action, 'noop');
    assert.strictEqual(result.installJsonUpserted, true);
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['copilot-vscode-plugin'].last_writer_version, '1.0.0');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('install.json NOT rewritten on NOOP when entry is already current', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-noop-noupsert-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({
      pluginRoot, radHome,
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    await stageInstallSource(pluginRoot);
    const mtimeBefore = fs.statSync(join(radHome, 'install.json')).mtimeMs;
    // Wait a tick so mtime would visibly change if rewritten.
    await new Promise((r) => setTimeout(r, 50));
    const result = await runInstall({
      pluginRoot, radHome,
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    assert.strictEqual(result.action, 'noop');
    assert.strictEqual(result.installJsonUpserted, false);
    assert.strictEqual(fs.statSync(join(radHome, 'install.json')).mtimeMs, mtimeBefore);
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('install.json upsert on downgrade-noop when entry shape is drifted', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-upsert-downgrade-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    // Prior install at v1.1.0 with drifted shape.
    fs.mkdirSync(radHome, { recursive: true });
    fs.writeFileSync(join(radHome, 'install.json'), JSON.stringify({
      harnesses: { 'copilot-vscode-plugin': { version: '1.1.0', channel: 'wrong-channel', installed_at: '2020-01-01T00:00:00.000Z', last_writer_version: '1.1.0' } },
    }, null, 2));
    const result = await runInstall({
      pluginRoot, radHome, // delivering 1.0.0 < installed 1.1.0
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    assert.strictEqual(result.action, 'downgrade-noop');
    assert.strictEqual(result.installJsonUpserted, true);
    const ij = JSON.parse(fs.readFileSync(join(radHome, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses['copilot-vscode-plugin'].channel, 'copilot-vscode-plugin');
    // Downgrade-noop preserves the installed (higher) version, not the delivering one.
    assert.strictEqual(ij.harnesses['copilot-vscode-plugin'].version, '1.1.0');
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('retry-safe staging: a mid-install failure leaves _install-source/ intact', async () => {
  // Force a failure inside runInstall by removing the orchestration.yml source
  // partway through. _install-source/ should still be present after the throw
  // so a subsequent retry can re-attempt the copy.
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-staging-retry-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    // Sabotage: remove the orchestration.yml source so installManifestFiles throws ENOENT mid-stream.
    fs.rmSync(join(pluginRoot, '_install-source/orchestration.yml'));
    let threw = null;
    try {
      await runInstall({
        pluginRoot, radHome,
        _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
      });
    } catch (err) { threw = err; }
    assert.ok(threw instanceof Error);
    // Other staging files still present for retry.
    assert.ok(fs.existsSync(join(pluginRoot, '_install-source')));
    assert.ok(fs.existsSync(join(pluginRoot, '_install-source/ui.tgz')));
    assert.ok(fs.existsSync(join(pluginRoot, '_install-source/templates/medium.yml')));
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('success branch DOES clean up _install-source/ after fresh-install', async () => {
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-home-staging-success-'));
  const pluginRoot = await makePluginRoot('1.0.0');
  try {
    await runInstall({
      pluginRoot, radHome,
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    assert.ok(!fs.existsSync(join(pluginRoot, '_install-source')));
  } finally {
    fs.rmSync(radHome, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});
