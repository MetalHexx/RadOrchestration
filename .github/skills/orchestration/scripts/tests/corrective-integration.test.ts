import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import type {
  PipelineState,
  OrchestrationConfig,
  IOAdapter,
  PipelineResult,
  StepNodeState,
  GateNodeState,
  ConditionalNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  CorrectiveTaskEntry,
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = '/tmp/test-project/CORRECTIVE-INTEGRATION';
const ORCH_ROOT = path.resolve(__dirname, '../../../..'); // points to .github

function makeConfig(overrides: {
  execution_mode?: string;
  after_planning?: boolean;
  after_final_review?: boolean;
  auto_commit?: string;
  auto_pr?: string;
  max_retries_per_task?: number;
} = {}): OrchestrationConfig {
  return {
    system: { orch_root: ORCH_ROOT },
    projects: { base_path: '', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: overrides.max_retries_per_task ?? 2,
      max_consecutive_review_rejections: 3,
    },
    human_gates: {
      after_planning: overrides.after_planning ?? true,
      execution_mode: overrides.execution_mode ?? 'autonomous',
      after_final_review: overrides.after_final_review ?? true,
    },
    source_control: {
      auto_commit: overrides.auto_commit ?? 'always',
      auto_pr: overrides.auto_pr ?? 'always',
      provider: 'github',
    },
    default_template: 'full',
  };
}

// Map of doc_path → document content used by mock readDocument
const DOC_STORE: Record<string, { frontmatter: Record<string, unknown>; content: string }> = {};

// ── Mock IOAdapter factory ────────────────────────────────────────────────────

type MockIO = IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
  ensureDirCalls: string[];
};

function createMockIO(
  initialState: PipelineState | null = null,
  config: OrchestrationConfig = makeConfig(),
): MockIO {
  let currentState = initialState ? structuredClone(initialState) : null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];
  const ensureDirCalls: string[] = [];

  return {
    get currentState() {
      return currentState;
    },
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
      return structuredClone(config);
    },
    readDocument(docPath: string): { frontmatter: Record<string, unknown>; content: string } | null {
      return DOC_STORE[docPath.replace(/\\/g, '/')] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
  DOC_STORE[docPath.replace(/\\/g, '/')] = {
    frontmatter: {
      title: path.basename(docPath, path.extname(docPath)),
      status: 'completed',
      ...extraFrontmatter,
    },
    content: `# ${path.basename(docPath)}`,
  };
}

const DOC_PATHS = {
  research: path.join(PROJECT_DIR, 'docs', 'research.md'),
  prd: path.join(PROJECT_DIR, 'docs', 'prd.md'),
  design: path.join(PROJECT_DIR, 'docs', 'design.md'),
  architecture: path.join(PROJECT_DIR, 'docs', 'architecture.md'),
  masterPlan: path.join(PROJECT_DIR, 'docs', 'master-plan.md'),
  phasePlan: (phase: number) => path.join(PROJECT_DIR, 'phases', `phase-${phase}-plan.md`),
  taskHandoff: (phase: number, task: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-handoff.md`),
  codeReview: (phase: number, task: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-review.md`),
  phaseReport: (phase: number) => path.join(PROJECT_DIR, 'phases', `phase-${phase}-report.md`),
  phaseReview: (phase: number) => path.join(PROJECT_DIR, 'phases', `phase-${phase}-review.md`),
  finalReview: path.join(PROJECT_DIR, 'docs', 'final-review.md'),
};

const TASKS_FIXTURE = [
  { id: 'T01', title: 'Task 1' },
  { id: 'T02', title: 'Task 2' },
];

/**
 * Drives the planning tier from init through plan_approved.
 * Returns the MockIO with state ready for execution-tier events.
 */
