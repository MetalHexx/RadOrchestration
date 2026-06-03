import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { isDirty } from './use-dirty-batch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bar = readFileSync(join(__dirname, 'save-bar.tsx'), 'utf-8');

test('isDirty is false when draft deep-equals baseline, true otherwise (FR-14)', () => {
  const base = { remote: 'r', groups: ['a', 'b'] };
  assert.strictEqual(isDirty(base, { remote: 'r', groups: ['a', 'b'] }), false);
  assert.strictEqual(isDirty(base, { remote: 'r2', groups: ['a', 'b'] }), true);
  assert.strictEqual(isDirty(base, { remote: 'r', groups: ['a'] }), true);
});

test('member order does not falsely dirty (FR-14)', () => {
  assert.strictEqual(isDirty({ groups: ['a', 'b'] }, { groups: ['b', 'a'] }), false);
});

test('save bar is the only dirty signal: Discard all + Save all, disabled when clean (DD-5)', () => {
  assert.match(bar, /Discard all/);
  assert.match(bar, /Save all/);
  assert.match(bar, /disabled/);
  assert.doesNotMatch(bar, /pending|Pending/);
});
