import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapterPlugin } from './run-plugin.js';
import { adapter } from './claude/adapter.js';

test('runAdapterPlugin copies canonical hooks/ into the plugin hooks/', async () => {
  const repoRoot = path.resolve('.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-hooks-'));
  await runAdapterPlugin(adapter, { canonicalRoot: repoRoot, outputRoot: tmp, version: '0.0.0-test' });
  const claudeDist = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  for (const f of ['hooks.json']) {
    const abs = path.join(claudeDist, 'hooks', f);
    assert.ok(fs.existsSync(abs), `plugin emit missing hooks/${f}`);
  }
});
