import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { appendInstallLog, INSTALL_LOG_ACTIONS } from '../lib/install/install-log.js';

test('INSTALL_LOG_ACTIONS is exactly the six-action vocabulary', () => {
  assert.deepStrictEqual([...INSTALL_LOG_ACTIONS].sort(),
    ['cancelled-modified-files', 'downgrade-noop', 'error', 'fresh-install', 'noop', 'upgrade-complete']);
});

test('appendInstallLog writes JSONL with the five canonical fields and channel copilot-vscode-plugin', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'log-vsc-'));
  try {
    const f = join(dir, 'install.log');
    appendInstallLog(f, { action: 'fresh-install', deliveringVersion: '1.0.0', installedVersionBefore: null });
    const line = fs.readFileSync(f, 'utf8').trim();
    const obj = JSON.parse(line);
    assert.deepStrictEqual(Object.keys(obj).sort(),
      ['action', 'at', 'channel', 'delivering_version', 'installed_version_before']);
    assert.strictEqual(obj.channel, 'copilot-vscode-plugin');
    assert.strictEqual(obj.action, 'fresh-install');
    assert.strictEqual(obj.installed_version_before, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('appendInstallLog is best-effort — write to an unreachable path resolves without throwing', () => {
  assert.doesNotThrow(() => {
    appendInstallLog('/no/such/ancestor/install.log',
      { action: 'noop', deliveringVersion: '1.0.0', installedVersionBefore: '1.0.0' },
      { mkdirAncestors: false });
  });
});
