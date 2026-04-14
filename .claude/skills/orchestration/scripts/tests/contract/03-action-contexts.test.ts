import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createMockIO,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  completePlanningSteps,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  driveToReviewTier,
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
  TASKS_2,
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

// ── [CONTRACT] Planning spawn actions (full template: prd → research → design → …) ──

describe('[CONTRACT] Action Contexts — planning spawn actions (full template)', () => {
  // Note: step order is template-specific. The full template starts with prd,
  // followed by research. A different template (e.g. quick) may reorder these.

  it('first action is spawn_prd (prd is first node in full template)', () => {
    const io = createMockIO(null);
    const result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
  });

  it('spawn_research returns { step: "research" } (research follows prd in full template)', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('research_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_research');
    expect(result.context).toEqual({ step: 'research' });
  });

  it('spawn_design returns { step: "design" } (after completing prd)', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('design_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
  });

  it('spawn_architecture returns { step: "architecture" } (after completing design)', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('architecture_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
  });

  it('spawn_master_plan returns { step: "master_plan" } (after completing architecture)', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
  });
});

// ── [CONTRACT] Phase-level execution actions ──────────────────────────────────

describe('[CONTRACT] Action Contexts — phase-level execution actions', () => {
  it('create_phase_plan returns { phase_number: 1, phase_id: "P01" }', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
  });

  it('generate_phase_report returns { phase_number: 1, phase_id: "P01" }', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    // With one task and autonomous mode, driveTaskWith returns generate_phase_report
    const result = driveTaskWith(io, 1, 1);
    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
  });

  it('spawn_phase_reviewer returns { phase_number: 1, phase_id: "P01", phase_report_doc }', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    const result = processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1, doc_path: phaseReportDoc(1),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_phase_reviewer');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
    expect(typeof result.context.phase_report_doc).toBe('string');
    expect((result.context.phase_report_doc as string).length).toBeGreaterThan(0);
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
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1, doc_path: phaseReportDoc(1),
    }, io);
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
  it('create_task_handoff returns { phase_number: 1, phase_id: "P01", task_number: 1, task_id: "P01-T01", is_correction: false }', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1, doc_path: phasePlanDoc(1),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
      task_number: 1,
      task_id: 'P01-T01',
      is_correction: false,
    }));
  });

  it('execute_task returns { phase_number: 1, phase_id: "P01", task_number: 1, task_id: "P01-T01", handoff_doc }', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    const result = processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
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
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const result = processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
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
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    // Drive manually to code_review_completed without approving the gate
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const handoffDoc = taskHandoffDoc(1, 1);
    seedDoc(handoffDoc);
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);
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
    completePlanningSteps(state, 'architecture');
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const mpDocPath = '/tmp/master_plan.md';
    seedDoc(mpDocPath);
    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: mpDocPath }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');
    expect(result.context).toEqual({});
  });

  it('spawn_final_reviewer returns {}', () => {
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
    expect(result.context).toEqual({});
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
    seedDoc(frDocPath);
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
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
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
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
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1) }, io);
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
