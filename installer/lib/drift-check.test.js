import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectPluginDrift } from './drift-check.js';

function makeHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-check-'));
  t.after(() => {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ }
  });
  return home;
}

function writeRegistry(homeDir, obj) {
  const dir = path.join(homeDir, '.claude', 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'installed_plugins.json');
  fs.writeFileSync(file, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2), 'utf8');
  return file;
}

test('detectPluginDrift returns no drift when installed_plugins.json is missing', (t) => {
  const home = makeHome(t);
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
  assert.deepEqual(result.plugins, []);
});

test('detectPluginDrift returns no drift when rad-orchestration entry matches', (t) => {
  const home = makeHome(t);
  writeRegistry(home, {
    plugins: {
      'rad-orchestration@radorch-local': [{
        scope: 'user',
        installPath: '/tmp/install',
        version: '1.0.0-alpha.9',
        installedAt: '2026-05-14T00:00:00Z',
      }],
    },
  });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
  assert.deepEqual(result.plugins, []);
});

test('detectPluginDrift reports a mismatching rad-orchestration entry', (t) => {
  const home = makeHome(t);
  writeRegistry(home, {
    plugins: {
      'rad-orchestration@radorch-local': [{
        scope: 'user',
        installPath: '/tmp/install',
        version: '1.0.0-alpha.8',
        installedAt: '2026-05-14T00:00:00Z',
      }],
    },
  });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, true);
  assert.equal(result.plugins.length, 1);
  assert.equal(result.plugins[0].key, 'rad-orchestration@radorch-local');
  assert.equal(result.plugins[0].version, '1.0.0-alpha.8');
  assert.equal(result.plugins[0].installPath, '/tmp/install');
});

test('detectPluginDrift reports every mismatching entry across multiple marketplaces', (t) => {
  const home = makeHome(t);
  writeRegistry(home, {
    plugins: {
      'rad-orchestration@radorch-local': [{ version: '1.0.0-alpha.8' }],
      'rad-orchestration@official-marketplace': [{ version: '1.0.0-alpha.7' }],
    },
  });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, true);
  assert.equal(result.plugins.length, 2);
  const keys = result.plugins.map((p) => p.key).sort();
  assert.deepEqual(keys, [
    'rad-orchestration@official-marketplace',
    'rad-orchestration@radorch-local',
  ]);
});

test('detectPluginDrift ignores entries from other plugins', (t) => {
  const home = makeHome(t);
  writeRegistry(home, {
    plugins: {
      'some-other-plugin@store': [{ version: '2.5.0' }],
    },
  });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
  assert.deepEqual(result.plugins, []);
});

test('detectPluginDrift returns no drift on malformed registry JSON', (t) => {
  const home = makeHome(t);
  writeRegistry(home, '{ not valid json');
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
  assert.deepEqual(result.plugins, []);
});

test('detectPluginDrift returns no drift when plugins object is absent', (t) => {
  const home = makeHome(t);
  writeRegistry(home, { something: 'else' });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
  assert.deepEqual(result.plugins, []);
});

test('detectPluginDrift skips entries with missing version field', (t) => {
  const home = makeHome(t);
  writeRegistry(home, {
    plugins: {
      'rad-orchestration@store': [{ scope: 'user', installedAt: 'x' }],
    },
  });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
});

test('detectPluginDrift only matches the rad-orchestration name part exactly', (t) => {
  const home = makeHome(t);
  writeRegistry(home, {
    plugins: {
      // Hypothetical lookalike — should NOT match.
      'rad-orchestration-extras@store': [{ version: '0.1.0' }],
    },
  });
  const result = detectPluginDrift('1.0.0-alpha.9', { homeDir: home });
  assert.equal(result.drift, false);
});
