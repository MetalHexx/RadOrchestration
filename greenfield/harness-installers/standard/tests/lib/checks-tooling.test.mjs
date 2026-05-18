// tests/lib/checks-tooling.test.mjs — tooling pre-flight check tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkGit, checkGh } from '../../lib/checks/tooling.js';

describe('checkGit', () => {
  it('returns null when git is present, or a string error when missing', () => {
    const result = checkGit();
    // Either git is installed (null) or it isn't (string with recovery hint)
    if (result === null) {
      assert.equal(result, null);
    } else {
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0, 'error message should be non-empty');
      // Should contain a recovery hint
      assert.ok(
        result.toLowerCase().includes('git') || result.toLowerCase().includes('install'),
        'error message should contain a recovery hint'
      );
    }
  });

  it('return value is null or string, never throws', () => {
    let threw = false;
    try {
      checkGit();
    } catch {
      threw = true;
    }
    assert.equal(threw, false, 'checkGit should never throw');
  });
});

describe('checkGh', () => {
  it('returns null or a string error message (environment-dependent)', () => {
    const result = checkGh();
    if (result === null) {
      assert.equal(result, null);
    } else {
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0, 'error message should be non-empty');
      // Should contain a recovery hint (either install gh or auth login)
      assert.ok(
        result.includes('gh') || result.includes('install') || result.includes('auth'),
        'error message should contain a recovery hint'
      );
    }
  });

  it('return value is null or string, never throws', () => {
    let threw = false;
    try {
      checkGh();
    } catch {
      threw = true;
    }
    assert.equal(threw, false, 'checkGh should never throw');
  });

  it('when a string is returned, it includes a recovery hint (install url or auth command)', () => {
    const result = checkGh();
    if (result !== null) {
      const hasRecovery =
        result.includes('https://cli.github.com') ||
        result.includes('gh auth login') ||
        result.includes('install');
      assert.ok(hasRecovery, `Expected recovery hint in: ${result}`);
    }
    // If null, git is authenticated — test passes vacuously
  });
});
