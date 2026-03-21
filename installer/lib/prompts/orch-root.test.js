// installer/lib/prompts/orch-root.test.js

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create mock functions before registering module mocks
const selectMock = mock.fn(async () => '.github');
const inputMock = mock.fn(async () => 'my-custom-folder');
const isValidFolderNameMock = mock.fn(() => true);

// Register module mocks BEFORE dynamic import of the module under test
mock.module('@inquirer/prompts', {
  namedExports: { select: selectMock, input: inputMock },
});

mock.module('../path-utils.js', {
  namedExports: { isValidFolderName: isValidFolderNameMock },
});

// Dynamic import after mock registration so the module uses the mocked dependencies
const { promptOrchRoot } = await import('./orch-root.js');

describe('promptOrchRoot — preset value selected', () => {
  let result;
  let selectArgs;

  before(async () => {
    selectMock.mock.resetCalls();
    inputMock.mock.resetCalls();
    selectMock.mock.mockImplementation(async () => '.github');

    result = await promptOrchRoot();
    selectArgs = selectMock.mock.calls[0].arguments[0];
  });

  it('calls select() with message "Orchestration root folder"', () => {
    assert.equal(selectArgs.message, 'Orchestration root folder');
  });

  it('calls select() with exactly 3 choices', () => {
    assert.equal(selectArgs.choices.length, 3);
  });

  it('choices are .agent, .github, Custom…', () => {
    const values = selectArgs.choices.map((c) => c.value);
    assert.deepEqual(values, ['.agent', '.github', 'custom']);
  });

  it('".github" is the default', () => {
    assert.equal(selectArgs.default, '.github');
  });

  it('returns { orchRoot: ".github" }', () => {
    assert.deepEqual(result, { orchRoot: '.github' });
  });

  it('does NOT call input() when a preset value is selected', () => {
    assert.equal(inputMock.mock.calls.length, 0);
  });
});

describe('promptOrchRoot — "custom" selected', () => {
  let result;
  let inputArgs;

  before(async () => {
    selectMock.mock.resetCalls();
    inputMock.mock.resetCalls();
    isValidFolderNameMock.mock.resetCalls();
    selectMock.mock.mockImplementation(async () => 'custom');
    inputMock.mock.mockImplementation(async () => 'my-custom-folder');
    isValidFolderNameMock.mock.mockImplementation(() => true);

    result = await promptOrchRoot();
    inputArgs = inputMock.mock.calls[0].arguments[0];
  });

  it('calls input() when "Custom…" is selected', () => {
    assert.equal(inputMock.mock.calls.length, 1);
  });

  it('input() message is "Enter custom folder name"', () => {
    assert.equal(inputArgs.message, 'Enter custom folder name');
  });

  it('returns { orchRoot: "<custom-value>" }', () => {
    assert.deepEqual(result, { orchRoot: 'my-custom-folder' });
  });

  describe('P-3a validate function', () => {
    let validate;

    before(() => {
      validate = inputArgs.validate;
    });

    it('returns true when isValidFolderName returns true', () => {
      isValidFolderNameMock.mock.mockImplementation(() => true);
      assert.equal(validate('valid-folder'), true);
    });

    it('returns an error string when isValidFolderName returns an error string', () => {
      isValidFolderNameMock.mock.mockImplementation(
        () => 'Folder name contains illegal filesystem characters.'
      );
      const errResult = validate('bad<name>');
      assert.equal(typeof errResult, 'string');
      assert.ok(errResult.length > 0, 'error string should not be empty');
    });
  });
});

describe('promptOrchRoot — absolute path as custom value', () => {
  let result;

  before(async () => {
    selectMock.mock.resetCalls();
    inputMock.mock.resetCalls();
    isValidFolderNameMock.mock.resetCalls();
    selectMock.mock.mockImplementation(async () => 'custom');
    inputMock.mock.mockImplementation(async () => '/opt/orch');
    isValidFolderNameMock.mock.mockImplementation(() => true);

    result = await promptOrchRoot();
  });

  it('returns absolute path as orchRoot', () => {
    assert.deepEqual(result, { orchRoot: '/opt/orch' });
  });
});
