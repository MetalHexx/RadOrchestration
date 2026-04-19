import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createMockIO,
  createMockIOWithConfig,
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

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared configs ────────────────────────────────────────────────────────────

// Default: autonomous mode, no source-control side-effects
const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'never', auto_pr: 'never' },
});

// Task-gate mode: gate_task fires after code_review_completed
const taskGateConfig = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'task',
    after_final_review: true,
  },
  source_control: { auto_commit: 'never' },
});

// Commit config: gate_phase fires then invoke_source_control_commit
const commitConfig = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'always', auto_pr: 'never' },
});

// PR config: after final_approved → invoke_source_control_pr
const prConfig = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'always', auto_pr: 'always' },
});

// ── [CONTRACT] Event Names — planning tier events ─────────────────────────────

describe('[CONTRACT] Event Names — planning tier events', () => {
  it('master_plan_started is a valid v5 event', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('master_plan_completed is a valid v5 event', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = '/tmp/master_plan.md';
    seedDoc(docPath, { total_phases: 1 });
    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — gate events ──────────────────────────────────────

describe('[CONTRACT] Event Names — gate events', () => {
  it('plan_approved is a valid v5 event', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 2 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('task_gate_approved is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(taskGateConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    const gateResult = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);
    expect(gateResult.action).toBe('gate_task');
    const result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('phase_gate_approved is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(taskGateConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const gateResult = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);
    expect(gateResult.action).toBe('gate_phase');
    const result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('final_approved is a valid v5 event', () => {
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
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — phase execution events ───────────────────────────

describe('[CONTRACT] Event Names — phase execution events', () => {
  it('phase_planning_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('phase_plan_created is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1, doc_path: phasePlanDoc(1),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — task execution events ────────────────────────────

describe('[CONTRACT] Event Names — task execution events', () => {
  it('task_handoff_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    const result = processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('task_handoff_created is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    const result = processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('execution_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
    const result = processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('task_completed is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const result = processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('code_review_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const result = processEvent('code_review_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('code_review_completed is a valid v5 event', () => {
    // Autonomous mode: no task gate fires, code_review_completed advances to next state
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: taskHandoffDoc(1, 1),
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('code_review_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(codeReviewDoc(1, 1));
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1, task: 1, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — phase review events ──────────────────────────────

describe('[CONTRACT] Event Names — phase review events', () => {
  it('phase_report_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    const result = processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('phase_report_created is a valid v5 event', () => {
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
    expect(result.action).not.toBeNull();
  });

  it('phase_review_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1, doc_path: phaseReportDoc(1),
    }, io);
    const result = processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('phase_review_completed is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(config, 1);
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
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — final review events ──────────────────────────────

describe('[CONTRACT] Event Names — final review events', () => {
  it('final_review_started is a valid v5 event', () => {
    const io = driveToReviewTier(config);
    const result = processEvent('final_review_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('final_review_completed is a valid v5 event', () => {
    const io = driveToReviewTier(config);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — source control events ────────────────────────────

describe('[CONTRACT] Event Names — source control events', () => {
  it('commit_started is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    // Drive task manually up to task_completed to reach commit_gate (commit runs before code_review)
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    const r = processEvent('task_completed', PROJECT_DIR, ctx, io);
    expect(r.action).toBe('invoke_source_control_commit');
    const result = processEvent('commit_started', PROJECT_DIR, ctx, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('commit_completed is a valid v5 event', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    // Drive task manually up to task_completed to reach commit_gate (commit runs before code_review)
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    const r = processEvent('task_completed', PROJECT_DIR, ctx, io);
    expect(r.action).toBe('invoke_source_control_commit');
    processEvent('commit_started', PROJECT_DIR, ctx, io);
    const result = processEvent('commit_completed', PROJECT_DIR, ctx, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('pr_requested is a valid v5 event', () => {
    const io = driveToReviewTier(prConfig);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    const invokeResult = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(invokeResult.action).toBe('invoke_source_control_pr');
    const result = processEvent('pr_requested', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('pr_created is a valid v5 event', () => {
    const io = driveToReviewTier(prConfig);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    const invokeResult = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(invokeResult.action).toBe('invoke_source_control_pr');
    processEvent('pr_requested', PROJECT_DIR, {}, io);
    const result = processEvent('pr_created', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── [CONTRACT] Event Names — unknown / invalid event names ────────────────────

describe('[CONTRACT] Event Names — unknown / invalid event names', () => {
  it('"unknown_event" produces success: false with structured error', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('unknown_event', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.action).toBeNull();
    expect(result.error?.message).toBe('Unknown event: unknown_event');
    expect(result.error?.event).toBe('unknown_event');
  });

  it('"reserch_started" (misspelling) produces success: false with structured error', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('reserch_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.action).toBeNull();
    expect(result.error?.message).toBe('Unknown event: reserch_started');
    expect(result.error?.event).toBe('reserch_started');
  });

  it('"gate_mode_set" is a valid v5 OOB event and produces success: true', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('gate_mode_set', PROJECT_DIR, { gate_mode: 'task' }, io);
    expect(result.success).toBe(true);
  });
});

// ── [CONTRACT] Event Names — OOB events ───────────────────────────────────────

describe('[CONTRACT] Event Names — OOB events', () => {
  it('plan_rejected is a valid v5 OOB event and produces success: true', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 1 });
    const result = processEvent('plan_rejected', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('gate_rejected is a valid v5 OOB event and produces success: true', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('gate_rejected', PROJECT_DIR, { gate_type: 'task', reason: 'Rejected by operator' }, io);
    expect(result.success).toBe(true);
  });

  it('final_rejected is a valid v5 OOB event and produces success: true', () => {
    const io = driveToReviewTier(config);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    const result = processEvent('final_rejected', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });

  it('halt is a valid v5 OOB event and produces success: true', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const result = processEvent('halt', PROJECT_DIR, { reason: 'Emergency stop' }, io);
    expect(result.success).toBe(true);
  });
});
