// installer/lib/prompts/source-control.test.js

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create mock functions before registering module mocks
const selectMock = mock.fn(async () => 'ask');
const execFileSyncMock = mock.fn(() => 'git version 2.40.0');

// Register module mocks BEFORE dynamic import of the module under test
mock.module('@inquirer/prompts', {
  namedExports: { select: selectMock },
});

mock.module('node:child_process', {
  namedExports: { execFileSync: execFileSyncMock },
});

// Dynamic import after mock registration so the module uses the mocked dependencies
const { promptSourceControl } = await import('./source-control.js');

describe('promptSourceControl', () => {
  let result;
  let firstSelectArgs;
  let secondSelectArgs;

  before(async () => {
    selectMock.mock.resetCalls();
    execFileSyncMock.mock.resetCalls();
    selectMock.mock.mockImplementation(async () => 'ask');
    execFileSyncMock.mock.mockImplementation(() => 'git version 2.40.0');

    result = await promptSourceControl();
    firstSelectArgs = selectMock.mock.calls[0].arguments[0];
    secondSelectArgs = selectMock.mock.calls[1].arguments[0];
  });

  // ── select() call verification tests ────────────────────────────────────────

  it('calls select() exactly 2 times', () => {
    assert.equal(selectMock.mock.callCount(), 2);
  });

  it('first select() message is "Auto-commit behavior"', () => {
    assert.equal(firstSelectArgs.message, 'Auto-commit behavior');
  });

  it('first select() has exactly 3 choices', () => {
    assert.equal(firstSelectArgs.choices.length, 3);
  });

  it('first select() choice values are always, ask, never (in order)', () => {
    assert.deepEqual(firstSelectArgs.choices.map(c => c.value), ['always', 'ask', 'never']);
  });

  it('first select() default is "ask"', () => {
    assert.equal(firstSelectArgs.default, 'ask');
  });

  it('first select() "always" choice name is "always — Commit and push after every approved task"', () => {
    const choice = firstSelectArgs.choices.find(c => c.value === 'always');
    assert.equal(choice.name, 'always — Commit and push after every approved task');
  });

  it('first select() "ask" choice name is "ask — Prompt before each project run"', () => {
    const choice = firstSelectArgs.choices.find(c => c.value === 'ask');
    assert.equal(choice.name, 'ask — Prompt before each project run');
  });

  it('first select() "never" choice name is "never — Never commit automatically"', () => {
    const choice = firstSelectArgs.choices.find(c => c.value === 'never');
    assert.equal(choice.name, 'never — Never commit automatically');
  });

  it('second select() message is "Auto-PR behavior"', () => {
    assert.equal(secondSelectArgs.message, 'Auto-PR behavior');
  });

  it('second select() has exactly 3 choices', () => {
    assert.equal(secondSelectArgs.choices.length, 3);
  });

  it('second select() choice values are always, ask, never (in order)', () => {
    assert.deepEqual(secondSelectArgs.choices.map(c => c.value), ['always', 'ask', 'never']);
  });

  it('second select() default is "ask"', () => {
    assert.equal(secondSelectArgs.default, 'ask');
  });

  it('second select() "always" choice name is "always — Create PR automatically on final approval"', () => {
    const choice = secondSelectArgs.choices.find(c => c.value === 'always');
    assert.equal(choice.name, 'always — Create PR automatically on final approval');
  });

  it('second select() "ask" choice name is "ask — Prompt before each project run"', () => {
    const choice = secondSelectArgs.choices.find(c => c.value === 'ask');
    assert.equal(choice.name, 'ask — Prompt before each project run');
  });

  it('second select() "never" choice name is "never — Never create PRs automatically"', () => {
    const choice = secondSelectArgs.choices.find(c => c.value === 'never');
    assert.equal(choice.name, 'never — Never create PRs automatically');
  });

  it('all choice names include " — " separator', () => {
    const allChoices = [...firstSelectArgs.choices, ...secondSelectArgs.choices];
    for (const choice of allChoices) {
      assert.ok(
        choice.name.includes(' — '),
        `choice "${choice.value}" name should include " — " separator`
      );
    }
  });

  // ── Return shape tests ──────────────────────────────────────────────────────

  it('returns object with autoCommit property', () => {
    assert.ok(Object.hasOwn(result, 'autoCommit'));
  });

  it('returns object with autoPr property', () => {
    assert.ok(Object.hasOwn(result, 'autoPr'));
  });

  it('returns object with provider property', () => {
    assert.ok(Object.hasOwn(result, 'provider'));
  });

  it('autoCommit matches first select() return value', () => {
    assert.equal(result.autoCommit, 'ask');
  });

  it('autoPr matches second select() return value', () => {
    assert.equal(result.autoPr, 'ask');
  });

  it('provider is always "github"', () => {
    assert.equal(result.provider, 'github');
  });

  // ── Git check test ──────────────────────────────────────────────────────────

  it('calls execFileSync with "git" and ["--version"]', () => {
    const args = execFileSyncMock.mock.calls[0].arguments;
    assert.equal(args[0], 'git');
    assert.deepEqual(args[1], ['--version']);
  });

  // ── "git not found" describe block ──────────────────────────────────────────

  describe('when git is not found', () => {
    let gitNotFoundResult;

    before(async () => {
      selectMock.mock.resetCalls();
      execFileSyncMock.mock.resetCalls();
      execFileSyncMock.mock.mockImplementation(() => {
        throw new Error('git not found');
      });
      selectMock.mock.mockImplementation(async () => 'never');

      gitNotFoundResult = await promptSourceControl();
    });

    it('function completes without throwing', () => {
      assert.ok(gitNotFoundResult);
    });

    it('returns valid result despite git failure', () => {
      assert.equal(gitNotFoundResult.autoCommit, 'never');
      assert.equal(gitNotFoundResult.provider, 'github');
    });
  });

  // ── "autoPr always with gh auth failure" describe block ─────────────────────

  describe('when autoPr is "always" and gh auth fails', () => {
    let ghAuthFailResult;

    before(async () => {
      selectMock.mock.resetCalls();
      execFileSyncMock.mock.resetCalls();

      let selectCallCount = 0;
      selectMock.mock.mockImplementation(async () => {
        selectCallCount++;
        // First call (autoCommit) returns 'ask', second call (autoPr) returns 'always'
        return selectCallCount === 1 ? 'ask' : 'always';
      });

      let execCallCount = 0;
      execFileSyncMock.mock.mockImplementation((cmd) => {
        execCallCount++;
        // First call (git --version) succeeds, second call (gh auth status) throws
        if (execCallCount === 1) {
          return 'git version 2.40.0';
        }
        throw new Error('gh auth failed');
      });

      ghAuthFailResult = await promptSourceControl();
    });

    it('function completes without throwing', () => {
      assert.ok(ghAuthFailResult);
    });

    it('returns autoPr: "always" despite gh failure', () => {
      assert.equal(ghAuthFailResult.autoPr, 'always');
    });

    it('calls execFileSync for gh auth status', () => {
      assert.equal(execFileSyncMock.mock.callCount(), 2);
      const secondCallArgs = execFileSyncMock.mock.calls[1].arguments;
      assert.equal(secondCallArgs[0], 'gh');
      assert.deepEqual(secondCallArgs[1], ['auth', 'status']);
    });
  });

  // ── "autoPr not always skips gh check" describe block ───────────────────────

  describe('when autoPr is not "always"', () => {
    before(async () => {
      selectMock.mock.resetCalls();
      execFileSyncMock.mock.resetCalls();
      selectMock.mock.mockImplementation(async () => 'never');
      execFileSyncMock.mock.mockImplementation(() => 'git version 2.40.0');

      await promptSourceControl();
    });

    it('does not call execFileSync for gh auth status', () => {
      // Only the git --version call should have been made
      assert.equal(execFileSyncMock.mock.callCount(), 1);
    });
  });
});
