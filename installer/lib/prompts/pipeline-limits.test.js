// installer/lib/prompts/pipeline-limits.test.js

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// Create mock function before registering module mock
// Returns default values sequentially: '10', '8', '2', '3'
let callCount = 0;
const defaults = ['10', '8', '2', '3'];
const inputMock = mock.fn(async () => defaults[callCount++ % defaults.length]);

// Register module mock BEFORE dynamic import of the module under test
mock.module('@inquirer/prompts', {
  namedExports: { input: inputMock },
});

// Dynamic import after mock registration so the module uses the mocked @inquirer/prompts
const { promptPipelineLimits } = await import('./pipeline-limits.js');

describe('promptPipelineLimits', () => {
  let result;
  let calls;

  before(async () => {
    callCount = 0;
    inputMock.mock.resetCalls();
    inputMock.mock.mockImplementation(async () => defaults[callCount++ % defaults.length]);

    result = await promptPipelineLimits();
    calls = inputMock.mock.calls.map((c) => c.arguments[0]);
  });

  it('calls input() exactly 4 times', () => {
    assert.equal(inputMock.mock.calls.length, 4);
  });

  it('P-6: message is "Maximum phases per project"', () => {
    assert.equal(calls[0].message, 'Maximum phases per project');
  });

  it('P-6: default is "10"', () => {
    assert.equal(calls[0].default, '10');
  });

  it('P-7: message is "Maximum tasks per phase"', () => {
    assert.equal(calls[1].message, 'Maximum tasks per phase');
  });

  it('P-7: default is "8"', () => {
    assert.equal(calls[1].default, '8');
  });

  it('P-8: message is "Maximum retries per task"', () => {
    assert.equal(calls[2].message, 'Maximum retries per task');
  });

  it('P-8: default is "2"', () => {
    assert.equal(calls[2].default, '2');
  });

  it('P-9: message is "Maximum consecutive review rejections"', () => {
    assert.equal(calls[3].message, 'Maximum consecutive review rejections');
  });

  it('P-9: default is "3"', () => {
    assert.equal(calls[3].default, '3');
  });

  it('returns an object with the 4 expected keys', () => {
    assert.ok(Object.hasOwn(result, 'maxPhases'));
    assert.ok(Object.hasOwn(result, 'maxTasksPerPhase'));
    assert.ok(Object.hasOwn(result, 'maxRetriesPerTask'));
    assert.ok(Object.hasOwn(result, 'maxConsecutiveReviewRejections'));
  });

  it('all returned values are numbers (not strings)', () => {
    assert.equal(typeof result.maxPhases, 'number');
    assert.equal(typeof result.maxTasksPerPhase, 'number');
    assert.equal(typeof result.maxRetriesPerTask, 'number');
    assert.equal(typeof result.maxConsecutiveReviewRejections, 'number');
  });

  it('all returned values are integers', () => {
    assert.ok(Number.isInteger(result.maxPhases));
    assert.ok(Number.isInteger(result.maxTasksPerPhase));
    assert.ok(Number.isInteger(result.maxRetriesPerTask));
    assert.ok(Number.isInteger(result.maxConsecutiveReviewRejections));
  });

  it('returns correct parsed values', () => {
    assert.equal(result.maxPhases, 10);
    assert.equal(result.maxTasksPerPhase, 8);
    assert.equal(result.maxRetriesPerTask, 2);
    assert.equal(result.maxConsecutiveReviewRejections, 3);
  });

  describe('P-6 validate function (positive integer)', () => {
    let validate;

    before(() => {
      validate = calls[0].validate;
    });

    it('"5" → true', () => {
      assert.equal(validate('5'), true);
    });

    it('"0" → error string', () => {
      const r = validate('0');
      assert.equal(typeof r, 'string');
      assert.ok(r.length > 0);
    });

    it('"-1" → error string', () => {
      const r = validate('-1');
      assert.equal(typeof r, 'string');
    });

    it('"abc" → error string', () => {
      const r = validate('abc');
      assert.equal(typeof r, 'string');
    });

    it('"3.5" → error string', () => {
      const r = validate('3.5');
      assert.equal(typeof r, 'string');
    });
  });

  describe('P-7 validate function (positive integer)', () => {
    let validate;

    before(() => {
      validate = calls[1].validate;
    });

    it('"1" → true', () => {
      assert.equal(validate('1'), true);
    });

    it('"0" → error string', () => {
      const r = validate('0');
      assert.equal(typeof r, 'string');
    });
  });

  describe('P-8 validate function (non-negative integer)', () => {
    let validate;

    before(() => {
      validate = calls[2].validate;
    });

    it('"0" → true (non-negative allowed)', () => {
      assert.equal(validate('0'), true);
    });

    it('"2" → true', () => {
      assert.equal(validate('2'), true);
    });

    it('"-1" → error string', () => {
      const r = validate('-1');
      assert.equal(typeof r, 'string');
    });
  });

  describe('P-9 validate function (positive integer)', () => {
    let validate;

    before(() => {
      validate = calls[3].validate;
    });

    it('"1" → true', () => {
      assert.equal(validate('1'), true);
    });

    it('"0" → error string', () => {
      const r = validate('0');
      assert.equal(typeof r, 'string');
    });
  });
});
