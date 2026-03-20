// installer/lib/prompts/getting-started.test.js

import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

// Create mock functions before registering the module mock
const selectMock = mock.fn(async () => 'copilot');
const inputMock = mock.fn(async () => process.cwd());

// Register module mock BEFORE dynamic import of the module under test
mock.module('@inquirer/prompts', {
  namedExports: { select: selectMock, input: inputMock },
});

// Dynamic import after mock registration so the module uses the mocked @inquirer/prompts
const { promptGettingStarted } = await import('./getting-started.js');

describe('promptGettingStarted', () => {
  let result;
  let selectArgs;
  let inputArgs;

  before(async () => {
    selectMock.mock.resetCalls();
    inputMock.mock.resetCalls();
    selectMock.mock.mockImplementation(async () => 'copilot');
    inputMock.mock.mockImplementation(async () => process.cwd());

    result = await promptGettingStarted();
    selectArgs = selectMock.mock.calls[0].arguments[0];
    inputArgs = inputMock.mock.calls[0].arguments[0];
  });

  it('calls select() with message "Select your AI coding tool"', () => {
    assert.equal(selectArgs.message, 'Select your AI coding tool');
  });

  it('calls select() with exactly 3 choices', () => {
    assert.equal(selectArgs.choices.length, 3);
  });

  it('first choice is GitHub Copilot (selectable, value: "copilot")', () => {
    assert.equal(selectArgs.choices[0].name, 'GitHub Copilot');
    assert.equal(selectArgs.choices[0].value, 'copilot');
    assert.ok(!selectArgs.choices[0].disabled, 'copilot choice should not be disabled');
  });

  it('second choice is Cursor (disabled)', () => {
    assert.equal(selectArgs.choices[1].value, 'cursor');
    assert.equal(selectArgs.choices[1].disabled, true);
  });

  it('third choice is Claude Code (disabled)', () => {
    assert.equal(selectArgs.choices[2].value, 'claude-code');
    assert.equal(selectArgs.choices[2].disabled, true);
  });

  it('calls input() with message "Target workspace directory"', () => {
    assert.equal(inputArgs.message, 'Target workspace directory');
  });

  it('calls input() with process.cwd() as the default', () => {
    assert.equal(inputArgs.default, process.cwd());
  });

  it('returns an object with tool and workspaceDir properties', () => {
    assert.ok(Object.hasOwn(result, 'tool'), 'result has tool property');
    assert.ok(Object.hasOwn(result, 'workspaceDir'), 'result has workspaceDir property');
  });

  it('returns tool: "copilot"', () => {
    assert.equal(result.tool, 'copilot');
  });

  it('workspaceDir is an absolute path', () => {
    assert.ok(path.isAbsolute(result.workspaceDir), 'workspaceDir should be absolute');
  });

  describe('P-2 validate function', () => {
    let validate;

    before(() => {
      validate = inputArgs.validate;
    });

    it('returns true for an existing directory', () => {
      // os.tmpdir() is guaranteed to exist
      assert.equal(validate(os.tmpdir()), true);
    });

    it('returns an error string for a non-existent path', () => {
      const errResult = validate('/this-path-definitely-does-not-exist-xyz-12345');
      assert.equal(typeof errResult, 'string');
      assert.ok(errResult.length > 0, 'error string should not be empty');
    });
  });
});
