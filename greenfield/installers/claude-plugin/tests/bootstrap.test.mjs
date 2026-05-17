import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function makeFakePluginRoot(version) {
  // bootstrap.mjs is the source-side entry; the bundled output lands in
  // installers/claude-plugin/output/hooks/bootstrap.mjs via emit-hook-bundle.
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

test('bootstrap.mjs self-uninstalls UserPromptSubmit on success, leaves SessionStart in place (FR-5, DD-15)', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    const result = spawnSync(process.execPath, [
      'greenfield/installers/claude-plugin/hooks/bootstrap.mjs',
    ], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `bootstrap exit 0; stderr=${result.stderr}`);
    const hooks = JSON.parse(fs.readFileSync(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
    assert.ok(!hooks.hooks.UserPromptSubmit, 'UserPromptSubmit removed on success (DD-15)');
    assert.ok(hooks.hooks.SessionStart, 'SessionStart left intact (DD-15)');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});

test('bootstrap.mjs leaves hooks.json intact on install failure so the next prompt retries (FR-5)', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    // Sabotage: delete the per-version manifest so loadManifest throws.
    fs.rmSync(join(pluginRoot, 'manifests/v1.0.0.json'));
    const result = spawnSync(process.execPath, [
      'greenfield/installers/claude-plugin/hooks/bootstrap.mjs',
    ], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
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

test('hooks.json self-rewrite is atomic — no leftover .tmp file on success (FR-14)', async () => {
  const pluginRoot = makeFakePluginRoot('1.0.0');
  const radHome = fs.mkdtempSync(join(os.tmpdir(), 'rad-'));
  try {
    spawnSync(process.execPath, ['greenfield/installers/claude-plugin/hooks/bootstrap.mjs'], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, RAD_HOME: radHome },
    });
    const leftover = fs.readdirSync(join(pluginRoot, 'hooks')).filter((n) => n.includes('.tmp'));
    assert.deepStrictEqual(leftover, [], 'no .tmp files remain (FR-14)');
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(radHome, { recursive: true, force: true });
  }
});
