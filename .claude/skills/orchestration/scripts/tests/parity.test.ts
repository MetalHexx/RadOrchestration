import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import { EVENTS } from '../lib/constants.js';
import {
  createScaffoldedState,
  createMockIO,
  createConfig,
  createMockIOWithConfig,
  driveToReviewTier,
  driveToExecutionWithConfig,
  driveTaskWith,
  drivePhaseReviewApproval,
  seedDoc,
  completePlanningSteps,
  DOC_STORE,
  PROJECT_DIR,
  ORCH_ROOT,
  TASKS_2,
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
} from './fixtures/parity-states.js';
import type { MockIO } from './fixtures/parity-states.js';
import type {
  PipelineState,
  StepNodeState,
  GateNodeState,
  ConditionalNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  PipelineResult,
  OrchestrationConfig,
} from '../lib/types.js';

// ── [PARITY] v4:resolvePlanning ───────────────────────────────────────────────

describe('[PARITY] v4:resolvePlanning', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  // ── _completed → next spawn action (one per step) ─────────────────────────

  it('[PARITY] v4:resolvePlanning — master_plan_completed → request_plan_approval', () => {
    // v4: resolver.js resolvePlanning() — all PLANNING_STEP_ORDER complete, !human_approved → request_plan_approval
    const state = createScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');
    expect(result.context).toEqual({});
  });

  // ── _started → in_progress + echo action (one per step) ───────────────────

  it('[PARITY] v4:resolvePlanning — master_plan_started sets in_progress and echoes spawn_master_plan', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[4] not complete → spawn_master_plan
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  // ── _completed events store doc_path ──────────────────────────────────────

  it('[PARITY] v4:resolvePlanning — master_plan_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.posix.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  // ── plan_approved → gate completion ───────────────────────────────────────

  it('[PARITY] v4:resolvePlanning — plan_approved completes gate with gate_active: true', () => {
    // v4: resolver.js resolvePlanning() — plan_approved → gate completes, tier transition to execution
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    const masterPlanDocPath = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    const io = createMockIO(state);
    DOC_STORE[masterPlanDocPath.replace(/\\/g, '/')] = {
      frontmatter: { total_phases: 3, total_tasks: 6 },
      content: '---\ntotal_phases: 3\ntotal_tasks: 6\n---\n# Master Plan',
    };

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: masterPlanDocPath }, io);

    expect(result.success).toBe(true);
    const g = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(g.status).toBe('completed');
    expect(g.gate_active).toBe(true);
  });

  // ── plan_approved with seeded master plan → tier transition ───────────────

  it('[PARITY] v4:resolvePlanning — plan_approved with seeded master plan doc → create_phase_plan tier transition', () => {
    // v4: resolver.js resolvePlanning() → resolveExecution() — plan_approved sets current_tier = 'execution',
    //   next call returns create_phase_plan for phase 1
    // Use autonomous mode so walker passes through gate_mode_selection transparently.
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    // Seed the master plan doc at the doc_path stored on the master_plan node
    const masterPlanDocPath = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(masterPlanDocPath, { total_phases: 2, total_tasks: 4 });
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
    });
    const io = createMockIOWithConfig(state, config);

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: masterPlanDocPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    // v5 enriches context with phase_number and phase_id for phase planning steps
    expect(result.context).toEqual({ phase_number: 1, phase_id: 'P01' });
  });

  // ── Unknown event → error ─────────────────────────────────────────────────

  it('[PARITY] v4:resolvePlanning — unknown event returns success: false with error containing event name', () => {
    // v4: resolver.js resolveNextAction() — unknown event → error response
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('bogus_nonexistent_event', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('bogus_nonexistent_event');
    expect(result.error!.event).toBe('bogus_nonexistent_event');
  });
});

// ── [PARITY] v4:resolveExecution ──────────────────────────────────────────────

