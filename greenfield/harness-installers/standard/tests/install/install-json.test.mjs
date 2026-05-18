import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readInstallJson, writeInstallJson, resolveFolderConflict,
  detectChannelOverlap, cmpSemver, isCurrentShape,
} from '../../lib/install/install-json.js';

test('writeInstallJson is atomic (tmp + rename) and strips state_schema_version', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'std-ij-'));
  try {
    const file = path.join(tmpDir, 'install.json');
    writeInstallJson(file, { state_schema_version: 'v6', harnesses: { claude: { version: '1.0.0', channel: 'legacy-installer', installed_at: 't', last_writer_version: '1.0.0' } } });
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(onDisk.state_schema_version, undefined, 'state_schema_version stripped (AD-1)');
    assert.strictEqual(onDisk.harnesses.claude.version, '1.0.0');
    // No leftover .tmp files (NFR-3).
    const leftovers = fs.readdirSync(tmpDir).filter((f) => f.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, []);
  } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
});

test('resolveFolderConflict removes every cross-UI partner currently registered', () => {
  const harnesses = {
    'copilot-cli':        { version: '1.0.0', channel: 'legacy-installer', installed_at: 't', last_writer_version: '1.0.0' },
    'copilot-cli-plugin': { version: '1.0.0', channel: 'plugin',           installed_at: 't', last_writer_version: '1.0.0' },
  };
  const r = resolveFolderConflict(harnesses, 'copilot-vscode');
  assert.ok(Array.isArray(r.removed), 'removed is an array');
  assert.strictEqual(r.removed.length, 2, 'both cross-UI partners evicted');
  const keys = r.removed.map((p) => p.key).sort();
  assert.deepStrictEqual(keys, ['copilot-cli', 'copilot-cli-plugin']);
  assert.strictEqual(harnesses['copilot-cli'], undefined);
  assert.strictEqual(harnesses['copilot-cli-plugin'], undefined);
});

test('detectChannelOverlap returns claude-plugin when installing claude alongside claude-plugin (AD-15)', () => {
  const harnesses = { 'claude-plugin': { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' } };
  assert.strictEqual(detectChannelOverlap(harnesses, 'claude'), 'claude-plugin');
});

test('cmpSemver: 1.0.0 > 1.0.0-alpha.8 (release > pre-release)', () => {
  assert.strictEqual(cmpSemver('1.0.0', '1.0.0-alpha.8'), 1);
});

test('isCurrentShape: structural lift identifies harnesses-object shape', () => {
  assert.strictEqual(isCurrentShape({ harnesses: {} }), true);
  assert.strictEqual(isCurrentShape({ package_version: '1.0.0' }), false);
  assert.strictEqual(isCurrentShape(null), false);
});
