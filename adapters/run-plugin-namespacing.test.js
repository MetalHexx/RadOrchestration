import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapter } from './run.js';
import { runAdapterPlugin } from './run-plugin.js';
import { adapter } from './claude/adapter.js';

const CANON_AGENTS = ['brainstormer', 'coder', 'coder-junior', 'coder-senior',
                      'planner', 'reviewer', 'source-control'];

test('Claude plugin emit namespaces every agent dispatch token', async () => {
  const repoRoot = path.resolve('.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-ns-'));
  await runAdapterPlugin(adapter, { canonicalRoot: repoRoot, outputRoot: tmp, version: '0.0.0' });
  const claudeDist = path.join(tmp, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  const orchestratorBody = fs.readFileSync(path.join(claudeDist, 'agents', 'orchestrator.md'), 'utf8');
  const canonicalOrchestrator = fs.readFileSync(path.join(repoRoot, 'agents', 'orchestrator.md'), 'utf8');
  // Every canonical agent name that appears as a dispatch reference in the
  // canonical orchestrator body MUST appear in its namespaced form in the
  // emitted plugin orchestrator body. Agents that don't appear at all in the
  // canonical body are trivially satisfied (no dispatch token to rewrite).
  for (const a of CANON_AGENTS) {
    const bareInCanonical = new RegExp(`(?<![\\w:-])${a.replace(/[-]/g, '\\-')}\\b`);
    if (!bareInCanonical.test(canonicalOrchestrator)) continue;
    // require namespaced form to be present
    assert.match(orchestratorBody, new RegExp(`rad-orchestration:${a}\\b`), `expected namespaced ${a} in orchestrator body`);
  }
});

test('dogfood emit (runAdapter) preserves bare names', async () => {
  // Drive the Claude adapter through the legacy/dogfood emit path (runAdapter,
  // not runAdapterPlugin) into a tmp dir and confirm bare-name dispatch
  // tokens (`coder`, `reviewer`) are NOT rewritten to the namespaced form.
  // Reading from a tmp emit avoids depending on .claude/ being built — that
  // tree is gitignored and absent on clean CI.
  const repoRoot = path.resolve('.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rap-dogfood-'));
  await runAdapter(adapter, { canonicalRoot: repoRoot, outputRoot: tmp, version: '0.0.0' });
  const dogfoodBody = fs.readFileSync(path.join(tmp, adapter.targetDir, 'agents', 'orchestrator.md'), 'utf8');
  assert.doesNotMatch(dogfoodBody, /rad-orchestration:coder\b/);
  assert.doesNotMatch(dogfoodBody, /rad-orchestration:reviewer\b/);
});
