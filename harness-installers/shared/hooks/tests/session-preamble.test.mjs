import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { buildHookOutput, resolveRadorch } from '../session-preamble.mjs';

test('wraps the preamble in additionalContext on ok envelope', () => {
  const run = () => ({ status: 0, stdout: JSON.stringify({ ok: true, data: { preamble: 'Rad Orc Initialized!\n/rad-repo' } }) });
  const out = buildHookOutput({ run });
  assert.match(out.additionalContext, /Rad Orc Initialized!/);
  assert.match(out.additionalContext, /\/rad-repo/);
});

test('surfaces a clear notice and never throws when the command returns ok:false', () => {
  const run = () => ({ status: 1, stdout: JSON.stringify({ ok: false, error: { type: 'system_error', message: 'malformed registry' } }) });
  const out = buildHookOutput({ run });
  assert.match(out.additionalContext, /ambient awareness/i);
  assert.match(out.additionalContext, /malformed registry/);
});

test('surfaces a notice when the command output is unparseable', () => {
  const run = () => ({ status: 0, stdout: 'not json' });
  const out = buildHookOutput({ run });
  assert.match(out.additionalContext, /ambient awareness/i);
});

test('resolveRadorch roots under COPILOT_PLUGIN_ROOT when CLAUDE_PLUGIN_ROOT is unset (FR-16)', () => {
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevCopilot = process.env.COPILOT_PLUGIN_ROOT;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    process.env.COPILOT_PLUGIN_ROOT = path.join('tmp', 'copilot-root');
    const resolved = resolveRadorch();
    const expected = path.join('tmp', 'copilot-root', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    assert.strictEqual(resolved, expected);
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevCopilot === undefined) delete process.env.COPILOT_PLUGIN_ROOT;
    else process.env.COPILOT_PLUGIN_ROOT = prevCopilot;
  }
});

test('resolveRadorch still roots under CLAUDE_PLUGIN_ROOT when it is set (no regression)', () => {
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevCopilot = process.env.COPILOT_PLUGIN_ROOT;
  try {
    process.env.CLAUDE_PLUGIN_ROOT = path.join('tmp', 'claude-root');
    process.env.COPILOT_PLUGIN_ROOT = path.join('tmp', 'copilot-root');
    const resolved = resolveRadorch();
    const expected = path.join('tmp', 'claude-root', 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs');
    assert.strictEqual(resolved, expected);
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevCopilot === undefined) delete process.env.COPILOT_PLUGIN_ROOT;
    else process.env.COPILOT_PLUGIN_ROOT = prevCopilot;
  }
});
