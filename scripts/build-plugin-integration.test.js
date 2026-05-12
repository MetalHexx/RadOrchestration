// scripts/build-plugin-integration.test.js — End-to-end seam test between
// adapters/run-plugin.js (the namespacing-emit producer) and
// scripts/build-plugin.js's validatePluginTree (the namespaced-token
// consumer). Runs the real adapter emit against the canonical worktree —
// no fixture synthesis for the namespacing pass — so producer/consumer drift
// on the `rad-orchestration:<name>` token contract surfaces immediately.
//
// runAdapterPlugin emits skills/, agents/, hooks/, .claude-plugin/. The
// publish-time meta-script (scripts/build-plugin.js main) layers bin/ and
// ui/ bundle artifacts on top via separate steps before validatePluginTree
// runs. To isolate the namespacing producer-consumer seam under test here,
// stub-touch those static bundle artifacts after runAdapterPlugin so the
// validator's REQUIRED_ARTIFACTS list is satisfied and any remaining
// `r.missing` entries reflect only the namespacing seam.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAdapterPlugin } from '../adapters/run-plugin.js';
import { adapter } from '../adapters/claude/adapter.js';
import { validatePluginTree } from './build-plugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

test('validatePluginTree: real claude plugin emit passes end-to-end', async () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-int-'));
  await runAdapterPlugin(adapter, { canonicalRoot: repoRoot, outputRoot, version: '0.0.0' });
  const claudeDist = path.join(
    outputRoot,
    'cli',
    'dist',
    'marketplaces',
    'claude',
    'plugins',
    'rad-orchestration',
  );
  // Stub bundle artifacts (out of scope for runAdapterPlugin; produced by
  // the meta-script's cli-bundle / pipeline-bundle / ui-standalone steps).
  for (const rel of ['bin/radorch.mjs', 'ui/server.js']) {
    const f = path.join(claudeDist, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, '');
  }
  const r = validatePluginTree(claudeDist, repoRoot);
  assert.equal(
    r.ok,
    true,
    `validatePluginTree returned ok:false on real emit; missing: ${JSON.stringify(r.missing)}`,
  );
  assert.equal(
    r.missing.length,
    0,
    `expected zero missing entries; got: ${JSON.stringify(r.missing)}`,
  );
});
