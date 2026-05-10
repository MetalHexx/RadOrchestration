import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapterPlugin } from './run-plugin.js';
import { adapter } from './claude/adapter.js';

test('plugin orchestration.yml defaults base_path to ~/.radorch/projects/', async () => {
  const repoRoot = path.resolve('.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-yml-'));
  await runAdapterPlugin(adapter, { canonicalRoot: repoRoot, outputRoot: tmp, version: '0.0.0' });
  const claudeDist = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  const yml = fs.readFileSync(path.join(claudeDist, 'skills', 'rad-orchestration', 'config', 'orchestration.yml'), 'utf8');
  assert.match(yml, /^\s*base_path:\s*~\/\.radorch\/projects\/?\s*$/m);
});
