import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validatePluginTree } from './build-plugin.js';

test('validatePluginTree fails when an agent file is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vpt-'));
  // Write only a partial tree
  fs.mkdirSync(path.join(tmp, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'), '{}');
  const r = validatePluginTree(tmp);
  assert.equal(r.ok, false);
  assert.ok(r.missing.some(m => m.startsWith('agents/')), 'expected missing agents/* in failure list');
});