function drivePlanningTier(io: MockIO): PipelineResult {
  // Init scaffold
  processEvent('start', PROJECT_DIR, {}, io);
  // research in_progress
  processEvent('research_started', PROJECT_DIR, {}, io);
  // research completed
  seedDoc(DOC_PATHS.research);
  processEvent('research_completed', PROJECT_DIR, { doc_path: DOC_PATHS.research }, io);

  // prd
  processEvent('prd_started', PROJECT_DIR, {}, io);
  seedDoc(DOC_PATHS.prd);
  processEvent('prd_completed', PROJECT_DIR, { doc_path: DOC_PATHS.prd }, io);

  // design
  processEvent('design_started', PROJECT_DIR, {}, io);
  seedDoc(DOC_PATHS.design);
  processEvent('design_completed', PROJECT_DIR, { doc_path: DOC_PATHS.design }, io);

  // architecture
  processEvent('architecture_started', PROJECT_DIR, {}, io);
  seedDoc(DOC_PATHS.architecture);
  processEvent('architecture_completed', PROJECT_DIR, { doc_path: DOC_PATHS.architecture }, io);

  // master_plan
  processEvent('master_plan_started', PROJECT_DIR, {}, io);
  seedDoc(DOC_PATHS.masterPlan, { total_phases: 2 });
  processEvent('master_plan_completed', PROJECT_DIR, { doc_path: DOC_PATHS.masterPlan }, io);

  // plan_approved → triggers phase_loop expansion
  return processEvent('plan_approved', PROJECT_DIR, { doc_path: DOC_PATHS.masterPlan }, io);
}

/**
 * Drives one task through the full started → handoff → execute → review cycle.
 * Returns the result of the final code_review_completed event.
 */
function driveTask(io: MockIO, phase: number, task: number): PipelineResult {
  const ctx = { phase, task };

  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);

  const handoffDoc = DOC_PATHS.taskHandoff(phase, task);
  seedDoc(handoffDoc);
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);

  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);

  processEvent('code_review_started', PROJECT_DIR, ctx, io);

  const reviewDoc = DOC_PATHS.codeReview(phase, task);
  seedDoc(reviewDoc);
  let result = processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict: 'approved',
  }, io);

  // If commit conditional fires, drive commit events at task scope
  if (result.action === 'invoke_source_control_commit') {
    processEvent('commit_started', PROJECT_DIR, ctx, io);
    result = processEvent('commit_completed', PROJECT_DIR, ctx, io);
  }

  // If task gate fires, approve it to continue
  if (result.action === 'gate_task') {
    result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
  }

  return result;
}

/**
 * Drives a task through handoff → execute → code review with a configurable verdict.
 * Used for the initial task drive before corrective injection.
 */
function driveTaskWithVerdict(
  io: MockIO,
  phase: number,
  task: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase, task };

  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);

  const handoffDoc = DOC_PATHS.taskHandoff(phase, task);
  seedDoc(handoffDoc);
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);

  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);

  processEvent('code_review_started', PROJECT_DIR, ctx, io);

  const reviewDoc = DOC_PATHS.codeReview(phase, task);
  seedDoc(reviewDoc);
  return processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict,
  }, io);
}

/**
 * Drives a corrective task through the same handoff → execute → review cycle.
 * The events use the same {phase, task} context because the engine's mutations
 * route to the latest corrective task's nodes via resolveNodeState.
 */
function driveCorrectiveTask(
  io: MockIO,
  phase: number,
  task: number,
  _corrective: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase, task };

  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);

  const handoffDoc = DOC_PATHS.taskHandoff(phase, task);
  seedDoc(handoffDoc);
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);

  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);

  processEvent('code_review_started', PROJECT_DIR, ctx, io);

  const reviewDoc = DOC_PATHS.codeReview(phase, task);
  seedDoc(reviewDoc);
  let result = processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict,
  }, io);

  // If commit conditional fires, drive commit events at task scope
  if (result.action === 'invoke_source_control_commit') {
    processEvent('commit_started', PROJECT_DIR, ctx, io);
    result = processEvent('commit_completed', PROJECT_DIR, ctx, io);
  }

  // If task gate fires (verdict='approve' path), approve it to continue
  if (result.action === 'gate_task') {
    result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
  }

  return result;
}

/**
 * Drives post-task-loop phase steps: report, review, gate.
 * Returns the result of the last event for the phase.
 */
