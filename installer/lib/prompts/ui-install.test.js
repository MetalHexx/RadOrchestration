// installer/lib/prompts/ui-install.test.js

import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

// Create mock functions before registering the module mock
const confirmMock = mock.fn(async () => false);
const inputMock = mock.fn(async () => '/some/dir/ui');

// Register module mock BEFORE dynamic import of the module under test
mock.module('@inquirer/prompts', {
  namedExports: { confirm: confirmMock, input: inputMock },
});

// Dynamic import after mock registration so the module uses the mocked @inquirer/prompts
const { promptUiInstall } = await import('./ui-install.js');

const WORKSPACE_DIR = '/home/user/myproject';

describe('promptUiInstall', () => {
  beforeEach(() => {
    confirmMock.mock.resetCalls();
    inputMock.mock.resetCalls();
  });

  describe('P-11: confirm prompt', () => {
    before(async () => {
      confirmMock.mock.resetCalls();
      inputMock.mock.resetCalls();
      confirmMock.mock.mockImplementation(async () => false);
    });

    it('calls confirm() with message "Install the monitoring dashboard UI?"', async () => {
      await promptUiInstall(WORKSPACE_DIR);
      const args = confirmMock.mock.calls[0].arguments[0];
      assert.equal(args.message, 'Install the monitoring dashboard UI?');
    });

    it('calls confirm() with default: true', async () => {
      confirmMock.mock.resetCalls();
      await promptUiInstall(WORKSPACE_DIR);
      const args = confirmMock.mock.calls[0].arguments[0];
      assert.equal(args.default, true);
    });

    it('returns { installUi: false } when user answers false', async () => {
      confirmMock.mock.resetCalls();
      confirmMock.mock.mockImplementation(async () => false);
      const result = await promptUiInstall(WORKSPACE_DIR);
      assert.deepEqual(result, { installUi: false });
    });

    it('does NOT call input() when P-11 answer is false', async () => {
      confirmMock.mock.resetCalls();
      inputMock.mock.resetCalls();
      confirmMock.mock.mockImplementation(async () => false);
      await promptUiInstall(WORKSPACE_DIR);
      assert.equal(inputMock.mock.calls.length, 0);
    });
  });

  describe('P-12: input prompt (when P-11 is true)', () => {
    let result;
    let inputArgs;

    before(async () => {
      confirmMock.mock.resetCalls();
      inputMock.mock.resetCalls();
      confirmMock.mock.mockImplementation(async () => true);
      inputMock.mock.mockImplementation(async () => path.join(WORKSPACE_DIR, 'ui'));

      result = await promptUiInstall(WORKSPACE_DIR);
      inputArgs = inputMock.mock.calls[0].arguments[0];
    });

    it('calls input() with message "Dashboard installation directory"', () => {
      assert.equal(inputArgs.message, 'Dashboard installation directory');
    });

    it('calls input() with default path.join(workspaceDir, "ui")', () => {
      assert.equal(inputArgs.default, path.join(WORKSPACE_DIR, 'ui'));
    });

    it('returns { installUi: true, uiDir: ... } when P-11 is true', () => {
      assert.equal(result.installUi, true);
      assert.ok(Object.hasOwn(result, 'uiDir'));
    });

    it('returned uiDir is an absolute path (resolved via path.resolve)', () => {
      assert.ok(path.isAbsolute(result.uiDir), 'uiDir should be absolute');
    });

    describe('P-12 validate function', () => {
      let validate;

      before(() => {
        validate = inputArgs.validate;
      });

      it('returns true for a valid directory path', () => {
        assert.equal(validate('/home/user/project/ui'), true);
      });

      it('returns error string for empty input', () => {
        const errResult = validate('');
        assert.equal(typeof errResult, 'string');
        assert.equal(errResult, 'Please enter a valid directory path.');
      });

      it('returns error string for whitespace-only input', () => {
        const errResult = validate('   ');
        assert.equal(typeof errResult, 'string');
        assert.equal(errResult, 'Please enter a valid directory path.');
      });
    });
  });
});
