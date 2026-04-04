'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const constants = require('../lib/constants.js');

const {
  SCHEMA_VERSION,
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  PHASE_STATUSES,
  TASK_STATUSES,
  TASK_STAGES,
  PHASE_STAGES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS,
  HUMAN_GATE_MODES,
  NEXT_ACTIONS,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
  ALLOWED_TASK_STAGE_TRANSITIONS,
  ALLOWED_PHASE_STAGE_TRANSITIONS,
} = constants;

// ─── Freeze checks ─────────────────────────────────────────────────────────

describe('All exported enums are frozen', () => {
  const frozenObjects = {
    PIPELINE_TIERS,
    PLANNING_STATUSES,
    PLANNING_STEP_STATUSES,
    PHASE_STATUSES,
    TASK_STATUSES,
    TASK_STAGES,
    PHASE_STAGES,
    REVIEW_VERDICTS,
    REVIEW_ACTIONS,
    PHASE_REVIEW_ACTIONS,
    SEVERITY_LEVELS,
    HUMAN_GATE_MODES,
    NEXT_ACTIONS,
    ALLOWED_TASK_TRANSITIONS,
    ALLOWED_PHASE_TRANSITIONS,
    ALLOWED_TASK_STAGE_TRANSITIONS,
    ALLOWED_PHASE_STAGE_TRANSITIONS,
  };

  for (const [name, obj] of Object.entries(frozenObjects)) {
    it(`${name} is frozen`, () => {
      assert.ok(Object.isFrozen(obj), `${name} should be frozen`);
    });
  }
});

// ─── SCHEMA_VERSION ─────────────────────────────────────────────────────────

describe('SCHEMA_VERSION', () => {
  it('equals orchestration-state-v4', () => {
    assert.equal(SCHEMA_VERSION, 'orchestration-state-v4');
  });
});

// ─── TASK_STAGES ─────────────────────────────────────────────────────────────

describe('TASK_STAGES', () => {
  it('has exactly 5 keys', () => {
    assert.equal(Object.keys(TASK_STAGES).length, 5);
  });

  it('PLANNING equals planning', () => { assert.equal(TASK_STAGES.PLANNING, 'planning'); });
  it('CODING equals coding', () => { assert.equal(TASK_STAGES.CODING, 'coding'); });
  it('REVIEWING equals reviewing', () => { assert.equal(TASK_STAGES.REVIEWING, 'reviewing'); });
  it('COMPLETE equals complete', () => { assert.equal(TASK_STAGES.COMPLETE, 'complete'); });
  it('FAILED equals failed', () => { assert.equal(TASK_STAGES.FAILED, 'failed'); });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(TASK_STAGES), 'TASK_STAGES should be frozen');
  });
});

// ─── PHASE_STAGES ────────────────────────────────────────────────────────────

describe('PHASE_STAGES', () => {
  it('has exactly 5 keys', () => {
    assert.equal(Object.keys(PHASE_STAGES).length, 5);
  });

  it('PLANNING equals planning', () => { assert.equal(PHASE_STAGES.PLANNING, 'planning'); });
  it('EXECUTING equals executing', () => { assert.equal(PHASE_STAGES.EXECUTING, 'executing'); });
  it('REVIEWING equals reviewing', () => { assert.equal(PHASE_STAGES.REVIEWING, 'reviewing'); });
  it('COMPLETE equals complete', () => { assert.equal(PHASE_STAGES.COMPLETE, 'complete'); });
  it('FAILED equals failed', () => { assert.equal(PHASE_STAGES.FAILED, 'failed'); });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(PHASE_STAGES), 'PHASE_STAGES should be frozen');
  });
});

// ─── ALLOWED_TASK_STAGE_TRANSITIONS ──────────────────────────────────────────