describe('[PARITY] v4:resolveExecution', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  // ── Execution-tier config: autonomous gates, no commit conditional ──────

  const EXEC_CONFIG: OrchestrationConfig = {
    system: { orch_root: ORCH_ROOT },
    projects: { base_path: '', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3,
    },
    human_gates: {
      after_planning: true,
      execution_mode: 'autonomous',
      after_final_review: true,
    },
    source_control: {
      auto_commit: 'ask',
      auto_pr: 'never',
      provider: 'github',
    },
    default_template: 'full',
  };

  function createExecMockIO(initialState: PipelineState): MockIO {
    let currentState: PipelineState | null = structuredClone(initialState);
    const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];
    const ensureDirCalls: string[] = [];

    return {
      get currentState() { return currentState; },
      writeCalls,
      ensureDirCalls,
      readState(_projectDir: string): PipelineState | null {
        return currentState ? structuredClone(currentState) : null;
      },
      writeState(_projectDir: string, state: PipelineState): void {
        currentState = structuredClone(state);
        writeCalls.push({ projectDir: _projectDir, state: structuredClone(state) });
      },
      readConfig(_configPath?: string): OrchestrationConfig {
        return structuredClone(EXEC_CONFIG);
      },
      readDocument(docPath: string): { frontmatter: Record<string, unknown>; content: string } | null {
        return DOC_STORE[docPath.replace(/\\/g, '/')] ?? null;
      },
      ensureDirectories(projectDir: string): void {
        ensureDirCalls.push(projectDir);
      },
    };
  }

  // ── Shared helper: drive planning through to execution tier ───────────────

  function driveToExecution(totalPhases = 2): MockIO {
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    const masterPlanDocPath = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(masterPlanDocPath, { total_phases: totalPhases, total_tasks: totalPhases * 2 });
    const io = createExecMockIO(state);
    processEvent('plan_approved', PROJECT_DIR, { doc_path: masterPlanDocPath }, io);
    return io;
  }

  // ── Phase stage: planning → create_phase_plan ─────────────────────────────

  it('[PARITY] v4:resolveExecution — phase planning stage returns create_phase_plan', () => {
    // v4: resolveExecution() → phase.stage === 'planning' → create_phase_plan
    const io = driveToExecution();
    // plan_approved already advanced to execution tier; re-resolve to verify
    const state = io.currentState!;
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop.iterations).toHaveLength(2);

    // The plan_approved result was consumed by driveToExecution; verify by
    // sending phase_planning_started which echoes the action
    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
  });

  // ── Phase stage: executing → task routing (create_task_handoff) ────────────

  it('[PARITY] v4:resolveExecution — phase executing stage delegates to task routing', () => {
    // v4: resolveExecution() → phase.stage === 'executing' → resolvePhaseExecuting() → resolveTask()
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');
  });

  // ── Task stage: planning → create_task_handoff ────────────────────────────

  it('[PARITY] v4:resolveExecution — task planning stage returns create_task_handoff', () => {
    // v4: resolveTask() → task.stage === 'planning' → create_task_handoff
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');
    // Verify task_loop expanded
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    expect(taskLoop.iterations).toHaveLength(2);
  });

  // ── Task stage: coding → execute_task ─────────────────────────────────────

  it('[PARITY] v4:resolveExecution — task coding stage returns execute_task', () => {
    // v4: resolveTask() → task.stage === 'coding' → execute_task
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    // Drive task 1 to coding stage: task_handoff_started + task_handoff_created
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const handoffDoc = taskHandoffDoc(1, 1);
    seedDoc(handoffDoc);
    const result = processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: handoffDoc,
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
  });

  // ── Task stage: reviewing → spawn_code_reviewer ───────────────────────────

  it('[PARITY] v4:resolveExecution — task reviewing stage returns spawn_code_reviewer', () => {
    // v4: resolveTask() → task.stage === 'reviewing' → spawn_code_reviewer
    // v5: commit_gate runs before code_review, so after task_completed the
    // next action is invoke_source_control_commit (when auto_commit != 'never');
    // spawn_code_reviewer is reached after commit_completed.
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    // Drive task 1 through commit to reach reviewing stage
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: taskHandoffDoc(1, 1),
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    processEvent('commit_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const result = processEvent('commit_completed', PROJECT_DIR, {
      phase: 1, task: 1, commit_hash: 'abc123', pushed: 'false',
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_code_reviewer');
  });

  // ── Task complete+advanced → next task (create_task_handoff) ───────────────

  it('[PARITY] v4:resolveExecution — task complete+advanced advances to next task', () => {
    // v4: resolveTask() → task.stage === 'complete' + review.action === 'advanced'
    //   → resolveTaskGate() → autonomous → pointer bumped → next task
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    // Complete task 1 through full cycle
    const result = driveTaskWith(io, 1, 1);

    expect(result.success).toBe(true);
    // Task gate auto-approves in autonomous mode (verdict=approved) → advance to task 2
    expect(result.action).toBe('create_task_handoff');

    // Verify task_gate resolved via auto_approve_modes: [phase, autonomous] → gate_active=false
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(gate.gate_active).toBe(false);
  });

  // ── All tasks done → generate_phase_report ────────────────────────────────

  it('[PARITY] v4:resolveExecution — all tasks done returns generate_phase_report', () => {
    // v4: resolvePhaseExecuting() → current_task > tasks.length → generate_phase_report
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    // Complete task 1
    driveTaskWith(io, 1, 1);
    // Complete task 2
    const result = driveTaskWith(io, 1, 2);

    expect(result.success).toBe(true);
    // Task gate auto-approves → task_loop completes → phase_report
    expect(result.action).toBe('generate_phase_report');
  });

  // ── Phase stage: reviewing → spawn_phase_reviewer ─────────────────────────

  it('[PARITY] v4:resolveExecution — phase reviewing stage returns spawn_phase_reviewer', () => {
    // v4: resolveExecution() → phase.stage === 'reviewing' → spawn_phase_reviewer
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    // Drive to phase review
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    const result = processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReportDoc(1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_phase_reviewer');
  });

  // ── Phase complete+advanced (non-final) → next phase create_phase_plan ────

  it('[PARITY] v4:resolveExecution — phase complete+advanced advances to next phase', () => {
    // v4: resolveExecution() → phase.stage === 'complete' + review.action === 'advanced'
    //   → resolvePhaseGate() → autonomous → pointer bumped → next phase create_phase_plan
    const io = driveToExecution(2);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReportDoc(1),
    }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    let result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    // Phase gate auto-approves in autonomous mode (verdict=approved) → no commit at phase scope (commit is per-task) → create_phase_plan
    expect(result.action).toBe('create_phase_plan');

    // Verify phase_gate auto-approved (gate_active = false)
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(gate.gate_active).toBe(false);
  });

  // ── Final phase completion → spawn_final_reviewer (review tier transition) ─

  it('[PARITY] v4:resolveExecution — final phase completion transitions to review tier', () => {
    // v4: resolveExecution() → last phase complete → execution.status === 'complete'
    //   → pipeline.current_tier === 'review' → resolveReview() → spawn_final_reviewer
    const io = driveToExecution(2);

    // ── Phase 1 full lifecycle ───────────────────────────────────────────
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReportDoc(1),
    }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);
    // Approve phase 1 gate, then drive commit (auto_commit='ask')
    // Phase gate auto-approves (autonomous) → no commit at phase scope (commit is per-task) → advances to phase 2

    // ── Phase 2 full lifecycle ───────────────────────────────────────────
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 2 }, io);
    seedDoc(phasePlanDoc(2), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 2,
      doc_path: phasePlanDoc(2),
    }, io);
    driveTaskWith(io, 2, 1);
    driveTaskWith(io, 2, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 2 }, io);
    seedDoc(phaseReportDoc(2));
    processEvent('phase_report_created', PROJECT_DIR, {
      phase: 2,
      doc_path: phaseReportDoc(2),
    }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 2 }, io);
    seedDoc(phaseReviewDoc(2));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 2,
      doc_path: phaseReviewDoc(2),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);
    // Phase gate auto-approves (autonomous) → no commit at phase scope (commit is per-task) → phase_loop completes → spawn_final_reviewer

    expect(result.success).toBe(true);
    // Phase gate auto-approved (autonomous) → no commit at phase scope → phase_loop completes → spawn_final_reviewer
    expect(result.action).toBe('spawn_final_reviewer');

    // Verify phase_loop completed
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop.status).toBe('completed');
  });

  // ── Empty phase (0 tasks) → generate_phase_report ─────────────────────────

  it('[PARITY] v4:resolveExecution — empty phase with zero tasks advances to generate_phase_report', () => {
    // v4: resolvePhaseExecuting() → current_task === 0 && tasks.length === 0 → generate_phase_report
    // v5 DIVERGENCE: frontmatter validation rejects tasks: [] (must be non-empty array)
    const io = driveToExecution(1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [] });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('tasks');
  });
});

