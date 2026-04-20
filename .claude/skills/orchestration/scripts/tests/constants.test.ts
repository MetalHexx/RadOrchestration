import { describe, it, expect } from 'vitest';
import {
  NODE_KINDS,
  NODE_STATUSES,
  GRAPH_STATUSES,
  CONDITION_OPERATORS,
  NEXT_ACTIONS,
  EVENTS,
} from '../lib/constants.js';

describe('NODE_KINDS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(NODE_KINDS)).toBe(true);
  });

  it('throws on mutation in strict mode', () => {
    expect(() => {
      (NODE_KINDS as Record<string, string>).NEW_KEY = 'x';
    }).toThrow(TypeError);
  });

  it('has exactly 6 keys', () => {
    expect(Object.keys(NODE_KINDS)).toHaveLength(6);
  });

  it('has expected keys', () => {
    expect(NODE_KINDS).toHaveProperty('STEP');
    expect(NODE_KINDS).toHaveProperty('GATE');
    expect(NODE_KINDS).toHaveProperty('FOR_EACH_PHASE');
    expect(NODE_KINDS).toHaveProperty('FOR_EACH_TASK');
    expect(NODE_KINDS).toHaveProperty('CONDITIONAL');
    expect(NODE_KINDS).toHaveProperty('PARALLEL');
  });

  it('has expected values', () => {
    expect(NODE_KINDS.STEP).toBe('step');
    expect(NODE_KINDS.GATE).toBe('gate');
    expect(NODE_KINDS.FOR_EACH_PHASE).toBe('for_each_phase');
    expect(NODE_KINDS.FOR_EACH_TASK).toBe('for_each_task');
    expect(NODE_KINDS.CONDITIONAL).toBe('conditional');
    expect(NODE_KINDS.PARALLEL).toBe('parallel');
  });
});

describe('NODE_STATUSES', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(NODE_STATUSES)).toBe(true);
  });

  it('throws on mutation in strict mode', () => {
    expect(() => {
      (NODE_STATUSES as Record<string, string>).NEW_KEY = 'x';
    }).toThrow(TypeError);
  });

  it('has exactly 6 keys', () => {
    expect(Object.keys(NODE_STATUSES)).toHaveLength(6);
  });

  it('has expected keys', () => {
    expect(NODE_STATUSES).toHaveProperty('NOT_STARTED');
    expect(NODE_STATUSES).toHaveProperty('IN_PROGRESS');
    expect(NODE_STATUSES).toHaveProperty('COMPLETED');
    expect(NODE_STATUSES).toHaveProperty('FAILED');
    expect(NODE_STATUSES).toHaveProperty('HALTED');
    expect(NODE_STATUSES).toHaveProperty('SKIPPED');
  });

  it('has expected values', () => {
    expect(NODE_STATUSES.NOT_STARTED).toBe('not_started');
    expect(NODE_STATUSES.IN_PROGRESS).toBe('in_progress');
    expect(NODE_STATUSES.COMPLETED).toBe('completed');
    expect(NODE_STATUSES.FAILED).toBe('failed');
    expect(NODE_STATUSES.HALTED).toBe('halted');
    expect(NODE_STATUSES.SKIPPED).toBe('skipped');
  });
});

describe('GRAPH_STATUSES', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(GRAPH_STATUSES)).toBe(true);
  });

  it('throws on mutation in strict mode', () => {
    expect(() => {
      (GRAPH_STATUSES as Record<string, string>).NEW_KEY = 'x';
    }).toThrow(TypeError);
  });

  it('has exactly 4 keys', () => {
    expect(Object.keys(GRAPH_STATUSES)).toHaveLength(4);
  });

  it('has expected keys', () => {
    expect(GRAPH_STATUSES).toHaveProperty('NOT_STARTED');
    expect(GRAPH_STATUSES).toHaveProperty('IN_PROGRESS');
    expect(GRAPH_STATUSES).toHaveProperty('COMPLETED');
    expect(GRAPH_STATUSES).toHaveProperty('HALTED');
  });

  it('has expected values', () => {
    expect(GRAPH_STATUSES.NOT_STARTED).toBe('not_started');
    expect(GRAPH_STATUSES.IN_PROGRESS).toBe('in_progress');
    expect(GRAPH_STATUSES.COMPLETED).toBe('completed');
    expect(GRAPH_STATUSES.HALTED).toBe('halted');
  });
});

