import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHookOutput } from '../session-preamble.mjs';

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
