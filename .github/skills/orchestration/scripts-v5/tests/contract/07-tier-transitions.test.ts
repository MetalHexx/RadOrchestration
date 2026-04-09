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
  drivePhaseReviewApproval,
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
  TASKS_2,
} from '../fixtures/parity-states.js';
import type { StepNodeState } from '../../lib/types.js';

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
  it('plan_approved → create_phase_plan for phase 1 (2 phases)', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('research_started', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 2 });

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
  });

  it('plan_approved → first action targets phase 1 even with 3 phases', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('research_started', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 3 });

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
  });
});

// ── [CONTRACT] Tier Transitions — task cycle to next task ─────────────────────

describe('[CONTRACT] Tier Transitions — task cycle to next task', () => {
  it('code_review_completed (approved) on task 1 of 2 → create_task_handoff for task 2', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approve',
    }, io);

    // Task gate fires before advancing to the next task (even in autonomous mode)
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');
    expect(result.context).toEqual(expect.objectContaining({
      task_number: 2,
      task_id: 'P01-T02',
    }));
  });

  it('code_review_completed (approved) on last task → generate_phase_report', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);

    const ctx = { phase: 1, task: 2 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 2));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 2) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 2));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 2),
      verdict: 'approve',
    }, io);

    // Task gate fires before advancing to phase report (even in autonomous mode)
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }

    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
    }));
  });
});

// ── [CONTRACT] Tier Transitions — phase completion to next phase ──────────────

describe('[CONTRACT] Tier Transitions — phase completion to next phase', () => {
  it('phase_review_completed (approved) on phase 1 of 2 → create_phase_plan for phase 2', () => {
    const io = driveToExecutionWithConfig(config, 2);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    drivePhaseReviewApproval(io, 1);

    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 2 }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 2,
      phase_id: 'P02',
    }));
  });

  it('phase_review_completed (approved) on last phase → pipeline reaches review tier', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    drivePhaseReviewApproval(io, 1);

    const result = processEvent('final_review_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');
    expect(result.context).toEqual({});
  });

  it('final_approved → display_complete', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

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
