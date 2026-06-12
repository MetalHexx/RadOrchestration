import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../action-events');
const body = fs.readFileSync(
  path.join(AE, 'event.final_approved.md'), 'utf8');

test('cleanup offer fires post-approval via askUserQuestion (FR-15, DD-3)', () => {
  assert.match(body, /askUserQuestion/);
  assert.match(body, /worktree/i);
  assert.match(body, /remove|clean ?up|delete/i);
});

test('offer reminds the operator to merge first (FR-15, DD-3)', () => {
  assert.match(body, /merge/i);
});

test('removal routes outside the worktree being removed (FR-16)', () => {
  assert.match(body, /main session|not.*inside|outside the worktree/i);
  assert.match(body, /worktree remove/);
});
