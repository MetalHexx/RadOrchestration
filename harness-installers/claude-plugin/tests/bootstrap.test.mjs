import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const BOOTSTRAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../hooks/bootstrap.mjs');

function makeFakePluginRoot(version) {
  // bootstrap.mjs is the source-side entry; the bundled output lands in
  // harness-installers/claude-plugin/output/hooks/bootstrap.mjs via emit-hook-bundle.
  // Tests against bootstrap import the source-side entry directly so
  // lib/install/* resolves at runtime.
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'bp-'));
  fs.mkdirSync(join(dir, 'skills/rad-orchestration/scripts'), { recursive: true });
  fs.writeFileSync(join(dir, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
  fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', version }));
  fs.mkdirSync(join(dir, 'manifests'), { recursive: true });
  fs.writeFileSync(join(dir, `manifests/v${version}.json`), JSON.stringify({ version, files: [] }));
  fs.mkdirSync(join(dir, 'hooks'), { recursive: true });
  fs.writeFileSync(join(dir, 'hooks/hooks.json'), JSON.stringify({
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node bootstrap.mjs' }] }],
      SessionStart: [{ hooks: [{ type: 'command', command: 'node drift-check.mjs' }] }],
    },
  }, null, 2));
  return dir;
}

test('bootstrap.mjs self-uninstalls UserPromptSubmit on success, leaves SessionStart in place', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    const result = spawnSync(process.execPath, [
      BOOTSTRAP,
    ], {
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        RAD_HOME: radHome,
        RAD_BOOTSTRAP_SELFUNINSTALL_ALLOW_NONCACHE: '1',
      },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    const hooks = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(!hooks.hooks.UserPromptSubmit, 'UserPromptSubmit removed on success');
    assert.ok(hooks.hooks.SessionStart, 'SessionStart left intact');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('bootstrap.mjs leaves hooks.json intact on install failure so the next prompt retries', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    // Sabotage: delete the per-version manifest so loadManifest throws.
    fs.rmSync(join(pluginRoot, 'manifests/v1.0.0.json'));
    const result = spawnSync(process.execPath, [
      BOOTSTRAP,
    ], {
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        RAD_HOME: radHome,
        RAD_BOOTSTRAP_SELFUNINSTALL_ALLOW_NONCACHE: '1',
      },
      encoding: 'utf8',
    });
    assert.notStrictEqual(result.status, 0, 'bootstrap exits non-zero on install failure');
    const hooks = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(hooks.hooks.UserPromptSubmit, 'UserPromptSubmit retained for retry on next prompt');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('hooks.json self-rewrite is atomic — no leftover .tmp file on success', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    spawnSync(process.execPath, [BOOTSTRAP], {
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        RAD_HOME: radHome,
        RAD_BOOTSTRAP_SELFUNINSTALL_ALLOW_NONCACHE: '1',
      },
    });
    const leftover = fs.readdirSync(join(pluginRoot, 'hooks')).filter((n) => n.includes('.tmp'));
    assert.deepStrictEqual(leftover, [], 'no .tmp files remain');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('selfUninstall is skipped when pluginRoot is outside ~/.claude/plugins/cache', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  const hooksJsonPath = join(pluginRoot, 'hooks/hooks.json');
  const before = fs.readFileSync(hooksJsonPath);
  try {
    const result = spawnSync(process.execPath, [BOOTSTRAP], {
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        RAD_HOME: radHome,
        // No RAD_BOOTSTRAP_SELFUNINSTALL_ALLOW_NONCACHE — guard should engage.
      },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    assert.match(result.stderr, /selfUninstall skipped/, 'stderr announces the skip');
    // runInstall still ran successfully against radHome:
    assert.ok(fs.existsSync(join(radHome, 'install.json')), 'install.json written despite skipped selfUninstall');
    // hooks.json is byte-identical — no mutation:
    const after = fs.readFileSync(hooksJsonPath);
    assert.ok(before.equals(after), 'hooks.json byte-identical before and after — not mutated');
    // Defense-in-depth: parse and confirm UserPromptSubmit retained.
    const hooks = JSON.parse(after.toString('utf8'));
    assert.ok(hooks.hooks.UserPromptSubmit, 'UserPromptSubmit retained');
    assert.ok(hooks.hooks.SessionStart, 'SessionStart retained');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('selfUninstall fires when pluginRoot sits under a fake Claude Code cache (positive guard case)', async () => {
  // Build a fake homedir with a .claude/plugins/cache/<rest>/ subtree, then point
  // the spawned bootstrap process at it via HOME + USERPROFILE overrides so
  // os.homedir() resolves there. The guard then sees pluginRoot inside cacheRoot
  // and proceeds with selfUninstall.
  const fakeHome = fs.mkdtempSync(join(os.tmpdir(), 'fake-home-'));
  const pluginRoot = join(fakeHome, '.claude/plugins/cache/test-mkt/test-plugin/1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.mkdirSync(join(pluginRoot, 'skills/rad-orchestration/scripts'), { recursive: true });
    fs.writeFileSync(join(pluginRoot, 'skills/rad-orchestration/scripts/radorch.mjs'), '#!/usr/bin/env node\n');
    fs.writeFileSync(join(pluginRoot, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }));
    fs.mkdirSync(join(pluginRoot, 'manifests'), { recursive: true });
    fs.writeFileSync(join(pluginRoot, 'manifests/v1.0.0.json'), JSON.stringify({ version: '1.0.0', files: [] }));
    fs.mkdirSync(join(pluginRoot, 'hooks'), { recursive: true });
    fs.writeFileSync(join(pluginRoot, 'hooks/hooks.json'), JSON.stringify({
      hooks: {
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node bootstrap.mjs' }] }],
        SessionStart: [{ hooks: [{ type: 'command', command: 'node drift-check.mjs' }] }],
      },
    }, null, 2));
    const result = spawnSync(process.execPath, [BOOTSTRAP], {
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        RAD_HOME: radHome,
        HOME: fakeHome,
        USERPROFILE: fakeHome,
      },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    assert.doesNotMatch(result.stderr, /selfUninstall skipped/, 'stderr does NOT announce a skip — guard allowed mutation');
    const hooks = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(!hooks.hooks.UserPromptSubmit, 'UserPromptSubmit removed (cache path mutated)');
    assert.ok(hooks.hooks.SessionStart, 'SessionStart left intact');
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});
