'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateTransition } = require('../lib/validator.js');

function makeState(pipelineOverrides = {}) {
  return {
    $schema: 'orchestration-state-v4',
    project: {
      name: 'TEST',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:01.000Z',
    },
    pipeline: { current_tier: 'planning', ...pipelineOverrides },
    planning: { status: 'not_started', human_approved: false, steps: [] },
    execution: { status: 'not_started', current_phase: 0, phases: [] },
    final_review: { status: 'not_started', doc_path: null, human_approved: false },
  };
}

const config = { limits: { max_phases: 10, max_tasks_per_phase: 10, max_retries: 3 } };

function hasGateModeError(errs) {
  return errs.some(e => {
    const s = typeof e === 'string' ? e : (e.field || '') + ' ' + (e.message || '') + ' ' + JSON.stringify(e);
    return s.includes('gate_mode');
  });
}

describe('gate_mode schema — valid values accepted', () => {
  it('accepts "task"', () => {
    const errs = validateTransition(null, makeState({ gate_mode: 'task' }), config);
    assert.ok(!hasGateModeError(errs), `Expected no gate_mode errors, got: ${JSON.stringify(errs)}`);
  });

  it('accepts "phase"', () => {
    const errs = validateTransition(null, makeState({ gate_mode: 'phase' }), config);
    assert.ok(!hasGateModeError(errs), `Expected no gate_mode errors, got: ${JSON.stringify(errs)}`);
  });

  it('accepts "autonomous"', () => {
    const errs = validateTransition(null, makeState({ gate_mode: 'autonomous' }), config);
    assert.ok(!hasGateModeError(errs), `Expected no gate_mode errors, got: ${JSON.stringify(errs)}`);
  });

  it('accepts null', () => {
    const errs = validateTransition(null, makeState({ gate_mode: null }), config);
    assert.ok(!hasGateModeError(errs), `Expected no gate_mode errors, got: ${JSON.stringify(errs)}`);
  });
});

describe('gate_mode schema — invalid values rejected', () => {
  it('rejects "ask"', () => {
    const errs = validateTransition(null, makeState({ gate_mode: 'ask' }), config);
    assert.ok(errs.length > 0, 'Expected at least one validation error for "ask"');
  });

  it('rejects "manual"', () => {
    const errs = validateTransition(null, makeState({ gate_mode: 'manual' }), config);
    assert.ok(errs.length > 0, 'Expected at least one validation error for "manual"');
  });

  it('rejects ""', () => {
    const errs = validateTransition(null, makeState({ gate_mode: '' }), config);
    assert.ok(errs.length > 0, 'Expected at least one validation error for ""');
  });

  it('rejects 42 (number)', () => {
    const errs = validateTransition(null, makeState({ gate_mode: 42 }), config);
    assert.ok(errs.length > 0, 'Expected at least one validation error for 42');
  });

  it('rejects true (boolean)', () => {
    const errs = validateTransition(null, makeState({ gate_mode: true }), config);
    assert.ok(errs.length > 0, 'Expected at least one validation error for true');
  });
});

describe('gate_mode schema — backward compatibility', () => {
  it('accepts state without gate_mode field', () => {
    const errs = validateTransition(null, makeState(), config);
    assert.ok(!hasGateModeError(errs), `Expected no gate_mode errors, got: ${JSON.stringify(errs)}`);
    // State with only current_tier in pipeline should be valid
    assert.equal(errs.length, 0, `Expected zero errors, got: ${JSON.stringify(errs)}`);
  });
});

describe('config section — schema compatibility', () => {
  it('accepts state with fully valid config section (zero errors)', () => {
    const stateWithConfig = {
      ...makeState(),
      config: {
        limits: {
          max_phases: 5,
          max_tasks_per_phase: 8,
          max_retries_per_task: 2,
          max_consecutive_review_rejections: 3,
        },
        human_gates: {
          after_planning: true,
          execution_mode: 'autonomous',
          after_final_review: true,
        },
      },
    };
    const errs = validateTransition(null, stateWithConfig, config);
    assert.equal(errs.length, 0, `Expected zero errors, got: ${JSON.stringify(errs)}`);
  });
});
