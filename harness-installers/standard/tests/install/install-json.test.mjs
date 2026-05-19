import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readInstallJson, writeInstallJson, resolveFolderConflict,
  detectPluginCoexistence, cmpSemver, isCurrentShape,
} from '../../lib/install/install-json.js';

test('writeInstallJson is atomic (tmp + rename) and strips state_schema_version', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'std-ij-'));
  try {
    const file = path.join(tmpDir, 'install.json');
    writeInstallJson(file, { state_schema_version: 'v6', harnesses: { claude: { version: '1.0.0', channel: 'standard', installed_at: 't', last_writer_version: '1.0.0' } } });
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(onDisk.state_schema_version, undefined, 'state_schema_version stripped (AD-1)');
    assert.strictEqual(onDisk.harnesses.claude.version, '1.0.0');
    // No leftover .tmp files (NFR-3).
    const leftovers = fs.readdirSync(tmpDir).filter((f) => f.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, []);
  } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
});

test('resolveFolderConflict evicts the legacy cross-UI partner only', () => {
  const harnesses = {
    'copilot-cli': { version: '1.0.0', channel: 'standard', installed_at: 't', last_writer_version: '1.0.0' },
  };
  const r = resolveFolderConflict(harnesses, 'copilot-vscode');
  assert.ok(Array.isArray(r.removed), 'removed is an array');
  assert.strictEqual(r.removed.length, 1);
  assert.strictEqual(r.removed[0].key, 'copilot-cli');
  assert.strictEqual(harnesses['copilot-cli'], undefined);
});

test('resolveFolderConflict preserves plugin entries (regression: plugin entries must never be evicted by the standard installer)', () => {
  const harnesses = {
    'copilot-cli':           { version: '1.0.0', channel: 'standard', installed_at: 't', last_writer_version: '1.0.0' },
    'copilot-cli-plugin':    { version: '1.0.0', channel: 'plugin',           installed_at: 't', last_writer_version: '1.0.0' },
    'copilot-vscode-plugin': { version: '1.0.0', channel: 'plugin',           installed_at: 't', last_writer_version: '1.0.0' },
  };
  const r = resolveFolderConflict(harnesses, 'copilot-vscode');
  // Only the legacy partner is evicted; both plugin entries survive.
  const removedKeys = (r.removed ?? []).map((p) => p.key).sort();
  assert.deepStrictEqual(removedKeys, ['copilot-cli']);
  assert.strictEqual(harnesses['copilot-cli'], undefined);
  assert.ok(harnesses['copilot-cli-plugin'], 'copilot-cli-plugin entry preserved');
  assert.ok(harnesses['copilot-vscode-plugin'], 'copilot-vscode-plugin entry preserved');
});

test('resolveFolderConflict: installing a plugin key is a no-op (plugin installs are owned by the plugin)', () => {
  const harnesses = {
    'copilot-cli': { version: '1.0.0', channel: 'standard', installed_at: 't', last_writer_version: '1.0.0' },
  };
  const r = resolveFolderConflict(harnesses, 'copilot-cli-plugin');
  assert.deepStrictEqual(r, {}, 'plugin installKey not in mutex map → no eviction');
  assert.ok(harnesses['copilot-cli'], 'legacy entry preserved');
});

