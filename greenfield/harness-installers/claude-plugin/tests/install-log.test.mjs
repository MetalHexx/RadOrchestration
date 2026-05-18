import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { appendInstallLog, INSTALL_LOG_ACTIONS } from '../lib/install/install-log.js';

test('INSTALL_LOG_ACTIONS is exactly the six-action vocabulary', () => {
  assert.deepStrictEqual([...INSTALL_LOG_ACTIONS].sort(), [
    'cancelled-modified-files', 'downgrade-noop', 'error',
    'fresh-install', 'noop', 'upgrade-complete',
  ]);
});

test('appendInstallLog writes a single JSON object per line with the five canonical fields', async () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'log-'));
  try {
    const f = join(dir, 'install.log');
    appendInstallLog(f, { action: 'fresh-install', deliveringVersion: '1.0.0', installedVersionBefore: null });
    const line = fs.readFileSync(f, 'utf8').trim();
    const obj = JSON.parse(line);
    assert.deepStrictEqual(Object.keys(obj).sort(), ['action', 'at', 'channel', 'delivering_version', 'installed_version_before']);
    assert.strictEqual(obj.channel, 'claude-plugin');
    assert.strictEqual(obj.action, 'fresh-install');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('appendInstallLog is best-effort — write to an unwritable path resolves without throwing', async () => {
  // EBADF / EACCES is the realistic class; here we drive the same code path
  // by passing a path under a non-existent ancestor and refusing mkdir.
  await assert.doesNotReject(async () => {
    appendInstallLog('/no/such/ancestor/install.log',
      { action: 'noop', deliveringVersion: '1.0.0', installedVersionBefore: '1.0.0' },
      { mkdirAncestors: false });
  });
});
