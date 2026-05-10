import test from 'node:test';
import assert from 'node:assert/strict';
import { adapter as claude } from './claude/adapter.js';
import { adapter as copilotCli } from './copilot-cli/adapter.js';
import { adapter as copilotVscode } from './copilot-vscode/adapter.js';

test('every adapter declares pluginRootSubstitution', () => {
  for (const a of [claude, copilotCli, copilotVscode]) {
    assert.equal(typeof a.pluginRootSubstitution, 'string', `${a.name} missing pluginRootSubstitution`);
    assert.ok(a.pluginRootSubstitution.length > 0, `${a.name} pluginRootSubstitution empty`);
  }
});
test('Claude declares ${CLAUDE_PLUGIN_ROOT}', () => {
  assert.equal(claude.pluginRootSubstitution, '${CLAUDE_PLUGIN_ROOT}');
});
test('Copilot adapters render PLUGIN_ROOT to today\'s literal (no plugin token leak)', () => {
  assert.doesNotMatch(copilotCli.pluginRootSubstitution, /CLAUDE_PLUGIN_ROOT/);
  assert.doesNotMatch(copilotVscode.pluginRootSubstitution, /CLAUDE_PLUGIN_ROOT/);
});
