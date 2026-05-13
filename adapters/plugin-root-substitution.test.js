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

test('legacy adapters render PLUGIN_ROOT to the harness install root, not the data root', () => {
  // The CLI now ships inside the rad-orchestration skill (FR-XX), and
  // skills/* entries route through harnessRoot() — `~/.claude` for Claude,
  // `~/.copilot` for Copilot. The substitution must match so that skill
  // bodies like `${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs`
  // resolve correctly on disk. The legacy data root `~/.radorch` is no
  // longer where skills live.
  assert.equal(claude.pluginRootSubstitution, '~/.claude', 'claude must substitute to ~/.claude');
  assert.equal(copilotCli.pluginRootSubstitution, '~/.copilot', 'copilot-cli must substitute to ~/.copilot');
  assert.equal(copilotVscode.pluginRootSubstitution, '~/.copilot', 'copilot-vscode must substitute to ~/.copilot');
  for (const a of [claude, copilotCli, copilotVscode]) {
    // Defensive: the plugin-specific ${CLAUDE_PLUGIN_ROOT} token is injected
    // by adapters/run-plugin.js, not via this field.
    assert.doesNotMatch(a.pluginRootSubstitution, /CLAUDE_PLUGIN_ROOT/);
    // Guard against the retired ~/.radorch data-root value sneaking back in.
    assert.notEqual(a.pluginRootSubstitution, '~/.radorch', `${a.name} must not point at the retired data root`);
  }
});
