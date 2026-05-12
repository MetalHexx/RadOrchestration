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
test('all legacy adapters render PLUGIN_ROOT to the canonical radorch install path', () => {
  // Legacy emit (run.js) substitutes ${PLUGIN_ROOT} with the standard radorch
  // install location. The plugin-specific ${CLAUDE_PLUGIN_ROOT} token is
  // hardcoded in adapters/run-plugin.js — not via the adapter's field.
  for (const a of [claude, copilotCli, copilotVscode]) {
    assert.equal(a.pluginRootSubstitution, '~/.radorch', `${a.name} pluginRootSubstitution must be ~/.radorch`);
    assert.doesNotMatch(a.pluginRootSubstitution, /CLAUDE_PLUGIN_ROOT/);
  }
});
