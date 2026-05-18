// tests/lib/checks-tooling.test.mjs — tooling pre-flight check contract tests
//
// Each check returns either null (tool present and ready) or a non-empty
// string (tool missing or unauthenticated). Behavior is environment-dependent;
// the contract being tested is "returns null|string, never throws."

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGit, checkGh } from '../../lib/checks/tooling.js';

test('checkGit returns null or a non-empty string and never throws', () => {
  const result = checkGit();
  if (result !== null) {
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  }
});

test('checkGh returns null or a non-empty string and never throws', () => {
  const result = checkGh();
  if (result !== null) {
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  }
});
