import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(__dirname, 'drift-check.mjs');

function makeFakePluginRoot(t, pluginVersion) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-hook-plugin-'));
  t.after(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: '@rad-orchestration/claude-plugin', version: pluginVersion }),
    'utf8',
  );
  return root;
}

function makeFakeHome(t, installJson) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-hook-home-'));
  t.after(() => {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ }
  });
  if (installJson !== undefined) {
    const dir = path.join(home, '.radorch');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'install.json'),
      typeof installJson === 'string' ? installJson : JSON.stringify(installJson),
      'utf8',
    );
  }
  return home;
}

function runHook(env) {
  return spawnSync(process.execPath, [HOOK], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('drift-check exits 0 with empty stdout when CLAUDE_PLUGIN_ROOT is unset', () => {
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.HOME;
  delete env.USERPROFILE;
  const result = spawnSync(process.execPath, [HOOK], { env, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('drift-check exits 0 silently when plugin package.json is missing', (t) => {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-hook-noplug-'));
  t.after(() => { try { fs.rmSync(pluginRoot, { recursive: true, force: true }); } catch { /* best effort */ } });
  const home = makeFakeHome(t, { package_version: '1.0.0-alpha.8' });
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('drift-check exits 0 silently when install.json is missing (fresh state)', (t) => {
  const pluginRoot = makeFakePluginRoot(t, '1.0.0-alpha.8');
  const home = makeFakeHome(t /* no install.json */);
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('drift-check exits 0 silently when install.json is malformed', (t) => {
  const pluginRoot = makeFakePluginRoot(t, '1.0.0-alpha.8');
  const home = makeFakeHome(t, '{ not valid');
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('drift-check exits 0 silently when install.json lacks package_version', (t) => {
  const pluginRoot = makeFakePluginRoot(t, '1.0.0-alpha.8');
  const home = makeFakeHome(t, { some_other_field: 'x' });
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('drift-check is silent when versions match', (t) => {
  const pluginRoot = makeFakePluginRoot(t, '1.0.0-alpha.8');
  const home = makeFakeHome(t, { package_version: '1.0.0-alpha.8' });
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('drift-check emits drift context when versions differ', (t) => {
  const pluginRoot = makeFakePluginRoot(t, '1.0.0-alpha.8');
  const home = makeFakeHome(t, {
    package_version: '1.0.0-alpha.10',
    last_writer_version: '1.0.0-alpha.10',
  });
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[rad-orchestration drift\]/);
  assert.match(result.stdout, /1\.0\.0-alpha\.10/);
  assert.match(result.stdout, /1\.0\.0-alpha\.8/);
  assert.match(result.stdout, /\/plugin update rad-orchestration/);
});

test('drift-check surfaces last_writer when it differs from package_version', (t) => {
  const pluginRoot = makeFakePluginRoot(t, '1.0.0-alpha.8');
  const home = makeFakeHome(t, {
    package_version: '1.0.0-alpha.10',
    last_writer_version: '1.0.0-alpha.11',
  });
  const result = runHook({ CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /last writer: 1\.0\.0-alpha\.11/);
});
