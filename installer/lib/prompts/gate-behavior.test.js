// installer/lib/prompts/gate-behavior.test.js

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create mock function before registering module mock
const selectMock = mock.fn(async () => 'ask');

// Register module mock BEFORE dynamic import of the module under test
mock.module('@inquirer/prompts', {
  namedExports: { select: selectMock },
});

// Dynamic import after mock registration so the module uses the mocked @inquirer/prompts
const { promptGateBehavior } = await import('./gate-behavior.js');

describe('promptGateBehavior', () => {
  let result;
  let selectArgs;

  before(async () => {
    selectMock.mock.resetCalls();
    selectMock.mock.mockImplementation(async () => 'ask');

    result = await promptGateBehavior();
    selectArgs = selectMock.mock.calls[0].arguments[0];
  });

  it('calls select() with message "Execution mode"', () => {
    assert.equal(selectArgs.message, 'Execution mode');
  });

  it('select has exactly 4 choices', () => {
    assert.equal(selectArgs.choices.length, 4);
  });

  it('choice values are ask, phase, task, autonomous (in order)', () => {
    const values = selectArgs.choices.map((c) => c.value);
    assert.deepEqual(values, ['ask', 'phase', 'task', 'autonomous']);
  });

  it('each choice name includes a description suffix with " — "', () => {
    for (const choice of selectArgs.choices) {
      assert.ok(
        choice.name.includes(' — '),
        `choice "${choice.value}" name should include " — " separator`
      );
    }
  });

  it('"ask" choice name is "ask — Prompt before each phase"', () => {
    const choice = selectArgs.choices.find((c) => c.value === 'ask');
    assert.equal(choice.name, 'ask — Prompt before each phase');
  });

  it('"phase" choice name is "phase — Gate between phases"', () => {
    const choice = selectArgs.choices.find((c) => c.value === 'phase');
    assert.equal(choice.name, 'phase — Gate between phases');
  });

  it('"task" choice name is "task — Gate between tasks"', () => {
    const choice = selectArgs.choices.find((c) => c.value === 'task');
    assert.equal(choice.name, 'task — Gate between tasks');
  });

  it('"autonomous" choice name is "autonomous — No gates"', () => {
    const choice = selectArgs.choices.find((c) => c.value === 'autonomous');
    assert.equal(choice.name, 'autonomous — No gates');
  });

  it('default is "ask"', () => {
    assert.equal(selectArgs.default, 'ask');
  });

  it('returns an object with executionMode property', () => {
    assert.ok(Object.hasOwn(result, 'executionMode'), 'result has executionMode property');
  });

  it('returns executionMode matching the selected value', () => {
    assert.equal(result.executionMode, 'ask');
  });

  describe('with different selection', () => {
    let autonomousResult;

    before(async () => {
      selectMock.mock.resetCalls();
      selectMock.mock.mockImplementation(async () => 'autonomous');

      autonomousResult = await promptGateBehavior();
    });

    it('returns executionMode: "autonomous" when that value is selected', () => {
      assert.equal(autonomousResult.executionMode, 'autonomous');
    });
  });
});