// ── [PARITY] v4:resolveExecution — gate modes ────────────────────────────────

describe('[PARITY] v4:resolveExecution — gate modes', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  // ── autonomous mode ─────────────────────────────────────────────────────

  it('[PARITY] v4:resolveTaskGate — execution_mode=autonomous auto-approves task gate (verdict=approved)', () => {
    // v5: in autonomous mode, task gate auto-approves via auto_approve_modes: [phase, autonomous]
    //     (gate_active=false, no gate_task action fired)
    const config = createConfig({ human_gates: { execution_mode: 'autonomous' } });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    const result = driveTaskWith(io, 1, 1);

    expect(result.success).toBe(true);
    // Task gate auto-approves → advances to task 2
    expect(result.action).toBe('create_task_handoff');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    // gate_active=false: auto_approve_modes path sets gate_active=false
    expect(gate.gate_active).toBe(false);
  });

  it('[PARITY] v4:resolvePhaseGate — execution_mode=autonomous auto-approves phase gate (verdict=approved)', () => {
    // v5: in autonomous mode, if phase_review.verdict === 'approved', the phase gate
    //     auto-approves without emitting gate_phase (gate_active = false)
    // After T02 (verdict checking), autonomous with verdict=approved auto-approves (gate_active=false)
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    let result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    // Phase gate auto-approves in autonomous mode (verdict=approved) → auto_commit='never' → commit skipped → spawn_final_reviewer
    expect(result.action).toBe('spawn_final_reviewer');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(gate.gate_active).toBe(false);
  });

  // ── task mode ───────────────────────────────────────────────────────────

  it('[PARITY] v4:resolveTaskGate — execution_mode=task emits gate_task (gate_active: true)', () => {
    // v4: resolveTaskGate() — mode === 'task' → { action: 'gate_task' }
    // v5: task_gate.auto_approve_modes = [phase] does NOT include 'task' → gate fires
    const config = createConfig({
      human_gates: { execution_mode: 'task' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

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
    // v5: 'task' not in auto_approve_modes → gate fires
    expect(result.action).toBe('gate_task');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });

  it('[PARITY] v4:resolvePhaseGate — execution_mode=task emits gate_phase (gate_active: true)', () => {
    // v4: resolvePhaseGate() — mode === 'task' → { action: 'gate_phase' }
    // v5: phase_gate.auto_approve_modes = [] does NOT include 'task' → gate fires
    const config = createConfig({
      human_gates: { execution_mode: 'task' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    // v5: 'task' not in auto_approve_modes → phase gate fires
    expect(result.action).toBe('gate_phase');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });

  // ── phase mode ──────────────────────────────────────────────────────────

  it('[PARITY] v4:resolveTaskGate — execution_mode=phase auto-approves task gate', () => {
    // v4: resolveTaskGate() — mode === 'phase' → no gate_task (auto-approve)
    // v5: task_gate.auto_approve_modes = [phase] includes 'phase' → auto-approved
    const config = createConfig({
      human_gates: { execution_mode: 'phase' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    const result = driveTaskWith(io, 1, 1);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(gate.gate_active).toBe(false);
  });

  it('[PARITY] v4:resolvePhaseGate — execution_mode=phase emits gate_phase (gate_active: true)', () => {
    // v4: resolvePhaseGate() — mode === 'phase' → { action: 'gate_phase' }
    // v5: phase_gate.auto_approve_modes = [] does NOT include 'phase' → gate fires
    const config = createConfig({
      human_gates: { execution_mode: 'phase' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });

  // ── ask mode ────────────────────────────────────────────────────────────

  it('[PARITY] v4:resolveExecution — execution_mode=ask with pipeline.gate_mode=null emits ask_gate_mode', () => {
    // v4 parity achieved: effectiveMode === 'ask' && pipeline.gate_mode === null → ask_gate_mode
    // This is the new v5 behavior matching v4's ask_gate_mode mechanism.
    // The walker returns ask_gate_mode before activating the task_gate,
    // prompting the operator to choose a gate mode before proceeding.
    const config = createConfig({
      human_gates: { execution_mode: 'ask' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    // Manual drive without gate approval — we want to observe ask_gate_mode firing
    const askCtx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, askCtx, io);
    const askHandoff = taskHandoffDoc(1, 1);
    seedDoc(askHandoff);
    processEvent('task_handoff_created', PROJECT_DIR, { ...askCtx, doc_path: askHandoff }, io);
    processEvent('execution_started', PROJECT_DIR, askCtx, io);
    processEvent('task_completed', PROJECT_DIR, askCtx, io);
    processEvent('code_review_started', PROJECT_DIR, askCtx, io);
    const askReview = codeReviewDoc(1, 1);
    seedDoc(askReview);
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...askCtx, doc_path: askReview, verdict: 'approved',
    }, io);

    expect(result.success).toBe(true);
    // ask mode + pipeline.gate_mode=null → ask_gate_mode fires before gate evaluation
    expect(result.action).toBe('ask_gate_mode');

    // Gate was NOT activated — ask_gate_mode fires before gate evaluation
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('not_started');
  });
});

// ── [PARITY] v4:resolveExecution — source control conditionals ───────────────

describe('[PARITY] v4:resolveExecution — source control conditionals', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('[PARITY] v4:resolveTaskGate — auto_commit=always + autonomous — commit per-task, verified at task scope', () => {
    // v4: resolveTaskGate() — auto_commit === 'always' → invoke_source_control_commit after task
    // v5: commit_gate is now at task scope (matching v4). driveTaskWith handles commit per-task.
    // auto_commit='always' neq 'never' → true branch → invoke_source_control_commit per task
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'always' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    const result = drivePhaseReviewApproval(io, 1);

    expect(result.success).toBe(true);
    // commit happens per-task inside driveTaskWith → no commit at phase scope → spawn_final_reviewer
    expect(result.action).toBe('spawn_final_reviewer');

    // Verify branch_taken on commit_gate at task scope
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const commitGate = taskLoop.iterations[0].nodes['commit_gate'] as ConditionalNodeState;
    expect(commitGate.branch_taken).toBe('true');
  });

  it('[PARITY] v4:resolveTaskGate — auto_commit=always + task mode — commit per-task matching v4', () => {
    // v4: resolveTaskGate() — mode === 'task' + auto_commit === 'always' → invoke_source_control_commit per task
    // v5: commit_gate is now at task scope (matching v4). driveTaskWith handles commit per-task.
    const config = createConfig({
      human_gates: { execution_mode: 'task' },
      source_control: { auto_commit: 'always' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    // Task 1 completes — commit handled per-task inside driveTaskWith
    const t1Result = driveTaskWith(io, 1, 1);
    expect(t1Result.success).toBe(true);
    // commit fires → driveTaskWith handles it → task gate fires → driveTaskWith approves → advances to task 2
    expect(t1Result.action).toBe('create_task_handoff');

    driveTaskWith(io, 1, 2);

    // After all tasks + phase review → no commit at phase scope (commit was per-task) → spawn_final_reviewer
    const result = drivePhaseReviewApproval(io, 1);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');
  });

  it('[PARITY] v4:resolveExecution — auto_commit=never skips commit_gate at task scope (branch_taken: false)', () => {
    // v4: auto_commit='never' → no commit step anywhere
    // v5: commit_gate condition at task scope: auto_commit neq 'never' → false → false branch (empty) → skipped
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    const result = drivePhaseReviewApproval(io, 1);

    expect(result.success).toBe(true);
    // Phase gate auto-approves (autonomous), commit conditional false → skip → spawn_final_reviewer
    expect(result.action).toBe('spawn_final_reviewer');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const commitGate = taskLoop.iterations[0].nodes['commit_gate'] as ConditionalNodeState;
    expect(commitGate.branch_taken).toBe('false');
    expect(commitGate.status).toBe('completed');
  });

  it('[PARITY] v4:resolveExecution — auto_commit=ask takes true branch at task scope (neq never)', () => {
    // v4: auto_commit='ask' → invoke source control commit (with prompt)
    // v5: commit_gate condition at task scope: auto_commit neq 'never' → true ('ask' != 'never') → commit per-task
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'ask' },
    });
    const io = driveToExecutionWithConfig(config);

    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    const result = drivePhaseReviewApproval(io, 1);

    expect(result.success).toBe(true);
    // commit happens per-task inside driveTaskWith → no commit at phase scope → spawn_final_reviewer
    expect(result.action).toBe('spawn_final_reviewer');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const commitGate = taskLoop.iterations[0].nodes['commit_gate'] as ConditionalNodeState;
    expect(commitGate.branch_taken).toBe('true');
  });
});

// ── [PARITY] v4:resolveExecution — corrective loops and halts ─────────────────

describe('[PARITY] v4:resolveExecution — corrective loops and halts', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  // Config: autonomous gates, ask commit (same as source-control tests)
  const CORRECTIVE_CONFIG = createConfig({
    human_gates: { execution_mode: 'autonomous' },
    source_control: { auto_commit: 'never' },
  });

  /**
   * Helper: drive to execution with phase plan seeded, ready for tasks.
   */
  function setupPhaseWithTasks(tasks = TASKS_2, totalPhases = 1): MockIO {
    const io = driveToExecutionWithConfig(CORRECTIVE_CONFIG, totalPhases);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);
    return io;
  }

  /**
   * Helper: drive a task through handoff → execute → code_review with a given verdict.
   */
  function driveTaskToReview(
    io: MockIO,
    phase: number,
    task: number,
    verdict: string,
  ): PipelineResult {
    const ctx = { phase, task };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const handoffDoc = taskHandoffDoc(phase, task);
    seedDoc(handoffDoc);
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const reviewDoc = codeReviewDoc(phase, task);
    seedDoc(reviewDoc);
    return processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: reviewDoc,
      verdict,
    }, io);
  }

  // ── Task-level corrective injection ─────────────────────────────────────

  it('[PARITY] v4:resolveExecution — code_review changes_requested injects corrective task and routes to create_task_handoff', () => {
    const io = setupPhaseWithTasks();

    // Complete task 1 normally
    driveTaskWith(io, 1, 1);

    // Drive task 2 through code review with changes_requested
    const result = driveTaskToReview(io, 1, 2, 'changes_requested');

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Verify corrective task injected on task iteration
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskIter = taskLoop.iterations[1]; // task 2 (0-indexed)
    expect(taskIter.corrective_tasks).toHaveLength(1);
    expect(taskIter.corrective_tasks[0].status).toBe('in_progress');
    expect(taskIter.corrective_tasks[0].index).toBe(1);
    expect(taskIter.corrective_tasks[0].injected_after).toBe('code_review');
    expect(taskIter.corrective_tasks[0].nodes).toHaveProperty('task_handoff');
    expect(taskIter.corrective_tasks[0].nodes).toHaveProperty('task_executor');
    expect(taskIter.corrective_tasks[0].nodes).toHaveProperty('code_review');
    expect(taskIter.corrective_tasks[0].nodes).toHaveProperty('task_gate');
  });

  it('[PARITY] v4:resolveExecution — corrective task completion resumes normal flow (next task or phase_report)', () => {
    const io = setupPhaseWithTasks();

    // Complete task 1 normally
    driveTaskWith(io, 1, 1);

    // Inject corrective on task 2
    driveTaskToReview(io, 1, 2, 'changes_requested');

    // Drive corrective task through full cycle (handoff→execute→review approve)
    // The corrective task uses the same phase/task context
    const ctx = { phase: 1, task: 2 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const corrHandoff = taskHandoffDoc(1, 2);
    seedDoc(corrHandoff);
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: corrHandoff }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const corrReview = codeReviewDoc(1, 2);
    seedDoc(corrReview);
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: corrReview,
      verdict: 'approved',
    }, io);

    // task_gate fires (autonomous verdict lookup uses depends_on[0]=commit_gate which has no verdict)
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }

    // All tasks done → generate_phase_report
    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');

    // Verify corrective entry completed
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskIter = taskLoop.iterations[1];
    expect(taskIter.corrective_tasks[0].status).toBe('completed');
  });

  // ── Phase-level corrective injection ────────────────────────────────────

  it('[PARITY] v4:resolveExecution — phase_review changes_requested injects phase corrective task', () => {
    const io = setupPhaseWithTasks();

    // Complete both tasks
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    // Phase report
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    // Phase review with changes_requested
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'changes_requested', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');  // walker re-enters phase planning

    // Verify corrective entry pushed with empty nodes (phase re-planning approach)
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.corrective_tasks).toHaveLength(1);
    expect(phaseIter.corrective_tasks[0].status).toBe('in_progress');
    expect(phaseIter.corrective_tasks[0].index).toBe(1);
    expect(phaseIter.corrective_tasks[0].injected_after).toBe('phase_review');
    expect(Object.keys(phaseIter.corrective_tasks[0].nodes)).toHaveLength(0);  // empty: tasks recreated by planning

    // Phase planning reset to not_started so walker re-enters create_phase_plan
    expect(phaseIter.nodes['phase_planning'].status).toBe('not_started');

    // Task loop cleared (iterations reset)
    const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    expect(taskLoop.iterations).toHaveLength(0);
  });

  // ── Retry budget exhaustion ─────────────────────────────────────────────

  it('[PARITY] v4:resolveExecution — retry budget exhaustion halts pipeline (max_retries_per_task=2)', () => {
    const io = setupPhaseWithTasks();

    // Complete task 1 normally
    driveTaskWith(io, 1, 1);

    // Inject corrective 1 on task 2
    driveTaskToReview(io, 1, 2, 'changes_requested');

    // Drive corrective 1 through full cycle, end with changes_requested again
    const ctx = { phase: 1, task: 2 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 2));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 2) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 2));
    processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 2), verdict: 'changes_requested',
    }, io);

    // Now corrective_tasks.length == 2 (== max_retries_per_task)
    // Drive corrective 2 through to review with changes_requested → should halt
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 2));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 2) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 2));
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 2), verdict: 'changes_requested',
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    // Verify task iteration halted
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskIter = taskLoop.iterations[1];
    expect(taskIter.status).toBe('halted');
  });

  // ── Review rejected ─────────────────────────────────────────────────────

  it('[PARITY] v4:resolveExecution — code_review rejected halts pipeline', () => {
    const io = setupPhaseWithTasks();

    // Complete task 1 normally
    driveTaskWith(io, 1, 1);

    // Drive task 2 to review with rejected verdict
    const result = driveTaskToReview(io, 1, 2, 'rejected');

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskIter = taskLoop.iterations[1];
    expect(taskIter.status).toBe('halted');
  });

  it('[PARITY] v4:resolveExecution — phase_review rejected halts pipeline', () => {
    const io = setupPhaseWithTasks();

    // Complete both tasks
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    // Phase report
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    // Phase review with rejected verdict
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'rejected', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.status).toBe('halted');
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('[PARITY] v4:resolveExecution — single-task phase corrective cycle completes to phase_report', () => {
    const singleTask = [{ id: 'T01', title: 'Task 1' }];
    const io = setupPhaseWithTasks(singleTask);

    // Drive the only task with changes_requested
    driveTaskToReview(io, 1, 1, 'changes_requested');

    // Drive corrective task through full cycle with approve
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);

    // task_gate fires (autonomous verdict lookup uses depends_on[0]=commit_gate which has no verdict)
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }

    // All tasks done → generate_phase_report
    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');

    // Verify corrective entry completed
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    expect(taskLoop.iterations[0].corrective_tasks[0].status).toBe('completed');
  });

  it('[PARITY] v4:resolveExecution — phase-level corrective with subsequent task execution', () => {
    const io = setupPhaseWithTasks();

    // Complete both tasks
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    // Phase report + review with changes_requested (phase-level corrective)
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const corrResult = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'changes_requested', exit_criteria_met: true,
    }, io);

    // Walker re-enters phase planning (corrective re-planning approach)
    expect(corrResult.success).toBe(true);
    expect(corrResult.action).toBe('create_phase_plan');

    // ── Corrective pass: re-run phase planning, tasks, then phase review ──

    // Re-run phase planning
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1, doc_path: phasePlanDoc(1),
    }, io);

    // Re-drive both tasks
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    // Phase report (corrective run)
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);

    // Phase review (approve)
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    let result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    // Phase gate fires — approve it
    if (result.action === 'gate_phase') {
      result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
    }

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');  // auto_commit=never: commit skipped → all phases done → final

    // After phase corrective completes, phase iteration completes → advance
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.corrective_tasks[0].status).toBe('completed');
    expect(phaseIter.status).toBe('completed');
  });

  it('[PARITY] v4:resolveExecution — max retries on first task halts before second task starts', () => {
    const io = setupPhaseWithTasks();

    // Drive task 1 with changes_requested → injects corrective 1
    driveTaskToReview(io, 1, 1, 'changes_requested');

    // Drive corrective 1 through, end with changes_requested → injects corrective 2
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'changes_requested',
    }, io);

    // corrective_tasks.length == 2 == max_retries_per_task
    // Drive corrective 2 through, end with changes_requested → should halt
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'changes_requested',
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    // Task 2 never reached
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    expect(taskLoop.iterations[0].status).toBe('halted');
    expect(taskLoop.iterations[1].status).toBe('not_started');
  });
});