function drivePhasePostTasks(io: MockIO, phase: number): PipelineResult {
  const ctx = { phase };

  processEvent('phase_report_started', PROJECT_DIR, ctx, io);
  const reportDoc = DOC_PATHS.phaseReport(phase);
  seedDoc(reportDoc);
  processEvent('phase_report_created', PROJECT_DIR, { ...ctx, doc_path: reportDoc }, io);

  processEvent('phase_review_started', PROJECT_DIR, ctx, io);
  const reviewDoc = DOC_PATHS.phaseReview(phase);
  seedDoc(reviewDoc);
  let reviewResult = processEvent('phase_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict: 'approved',
    exit_criteria_met: true,
  }, io);

  // If phase gate fires, approve it to continue
  if (reviewResult.action === 'gate_phase') {
    reviewResult = processEvent('phase_gate_approved', PROJECT_DIR, ctx, io);
  }

  return reviewResult;
}

/**
 * Drives phase post-task steps up to phase_review_completed with a configurable verdict.
 */
function drivePhasePostTasksWithVerdict(
  io: MockIO,
  phase: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase };

  processEvent('phase_report_started', PROJECT_DIR, ctx, io);
  const reportDoc = DOC_PATHS.phaseReport(phase);
  seedDoc(reportDoc);
  processEvent('phase_report_created', PROJECT_DIR, { ...ctx, doc_path: reportDoc }, io);

  processEvent('phase_review_started', PROJECT_DIR, ctx, io);
  const reviewDoc = DOC_PATHS.phaseReview(phase);
  seedDoc(reviewDoc);
  return processEvent('phase_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict,
    exit_criteria_met: true,
  }, io);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Corrective-tier integration — task-level corrective loops', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('single task corrective loop — changes_requested → corrective task → approve → advances to next task', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    // ── Planning tier ────────────────────────────────────────────────────
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // ── Phase 1 setup ────────────────────────────────────────────────────
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    // ── Phase 1, Task 1 — drive with changes_requested ──────────────────
    result = driveTaskWithVerdict(io, 1, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Verify corrective entry was created
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const iteration = taskLoop.iterations[0];
      expect(iteration.corrective_tasks).toHaveLength(1);
      const ct = iteration.corrective_tasks[0];
      expect(ct.index).toBe(1);
      expect(ct.injected_after).toBe('code_review');
      expect(ct.reason).toBe('Code review requested changes');
      expect(ct.status).toBe('in_progress'); // walker promotes not_started → in_progress
    }

    // ── Drive corrective task 1 with approve ─────────────────────────────
    result = driveCorrectiveTask(io, 1, 1, 1, 'approved');
    expect(result.success).toBe(true);
    // task_gate auto-approves → corrective completes → iteration completes → next task
    expect(result.action).toBe('create_task_handoff');

    // Verify corrective entry completed and iteration completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const iteration = taskLoop.iterations[0];
      expect(iteration.corrective_tasks[0].status).toBe('completed');
      expect(iteration.status).toBe('completed');
      // Walker has advanced to task 2
      expect(taskLoop.iterations[1].status).toBe('in_progress');
    }
  });

  it('multiple retries then approval — two changes_requested → two corrective entries → second approved → advances', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // Phase 1 setup
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    // Task 1 — first changes_requested
    result = driveTaskWithVerdict(io, 1, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Corrective task 1 — also changes_requested
    result = driveCorrectiveTask(io, 1, 1, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Verify two corrective entries
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const iteration = taskLoop.iterations[0];
      expect(iteration.corrective_tasks).toHaveLength(2);
      expect(iteration.corrective_tasks[0].index).toBe(1);
      expect(iteration.corrective_tasks[1].index).toBe(2);
    }

    // Corrective task 2 — approve
    result = driveCorrectiveTask(io, 1, 1, 2, 'approved');
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Verify iteration completed and walker advanced to task 2
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].status).toBe('completed');
      expect(taskLoop.iterations[0].corrective_tasks[1].status).toBe('completed');
      expect(taskLoop.iterations[1].status).toBe('in_progress');
    }
  });

  it('budget exhaustion halts — max_retries_per_task corrective entries + another changes_requested → halted', () => {
    const io = createMockIO(null, makeConfig({ max_retries_per_task: 2 }));
    let result: PipelineResult;

    drivePlanningTier(io);

    // Phase 1 setup
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    // Task 1 — first changes_requested (injects corrective 1)
    driveTaskWithVerdict(io, 1, 1, 'changes_requested');

    // Corrective task 1 — changes_requested (injects corrective 2)
    driveCorrectiveTask(io, 1, 1, 1, 'changes_requested');

    // Verify 2 corrective entries (= max_retries_per_task)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(2);
    }

    // Corrective task 2 — changes_requested again → budget exhausted → halted
    result = driveCorrectiveTask(io, 1, 1, 2, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    // Verify iteration is halted
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].status).toBe('halted');
    }
  });

  it('code review rejected halts — rejected verdict → display_halted, graph halted', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // Phase 1 setup
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    // Task 1 — rejected
    result = driveTaskWithVerdict(io, 1, 1, 'rejected');
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    // Verify iteration is halted with no corrective entries
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].status).toBe('halted');
      expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(0);
    }
  });
});

