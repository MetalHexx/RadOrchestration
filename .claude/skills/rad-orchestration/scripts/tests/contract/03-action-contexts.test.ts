import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createMockIO,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  driveToReviewTier,
  codeReviewDoc,
  phaseReviewDoc,
} from '../fixtures/parity-states.js';
import type { StepNodeState } from '../../lib/types.js';
import { formatPhaseId, formatTaskId } from '../../lib/context-enrichment.js';

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode auto-approves task and phase gates) ────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
});

// ── [CONTRACT] formatPhaseId helper ──────────────────────────────────────────

describe('[CONTRACT] Action Contexts — formatPhaseId helper', () => {
  it('formatPhaseId(1) returns P01', () => {
    expect(formatPhaseId(1)).toBe('P01');
  });

  it('formatPhaseId(12) returns P12', () => {
    expect(formatPhaseId(12)).toBe('P12');
  });
});

// ── [CONTRACT] formatTaskId helper ───────────────────────────────────────────

describe('[CONTRACT] Action Contexts — formatTaskId helper', () => {
  it('formatTaskId(1, 1) returns P01-T01', () => {
    expect(formatTaskId(1, 1)).toBe('P01-T01');
  });

  it('formatTaskId(3, 12) returns P03-T12', () => {
    expect(formatTaskId(3, 12)).toBe('P03-T12');
  });
});

// ── [CONTRACT] Planning spawn actions (full template: master_plan only) ──

describe('[CONTRACT] Action Contexts — planning spawn actions (full template)', () => {
  // Planning-spawn context carries `repository_skills_block` (string) so the
  // orchestrator can inline the repo-skills manifest into the planner spawn
  // prompt. Value is content-dependent on the invoking repo, so we assert the
  // contract shape (string field present) rather than literal text.
  it('first action is spawn_master_plan (master_plan is first planning node in full template)', () => {
    const io = createMockIO(null);
    const result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    const ctx = result.context as Record<string, unknown>;
    expect(ctx.step).toBe('master_plan');
    expect(typeof ctx.repository_skills_block).toBe('string');
    expect(Object.keys(ctx).sort()).toEqual(['repository_skills_block', 'step']);
  });

  it('spawn_master_plan returns { step: "master_plan", repository_skills_block: <string> }', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    const ctx = result.context as Record<string, unknown>;
    expect(ctx.step).toBe('master_plan');
    expect(typeof ctx.repository_skills_block).toBe('string');
    expect(Object.keys(ctx).sort()).toEqual(['repository_skills_block', 'step']);
  });
});

// ── [CONTRACT] Phase-level execution actions ──────────────────────────────────

describe('[CONTRACT] Action Contexts — phase-level execution actions', () => {
  it('spawn_phase_reviewer returns { phase_number: 1, phase_id: "P01", phase_first_sha, phase_head_sha }', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);
    driveTaskWith(io, 1, 1);
    // With both tasks complete and autonomous mode, second driveTaskWith returns spawn_phase_reviewer (post-Iter 8)
    const result = driveTaskWith(io, 1, 2);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_phase_reviewer');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
    // phase_report_doc was dropped post-Iter 8 (phase_review absorbs phase_report).
    expect(result.context).not.toHaveProperty('phase_report_doc');
    expect(
      typeof result.context.phase_first_sha === 'string' || result.context.phase_first_sha === null,
    ).toBe(true);
    expect(
      typeof result.context.phase_head_sha === 'string' || result.context.phase_head_sha === null,
    ).toBe(true);
  });

  it('gate_phase returns { phase_number: 1, phase_id: "P01" } (execution_mode=task)', () => {
    const taskConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'task',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(taskConfig, 1);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
  });
});

// ── [CONTRACT] Task-level execution actions ───────────────────────────────────

describe('[CONTRACT] Action Contexts — task-level execution actions', () => {
  it('execute_task returns { phase_number: 1, phase_id: "P01", task_number: 1, task_id: "P01-T01", handoff_doc }', () => {
    // driveToExecutionWithConfig pre-seeds task_handoff with doc_path; walker advances directly to execute_task.
    const io = driveToExecutionWithConfig(config, 1);
    const result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
      task_number: 1,
      task_id: 'P01-T01',
    }));
    expect(typeof result.context.handoff_doc).toBe('string');
    expect((result.context.handoff_doc as string).length).toBeGreaterThan(0);
  });

  it('spawn_code_reviewer returns { phase_number: 1, phase_id: "P01", task_number: 1, task_id: "P01-T01" }', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('commit_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const result = processEvent('commit_completed', PROJECT_DIR, {
      phase: 1, task: 1, commit_hash: 'abc123', pushed: 'false',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_code_reviewer');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
      task_number: 1,
      task_id: 'P01-T01',
    }));
  });

  it('gate_task returns { phase_number: 1, phase_id: "P01", task_number: 1, task_id: "P01-T01" } (execution_mode=task)', () => {
    const taskConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'task',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(taskConfig, 1);
    // Drive manually to code_review_completed without approving the gate
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const reviewDoc = codeReviewDoc(1, 1);
    seedDoc(reviewDoc);
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: reviewDoc, verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_task');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
      task_number: 1,
      task_id: 'P01-T01',
    }));
  });
});

// ── [CONTRACT] Empty-context and terminal actions ─────────────────────────────

describe('[CONTRACT] Action Contexts — empty-context and terminal actions', () => {
  it('request_plan_approval returns {}', () => {
    // Drive planning steps via state mutation + master_plan_completed event
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const mpDocPath = '/tmp/master_plan.md';
    seedDoc(mpDocPath);
    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: mpDocPath }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');
    expect(result.context).toEqual({});
  });

  it('spawn_final_reviewer returns { project_base_sha: null, project_head_sha: null } (no commits)', () => {
    // Iter-12: spawn_final_reviewer moved off EMPTY_CONTEXT_ACTIONS and now
    // derives `project_base_sha` + `project_head_sha` at enrichment time from
    // iteration commit_hash values across the whole pipeline. In this fixture
    // (driveToReviewTier with auto_commit: 'never') no task commits exist, so
    // both SHAs are null and the reviewer falls back to `git diff HEAD` +
    // untracked files.
    const reviewConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(reviewConfig);
    const result = processEvent('final_review_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');
    expect(result.context).toEqual({ project_base_sha: null, project_head_sha: null });
  });

  it('request_final_approval returns { pr_url: null } when no source control is populated', () => {
    const reviewConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(reviewConfig);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath, { verdict: 'approved' });
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath, verdict: 'approved' }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('request_final_approval');
    expect(result.context).toEqual({ pr_url: null });
  });

  it('display_complete returns {}', () => {
    const reviewConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(reviewConfig);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath, { verdict: 'approved' });
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath, verdict: 'approved' }, io);
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');
    expect(result.context).toEqual({});
  });

  it.todo(
    'ask_gate_mode returns {} — v5 divergence: v5 never emits ask_gate_mode; ' +
    'gate_mode is set at scaffold time; "ask" mode fires gate_task via task_gate instead',
  );
});

// ── [CONTRACT] Action Contexts — display_halted ───────────────────────────────

describe('[CONTRACT] Action Contexts — display_halted', () => {
  it('display_halted context includes details as a string', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('code_review_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(codeReviewDoc(1, 1), { verdict: 'rejected' });
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: codeReviewDoc(1, 1), verdict: 'rejected',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(typeof result.context.details).toBe('string');
    expect((result.context.details as string).length).toBeGreaterThan(0);
  });
});
