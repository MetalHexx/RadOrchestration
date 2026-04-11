/**
 * Tests for P01-T01: Types & Constants Foundation
 * Verifies new interfaces in types.ts and renamed/new constants in constants.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  EVENTS,
  OUT_OF_BAND_EVENTS,
  REVIEW_VERDICTS,
  VALID_VERDICTS,
  ALLOWED_NODE_TRANSITIONS,
} from '../lib/constants.js';
import type {
  SourceControlState,
  PipelineSection,
  PipelineState,
} from '../lib/types.js';

// ── SourceControlState interface ──────────────────────────────────────────────

describe('SourceControlState interface', () => {
  it('is exported and can be used as a type annotation with all 8 required fields', () => {
    const state: SourceControlState = {
      branch: 'feature/test',
      base_branch: 'main',
      worktree_path: '/tmp/wt',
      auto_commit: 'never',
      auto_pr: 'never',
      remote_url: null,
      compare_url: null,
      pr_url: null,
    };
    expect(state.branch).toBe('feature/test');
    expect(state.base_branch).toBe('main');
    expect(state.worktree_path).toBe('/tmp/wt');
    expect(state.auto_commit).toBe('never');
    expect(state.auto_pr).toBe('never');
    expect(state.remote_url).toBeNull();
    expect(state.compare_url).toBeNull();
    expect(state.pr_url).toBeNull();
  });

  it('accepts non-null string values for nullable fields', () => {
    const state: SourceControlState = {
      branch: 'main',
      base_branch: 'main',
      worktree_path: '/tmp/wt',
      auto_commit: 'always',
      auto_pr: 'always',
      remote_url: 'https://github.com/org/repo',
      compare_url: 'https://github.com/org/repo/compare',
      pr_url: 'https://github.com/org/repo/pull/1',
    };
    expect(state.remote_url).toBe('https://github.com/org/repo');
    expect(state.compare_url).toBe('https://github.com/org/repo/compare');
    expect(state.pr_url).toBe('https://github.com/org/repo/pull/1');
  });
});

// ── PipelineSection interface ─────────────────────────────────────────────────

describe('PipelineSection interface', () => {
  it('is exported and can be used as a type annotation with all 4 fields', () => {
    const section: PipelineSection = {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    };
    expect(section.gate_mode).toBeNull();
    expect(section.source_control).toBeNull();
    expect(section.current_tier).toBe('planning');
    expect(section.halt_reason).toBeNull();
  });

  it('accepts non-null values for nullable fields', () => {
    const scState: SourceControlState = {
      branch: 'main',
      base_branch: 'main',
      worktree_path: '/tmp/wt',
      auto_commit: 'never',
      auto_pr: 'never',
      remote_url: null,
      compare_url: null,
      pr_url: null,
    };
    const section: PipelineSection = {
      gate_mode: 'autonomous',
      source_control: scState,
      current_tier: 'execution',
      halt_reason: 'too many rejections',
    };
    expect(section.gate_mode).toBe('autonomous');
    expect(section.source_control).toBe(scState);
    expect(section.current_tier).toBe('execution');
    expect(section.halt_reason).toBe('too many rejections');
  });
});

// ── PipelineState includes pipeline field ─────────────────────────────────────

describe('PipelineState.pipeline field', () => {
  it('includes a pipeline: PipelineSection field between config and graph', () => {
    // TypeScript type-check: construct a valid PipelineState
    const state: PipelineState = {
      $schema: 'orchestration-state-v5',
      project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
      config: {
        gate_mode: 'autonomous',
        limits: {
          max_phases: 10,
          max_tasks_per_phase: 20,
          max_retries_per_task: 3,
          max_consecutive_review_rejections: 2,
        },
        source_control: { auto_commit: 'never', auto_pr: 'never' },
      },
      pipeline: {
        gate_mode: null,
        source_control: null,
        current_tier: 'planning',
        halt_reason: null,
      },
      graph: {
        template_id: 'default',
        status: 'not_started',
        current_node_path: null,
        nodes: {},
      },
    };
    expect(state.pipeline).toBeDefined();
    expect(state.pipeline.current_tier).toBe('planning');
  });
});

// ── EVENTS renamed entries ────────────────────────────────────────────────────

describe('EVENTS — renamed v5 keys to v4 canonical names', () => {
  it('TASK_COMPLETED is "task_completed"', () => {
    expect(EVENTS.TASK_COMPLETED).toBe('task_completed');
  });

  it('PHASE_REPORT_CREATED is "phase_report_created"', () => {
    expect(EVENTS.PHASE_REPORT_CREATED).toBe('phase_report_created');
  });

  it('FINAL_APPROVED is "final_approved"', () => {
    expect(EVENTS.FINAL_APPROVED).toBe('final_approved');
  });

  it('COMMIT_STARTED is "commit_started"', () => {
    expect(EVENTS.COMMIT_STARTED).toBe('commit_started');
  });

  it('COMMIT_COMPLETED is "commit_completed"', () => {
    expect(EVENTS.COMMIT_COMPLETED).toBe('commit_completed');
  });

  it('PR_REQUESTED is "pr_requested"', () => {
    expect(EVENTS.PR_REQUESTED).toBe('pr_requested');
  });

  it('PR_CREATED is "pr_created"', () => {
    expect(EVENTS.PR_CREATED).toBe('pr_created');
  });
});

describe('EVENTS — old v5 keys no longer exist', () => {
  it('EXECUTION_COMPLETED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['EXECUTION_COMPLETED']).toBeUndefined();
  });

  it('PHASE_REPORT_COMPLETED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['PHASE_REPORT_COMPLETED']).toBeUndefined();
  });

  it('FINAL_REVIEW_APPROVED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['FINAL_REVIEW_APPROVED']).toBeUndefined();
  });

  it('SOURCE_CONTROL_COMMIT_STARTED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['SOURCE_CONTROL_COMMIT_STARTED']).toBeUndefined();
  });

  it('SOURCE_CONTROL_COMMIT_COMPLETED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['SOURCE_CONTROL_COMMIT_COMPLETED']).toBeUndefined();
  });

  it('SOURCE_CONTROL_PR_STARTED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['SOURCE_CONTROL_PR_STARTED']).toBeUndefined();
  });

  it('SOURCE_CONTROL_PR_COMPLETED does not exist', () => {
    expect((EVENTS as Record<string, unknown>)['SOURCE_CONTROL_PR_COMPLETED']).toBeUndefined();
  });
});

describe('EVENTS — new out-of-band entries', () => {
  it('PLAN_REJECTED is "plan_rejected"', () => {
    expect(EVENTS.PLAN_REJECTED).toBe('plan_rejected');
  });

  it('GATE_REJECTED is "gate_rejected"', () => {
    expect(EVENTS.GATE_REJECTED).toBe('gate_rejected');
  });

  it('FINAL_REJECTED is "final_rejected"', () => {
    expect(EVENTS.FINAL_REJECTED).toBe('final_rejected');
  });

  it('HALT is "halt"', () => {
    expect(EVENTS.HALT).toBe('halt');
  });

  it('GATE_MODE_SET is "gate_mode_set"', () => {
    expect(EVENTS.GATE_MODE_SET).toBe('gate_mode_set');
  });

  it('SOURCE_CONTROL_INIT is "source_control_init"', () => {
    expect(EVENTS.SOURCE_CONTROL_INIT).toBe('source_control_init');
  });
});

// ── OUT_OF_BAND_EVENTS ────────────────────────────────────────────────────────

describe('OUT_OF_BAND_EVENTS', () => {
  it('is a Set', () => {
    expect(OUT_OF_BAND_EVENTS).toBeInstanceOf(Set);
  });

  it('has exactly 6 entries', () => {
    expect(OUT_OF_BAND_EVENTS.size).toBe(6);
  });

  it('contains all 6 out-of-band event strings', () => {
    expect(OUT_OF_BAND_EVENTS.has('plan_rejected')).toBe(true);
    expect(OUT_OF_BAND_EVENTS.has('gate_rejected')).toBe(true);
    expect(OUT_OF_BAND_EVENTS.has('final_rejected')).toBe(true);
    expect(OUT_OF_BAND_EVENTS.has('halt')).toBe(true);
    expect(OUT_OF_BAND_EVENTS.has('gate_mode_set')).toBe(true);
    expect(OUT_OF_BAND_EVENTS.has('source_control_init')).toBe(true);
  });
});

// ── REVIEW_VERDICTS ───────────────────────────────────────────────────────────

describe('REVIEW_VERDICTS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(REVIEW_VERDICTS)).toBe(true);
  });

  it('has APPROVED: "approved"', () => {
    expect(REVIEW_VERDICTS.APPROVED).toBe('approved');
  });

  it('has CHANGES_REQUESTED: "changes_requested"', () => {
    expect(REVIEW_VERDICTS.CHANGES_REQUESTED).toBe('changes_requested');
  });

  it('has REJECTED: "rejected"', () => {
    expect(REVIEW_VERDICTS.REJECTED).toBe('rejected');
  });

  it('has exactly 3 entries', () => {
    expect(Object.keys(REVIEW_VERDICTS)).toHaveLength(3);
  });
});

// ── VALID_VERDICTS ────────────────────────────────────────────────────────────

describe('VALID_VERDICTS', () => {
  it('is a Set', () => {
    expect(VALID_VERDICTS).toBeInstanceOf(Set);
  });

  it('has exactly 3 entries', () => {
    expect(VALID_VERDICTS.size).toBe(3);
  });

  it('contains "approved"', () => {
    expect(VALID_VERDICTS.has('approved')).toBe(true);
  });

  it('contains "changes_requested"', () => {
    expect(VALID_VERDICTS.has('changes_requested')).toBe(true);
  });

  it('contains "rejected"', () => {
    expect(VALID_VERDICTS.has('rejected')).toBe(true);
  });
});

// ── ALLOWED_NODE_TRANSITIONS ──────────────────────────────────────────────────

describe('ALLOWED_NODE_TRANSITIONS', () => {
  it('is a Map', () => {
    expect(ALLOWED_NODE_TRANSITIONS).toBeInstanceOf(Map);
  });

  it('has exactly 6 entries', () => {
    expect(ALLOWED_NODE_TRANSITIONS.size).toBe(6);
  });

  it('not_started can transition to in_progress, skipped, completed', () => {
    const transitions = ALLOWED_NODE_TRANSITIONS.get('not_started');
    expect(transitions).toBeDefined();
    expect(transitions!.has('in_progress')).toBe(true);
    expect(transitions!.has('skipped')).toBe(true);
    expect(transitions!.has('completed')).toBe(true);
    expect(transitions!.size).toBe(3);
  });

  it('in_progress can transition to completed, failed, halted', () => {
    const transitions = ALLOWED_NODE_TRANSITIONS.get('in_progress');
    expect(transitions).toBeDefined();
    expect(transitions!.has('completed')).toBe(true);
    expect(transitions!.has('failed')).toBe(true);
    expect(transitions!.has('halted')).toBe(true);
    expect(transitions!.size).toBe(3);
  });

  it('completed can transition to not_started, in_progress', () => {
    const transitions = ALLOWED_NODE_TRANSITIONS.get('completed');
    expect(transitions).toBeDefined();
    expect(transitions!.has('not_started')).toBe(true);
    expect(transitions!.has('in_progress')).toBe(true);
    expect(transitions!.size).toBe(2);
  });

  it('failed can transition to in_progress only', () => {
    const transitions = ALLOWED_NODE_TRANSITIONS.get('failed');
    expect(transitions).toBeDefined();
    expect(transitions!.has('in_progress')).toBe(true);
    expect(transitions!.size).toBe(1);
  });

  it('halted has no allowed transitions', () => {
    const transitions = ALLOWED_NODE_TRANSITIONS.get('halted');
    expect(transitions).toBeDefined();
    expect(transitions!.size).toBe(0);
  });

  it('skipped has no allowed transitions', () => {
    const transitions = ALLOWED_NODE_TRANSITIONS.get('skipped');
    expect(transitions).toBeDefined();
    expect(transitions!.size).toBe(0);
  });
});
