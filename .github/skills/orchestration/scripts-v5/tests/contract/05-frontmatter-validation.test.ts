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
import { StepNodeState } from '../../lib/types.js';

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode auto-approves task gates) ──────────────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
});

// ── Drive helpers ─────────────────────────────────────────────────────────────

/** Returns MockIO positioned for phase_plan_created. */
function driveToPhaseCreated() {
  const io = driveToExecutionWithConfig(config, 1);
  processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
  return io;
}

/** Returns MockIO positioned for code_review_completed (T1, P1). */
function driveToCodeReview() {
  const io = driveToPhaseCreated();
  seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
  processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
  const ctx = { phase: 1, task: 1 };
  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
  seedDoc(taskHandoffDoc(1, 1));
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('execution_completed', PROJECT_DIR, ctx, io);
  processEvent('code_review_started', PROJECT_DIR, ctx, io);
  return io;
}

/** Returns MockIO positioned for phase_review_completed. */
function driveToPhaseReview() {
  const io = driveToPhaseCreated();
  seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
  processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
  driveTaskWith(io, 1, 1);
  processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
  seedDoc(phaseReportDoc(1));
  processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
  processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
  return io;
}

// ── Group 1: tasks (phase_plan_created) ──────────────────────────────────────

describe('[CONTRACT] Frontmatter — tasks (phase_plan_created)', () => {
  it('valid non-empty array passes', () => {
    const io = driveToPhaseCreated();
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    const result = processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    expect(result.success).toBe(true);
  });

  it('missing tasks → error', () => {
    const io = driveToPhaseCreated();
    seedDoc(phasePlanDoc(1), {});
    const result = processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('tasks');
    expect(result.error?.event).toBe('phase_plan_created');
  });

  it('tasks is not an array → error', () => {
    const io = driveToPhaseCreated();
    seedDoc(phasePlanDoc(1), { tasks: 'not-an-array' });
    const result = processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Invalid value: tasks must be an array');
    expect(result.error?.field).toBe('tasks');
  });

  it('empty array → error', () => {
    const io = driveToPhaseCreated();
    seedDoc(phasePlanDoc(1), { tasks: [] });
    const result = processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Invalid value: tasks must be a non-empty array');
    expect(result.error?.field).toBe('tasks');
  });
});

// ── Group 2: verdict (code_review_completed) ──────────────────────────────────

describe('[CONTRACT] Frontmatter — verdict (code_review_completed)', () => {
  it('present value passes', () => {
    const io = driveToCodeReview();
    seedDoc(codeReviewDoc(1, 1), { verdict: 'approved' });
    const result = processEvent('code_review_completed', PROJECT_DIR, { phase: 1, task: 1, doc_path: codeReviewDoc(1, 1) }, io);
    expect(result.success).toBe(true);
  });

  it("string 'null' coerced → error", () => {
    const io = driveToCodeReview();
    seedDoc(codeReviewDoc(1, 1), { verdict: 'null' });
    const result = processEvent('code_review_completed', PROJECT_DIR, { phase: 1, task: 1, doc_path: codeReviewDoc(1, 1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
    expect(result.error?.event).toBe('code_review_completed');
  });

  it('missing verdict → error', () => {
    const io = driveToCodeReview();
    seedDoc(codeReviewDoc(1, 1), {});
    const result = processEvent('code_review_completed', PROJECT_DIR, { phase: 1, task: 1, doc_path: codeReviewDoc(1, 1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
  });
});

// ── Group 3: verdict (phase_review_completed) ─────────────────────────────────

describe('[CONTRACT] Frontmatter — verdict (phase_review_completed)', () => {
  it('present value passes', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(true);
  });

  it("string 'null' coerced → error", () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'null', exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
  });

  it('missing verdict → error', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
  });
});

// ── Group 4: exit_criteria_met (phase_review_completed) ───────────────────────

describe('[CONTRACT] Frontmatter — exit_criteria_met (phase_review_completed)', () => {
  it('present value passes', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(true);
  });

  it('missing exit_criteria_met → error', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved' });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('exit_criteria_met');
    expect(result.error?.event).toBe('phase_review_completed');
  });

  it('explicit null → error', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: null });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('exit_criteria_met');
  });
});

// ── Group 5: total_phases (plan_approved) ─────────────────────────────────────

describe('[CONTRACT] Frontmatter — total_phases (plan_approved)', () => {
  function scaffoldForPlanApproved() {
    const io = createMockIOWithConfig(null, config);
    processEvent('research_started', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    return { io, mpDoc };
  }

  it('valid positive integer passes', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 2 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('zero → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 0 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('negative → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: -1 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('string → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 'three' });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('float → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 3.5 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('missing → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, {});
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });
});