describe('ALLOWED_TASK_STAGE_TRANSITIONS', () => {
  it('has exactly 5 keys', () => {
    assert.equal(Object.keys(ALLOWED_TASK_STAGE_TRANSITIONS).length, 5);
  });

  it('planning -> [coding]', () => {
    assert.deepEqual(ALLOWED_TASK_STAGE_TRANSITIONS['planning'], ['coding']);
  });

  it('coding -> [reviewing]', () => {
    assert.deepEqual(ALLOWED_TASK_STAGE_TRANSITIONS['coding'], ['reviewing']);
  });

  it('reviewing -> [complete, failed]', () => {
    assert.deepEqual(ALLOWED_TASK_STAGE_TRANSITIONS['reviewing'], ['complete', 'failed']);
  });

  it('complete -> []', () => {
    assert.deepEqual(ALLOWED_TASK_STAGE_TRANSITIONS['complete'], []);
  });

  it('failed -> [coding]', () => {
    assert.deepEqual(ALLOWED_TASK_STAGE_TRANSITIONS['failed'], ['coding']);
  });

  it('all target values are valid TASK_STAGES values', () => {
    const validValues = new Set(Object.values(TASK_STAGES));
    for (const [key, targets] of Object.entries(ALLOWED_TASK_STAGE_TRANSITIONS)) {
      assert.ok(Array.isArray(targets), `${key} should map to an array`);
      for (const target of targets) {
        assert.ok(validValues.has(target), `Invalid target "${target}" in ${key}`);
      }
    }
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(ALLOWED_TASK_STAGE_TRANSITIONS), 'ALLOWED_TASK_STAGE_TRANSITIONS should be frozen');
  });
});

// ─── ALLOWED_PHASE_STAGE_TRANSITIONS ─────────────────────────────────────────

describe('ALLOWED_PHASE_STAGE_TRANSITIONS', () => {
  it('has exactly 5 keys', () => {
    assert.equal(Object.keys(ALLOWED_PHASE_STAGE_TRANSITIONS).length, 5);
  });

  it('planning -> [executing]', () => {
    assert.deepEqual(ALLOWED_PHASE_STAGE_TRANSITIONS['planning'], ['executing']);
  });

  it('executing -> [reviewing]', () => {
    assert.deepEqual(ALLOWED_PHASE_STAGE_TRANSITIONS['executing'], ['reviewing']);
  });

  it('reviewing -> [complete, failed]', () => {
    assert.deepEqual(ALLOWED_PHASE_STAGE_TRANSITIONS['reviewing'], ['complete', 'failed']);
  });

  it('complete -> []', () => {
    assert.deepEqual(ALLOWED_PHASE_STAGE_TRANSITIONS['complete'], []);
  });

  it('failed -> [executing]', () => {
    assert.deepEqual(ALLOWED_PHASE_STAGE_TRANSITIONS['failed'], ['executing']);
  });

  it('all target values are valid PHASE_STAGES values', () => {
    const validValues = new Set(Object.values(PHASE_STAGES));
    for (const [key, targets] of Object.entries(ALLOWED_PHASE_STAGE_TRANSITIONS)) {
      assert.ok(Array.isArray(targets), `${key} should map to an array`);
      for (const target of targets) {
        assert.ok(validValues.has(target), `Invalid target "${target}" in ${key}`);
      }
    }
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(ALLOWED_PHASE_STAGE_TRANSITIONS), 'ALLOWED_PHASE_STAGE_TRANSITIONS should be frozen');
  });
});

// ─── NEXT_ACTIONS ───────────────────────────────────────────────────────────

describe('NEXT_ACTIONS', () => {
  it('has exactly 21 entries', () => {
    assert.equal(Object.keys(NEXT_ACTIONS).length, 21);
  });

  it('contains ASK_GATE_MODE with value ask_gate_mode', () => {
    assert.equal(NEXT_ACTIONS.ASK_GATE_MODE, 'ask_gate_mode');
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(NEXT_ACTIONS));
  });

  const removedActions = [
    'ADVANCE_TASK',
    'ADVANCE_PHASE',
    'TRANSITION_TO_EXECUTION',
    'TRANSITION_TO_REVIEW',
    'TRANSITION_TO_COMPLETE',
    'UPDATE_STATE_FROM_TASK',
    'UPDATE_STATE_FROM_REVIEW',
    'UPDATE_STATE_FROM_PHASE_REVIEW',
    'TRIAGE_TASK',
    'TRIAGE_PHASE',
    'HALT_TRIAGE_INVARIANT',
    'HALT_PHASE_TRIAGE_INVARIANT',
    'RETRY_FROM_REVIEW',
    'HALT_FROM_REVIEW',
    'HALT_TASK_FAILED',
    'CREATE_CORRECTIVE_HANDOFF',
  ];

  for (const action of removedActions) {
    it(`does NOT contain removed action ${action}`, () => {
      assert.equal(NEXT_ACTIONS[action], undefined);
    });
  }
});

