import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createMockIOWithConfig,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  completePlanningSteps,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
  TASKS_2,
} from '../fixtures/parity-states.js';
import type { MockIO } from '../fixtures/parity-states.js';
import type { StepNodeState, ForEachPhaseNodeState, PipelineResult } from '../../lib/types.js';

// ── Clear DOC_STORE between tests ─────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode auto-approves task and phase gates) ─────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
});

// ── Local helpers ──────────────────────────────────────────────────────────────

/**
 * Drives a single task through handoff → execute → review with a configurable
 * verdict string (NOT hard-coded to 'approve').
 */
function driveTaskWithVerdict(
  io: MockIO,
  phase: number,
  task: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase, task };
  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
  const handoff = taskHandoffDoc(phase, task);
  seedDoc(handoff);
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoff }, io);
  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('execution_completed', PROJECT_DIR, ctx, io);
  processEvent('code_review_started', PROJECT_DIR, ctx, io);
  const review = codeReviewDoc(phase, task);
  seedDoc(review);
  return processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx, doc_path: review, verdict,
  }, io);
}

/**
 * Drives a corrective task through the same handoff → execute → review cycle.
 * Uses the same {phase, task} context because the engine's mutations route to
 * the latest corrective task's nodes via resolveNodeState.
 */
function driveCorrectiveTask(
  io: MockIO,
  phase: number,
  task: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase, task };
  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
  const handoff = taskHandoffDoc(phase, task);
  seedDoc(handoff);
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoff }, io);
  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('execution_completed', PROJECT_DIR, ctx, io);
  processEvent('code_review_started', PROJECT_DIR, ctx, io);
  const review = codeReviewDoc(phase, task);
  seedDoc(review);
  return processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx, doc_path: review, verdict,
  }, io);
}

// ── [CONTRACT] Normal create_task_handoff ─────────────────────────────────────

describe('[CONTRACT] Corrective Cycles — normal create_task_handoff', () => {
  it('normal create_task_handoff context includes is_correction: false, no previous_review, no reason', () => {
    const io = driveToExecutionWithConfig(config, 1);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1, doc_path: phasePlanDoc(1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');
    expect(result.context).toEqual(expect.objectContaining({
      is_correction: false,
    }));
    expect(result.context).not.toHaveProperty('previous_review');
    expect(result.context).not.toHaveProperty('reason');
  });
});

// ── [CONTRACT] Corrective create_task_handoff ──────────────────────────────────

describe('[CONTRACT] Corrective Cycles — corrective create_task_handoff', () => {
  it('corrective create_task_handoff context includes is_correction: true, previous_review (non-empty), reason (non-empty)', () => {
    const io = driveToExecutionWithConfig(config, 1);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1, doc_path: phasePlanDoc(1),
    }, io);

    // Drive task 1 with changes_requested — result is corrective create_task_handoff
    const result = driveTaskWithVerdict(io, 1, 1, 'changes_requested');

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');
    expect(result.context).toEqual(expect.objectContaining({
      is_correction: true,
    }));
    expect(typeof result.context['previous_review']).toBe('string');
    expect((result.context['previous_review'] as string).length).toBeGreaterThan(0);
    expect(typeof result.context['reason']).toBe('string');
    expect((result.context['reason'] as string).length).toBeGreaterThan(0);
  });
});

// ── [CONTRACT] Normal create_phase_plan ───────────────────────────────────────

describe('[CONTRACT] Corrective Cycles — normal create_phase_plan', () => {
  it('normal create_phase_plan context does NOT have an is_correction property', () => {
    const io = driveToExecutionWithConfig(config, 2);

    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    expect(result.context).not.toHaveProperty('is_correction');
  });
});

// ── [CONTRACT] Corrective create_phase_plan ────────────────────────────────────

describe('[CONTRACT] Corrective Cycles — corrective create_phase_plan', () => {
  it('corrective create_phase_plan context includes is_correction: true and previous_review (non-empty)', () => {
    const io = driveToExecutionWithConfig(config, 1);

    // Set phase_review to completed on the active phase iteration to simulate the
    // corrective path. The v5 engine does not naturally re-enter create_phase_plan
    // after a phase_review; this setup verifies the enrichment logic directly.
    const state = io.currentState!;
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    const phaseReview = phaseIter.nodes['phase_review'] as StepNodeState;
    phaseReview.status = 'completed';
    phaseReview.doc_path = phaseReviewDoc(1);

    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    expect(result.context).toEqual(expect.objectContaining({
      is_correction: true,
    }));
    expect(typeof result.context['previous_review']).toBe('string');
    expect((result.context['previous_review'] as string).length).toBeGreaterThan(0);
  });
});

// ── [CONTRACT] Multi-retry corrective persistence ──────────────────────────────

describe('[CONTRACT] Corrective Cycles — multi-retry persistence', () => {
  it('corrective fields persist across consecutive changes_requested verdicts', () => {
    const io = driveToExecutionWithConfig(config, 1);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1, doc_path: phasePlanDoc(1),
    }, io);

    // First changes_requested → corrective create_task_handoff
    const firstResult = driveTaskWithVerdict(io, 1, 1, 'changes_requested');
    expect(firstResult.success).toBe(true);
    expect(firstResult.action).toBe('create_task_handoff');
    expect(firstResult.context['is_correction']).toBe(true);

    // Second changes_requested (from corrective) → another corrective create_task_handoff
    const secondResult = driveCorrectiveTask(io, 1, 1, 'changes_requested');
    expect(secondResult.success).toBe(true);
    expect(secondResult.action).toBe('create_task_handoff');
    expect(secondResult.context['is_correction']).toBe(true);
    expect(typeof secondResult.context['previous_review']).toBe('string');
    expect((secondResult.context['previous_review'] as string).length).toBeGreaterThan(0);
    expect(typeof secondResult.context['reason']).toBe('string');
    expect((secondResult.context['reason'] as string).length).toBeGreaterThan(0);
  });
});