describe('CONDITION_OPERATORS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(CONDITION_OPERATORS)).toBe(true);
  });

  it('throws on mutation in strict mode', () => {
    expect(() => {
      (CONDITION_OPERATORS as Record<string, string>).NEW_KEY = 'x';
    }).toThrow(TypeError);
  });

  it('has exactly 6 keys', () => {
    expect(Object.keys(CONDITION_OPERATORS)).toHaveLength(6);
  });

  it('has expected keys', () => {
    expect(CONDITION_OPERATORS).toHaveProperty('EQ');
    expect(CONDITION_OPERATORS).toHaveProperty('NEQ');
    expect(CONDITION_OPERATORS).toHaveProperty('IN');
    expect(CONDITION_OPERATORS).toHaveProperty('NOT_IN');
    expect(CONDITION_OPERATORS).toHaveProperty('TRUTHY');
    expect(CONDITION_OPERATORS).toHaveProperty('FALSY');
  });

  it('has expected values', () => {
    expect(CONDITION_OPERATORS.EQ).toBe('eq');
    expect(CONDITION_OPERATORS.NEQ).toBe('neq');
    expect(CONDITION_OPERATORS.IN).toBe('in');
    expect(CONDITION_OPERATORS.NOT_IN).toBe('not_in');
    expect(CONDITION_OPERATORS.TRUTHY).toBe('truthy');
    expect(CONDITION_OPERATORS.FALSY).toBe('falsy');
  });
});

describe('NEXT_ACTIONS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(NEXT_ACTIONS)).toBe(true);
  });

  it('throws on mutation in strict mode', () => {
    expect(() => {
      (NEXT_ACTIONS as Record<string, string>).NEW_KEY = 'x';
    }).toThrow(TypeError);
  });

  it('has exactly 17 keys', () => {
    // Post-Iter 7: CREATE_PHASE_PLAN + CREATE_TASK_HANDOFF removed (per-loop authoring deleted).
    expect(Object.keys(NEXT_ACTIONS)).toHaveLength(17);
  });

  it('has expected keys', () => {
    const expectedKeys = [
      'SPAWN_REQUIREMENTS', 'SPAWN_MASTER_PLAN', 'EXPLODE_MASTER_PLAN',
      'REQUEST_PLAN_APPROVAL', 'GATE_TASK', 'GATE_PHASE', 'ASK_GATE_MODE', 'REQUEST_FINAL_APPROVAL',
      'EXECUTE_TASK', 'SPAWN_CODE_REVIEWER',
      'GENERATE_PHASE_REPORT', 'SPAWN_PHASE_REVIEWER', 'SPAWN_FINAL_REVIEWER',
      'INVOKE_SOURCE_CONTROL_COMMIT', 'INVOKE_SOURCE_CONTROL_PR',
      'DISPLAY_HALTED', 'DISPLAY_COMPLETE',
    ];
    for (const key of expectedKeys) {
      expect(NEXT_ACTIONS).toHaveProperty(key);
    }
  });

  it('has expected values', () => {
    expect(NEXT_ACTIONS.SPAWN_REQUIREMENTS).toBe('spawn_requirements');
    expect(NEXT_ACTIONS.SPAWN_MASTER_PLAN).toBe('spawn_master_plan');
    expect(NEXT_ACTIONS.EXPLODE_MASTER_PLAN).toBe('explode_master_plan');
    expect(NEXT_ACTIONS.REQUEST_PLAN_APPROVAL).toBe('request_plan_approval');
    expect(NEXT_ACTIONS.GATE_TASK).toBe('gate_task');
    expect(NEXT_ACTIONS.GATE_PHASE).toBe('gate_phase');
    expect(NEXT_ACTIONS.ASK_GATE_MODE).toBe('ask_gate_mode');
    expect(NEXT_ACTIONS.REQUEST_FINAL_APPROVAL).toBe('request_final_approval');
    expect(NEXT_ACTIONS.EXECUTE_TASK).toBe('execute_task');
    expect(NEXT_ACTIONS.SPAWN_CODE_REVIEWER).toBe('spawn_code_reviewer');
    expect(NEXT_ACTIONS.GENERATE_PHASE_REPORT).toBe('generate_phase_report');
    expect(NEXT_ACTIONS.SPAWN_PHASE_REVIEWER).toBe('spawn_phase_reviewer');
    expect(NEXT_ACTIONS.SPAWN_FINAL_REVIEWER).toBe('spawn_final_reviewer');
    expect(NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_COMMIT).toBe('invoke_source_control_commit');
    expect(NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_PR).toBe('invoke_source_control_pr');
    expect(NEXT_ACTIONS.DISPLAY_HALTED).toBe('display_halted');
    expect(NEXT_ACTIONS.DISPLAY_COMPLETE).toBe('display_complete');
  });
});