// ── [PARITY] v4:resolveReview ─────────────────────────────────────────────────

describe('[PARITY] v4:resolveReview', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('[PARITY] v4:resolveReview — no final review doc emits spawn_final_reviewer', () => {
    // v4: resolveReview() — !final_review.doc_path → spawn_final_reviewer
    // v5: final_review step is not_started → action: spawn_final_reviewer
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(config);

    // After driveToReviewTier, the next action should be spawn_final_reviewer
    // Verify by re-processing the state
    const result = processEvent('final_review_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');

    const finalReview = io.currentState!.graph.nodes['final_review'] as StepNodeState;
    expect(finalReview.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolveReview — auto_pr=always emits invoke_source_control_pr after final approval', () => {
    // v4: resolveReview() — !human_approved + auto_pr=always → invoke_source_control_pr (before approval)
    // v5 DIVERGENCE: v5 template has pr_gate AFTER final_approval_gate, so PR happens after approval.
    // In v4, PR is invoked before requesting final approval; in v5, approval comes first.
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'always' },
    });
    const io = driveToReviewTier(config);

    // Drive final review
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDoc = path.join(PROJECT_DIR, 'final-review.md');
    seedDoc(frDoc);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDoc }, io);

    // final_approval_gate fires (mode_ref: human_gates.after_final_review = true, auto_approve_modes: [])
    const approvalResult = processEvent('final_approved', PROJECT_DIR, {}, io);

    expect(approvalResult.success).toBe(true);
    // After approval, pr_gate: auto_pr='always' neq 'never' → true → invoke_source_control_pr
    expect(approvalResult.action).toBe('invoke_source_control_pr');

    const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
    expect(prGate.branch_taken).toBe('true');
  });

  it('[PARITY] v4:resolveReview — auto_pr=never skips PR and completes pipeline (display_complete)', () => {
    // v4: resolveReview() — !human_approved + auto_pr != 'always' → request_final_approval
    // v5: final_approval_gate fires → after approved, pr_gate: auto_pr='never' neq 'never' → false → skip
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(config);

    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDoc = path.join(PROJECT_DIR, 'final-review.md');
    seedDoc(frDoc);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDoc }, io);

    const result = processEvent('final_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    // pr_gate false branch (empty) → all nodes complete → display_complete
    expect(result.action).toBe('display_complete');

    const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
    expect(prGate.branch_taken).toBe('false');
    expect(prGate.status).toBe('completed');
  });

  it('[PARITY] v4:resolveReview — auto_pr=ask emits invoke_source_control_pr (neq never evaluates true)', () => {
    // v4: resolveReview() — auto_pr='ask' does not match auto_pr==='always' check → request_final_approval
    // v5 DIVERGENCE: v5 uses neq 'never' conditional, so 'ask' (neq 'never' → true) invokes PR.
    // In v4, only auto_pr='always' triggers PR before approval request.
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'ask' },
    });
    const io = driveToReviewTier(config);

    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDoc = path.join(PROJECT_DIR, 'final-review.md');
    seedDoc(frDoc);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDoc }, io);

    const result = processEvent('final_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');

    const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
    expect(prGate.branch_taken).toBe('true');
  });

  it('[PARITY] v4:resolveReview — final_approved then PR completed reaches display_complete', () => {
    // v4: resolveReview() — human_approved → terminal (halted in v4 — should have transitioned)
    // v5: after final_approval_gate + pr_gate + PR step complete → all nodes done → display_complete
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'always' },
    });
    const io = driveToReviewTier(config);

    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDoc = path.join(PROJECT_DIR, 'final-review.md');
    seedDoc(frDoc);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDoc }, io);
    processEvent('final_approved', PROJECT_DIR, {}, io);

    // Drive PR step
    processEvent('pr_requested', PROJECT_DIR, {}, io);
    const result = processEvent('pr_created', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');
    expect(io.currentState!.graph.status).toBe('completed');
  });

  it('[PARITY] v4:resolveReview — request_final_approval gate fires with gate_active: true', () => {
    // v4: resolveReview() — !human_approved → request_final_approval
    // v5: final_approval_gate (mode_ref: human_gates.after_final_review, auto_approve_modes: [])
    //   after_final_review=true → not in [] → gate fires with action request_final_approval
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous', after_final_review: true },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(config);

    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDoc = path.join(PROJECT_DIR, 'final-review.md');
    seedDoc(frDoc);
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDoc }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('request_final_approval');

    const approvalGate = io.currentState!.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(approvalGate.gate_active).toBe(true);
  });

  it('[PARITY] v4:resolveNextAction — halted graph returns display_halted', () => {
    // v4: resolveNextAction() — tier === 'halted' → display_halted
    // v5: phase_review verdict='rejected' → iteration + graph halted → walkDAG returns display_halted
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 1 });
    processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

    // Phase 1 with one task
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    const ppDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-plan.md');
    seedDoc(ppDoc, { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: ppDoc }, io);

    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const thDoc = path.join(PROJECT_DIR, 'tasks', 'p1-t1-handoff.md');
    seedDoc(thDoc);
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: thDoc }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const crDoc = path.join(PROJECT_DIR, 'tasks', 'p1-t1-review.md');
    seedDoc(crDoc);
    processEvent('code_review_completed', PROJECT_DIR, { ...ctx, doc_path: crDoc, verdict: 'approved' }, io);

    // Phase report + review with rejected verdict → halted
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    const prDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-report.md');
    seedDoc(prDoc);
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: prDoc }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const prvDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-review.md');
    seedDoc(prvDoc);
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: prvDoc, verdict: 'rejected', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');
  });

  it('[PARITY] v4:resolveNextAction — completed graph returns display_complete', () => {
    // v4: resolveNextAction() — tier === 'complete' → display_complete
    // v5: all nodes completed → walkDAG returns display_complete
    const config = createConfig({
      human_gates: { execution_mode: 'autonomous' },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToReviewTier(config);

    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDoc = path.join(PROJECT_DIR, 'final-review.md');
    seedDoc(frDoc);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDoc }, io);
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);

    // auto_pr='never' → pr_gate false → all done → display_complete
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');
    expect(io.currentState!.graph.status).toBe('completed');
  });
});

