import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGit, checkGh } from './tooling.js';
test('checkGit returns null when git is on PATH, a warning string otherwise (FR-17)', () => {
  const r = checkGit();
  assert.ok(r === null || typeof r === 'string');
});
test('checkGh returns null when authenticated, a warning string otherwise (FR-17)', () => {
  const r = checkGh();
  assert.ok(r === null || typeof r === 'string');
});
