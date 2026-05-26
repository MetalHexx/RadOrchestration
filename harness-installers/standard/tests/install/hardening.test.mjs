// Hardening tests for hydrateUserData + install-harness NOOP upsert.
// Exercises the new UI-gate (auto-stop / fail-fast) and install.json upsert
// branches against synthetic fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';

import { hydrateUserData } from '../../lib/install/hydrate-user-data.js';
import { UiLockError } from '../../lib/install/ui-stop.js';
import { installHarness } from '../../lib/install/install-harness.js';

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function withHome(home) {
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return () => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
  };
}

async function buildBundle(bundleRoot) {
  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.writeFileSync(path.join(bundleRoot, 'orchestration.yml'), 'model: claude-opus-4-5\n');
  const templatesDir = path.join(bundleRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  for (const name of ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml']) {
    fs.writeFileSync(path.join(templatesDir, name), `# ${name}\n`);
  }
  const uiStage = path.join(bundleRoot, 'ui.stage');
  fs.mkdirSync(uiStage, { recursive: true });
  fs.writeFileSync(path.join(uiStage, 'main.js'), '// ui\n');
  await tar.c(
    { gzip: true, file: path.join(bundleRoot, 'ui.tgz'), cwd: uiStage, portable: true },
    ['.'],
  );
  fs.rmSync(uiStage, { recursive: true, force: true });
}

const fakeDetect = (outcome) => async () => outcome;

test('UI gate: no UI running -> hydrateUserData proceeds, uiStopped=false', async () => {
  const tmp = mkTmp('std-ui-none-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    await buildBundle(bundle);
    const result = await hydrateUserData({
      bundleRoot: bundle,
      _detectAndStopUi: fakeDetect({ wasRunning: false, stopped: false, status: null, reason: null }),
    });
    assert.strictEqual(result.uiStopped, false);
    assert.ok(fs.existsSync(path.join(tmp, 'home/.radorc/ui/main.js')));
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('UI gate: UI running and stopped -> hydrateUserData proceeds, uiStopped=true', async () => {
  const tmp = mkTmp('std-ui-stopped-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    await buildBundle(bundle);
    const result = await hydrateUserData({
      bundleRoot: bundle,
      _detectAndStopUi: fakeDetect({
        wasRunning: true, stopped: true,
        status: { pid: 12345, port: 3001, url: 'http://localhost:3001' },
        reason: null,
      }),
    });
    assert.strictEqual(result.uiStopped, true);
    assert.ok(fs.existsSync(path.join(tmp, 'home/.radorc/ui/main.js')));
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('UI gate: stop fails -> UiLockError; no file work attempted', async () => {
  const tmp = mkTmp('std-ui-lock-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    await buildBundle(bundle);
    let threw = null;
    try {
      await hydrateUserData({
        bundleRoot: bundle,
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
    // No file work happened (no ui/ extracted, no templates, no orchestration.yml).
    assert.ok(!fs.existsSync(path.join(tmp, 'home/.radorc/ui')));
    assert.ok(!fs.existsSync(path.join(tmp, 'home/.radorc/templates')));
    assert.ok(!fs.existsSync(path.join(tmp, 'home/.radorc/orchestration.yml')));
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// --- install-harness NOOP upsert ---

async function buildHarnessBundle(bundleRoot, harness, version) {
  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.writeFileSync(path.join(bundleRoot, 'package.json'), JSON.stringify({ name: harness, version }));
  // Minimal manifest the standard installer expects (matches the per-harness shape).
  const manifestsDir = path.join(bundleRoot, 'manifests');
  fs.mkdirSync(manifestsDir, { recursive: true });
  fs.writeFileSync(path.join(manifestsDir, `v${version}.json`), JSON.stringify({
    version, channel: 'standard', files: [],
  }));
}

test('install-harness NOOP upserts install.json when entry is shape-drifted', async () => {
  const tmp = mkTmp('std-noop-upsert-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const harness = 'claude';
    const bundle = path.join(tmp, 'bundle');
    await buildHarnessBundle(bundle, harness, '1.0.0');
    // Seed a sentinel in the harness root so the noop branch fires.
    const harnessRootDir = path.join(tmp, 'home/.claude');
    fs.mkdirSync(path.join(harnessRootDir, 'skills/rad-orchestration/scripts'), { recursive: true });
    fs.writeFileSync(path.join(harnessRootDir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
    // Seed install.json with a shape-drifted entry (missing last_writer_version).
    const radorch = path.join(tmp, 'home/.radorc');
    fs.mkdirSync(radorch, { recursive: true });
    fs.writeFileSync(path.join(radorch, 'install.json'), JSON.stringify({
      harnesses: {
        [harness]: { version: '1.0.0', channel: 'legacy-installer', installed_at: '2020-01-01T00:00:00.000Z' /* last_writer_version missing */ },
      },
    }, null, 2));

    const result = await installHarness({ bundleRoot: bundle, harness });
    assert.strictEqual(result.action, 'noop');
    assert.strictEqual(result.installJsonUpserted, true);
    const ij = JSON.parse(fs.readFileSync(path.join(radorch, 'install.json'), 'utf8'));
    assert.strictEqual(ij.harnesses[harness].last_writer_version, '1.0.0');
    // Channel is rewritten to canonical 'standard' on upsert.
    assert.strictEqual(ij.harnesses[harness].channel, 'standard');
    // installed_at is preserved from prior entry (defensive — don't churn timestamps).
    assert.strictEqual(ij.harnesses[harness].installed_at, '2020-01-01T00:00:00.000Z');
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('install-harness NOOP does NOT rewrite install.json when entry is already current', async () => {
  const tmp = mkTmp('std-noop-skip-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const harness = 'claude';
    const bundle = path.join(tmp, 'bundle');
    await buildHarnessBundle(bundle, harness, '1.0.0');
    const harnessRootDir = path.join(tmp, 'home/.claude');
    fs.mkdirSync(path.join(harnessRootDir, 'skills/rad-orchestration/scripts'), { recursive: true });
    fs.writeFileSync(path.join(harnessRootDir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
    const radorch = path.join(tmp, 'home/.radorc');
    fs.mkdirSync(radorch, { recursive: true });
    fs.writeFileSync(path.join(radorch, 'install.json'), JSON.stringify({
      harnesses: { [harness]: { version: '1.0.0', channel: 'standard', installed_at: '2024-01-01T00:00:00.000Z', last_writer_version: '1.0.0' } },
    }, null, 2));
    const mtimeBefore = fs.statSync(path.join(radorch, 'install.json')).mtimeMs;
    await new Promise((r) => setTimeout(r, 50));
    const result = await installHarness({ bundleRoot: bundle, harness });
    assert.strictEqual(result.action, 'noop');
    assert.strictEqual(result.installJsonUpserted, false);
    assert.strictEqual(fs.statSync(path.join(radorch, 'install.json')).mtimeMs, mtimeBefore);
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
