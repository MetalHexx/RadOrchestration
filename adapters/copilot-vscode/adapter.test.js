// adapters/copilot-vscode/adapter.test.js — Filename rule + dictionaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from './adapter.js';

test('VS Code adapter exposes name and targetDir', () => {
  assert.strictEqual(adapter.name, 'copilot-vscode');
  assert.strictEqual(adapter.targetDir, '.github');
});

test('filenameRule emits <name>.agent.md for agents', () => {
  assert.strictEqual(
    adapter.filenameRule({ kind: 'agent', canonicalName: 'orchestrator' }),
    'orchestrator.agent.md',
  );
});

test('filenameRule emits literal SKILL.md for skills', () => {
  assert.strictEqual(
    adapter.filenameRule({ kind: 'skill', canonicalName: 'rad-orchestration' }),
    'SKILL.md',
  );
});

test('toolDictionary uses lowercase Copilot aliases per research §2.A and §5.5', () => {
  assert.strictEqual(adapter.toolDictionary.Read, 'read');
  assert.strictEqual(adapter.toolDictionary.Write, 'edit');
  assert.strictEqual(adapter.toolDictionary.Edit, 'edit');
  assert.strictEqual(adapter.toolDictionary.Bash, 'execute');
  assert.strictEqual(adapter.toolDictionary.Grep, 'search');
  assert.strictEqual(adapter.toolDictionary.Glob, 'search');
  assert.strictEqual(adapter.toolDictionary.TodoWrite, 'todo');
  assert.strictEqual(adapter.toolDictionary.WebFetch, 'web/fetch');
  assert.strictEqual(adapter.toolDictionary.WebSearch, 'web');
  assert.strictEqual(adapter.toolDictionary.Task, 'agent');
  assert.strictEqual(adapter.toolDictionary.Agent, 'agent');
});

test('modelAliases use (copilot)-suffixed display names per research §6.6', () => {
  assert.deepStrictEqual(adapter.modelAliases, {
    haiku: 'Claude Haiku 4.5 (copilot)',
    sonnet: 'Claude Sonnet 4.6 (copilot)',
    opus: 'Claude Opus 4.7 (copilot)',
  });
});

test('agentFrontmatter maps tools PascalCase → lowercase aliases', () => {
  const out = adapter.agentFrontmatter(
    { name: 'coder', description: 'Coder', model: 'sonnet', tools: 'Read, Bash, Edit' },
    { adapter },
  );
  assert.deepStrictEqual(out.tools, ['read', 'execute', 'edit']);
});

test('agentFrontmatter remaps tier alias model → (copilot)-suffixed display name', () => {
  const out = adapter.agentFrontmatter(
    { name: 'planner', description: 'P', model: 'opus' },
    { adapter },
  );
  assert.strictEqual(out.model, 'Claude Opus 4.7 (copilot)');
});

test('agentFrontmatter passes through full Claude id model strings unchanged', () => {
  const out = adapter.agentFrontmatter(
    { name: 'planner', description: 'P', model: 'claude-opus-4-7[1m]' },
    { adapter },
  );
  assert.strictEqual(out.model, 'claude-opus-4-7[1m]');
});

test('agentFrontmatter adds target: vscode', () => {
  const out = adapter.agentFrontmatter({ name: 'a', description: 'd' }, { adapter });
  assert.strictEqual(out.target, 'vscode');
});

test('agentFrontmatter drops Claude-only allowedTools duplicate field', () => {
  const out = adapter.agentFrontmatter(
    { name: 'c', description: 'd', allowedTools: ['Read', 'Bash'] },
    { adapter },
  );
  assert.ok(!('allowedTools' in out));
});

test('skillFrontmatter passes allowed-tools through (silently ignored by VS Code per §6.2)', () => {
  const out = adapter.skillFrontmatter(
    { name: 'rad-demo', description: 'demo', 'allowed-tools': 'Bash(git *)' },
    { adapter },
  );
  assert.strictEqual(out['allowed-tools'], 'Bash(git *)');
});

test('skillFrontmatter preserves rad-* prefix unchanged (FR-22)', () => {
  const out = adapter.skillFrontmatter({ name: 'rad-orchestration', description: 'd' }, { adapter });
  assert.strictEqual(out.name, 'rad-orchestration');
});