test('detectPluginCoexistence: empty registry + empty home → []', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-empty-'));
  try {
    assert.deepStrictEqual(detectPluginCoexistence({}, 'claude', { home: tmpHome }), []);
    assert.deepStrictEqual(detectPluginCoexistence({}, 'copilot-cli', { home: tmpHome }), []);
    assert.deepStrictEqual(detectPluginCoexistence({}, 'copilot-vscode', { home: tmpHome }), []);
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: claude with claude-plugin in registry → registry hit', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-claude-'));
  try {
    const harnesses = { 'claude-plugin': { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' } };
    const r = detectPluginCoexistence(harnesses, 'claude', { home: tmpHome });
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].partner, 'claude-plugin');
    assert.strictEqual(r[0].source, 'registry');
    assert.strictEqual(r[0].entry.version, '1.0.0');
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: copilot-cli reports cross-UI partner (copilot-vscode-plugin) when same-UI absent', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-cli-cross-'));
  try {
    const harnesses = { 'copilot-vscode-plugin': { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' } };
    const r = detectPluginCoexistence(harnesses, 'copilot-cli', { home: tmpHome });
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].partner, 'copilot-vscode-plugin');
    assert.strictEqual(r[0].source, 'registry');
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: copilot-cli reports both partners when both registered', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-cli-both-'));
  try {
    const harnesses = {
      'copilot-cli-plugin':    { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' },
      'copilot-vscode-plugin': { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' },
    };
    const r = detectPluginCoexistence(harnesses, 'copilot-cli', { home: tmpHome });
    const partners = r.map((x) => x.partner).sort();
    assert.deepStrictEqual(partners, ['copilot-cli-plugin', 'copilot-vscode-plugin']);
    assert.ok(r.every((x) => x.source === 'registry'));
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: disk-fallback detects rad-orc plugin under ~/.claude/plugins/', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-disk-claude-'));
  try {
    fs.mkdirSync(path.join(tmpHome, '.claude', 'plugins', 'rad-orc'), { recursive: true });
    const r = detectPluginCoexistence({}, 'claude', { home: tmpHome });
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].partner, 'claude-plugin');
    assert.strictEqual(r[0].source, 'disk');
    assert.strictEqual(r[0].entry, undefined);
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: disk-fallback accepts legacy rad-orchestration leaf name', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-disk-legacy-'));
  try {
    fs.mkdirSync(path.join(tmpHome, '.claude', 'plugins', 'rad-orchestration'), { recursive: true });
    const r = detectPluginCoexistence({}, 'claude', { home: tmpHome });
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].source, 'disk');
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: disk-fallback detects rad-orc plugin under ~/.copilot/installed-plugins/<mp>/', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-disk-copilot-'));
  try {
    fs.mkdirSync(path.join(tmpHome, '.copilot', 'installed-plugins', 'whatever-mp', 'rad-orc'), { recursive: true });
    const rCli = detectPluginCoexistence({}, 'copilot-cli', { home: tmpHome });
    assert.strictEqual(rCli.length, 1);
    assert.strictEqual(rCli[0].partner, 'copilot-cli-plugin', 'same-UI canonical partner reported on disk hit');
    assert.strictEqual(rCli[0].source, 'disk');

    const rVscode = detectPluginCoexistence({}, 'copilot-vscode', { home: tmpHome });
    assert.strictEqual(rVscode.length, 1);
    assert.strictEqual(rVscode[0].partner, 'copilot-vscode-plugin');
    assert.strictEqual(rVscode[0].source, 'disk');
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('detectPluginCoexistence: registry beats disk (no probe needed when registry signal is present)', () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'std-coex-registry-wins-'));
  try {
    // Disk has a plugin too, but registry hit reports first and source='registry'.
    fs.mkdirSync(path.join(tmpHome, '.claude', 'plugins', 'rad-orc'), { recursive: true });
    const harnesses = { 'claude-plugin': { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' } };
    const r = detectPluginCoexistence(harnesses, 'claude', { home: tmpHome });
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].source, 'registry');
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
});

test('cmpSemver: 1.0.0 > 1.0.0-alpha.8 (release > pre-release)', () => {
  assert.strictEqual(cmpSemver('1.0.0', '1.0.0-alpha.8'), 1);
});

test('isCurrentShape: structural lift identifies harnesses-object shape', () => {
  assert.strictEqual(isCurrentShape({ harnesses: {} }), true);
  assert.strictEqual(isCurrentShape({ package_version: '1.0.0' }), false);
  assert.strictEqual(isCurrentShape(null), false);
});
