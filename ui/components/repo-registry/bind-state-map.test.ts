import { test } from 'node:test';
import assert from 'node:assert';
import { BIND_STATE_MAP } from './bind-state-map';

test('maps each bind state to a token cssVar + label (AD-6, DD-1)', () => {
  assert.strictEqual(BIND_STATE_MAP.bound.cssVar, '--status-complete');
  assert.strictEqual(BIND_STATE_MAP.unbound.cssVar, '--color-warning');
  assert.strictEqual(BIND_STATE_MAP.missing.cssVar, '--destructive');
  assert.strictEqual(BIND_STATE_MAP.bound.label, 'bound');
  assert.strictEqual(BIND_STATE_MAP.unbound.label, 'unbound');
  assert.strictEqual(BIND_STATE_MAP.missing.label, 'missing');
});

test('never embeds raw color literals (DD-10, NFR-2)', () => {
  const json = JSON.stringify(BIND_STATE_MAP);
  assert.doesNotMatch(json, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(json, /hsl\(|oklch\(|--bound|--unbound/);
});
