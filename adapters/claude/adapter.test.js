// adapters/claude/adapter.test.js — Identity-transform contract for the Claude adapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from './adapter.js';

test('Claude adapter exposes name + targetDir', () => {
  assert.strictEqual(adapter.name, 'claude');
  assert.strictEqual(adapter.targetDir, '.claude');
});

test('filenameRule emits <name>.md for agents', () => {
  assert.strictEqual(adapter.filenameRule({ kind: 'agent', canonicalName: 'orchestrator' }), 'orchestrator.md');
});

test('filenameRule emits SKILL.md for skills (literal)', () => {
  assert.strictEqual(adapter.filenameRule({ kind: 'skill', canonicalName: 'rad-orchestration' }), 'SKILL.md');
});

test('agentFrontmatter is identity for canonical Claude shape', () => {
  const canonical = { name: 'coder', description: 'Coder', model: 'sonnet', tools: 'Read, Bash' };
  assert.deepStrictEqual(adapter.agentFrontmatter(canonical, { adapter }), canonical);
});

test('skillFrontmatter preserves rad-* prefix unchanged', () => {
  const canonical = { name: 'rad-orchestration', description: 'Orch' };
  const out = adapter.skillFrontmatter(canonical, { adapter });
  assert.strictEqual(out.name, 'rad-orchestration');
});

test('toolDictionary maps Claude tools to themselves', () => {
  for (const t of ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'TodoWrite', 'WebFetch', 'WebSearch', 'Task']) {
    assert.strictEqual(adapter.toolDictionary[t], t, `${t} must round-trip`);
  }
});

test('modelAliases map to Claude tier aliases', () => {
  assert.deepStrictEqual(adapter.modelAliases, { haiku: 'haiku', sonnet: 'sonnet', opus: 'opus' });
});
