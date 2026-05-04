import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { runUninstall } from './uninstall.js';

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function fixtureInstaller(version, files) {
  const installerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inst-'));
  const dir = path.join(installerRoot, 'src', 'claude', 'manifests');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `v${version}.json`),
    JSON.stringify({ harness: 'claude', version, files }, null, 2) + '\n',
    'utf8',
  );
  return installerRoot;
}

function fixtureInstalled(orchRoot, version, contents) {
  const cfg = path.join(orchRoot, 'skills', 'rad-orchestration', 'config');
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(
    path.join(cfg, 'orchestration.yml'),
    `version: "1.0"\npackage_version: ${version}\nsystem:\n  orch_root: .claude\n`,
    'utf8',
  );
  for (const [rel, body] of Object.entries(contents)) {
    const abs = path.join(orchRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
}

test('runUninstall removes manifest-listed files and orchestration.yml when user confirms', async () => {
  const orchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uninst-'));
  fixtureInstalled(orchRoot, '1.0.0-alpha.9', { 'agents/coder.md': 'a' });
  const installerRoot = fixtureInstaller('1.0.0-alpha.9', [
    { bundlePath: 'agents/coder.md', sha256: sha256('a') },
  ]);
  const result = await runUninstall({
    installerRoot,
    resolvedOrchRoot: orchRoot,
    tool: 'claude-code',
    // Stub interactive prompts: confirm both prompts.
    promptConfirm: async () => true,
  });
  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.removedCount, 1);
  assert.ok(!fs.existsSync(path.join(orchRoot, 'agents', 'coder.md')));
  assert.ok(
    !fs.existsSync(path.join(orchRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml')),
    'orchestration.yml must be removed last',
  );
});

test('runUninstall exits cleanly when no install is detected', async () => {
  const orchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uninst-empty-'));
  const installerRoot = fixtureInstaller('1.0.0-alpha.9', []);
  const result = await runUninstall({
    installerRoot,
    resolvedOrchRoot: orchRoot,
    tool: 'claude-code',
    promptConfirm: async () => true,
  });
  assert.strictEqual(result.status, 'no-install-detected');
});

test('runUninstall exits via pre-manifest path when package_version is missing (DD-1)', async () => {
  const orchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uninst-pre-'));
  const cfg = path.join(orchRoot, 'skills', 'rad-orchestration', 'config');
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(
    path.join(cfg, 'orchestration.yml'),
    'version: "1.0"\nsystem:\n  orch_root: .claude\n',
    'utf8',
  );
  const installerRoot = fixtureInstaller('1.0.0-alpha.9', []);
  const result = await runUninstall({
    installerRoot,
    resolvedOrchRoot: orchRoot,
    tool: 'claude-code',
    promptConfirm: async () => true,
  });
  assert.strictEqual(result.status, 'pre-manifest');
  // No files were modified.
  assert.ok(fs.existsSync(path.join(cfg, 'orchestration.yml')), 'pre-manifest install must NOT be touched');
});

test('orchestration.yml removed AFTER all other manifest-listed files (F-5 invariant)', async () => {
  // This fixture includes orchestration.yml IN the manifest (as in the real
  // bundled manifest at position 51 of 1872). The invariant: orchestration.yml
  // must be removed LAST, not mid-stream by removeManifestFiles.
  const orchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uninst-order-'));
  const ymlPath = path.join(orchRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml');
  fixtureInstalled(orchRoot, '1.0.0-alpha.9', { 'agents/coder.md': 'a' });
  const installerRoot = fixtureInstaller('1.0.0-alpha.9', [
    { bundlePath: 'skills/rad-orchestration/config/orchestration.yml', sha256: sha256('yml') },
    { bundlePath: 'agents/coder.md', sha256: sha256('a') },
  ]);

  const removalOrder = [];
  const origRmSync = fs.rmSync.bind(fs);
  const origRmSyncFn = fs.rmSync;
  // Track removal order by monkey-patching rmSync
  fs.rmSync = (p, opts) => {
    if (String(p).replace(/\\/g, '/').endsWith('orchestration.yml')) removalOrder.push('yml');
    else if (String(p).replace(/\\/g, '/').endsWith('coder.md')) removalOrder.push('coder.md');
    origRmSync(p, opts);
  };

  try {
    const result = await runUninstall({
      installerRoot,
      resolvedOrchRoot: orchRoot,
      tool: 'claude-code',
      promptConfirm: async () => true,
    });
    assert.strictEqual(result.status, 'completed');
    // coder.md must be removed BEFORE orchestration.yml
    assert.ok(removalOrder.includes('coder.md'), 'coder.md was removed');
    assert.ok(removalOrder.includes('yml'), 'orchestration.yml was removed');
    assert.ok(
      removalOrder.indexOf('coder.md') < removalOrder.indexOf('yml'),
      `orchestration.yml must be removed last; got order: ${removalOrder.join(', ')}`,
    );
    assert.ok(!fs.existsSync(ymlPath), 'orchestration.yml no longer exists on disk');
  } finally {
    fs.rmSync = origRmSyncFn;
  }
});

test('runUninstall aborts when user declines the modified-file confirmation', async () => {
  const orchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uninst-mod-'));
  fixtureInstalled(orchRoot, '1.0.0-alpha.9', { 'agents/coder.md': 'CHANGED' });
  const installerRoot = fixtureInstaller('1.0.0-alpha.9', [
    { bundlePath: 'agents/coder.md', sha256: sha256('original') },
  ]);
  let prompts = 0;
  const result = await runUninstall({
    installerRoot,
    resolvedOrchRoot: orchRoot,
    tool: 'claude-code',
    promptConfirm: async () => { prompts++; return false; },
  });
  assert.strictEqual(result.status, 'cancelled-modified-files');
  assert.strictEqual(prompts, 1, 'modified-file prompt must run; uninstall confirmation must NOT run after decline');
  // Files survive.
  assert.ok(fs.existsSync(path.join(orchRoot, 'agents', 'coder.md')));
});