// ── [PARITY] coverage and audit ───────────────────────────────────────────────

describe('[PARITY] coverage and audit', () => {
  it('every EVENTS value appears in at least one test file', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const testFileNames = [
      'parity.test.ts',
      'pipeline.test.ts',
      'execution-integration.test.ts',
      'planning-integration.test.ts',
      'corrective-integration.test.ts',
      'engine.test.ts',
      'mutations.test.ts',
    ];

    const testContents = testFileNames.map((f: string) =>
      fs.readFileSync(path.join(testDir, f), 'utf-8') as string,
    );
    const combined = testContents.join('\n');

    for (const eventValue of Object.values(EVENTS)) {
      expect(
        combined.includes(eventValue),
        `Event '${eventValue}' not found in any test file`,
      ).toBe(true);
    }
  });

  it('zero any usage in core engine modules', () => {
    const libDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib');
    const sourceFiles = [
      'types.ts',
      'engine.ts',
      'dag-walker.ts',
      'mutations.ts',
      'validator.ts',
      'condition-evaluator.ts',
    ];

    const anyPattern = /:\s*any\b|<any>|as\s+any\b/;

    for (const file of sourceFiles) {
      const content = fs.readFileSync(path.join(libDir, file), 'utf-8');
      const lines = content.split('\n');
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment lines
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }
        if (anyPattern.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      }

      expect(
        violations,
        `Found 'any' usage in ${file}:\n${violations.join('\n')}`,
      ).toHaveLength(0);
    }
  });
});
