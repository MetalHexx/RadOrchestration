// adapters/copilot-cli/adapter.test.js — Filename rule + dictionaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from './adapter.js';

test('CLI adapter exposes name + targetDir', () => {
  assert.strictEqual(adapter.name, 'copilot-cli');
  assert.strictEqual(adapter.targetDir, '.github');
});

test('filenameRule emits <name>.agent.md for agents', () => {
  assert.strictEqual(
    adapter.filenameRule({ kind: 'agent', canonicalName: 'planner' }),
    'planner.agent.md',
  );
});

test('filenameRule emits SKILL.md for skills', () => {
  assert.strictEqual(
    adapter.filenameRule({ kind: 'skill', canonicalName: 'rad-execute' }),
    'SKILL.md',
  );
});

test('toolDictionary uses lowercase CLI aliases per research §3.A and §5.5', () => {
  assert.strictEqual(adapter.toolDictionary.Read, 'read');
  assert.strictEqual(adapter.toolDictionary.Write, 'edit');
  assert.strictEqual(adapter.toolDictionary.Edit, 'edit');
  assert.strictEqual(adapter.toolDictionary.Bash, 'execute');
  assert.strictEqual(adapter.toolDictionary.Grep, 'search');
  assert.strictEqual(adapter.toolDictionary.Glob, 'search');
  assert.strictEqual(adapter.toolDictionary.TodoWrite, 'todo');
  assert.strictEqual(adapter.toolDictionary.WebFetch, 'web');
  assert.strictEqual(adapter.toolDictionary.WebSearch, 'web');
  assert.strictEqual(adapter.toolDictionary.Task, 'agent');
  assert.strictEqual(adapter.toolDictionary.Agent, 'agent');
});

test('modelAliases use dot-versioned hyphenated ids per research §6.6', () => {
  assert.deepStrictEqual(adapter.modelAliases, {
    haiku: 'claude-haiku-4.5',
    sonnet: 'claude-sonnet-4.6',
    opus: 'claude-opus-4.7',
  });
});

test('agentFrontmatter maps tools PascalCase → lowercase aliases', () => {
  const out = adapter.agentFrontmatter(
    { name: 'coder', description: 'Coder', model: 'sonnet', tools: 'Read, Bash, Edit' },
    { adapter },
  );
  assert.deepStrictEqual(out.tools, ['read', 'execute', 'edit']);
});

test('agentFrontmatter remaps tier alias model → dot-versioned id', () => {
  const out = adapter.agentFrontmatter(
    { name: 'p', description: 'P', model: 'opus' },
    { adapter },
  );
  assert.strictEqual(out.model, 'claude-opus-4.7');
});

test('agentFrontmatter coerces array model → first element (CLI rejects arrays per #2133)', () => {
  const out = adapter.agentFrontmatter(
    { name: 'p', description: 'P', model: ['opus', 'sonnet'] },
    { adapter },
  );
  assert.strictEqual(typeof out.model, 'string');
  assert.strictEqual(out.model, 'claude-opus-4.7');
});

test('agentFrontmatter does not inject target: (not understood by Copilot CLI)', () => {
  const out = adapter.agentFrontmatter({ name: 'a', description: 'd' }, { adapter });
  assert.ok(!('target' in out));
});

test('agentFrontmatter drops Claude-only allowedTools duplicate field', () => {
  const out = adapter.agentFrontmatter(
    { name: 'c', description: 'd', allowedTools: ['Read', 'Bash'] },
    { adapter },
  );
  assert.ok(!('allowedTools' in out));
});

test('skillFrontmatter passes allowed-tools through (CLI honors it per §3.B)', () => {
  const out = adapter.skillFrontmatter(
    { name: 'rad-demo', description: 'd', 'allowed-tools': 'shell' },
    { adapter },
  );
  assert.strictEqual(out['allowed-tools'], 'shell');
});

test('skillFrontmatter preserves rad-* prefix unchanged', () => {
  const out = adapter.skillFrontmatter({ name: 'rad-orchestration', description: 'd' }, { adapter });
  assert.strictEqual(out.name, 'rad-orchestration');
});