// ─── TRIAGE_LEVELS not exported ─────────────────────────────────────────────

describe('TRIAGE_LEVELS removal', () => {
  it('is NOT exported', () => {
    assert.equal(constants.TRIAGE_LEVELS, undefined);
  });
});

// ─── PLANNING_STEP_STATUSES ─────────────────────────────────────────────────

describe('PLANNING_STEP_STATUSES', () => {
  it('has exactly 3 entries', () => {
    assert.equal(Object.keys(PLANNING_STEP_STATUSES).length, 3);
  });

  it('does NOT contain FAILED', () => {
    assert.equal(PLANNING_STEP_STATUSES.FAILED, undefined);
  });

  it('does NOT contain SKIPPED', () => {
    assert.equal(PLANNING_STEP_STATUSES.SKIPPED, undefined);
  });
});

// ─── PHASE_STATUSES ─────────────────────────────────────────────────────────

describe('PHASE_STATUSES', () => {
  it('has exactly 4 entries', () => {
    assert.equal(Object.keys(PHASE_STATUSES).length, 4);
  });

  it('does NOT contain FAILED', () => {
    assert.equal(PHASE_STATUSES.FAILED, undefined);
  });
});

// ─── Transition maps completeness ───────────────────────────────────────────

describe('ALLOWED_TASK_TRANSITIONS', () => {
  it('has a key for every TASK_STATUSES value', () => {
    for (const status of Object.values(TASK_STATUSES)) {
      assert.ok(
        status in ALLOWED_TASK_TRANSITIONS,
        `Missing key for task status: ${status}`
      );
    }
  });

  it('values are arrays of valid TASK_STATUSES values', () => {
    const validValues = new Set(Object.values(TASK_STATUSES));
    for (const [key, targets] of Object.entries(ALLOWED_TASK_TRANSITIONS)) {
      assert.ok(Array.isArray(targets), `${key} should map to an array`);
      for (const target of targets) {
        assert.ok(validValues.has(target), `Invalid target "${target}" in ${key}`);
      }
    }
  });

  it('complete is truly terminal (deep-equals [])', () => {
    assert.deepEqual(ALLOWED_TASK_TRANSITIONS.complete, []);
  });
});

describe('ALLOWED_PHASE_TRANSITIONS', () => {
  it('has a key for every PHASE_STATUSES value', () => {
    for (const status of Object.values(PHASE_STATUSES)) {
      assert.ok(
        status in ALLOWED_PHASE_TRANSITIONS,
        `Missing key for phase status: ${status}`
      );
    }
  });

  it('values are arrays of valid PHASE_STATUSES values', () => {
    const validValues = new Set(Object.values(PHASE_STATUSES));
    for (const [key, targets] of Object.entries(ALLOWED_PHASE_TRANSITIONS)) {
      assert.ok(Array.isArray(targets), `${key} should map to an array`);
      for (const target of targets) {
        assert.ok(validValues.has(target), `Invalid target "${target}" in ${key}`);
      }
    }
  });
});

// ─── Singular / plural review actions ───────────────────────────────────────

describe('Review action naming', () => {
  it('REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED is singular', () => {
    assert.equal(REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED, 'corrective_task_issued');
  });

  it('PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED is plural', () => {
    assert.equal(PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED, 'corrective_tasks_issued');
  });
});

// ─── No triage_attempts in source ───────────────────────────────────────────

describe('No triage_attempts in source', () => {
  it('source file contains zero occurrences of triage_attempts', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'lib', 'constants.js'),
      'utf8'
    );
    assert.equal(
      src.includes('triage_attempts'),
      false,
      'Source must not contain triage_attempts'
    );
  });
});
