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
  drivePhaseReviewApproval,
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
  TASKS_2,
} from '../fixtures/parity-states.js';
import type {
  StepNodeState,
  GateNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
} from '../../lib/types.js';

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

// ── [CONTRACT] State Mutations — Planning step mutations ──────────────────────

describe('[CONTRACT] State Mutations — Planning step mutations', () => {
  it('research_started: research.status=in_progress and graph.status=in_progress', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io); // scaffold
    const result = processEvent('research_started', PROJECT_DIR, {}, io); // standard route applies mutation

    expect(result.success).toBe(true);
    const researchNode = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(researchNode.status).toBe('in_progress');
    expect(io.currentState!.graph.status).toBe('in_progress');
    expect(result.mutations_applied.some((m) => m.includes('research') && m.includes('in_progress'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('graph.status'))).toBe(true);
  });

  it('research_completed: research.status=completed and doc_path set', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io); // scaffold
    processEvent('research_started', PROJECT_DIR, {}, io); // research in_progress
    const docPath = '/tmp/research-doc.md';
    seedDoc(docPath);
    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    const researchNode = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(researchNode.status).toBe('completed');
    expect(researchNode.doc_path).toBe(docPath);
    expect(result.mutations_applied.some((m) => m.includes('research') && m.includes('completed'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Plan approved mutations ──────────────────────

describe('[CONTRACT] State Mutations — Plan approved mutations', () => {
  it('plan_approved: gate.status=completed, gate_active=true, phase iterations created', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io); // scaffold
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 2 });

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

    expect(result.success).toBe(true);
    const gateNode = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(gateNode.status).toBe('completed');
    expect(gateNode.gate_active).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop.iterations.length).toBe(2);
    expect(result.mutations_applied.some((m) => m.includes('plan_approval_gate'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Phase plan created mutations ─────────────────

describe('[CONTRACT] State Mutations — Phase plan created mutations', () => {
  it('phase_plan_created: phase_planning.status=completed, doc_path set, task iterations created', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    const docPath = phasePlanDoc(1);
    seedDoc(docPath, { tasks: TASKS_2 });

    const result = processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: docPath }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    const phasePlanningNode = phaseIter.nodes['phase_planning'] as StepNodeState;
    expect(phasePlanningNode.status).toBe('completed');
    expect(phasePlanningNode.doc_path).toBe(docPath);
    const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    expect(taskLoop.iterations.length).toBe(2);
    expect(result.mutations_applied.some((m) => m.includes('phase_planning') && m.includes('completed'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Task handoff created mutations ───────────────

describe('[CONTRACT] State Mutations — Task handoff created mutations', () => {
  it('task_handoff_created: task_handoff.status=completed, doc_path set', () => {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const docPath = taskHandoffDoc(1, 1);
    seedDoc(docPath);

    const result = processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: docPath }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskHandoffNode = taskLoop.iterations[0].nodes['task_handoff'] as StepNodeState;
    expect(taskHandoffNode.status).toBe('completed');
    expect(taskHandoffNode.doc_path).toBe(docPath);
    expect(result.mutations_applied.some((m) => m.includes('task_handoff') && m.includes('completed'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Code review completed mutations ──────────────

describe('[CONTRACT] State Mutations — Code review completed mutations', () => {
  /** Sets up io positioned at code_review_started, ready for code_review_completed. */
  function driveToCodeReviewPosition() {
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
    return io;
  }

  it('code_review_completed (approved): code_review.status=completed, verdict=approved, doc_path set', () => {
    const io = driveToCodeReviewPosition();
    const ctx = { phase: 1, task: 1 };

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    expect(codeReviewNode.status).toBe('completed');
    expect(codeReviewNode.verdict).toBe('approved');
    expect(codeReviewNode.doc_path).toBe(codeReviewDoc(1, 1));
    expect(result.mutations_applied.some((m) => m.includes('code_review') && m.includes('completed'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('verdict'))).toBe(true);
  });

  it('code_review_completed (changes_requested): verdict=changes_requested, corrective task injected', () => {
    const io = driveToCodeReviewPosition();
    const ctx = { phase: 1, task: 1 };

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'changes_requested',
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    const taskIterCorrectives = taskLoop.iterations[0].corrective_tasks;
    expect(codeReviewNode.verdict).toBe('changes_requested');
    expect(taskIterCorrectives.length).toBeGreaterThanOrEqual(1);
    expect(result.mutations_applied.some((m) => m.includes('corrective') || m.includes('changes_requested'))).toBe(true);
  });

  it('code_review_completed (rejected): verdict=rejected, graph.status=halted', () => {
    const io = driveToCodeReviewPosition();
    const ctx = { phase: 1, task: 1 };

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'rejected',
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    expect(codeReviewNode.verdict).toBe('rejected');
    expect(io.currentState!.graph.status).toBe('halted');
    expect(result.mutations_applied.some((m) => m.includes('halted') || m.includes('rejected'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Phase review completed mutations ─────────────

describe('[CONTRACT] State Mutations — Phase review completed mutations', () => {
  /** Sets up io positioned at phase_review_started, ready for phase_review_completed. */
  function driveToPhaseReviewPosition() {
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    return io;
  }

  it('phase_review_completed (approved): phase_review.status=completed, verdict=approved, doc_path set', () => {
    const io = driveToPhaseReviewPosition();

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseReviewNode = phaseLoop.iterations[0].nodes['phase_review'] as StepNodeState;
    expect(phaseReviewNode.status).toBe('completed');
    expect(phaseReviewNode.verdict).toBe('approved');
    expect(phaseReviewNode.doc_path).toBe(phaseReviewDoc(1));
    expect(result.mutations_applied.some((m) => m.includes('phase_review') && m.includes('completed'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('verdict'))).toBe(true);
  });

  it('phase_review_completed (changes_requested): corrective task injected at phase level', () => {
    const io = driveToPhaseReviewPosition();

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'changes_requested', exit_criteria_met: false,
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.corrective_tasks.length).toBeGreaterThanOrEqual(1);
    expect(result.mutations_applied.some((m) => m.includes('corrective'))).toBe(true);
  });

  it('phase_review_completed (rejected): graph.status=halted', () => {
    const io = driveToPhaseReviewPosition();

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'rejected', exit_criteria_met: false,
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('halted');
    expect(result.mutations_applied.some((m) => m.includes('halted'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Gate approved mutations ──────────────────────

describe('[CONTRACT] State Mutations — Gate approved mutations', () => {
  it('task_gate_approved: task_gate.status=completed, gate_active=true', () => {
    const taskConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'task',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToExecutionWithConfig(taskConfig, 1);
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
    // In task mode, code_review_completed fires gate_task
    processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);

    const result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskGateNode = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(taskGateNode.status).toBe('completed');
    expect(taskGateNode.gate_active).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('task_gate'))).toBe(true);
  });

  it('phase_gate_approved: phase_gate.status=completed, gate_active=true', () => {
    const taskConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'task',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToExecutionWithConfig(taskConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    // driveTaskWith approves task gate if it fires (task mode fires task gate)
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    // In task mode, phase_review_completed fires gate_phase
    processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    const result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseGateNode = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(phaseGateNode.status).toBe('completed');
    expect(phaseGateNode.gate_active).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('phase_gate'))).toBe(true);
  });

  it('task_committed: phase_commit.status=completed', () => {
    const commitConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
      source_control: { auto_commit: 'always', auto_pr: 'never' },
    });
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    // drivePhaseReviewApproval drives phase report + review + phase gate (fires in autonomous+approve)
    // After gate approval with auto_commit:'always', action = invoke_source_control_commit
    drivePhaseReviewApproval(io, 1);

    processEvent('task_commit_requested', PROJECT_DIR, { phase: 1 }, io);
    const result = processEvent('task_committed', PROJECT_DIR, { phase: 1 }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseCommitNode = phaseLoop.iterations[0].nodes['phase_commit'] as StepNodeState;
    expect(phaseCommitNode.status).toBe('completed');
    expect(result.mutations_applied.some((m) => m.includes('phase_commit'))).toBe(true);
  });
});
