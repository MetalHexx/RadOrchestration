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