describe('EVENTS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(EVENTS)).toBe(true);
  });

  it('throws on mutation in strict mode', () => {
    expect(() => {
      (EVENTS as Record<string, string>).NEW_KEY = 'x';
    }).toThrow(TypeError);
  });

  it('has exactly 31 keys', () => {
    // Post-Iter 7: PHASE_PLANNING_STARTED / PHASE_PLAN_CREATED /
    // TASK_HANDOFF_STARTED / TASK_HANDOFF_CREATED removed (4 events).
    expect(Object.keys(EVENTS)).toHaveLength(31);
  });

  it('has expected keys', () => {
    const expectedKeys = [
      'REQUIREMENTS_STARTED', 'REQUIREMENTS_COMPLETED',
      'MASTER_PLAN_STARTED', 'MASTER_PLAN_COMPLETED',
      'EXPLOSION_STARTED', 'EXPLOSION_COMPLETED', 'EXPLOSION_FAILED',
      'PLAN_APPROVED', 'TASK_GATE_APPROVED', 'PHASE_GATE_APPROVED', 'FINAL_APPROVED',
      'EXECUTION_STARTED', 'TASK_COMPLETED',
      'CODE_REVIEW_STARTED', 'CODE_REVIEW_COMPLETED',
      'PHASE_REPORT_STARTED', 'PHASE_REPORT_CREATED',
      'PHASE_REVIEW_STARTED', 'PHASE_REVIEW_COMPLETED',
      'FINAL_REVIEW_STARTED', 'FINAL_REVIEW_COMPLETED',
      'COMMIT_STARTED', 'COMMIT_COMPLETED',
      'PR_REQUESTED', 'PR_CREATED',
      'PLAN_REJECTED', 'GATE_REJECTED', 'FINAL_REJECTED', 'HALT', 'GATE_MODE_SET', 'SOURCE_CONTROL_INIT',
    ];
    for (const key of expectedKeys) {
      expect(EVENTS).toHaveProperty(key);
    }
  });

  it('has expected values', () => {
    expect(EVENTS.REQUIREMENTS_STARTED).toBe('requirements_started');
    expect(EVENTS.REQUIREMENTS_COMPLETED).toBe('requirements_completed');
    expect(EVENTS.MASTER_PLAN_STARTED).toBe('master_plan_started');
    expect(EVENTS.MASTER_PLAN_COMPLETED).toBe('master_plan_completed');
    expect(EVENTS.EXPLOSION_STARTED).toBe('explosion_started');
    expect(EVENTS.EXPLOSION_COMPLETED).toBe('explosion_completed');
    expect(EVENTS.EXPLOSION_FAILED).toBe('explosion_failed');
    expect(EVENTS.PLAN_APPROVED).toBe('plan_approved');
    expect(EVENTS.TASK_GATE_APPROVED).toBe('task_gate_approved');
    expect(EVENTS.PHASE_GATE_APPROVED).toBe('phase_gate_approved');
    expect(EVENTS.FINAL_APPROVED).toBe('final_approved');
    expect(EVENTS.EXECUTION_STARTED).toBe('execution_started');
    expect(EVENTS.TASK_COMPLETED).toBe('task_completed');
    expect(EVENTS.CODE_REVIEW_STARTED).toBe('code_review_started');
    expect(EVENTS.CODE_REVIEW_COMPLETED).toBe('code_review_completed');
    expect(EVENTS.PHASE_REPORT_STARTED).toBe('phase_report_started');
    expect(EVENTS.PHASE_REPORT_CREATED).toBe('phase_report_created');
    expect(EVENTS.PHASE_REVIEW_STARTED).toBe('phase_review_started');
    expect(EVENTS.PHASE_REVIEW_COMPLETED).toBe('phase_review_completed');
    expect(EVENTS.FINAL_REVIEW_STARTED).toBe('final_review_started');
    expect(EVENTS.FINAL_REVIEW_COMPLETED).toBe('final_review_completed');
    expect(EVENTS.COMMIT_STARTED).toBe('commit_started');
    expect(EVENTS.COMMIT_COMPLETED).toBe('commit_completed');
    expect(EVENTS.PR_REQUESTED).toBe('pr_requested');
    expect(EVENTS.PR_CREATED).toBe('pr_created');
    expect(EVENTS.PLAN_REJECTED).toBe('plan_rejected');
    expect(EVENTS.GATE_REJECTED).toBe('gate_rejected');
    expect(EVENTS.FINAL_REJECTED).toBe('final_rejected');
    expect(EVENTS.HALT).toBe('halt');
    expect(EVENTS.GATE_MODE_SET).toBe('gate_mode_set');
    expect(EVENTS.SOURCE_CONTROL_INIT).toBe('source_control_init');
  });
});
