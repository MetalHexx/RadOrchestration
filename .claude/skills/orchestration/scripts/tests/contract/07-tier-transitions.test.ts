import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  drivePhaseReviewApproval,
  codeReviewDoc,
} from '../fixtures/parity-states.js';

// ── Clear DOC_STORE between tests ─────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared autonomous config ──────────────────────────────────────────────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'never', auto_pr: 'never' },
});

// ── [CONTRACT] Tier Transitions — planning to execution ───────────────────────

describe('[CONTRACT] Tier Transitions — planning to execution', () => {
  it('plan_approved → execute_task for phase 1 / task 1 (2 phases) — phase_planning + task_handoff pre-seeded', () => {
    // driveToExecutionWithConfig pre-seeds the explosion-script post-condition,
    // so the walker advances directly to execute_task.
    const io = driveToExecutionWithConfig(config, 2);
    const result = processEvent('start', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
      task_number: 1,
      task_id: 'P01-T01',
    }));
  });
});

// ── [CONTRACT] Tier Transitions — task cycle to next task ─────────────────────

describe('[CONTRACT] Tier Transitions — task cycle to next task', () => {
  it('code_review_completed (approved) on task 1 of 2 → execute_task for task 2', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);

    // Task gate fires before advancing to the next task (even in autonomous mode)
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }

    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
    expect(result.context).toEqual(expect.objectContaining({
      task_number: 2,
      task_id: 'P01-T02',
    }));
  });

  it('code_review_completed (approved) on last task → spawn_phase_reviewer (post-Iter 8)', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);

    driveTaskWith(io, 1, 1);

    const ctx = { phase: 1, task: 2 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 2));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 2),
      verdict: 'approved',
    }, io);

    // Task gate fires before advancing to phase review (even in autonomous mode)
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_phase_reviewer');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
    }));
  });
});

// ── [CONTRACT] Tier Transitions — phase completion to next phase ──────────────

describe('[CONTRACT] Tier Transitions — phase completion to next phase', () => {
  it('phase_review_completed (approved) on phase 1 of 2 → execute_task for phase 2', () => {
    const io = driveToExecutionWithConfig(config, 2, 2);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    drivePhaseReviewApproval(io, 1);

    // Walker advances directly into phase 2's first execute_task
    const result = processEvent('start', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 2,
      phase_id: 'P02',
    }));
  });

  it('phase_review_completed (approved) on last phase → pipeline reaches review tier', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    drivePhaseReviewApproval(io, 1);

    const result = processEvent('final_review_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');
    expect(result.context).toEqual({});
  });

  it('final_approved → display_complete', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    drivePhaseReviewApproval(io, 1);

    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');
    expect(result.context).toEqual({});
  });
});