describe('Corrective-tier integration — phase-level corrective loops', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('phase-level corrective loop — phase review changes_requested → re-planning → complete → advances', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // ── Phase 1 — first pass: complete all tasks normally ────────────────
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // ── Phase review with changes_requested → corrective re-planning ─────
    result = drivePhasePostTasksWithVerdict(io, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');  // walker re-enters phase planning
    expect(result.context['previous_review']).toBeTruthy();  // doc_path preserved through reset

    // Verify phase-level corrective entry created with empty nodes
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const iteration = phaseLoop.iterations[0];
      expect(iteration.corrective_tasks).toHaveLength(1);
      const ct = iteration.corrective_tasks[0];
      expect(ct.index).toBe(1);
      expect(ct.injected_after).toBe('phase_review');
      expect(ct.reason).toBe('Phase review requested changes');
      expect(ct.status).toBe('in_progress');
      expect(Object.keys(ct.nodes)).toHaveLength(0);  // empty — tasks created by re-planning
      // Phase planning reset to not_started
      expect(iteration.nodes['phase_planning'].status).toBe('not_started');
      // Task loop iterations cleared
      const taskLoop = iteration.nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations).toHaveLength(0);
    }

    // ── Phase 1 — corrective pass: re-run phase planning and tasks ───────
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // ── Phase report, review (approve), gate ───────────────────────────
    result = drivePhasePostTasks(io, 1);

    // Verify corrective entry completed and phase iteration completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const iteration = phaseLoop.iterations[0];
      expect(iteration.corrective_tasks[0].status).toBe('completed');
      expect(iteration.status).toBe('completed');
    }

    // Walker should advance to phase 2
    expect(result.action).toBe('create_phase_plan');
  });

  it('phase review rejected halts — rejected verdict → display_halted, graph halted', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // Phase 1 — complete all tasks normally
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // Phase review with rejected
    result = drivePhasePostTasksWithVerdict(io, 1, 'rejected');
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');

    // Verify phase iteration is halted with no corrective entries
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.iterations[0].status).toBe('halted');
      expect(phaseLoop.iterations[0].corrective_tasks).toHaveLength(0);
    }
  });
});

describe('Corrective-tier integration — validator enforcement', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('validator rejects corrupted state — no state write occurs', () => {
    const io = createMockIO(null, makeConfig());

    // Drive planning tier to get a valid state
    drivePlanningTier(io);

    // Manually corrupt: set phase_loop to 'completed' while children are still in_progress/not_started
    // This violates the checkCompletedParentChildren invariant
    (io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState).status = 'completed';

    const writeCountBefore = io.writeCalls.length;

    // Fire a subsequent event — mutation sets phase_planning to in_progress,
    // validator sees completed phase_loop with in_progress child → rejects
    const result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(false);

    // No state write should have occurred
    expect(io.writeCalls.length).toBe(writeCountBefore);
  });
});
