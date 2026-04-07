import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { processEvent } from '../lib/engine.js';
import {
  createScaffoldedState,
  createMockIO,
  seedDoc,
  completePlanningSteps,
  DOC_STORE,
  PROJECT_DIR,
  ORCH_ROOT,
} from './fixtures/parity-states.js';
import type { MockIO } from './fixtures/parity-states.js';
import type {
  PipelineState,
  StepNodeState,
  GateNodeState,
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

  it('[PARITY] v4:resolvePlanning — research_completed → spawn_prd', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0] complete, [1] not complete → spawn_prd
    const state = createScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'research.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
  });

  it('[PARITY] v4:resolvePlanning — prd_completed → spawn_design', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0..1] complete, [2] not complete → spawn_design
    const state = createScaffoldedState();
    completePlanningSteps(state, 'research');
    (state.graph.nodes['prd'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'prd.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('prd_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
  });

  it('[PARITY] v4:resolvePlanning — design_completed → spawn_architecture', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0..2] complete, [3] not complete → spawn_architecture
    const state = createScaffoldedState();
    completePlanningSteps(state, 'prd');
    (state.graph.nodes['design'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'design.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('design_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
  });

  it('[PARITY] v4:resolvePlanning — architecture_completed → spawn_master_plan', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0..3] complete, [4] not complete → spawn_master_plan
    const state = createScaffoldedState();
    completePlanningSteps(state, 'design');
    (state.graph.nodes['architecture'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'architecture.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
  });

  it('[PARITY] v4:resolvePlanning — master_plan_completed → request_plan_approval', () => {
    // v4: resolver.js resolvePlanning() — all PLANNING_STEP_ORDER complete, !human_approved → request_plan_approval
    const state = createScaffoldedState();
    completePlanningSteps(state, 'architecture');
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

  it('[PARITY] v4:resolvePlanning — research_started sets in_progress and echoes spawn_research', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[0] not complete → spawn_research
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('research_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_research');
    expect(result.context).toEqual({ step: 'research' });
    const n = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — prd_started sets in_progress and echoes spawn_prd', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[1] not complete → spawn_prd
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('prd_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
    const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — design_started sets in_progress and echoes spawn_design', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[2] not complete → spawn_design
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('design_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
    const n = io.currentState!.graph.nodes['design'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('[PARITY] v4:resolvePlanning — architecture_started sets in_progress and echoes spawn_architecture', () => {
    // v4: resolver.js resolvePlanning() — PLANNING_STEP_ORDER[3] not complete → spawn_architecture
    const state = createScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('architecture_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
    const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

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

  it('[PARITY] v4:resolvePlanning — research_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'research.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — prd_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'research');
    (state.graph.nodes['prd'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'prd.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('prd_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — design_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'prd');
    (state.graph.nodes['design'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'design.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('design_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['design'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — architecture_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'design');
    (state.graph.nodes['architecture'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'architecture.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    processEvent('architecture_completed', PROJECT_DIR, { doc_path: docPath }, io);

    const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('[PARITY] v4:resolvePlanning — master_plan_completed stores doc_path', () => {
    // v4: mutations.js — completed event stores doc_path on step node
    const state = createScaffoldedState();
    completePlanningSteps(state, 'architecture');
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'master-plan.md');
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
    const io = createMockIO(state);

    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const g = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(g.status).toBe('completed');
    expect(g.gate_active).toBe(true);
    // Without a seeded master plan doc, the walker cannot expand for_each_phase
    expect(result.action).toBeNull();
  });

  // ── plan_approved with seeded master plan → tier transition ───────────────

  it('[PARITY] v4:resolvePlanning — plan_approved with seeded master plan doc → create_phase_plan tier transition', () => {
    // v4: resolver.js resolvePlanning() → resolveExecution() — plan_approved sets current_tier = 'execution',
    //   next call returns create_phase_plan for phase 1
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    // Seed the master plan doc at the doc_path stored on the master_plan node
    const masterPlanDocPath = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(masterPlanDocPath, { total_phases: 2 });
    const io = createMockIO(state);

    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
    // v5 step context comes from template definition (no phase_number field defined on plan_phase step)
    expect(result.context).toEqual({});
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
        return DOC_STORE[docPath] ?? null;
      },
      ensureDirectories(projectDir: string): void {
        ensureDirCalls.push(projectDir);
      },
    };
  }

  // ── Doc path helpers ──────────────────────────────────────────────────────

  const phasePlanDoc = (phase: number) =>
    path.join(PROJECT_DIR, 'phases', `phase-${phase}-plan.md`);
  const taskHandoffDoc = (phase: number, task: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-handoff.md`);
  const codeReviewDoc = (phase: number, task: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-review.md`);
  const phaseReportDoc = (phase: number) =>
    path.join(PROJECT_DIR, 'phases', `phase-${phase}-report.md`);
  const phaseReviewDoc = (phase: number) =>
    path.join(PROJECT_DIR, 'phases', `phase-${phase}-review.md`);

  const TASKS_2 = [
    { id: 'T01', title: 'Task 1' },
    { id: 'T02', title: 'Task 2' },
  ];

  // ── Shared helper: drive planning through to execution tier ───────────────

  function driveToExecution(totalPhases = 2): MockIO {
    const state = createScaffoldedState();
    completePlanningSteps(state, 'master_plan');
    const masterPlanDocPath = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(masterPlanDocPath, { total_phases: totalPhases });
    const io = createExecMockIO(state);
    processEvent('plan_approved', PROJECT_DIR, {}, io);
    return io;
  }

  /** Drive a single task through started → handoff → execute → review (approve). */
  function driveTask(io: MockIO, phase: number, task: number): PipelineResult {
    const ctx = { phase, task };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const handoffDoc = taskHandoffDoc(phase, task);
    seedDoc(handoffDoc);
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('execution_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const reviewDoc = codeReviewDoc(phase, task);
    seedDoc(reviewDoc);
    return processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: reviewDoc,
      verdict: 'approve',
    }, io);
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
    const io = driveToExecution();
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    // Drive task 1 to reviewing stage
    processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: taskHandoffDoc(1, 1),
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    const result = processEvent('execution_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);

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
    const result = driveTask(io, 1, 1);

    expect(result.success).toBe(true);
    // Task gate auto-approves (autonomous) → advance to task 2
    expect(result.action).toBe('create_task_handoff');

    // Verify task_gate auto-approved
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
    driveTask(io, 1, 1);
    // Complete task 2
    const result = driveTask(io, 1, 2);

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

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // Drive to phase review
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    const result = processEvent('phase_report_completed', PROJECT_DIR, {
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

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReportDoc(1),
    }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    let result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approve',
    }, io);

    expect(result.success).toBe(true);
    // Phase gate auto-approves (autonomous) → commit conditional (auto_commit='ask') → invoke commit
    expect(result.action).toBe('invoke_source_control_commit');

    // Drive through commit → iteration 0 completed → advance to iteration 1 → create_phase_plan
    processEvent('source_control_commit_started', PROJECT_DIR, { phase: 1 }, io);
    result = processEvent('source_control_commit_completed', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // Verify phase_gate auto-approved
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
    driveTask(io, 1, 1);
    driveTask(io, 1, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReportDoc(1),
    }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approve',
    }, io);
    // Drive phase 1 commit (auto_commit='ask')
    processEvent('source_control_commit_started', PROJECT_DIR, { phase: 1 }, io);
    processEvent('source_control_commit_completed', PROJECT_DIR, { phase: 1 }, io);

    // ── Phase 2 full lifecycle ───────────────────────────────────────────
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 2 }, io);
    seedDoc(phasePlanDoc(2), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 2,
      doc_path: phasePlanDoc(2),
    }, io);
    driveTask(io, 2, 1);
    driveTask(io, 2, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 2 }, io);
    seedDoc(phaseReportDoc(2));
    processEvent('phase_report_completed', PROJECT_DIR, {
      phase: 2,
      doc_path: phaseReportDoc(2),
    }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 2 }, io);
    seedDoc(phaseReviewDoc(2));
    processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 2,
      doc_path: phaseReviewDoc(2),
      verdict: 'approve',
    }, io);
    // Drive phase 2 commit → phase_loop completes → spawn_final_reviewer
    processEvent('source_control_commit_started', PROJECT_DIR, { phase: 2 }, io);
    const result = processEvent('source_control_commit_completed', PROJECT_DIR, { phase: 2 }, io);

    expect(result.success).toBe(true);
    // Phase gate auto-approves → commit (auto_commit='ask') driven → phase_loop completes → spawn_final_reviewer
    expect(result.action).toBe('spawn_final_reviewer');

    // Verify phase_loop completed
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop.status).toBe('completed');
  });

  // ── Empty phase (0 tasks) → generate_phase_report ─────────────────────────

  it('[PARITY] v4:resolveExecution — empty phase with zero tasks advances to generate_phase_report', () => {
    // v4: resolvePhaseExecuting() → current_task === 0 && tasks.length === 0 → generate_phase_report
    const io = driveToExecution(1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [] });
    const result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phasePlanDoc(1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');
  });
});
