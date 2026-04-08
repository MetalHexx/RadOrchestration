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
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_DIR = '/tmp/test-project/EXEC-INTEGRATION';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORCH_ROOT = path.resolve(__dirname, '../../../..'); // points to .github

function makeConfig(overrides: {
  execution_mode?: string;
  after_planning?: boolean;
  after_final_review?: boolean;
  auto_commit?: string;
  auto_pr?: string;
} = {}): OrchestrationConfig {
  return {
    system: { orch_root: ORCH_ROOT },
    projects: { base_path: '', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
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
      return DOC_STORE[docPath] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
  DOC_STORE[docPath] = {
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
  processEvent('research_started', PROJECT_DIR, {}, io);
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
  processEvent('execution_completed', PROJECT_DIR, ctx, io);

  processEvent('code_review_started', PROJECT_DIR, ctx, io);

  const reviewDoc = DOC_PATHS.codeReview(phase, task);
  seedDoc(reviewDoc);
  let result = processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict: 'approve',
  }, io);

  // If task gate fires, approve it to continue
  if (result.action === 'gate_task') {
    result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
  }

  return result;
}

/**
 * Drives post-task-loop phase steps: report, review, gate, commit conditional.
 * Returns the result of the last event for the phase.
 */
function drivePhasePostTasks(io: MockIO, phase: number, expectCommit: boolean): PipelineResult {
  const ctx = { phase };

  processEvent('phase_report_started', PROJECT_DIR, ctx, io);
  const reportDoc = DOC_PATHS.phaseReport(phase);
  seedDoc(reportDoc);
  processEvent('phase_report_completed', PROJECT_DIR, { ...ctx, doc_path: reportDoc }, io);

  processEvent('phase_review_started', PROJECT_DIR, ctx, io);
  const reviewDoc = DOC_PATHS.phaseReview(phase);
  seedDoc(reviewDoc);
  let reviewResult = processEvent('phase_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict: 'approve',
    exit_criteria_met: true,
  }, io);

  // If phase gate fires, approve it to continue
  if (reviewResult.action === 'gate_phase') {
    reviewResult = processEvent('phase_gate_approved', PROJECT_DIR, ctx, io);
  }

  if (!expectCommit) {
    return reviewResult;
  }

  // commit conditional takes true branch
  processEvent('source_control_commit_started', PROJECT_DIR, ctx, io);
  return processEvent('source_control_commit_completed', PROJECT_DIR, ctx, io);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Execution-tier integration — complete pipeline run', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('walks plan_approved → display_complete through 2 phases × 2 tasks (autonomous, auto_commit=always, auto_pr=always)', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    // ── Planning tier ────────────────────────────────────────────────────
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // ── Verify phase_loop expansion ──────────────────────────────────────
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.status).toBe('in_progress');
      expect(phaseLoop.iterations).toHaveLength(2);
      expect(phaseLoop.iterations[0].index).toBe(0);
      expect(phaseLoop.iterations[1].index).toBe(1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 1
    // ══════════════════════════════════════════════════════════════════════

    // ── phase_planning_started (phase 1) ─────────────────────────────────
    result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // ── phase_plan_created (phase 1) → triggers task_loop expansion ─────
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // ── Verify task_loop expansion in iteration 0 ────────────────────────
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('in_progress');
      expect(taskLoop.iterations).toHaveLength(2);
    }

    // ── Phase 1, Task 1 ──────────────────────────────────────────────────
    result = driveTask(io, 1, 1);
    expect(result.success).toBe(true);
    // task_gate fires in autonomous mode → driveTask approves it → advance to task 2
    expect(result.action).toBe('create_task_handoff');

    // Verify task_gate fired and was approved (gate_active = true)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(true);
    }

    // ── Phase 1, Task 2 ──────────────────────────────────────────────────
    result = driveTask(io, 1, 2);
    expect(result.success).toBe(true);
    // task_gate fires → driveTask approves it → task_loop completes → phase_report
    expect(result.action).toBe('generate_phase_report');

    // Verify task_gate for task 2 fired and was approved (gate_active = true)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[1].nodes['task_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(true);
    }

    // ── Phase 1 post-task steps ──────────────────────────────────────────
    result = drivePhasePostTasks(io, 1, true);
    expect(result.success).toBe(true);
    // After commit_completed → advance to phase 2
    expect(result.action).toBe('create_phase_plan');

    // Verify phase_gate fired and was approved (gate_active = true)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(true);
    }

    // Verify commit conditional branch_taken
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const cond = phaseLoop.iterations[0].nodes['phase_commit_gate'] as ConditionalNodeState;
      expect(cond.branch_taken).toBe('true');
      expect(cond.status).toBe('completed');
    }

    // Verify iteration 0 completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.iterations[0].status).toBe('completed');
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 2
    // ══════════════════════════════════════════════════════════════════════

    // ── phase_planning_started (phase 2) ─────────────────────────────────
    result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 2 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // ── phase_plan_created (phase 2) → triggers task_loop expansion ─────
    seedDoc(DOC_PATHS.phasePlan(2), { tasks: TASKS_FIXTURE });
    result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 2,
      doc_path: DOC_PATHS.phasePlan(2),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // ── Verify task_loop expansion in iteration 1 ────────────────────────
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[1].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('in_progress');
      expect(taskLoop.iterations).toHaveLength(2);
    }

    // ── Phase 2, Task 1 ──────────────────────────────────────────────────
    result = driveTask(io, 2, 1);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // ── Phase 2, Task 2 ──────────────────────────────────────────────────
    result = driveTask(io, 2, 2);
    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');

    // ── Phase 2 post-task steps ──────────────────────────────────────────
    result = drivePhasePostTasks(io, 2, true);
    expect(result.success).toBe(true);
    // After commit_completed for phase 2 → phase_loop completes → final_review
    expect(result.action).toBe('spawn_final_reviewer');

    // Verify phase_loop completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.status).toBe('completed');
      expect(phaseLoop.iterations[1].status).toBe('completed');
    }

    // ══════════════════════════════════════════════════════════════════════
    // Final review + PR
    // ══════════════════════════════════════════════════════════════════════

    // ── final_review_started ─────────────────────────────────────────────
    result = processEvent('final_review_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_final_reviewer');

    // ── final_review_completed ───────────────────────────────────────────
    seedDoc(DOC_PATHS.finalReview);
    result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: DOC_PATHS.finalReview,
      verdict: 'approve',
    }, io);
    expect(result.success).toBe(true);
    // final_approval_gate active (after_final_review = true)
    expect(result.action).toBe('request_final_approval');

    // ── final_review_approved ────────────────────────────────────────────
    result = processEvent('final_review_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    // PR conditional: auto_pr='always' neq 'never' → true branch → invoke PR
    expect(result.action).toBe('invoke_source_control_pr');

    // Verify PR conditional branch_taken
    {
      const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
      expect(prGate.branch_taken).toBe('true');
      expect(prGate.status).toBe('in_progress');
    }

    // ── source_control_pr_started ────────────────────────────────────────
    result = processEvent('source_control_pr_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');

    // ── source_control_pr_completed → display_complete ───────────────────
    result = processEvent('source_control_pr_completed', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');

    // ── Final state assertions ───────────────────────────────────────────
    // Verify all top-level nodes completed
    const nodes = io.currentState!.graph.nodes;
    expect((nodes['research'] as StepNodeState).status).toBe('completed');
    expect((nodes['master_plan'] as StepNodeState).status).toBe('completed');
    expect((nodes['plan_approval_gate'] as GateNodeState).status).toBe('completed');
    expect((nodes['phase_loop'] as ForEachPhaseNodeState).status).toBe('completed');
    expect((nodes['final_review'] as StepNodeState).status).toBe('completed');
    expect((nodes['final_approval_gate'] as GateNodeState).status).toBe('completed');
    expect((nodes['pr_gate'] as ConditionalNodeState).status).toBe('completed');

    expect(io.currentState!.graph.status).toBe('completed');
  });
});

describe('Execution-tier integration — gate mode variations', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('gates are active in ask mode — requires explicit approval events', () => {
    const config = makeConfig({ execution_mode: 'ask' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    // Drive planning tier
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // Phase 1 setup
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    // Phase 1, Task 1 — manual drive (no auto gate-approval so we observe gate_task)
    {
      const ctx = { phase: 1, task: 1 };
      processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
      const h = DOC_PATHS.taskHandoff(1, 1); seedDoc(h);
      processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: h }, io);
      processEvent('execution_started', PROJECT_DIR, ctx, io);
      processEvent('execution_completed', PROJECT_DIR, ctx, io);
      processEvent('code_review_started', PROJECT_DIR, ctx, io);
      const r = DOC_PATHS.codeReview(1, 1); seedDoc(r);
      result = processEvent('code_review_completed', PROJECT_DIR, { ...ctx, doc_path: r, verdict: 'approve' }, io);
    }
    expect(result.success).toBe(true);
    // task_gate is active in 'ask' mode → returns gate_task
    expect(result.action).toBe('gate_task');

    // Verify task_gate is active
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
      expect(gate.gate_active).toBe(true);
      expect(gate.status).toBe('not_started');
    }

    // Explicit task_gate_approved
    result = processEvent('task_gate_approved', PROJECT_DIR, { phase: 1, task: 1 }, io);
    expect(result.success).toBe(true);
    // After approval → advance to task 2
    expect(result.action).toBe('create_task_handoff');

    // Phase 1, Task 2 — manual drive (no auto gate-approval so we observe gate_task)
    {
      const ctx = { phase: 1, task: 2 };
      processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
      const h = DOC_PATHS.taskHandoff(1, 2); seedDoc(h);
      processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: h }, io);
      processEvent('execution_started', PROJECT_DIR, ctx, io);
      processEvent('execution_completed', PROJECT_DIR, ctx, io);
      processEvent('code_review_started', PROJECT_DIR, ctx, io);
      const r = DOC_PATHS.codeReview(1, 2); seedDoc(r);
      result = processEvent('code_review_completed', PROJECT_DIR, { ...ctx, doc_path: r, verdict: 'approve' }, io);
    }
    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_task');

    // Explicit task_gate_approved for task 2
    result = processEvent('task_gate_approved', PROJECT_DIR, { phase: 1, task: 2 }, io);
    expect(result.success).toBe(true);
    // All tasks done → phase_report
    expect(result.action).toBe('generate_phase_report');

    // Drive phase report + review
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    const reportDoc = DOC_PATHS.phaseReport(1);
    seedDoc(reportDoc);
    processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: reportDoc }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const reviewDoc = DOC_PATHS.phaseReview(1);
    seedDoc(reviewDoc);
    result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: reviewDoc,
      verdict: 'approve',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    // phase_gate is active in 'ask' mode → returns gate_phase
    expect(result.action).toBe('gate_phase');

    // Verify phase_gate is active
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
      expect(gate.gate_active).toBe(true);
      expect(gate.status).toBe('not_started');
    }

    // Explicit phase_gate_approved
    result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    // After phase gate approved → commit conditional (auto_commit=always) → invoke_source_control_commit
    expect(result.action).toBe('invoke_source_control_commit');
  });

  it('execution_mode=task fires task gates and phase gate (requires explicit approvals)', () => {
    const config = makeConfig({ execution_mode: 'task' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    // Drive planning tier
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // Phase 1 setup
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    // Phase 1, Task 1 — driveTask approves gate internally
    result = driveTask(io, 1, 1);
    expect(result.success).toBe(true);
    // task_gate fires in 'task' mode → driveTask approves it → advance to task 2
    expect(result.action).toBe('create_task_handoff');

    // Verify task_gate fired and was approved (gate_active = true)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(true);
    }

    // Phase 1, Task 2
    result = driveTask(io, 1, 2);
    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');

    // Drive phase report + review
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    const reportDoc = DOC_PATHS.phaseReport(1);
    seedDoc(reportDoc);
    processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: reportDoc }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const reviewDoc = DOC_PATHS.phaseReview(1);
    seedDoc(reviewDoc);
    result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: reviewDoc,
      verdict: 'approve',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    // phase_gate fires in 'task' mode
    expect(result.action).toBe('gate_phase');

    // Approve phase gate → commit conditional
    result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');

    // Verify phase_gate fired and was approved (gate_active = true)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(true);
    }
  });
});

describe('Execution-tier integration — conditional branch variations', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('auto_commit=never skips commit step, proceeds to next phase', () => {
    const config = makeConfig({ auto_commit: 'never' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    result = drivePlanningTier(io);
    expect(result.action).toBe('create_phase_plan');

    // Phase 1 setup + tasks
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // Phase review completes → phase_gate auto-approves (autonomous) →
    // commit conditional: 'never' neq 'never' → false → branch_taken='false' → skip → next phase
    result = drivePhasePostTasks(io, 1, false);
    expect(result.success).toBe(true);
    // Walker should proceed to phase 2 (commit skipped)
    expect(result.action).toBe('create_phase_plan');

    // Verify commit conditional took false branch
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const cond = phaseLoop.iterations[0].nodes['phase_commit_gate'] as ConditionalNodeState;
      expect(cond.branch_taken).toBe('false');
      expect(cond.status).toBe('completed');
    }
  });

  it('auto_pr=never skips PR step, display_complete follows final approval directly', () => {
    const config = makeConfig({ auto_pr: 'never' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    result = drivePlanningTier(io);
    expect(result.action).toBe('create_phase_plan');

    // Drive 2 phases × 2 tasks through completion
    for (let phase = 1; phase <= 2; phase++) {
      processEvent('phase_planning_started', PROJECT_DIR, { phase }, io);
      seedDoc(DOC_PATHS.phasePlan(phase), { tasks: TASKS_FIXTURE });
      processEvent('phase_plan_created', PROJECT_DIR, {
        phase,
        doc_path: DOC_PATHS.phasePlan(phase),
      }, io);

      driveTask(io, phase, 1);
      driveTask(io, phase, 2);
      drivePhasePostTasks(io, phase, true);
    }

    // Final review
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    seedDoc(DOC_PATHS.finalReview);
    processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: DOC_PATHS.finalReview,
      verdict: 'approve',
    }, io);

    // final_review_approved → PR conditional: 'never' neq 'never' → false → skip PR → display_complete
    result = processEvent('final_review_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');

    // Verify PR conditional took false branch
    {
      const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
      expect(prGate.branch_taken).toBe('false');
      expect(prGate.status).toBe('completed');
    }
  });

  it('auto_commit=always emits invoke_source_control_commit', () => {
    const config = makeConfig({ auto_commit: 'always' });
    const io = createMockIO(null, config);

    drivePlanningTier(io);

    // Phase 1 setup + tasks
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // After phase_review_completed, phase_gate auto-approves, commit conditional: true
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    const reportDoc = DOC_PATHS.phaseReport(1);
    seedDoc(reportDoc);
    processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: reportDoc }, io);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const reviewDoc = DOC_PATHS.phaseReview(1);
    seedDoc(reviewDoc);
    let result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: reviewDoc,
      verdict: 'approve',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');
    // Approve phase gate → commit conditional: auto_commit=always → true branch
    result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');

    // Verify commit conditional took true branch
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const cond = phaseLoop.iterations[0].nodes['phase_commit_gate'] as ConditionalNodeState;
      expect(cond.branch_taken).toBe('true');
    }
  });

  it('auto_pr=always emits invoke_source_control_pr', () => {
    const config = makeConfig({ auto_pr: 'always' });
    const io = createMockIO(null, config);

    drivePlanningTier(io);

    // Drive 2 phases × 2 tasks through completion
    for (let phase = 1; phase <= 2; phase++) {
      processEvent('phase_planning_started', PROJECT_DIR, { phase }, io);
      seedDoc(DOC_PATHS.phasePlan(phase), { tasks: TASKS_FIXTURE });
      processEvent('phase_plan_created', PROJECT_DIR, {
        phase,
        doc_path: DOC_PATHS.phasePlan(phase),
      }, io);

      driveTask(io, phase, 1);
      driveTask(io, phase, 2);
      drivePhasePostTasks(io, phase, true);
    }

    // Final review
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    seedDoc(DOC_PATHS.finalReview);
    processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: DOC_PATHS.finalReview,
      verdict: 'approve',
    }, io);

    // final_review_approved → PR conditional: 'always' neq 'never' → true → invoke PR
    const result = processEvent('final_review_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');

    // Verify PR conditional took true branch
    {
      const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
      expect(prGate.branch_taken).toBe('true');
    }
  });
});

describe('Execution-tier integration — multi-iteration boundaries', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('phase 2 (iterations[1]) resolves correctly after phase 1 completes', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // Complete phase 1
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(DOC_PATHS.phasePlan(1), { tasks: TASKS_FIXTURE });
    processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 1,
      doc_path: DOC_PATHS.phasePlan(1),
    }, io);

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);
    result = drivePhasePostTasks(io, 1, true);
    expect(result.action).toBe('create_phase_plan');

    // Verify iteration 0 completed and iteration 1 is next
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.iterations[0].status).toBe('completed');
      expect(phaseLoop.iterations[0].index).toBe(0);
      // Walker already walked into iteration 1 to find next action, so it's in_progress
      expect(phaseLoop.iterations[1].status).toBe('in_progress');
      expect(phaseLoop.iterations[1].index).toBe(1);
    }

    // Start phase 2
    result = processEvent('phase_planning_started', PROJECT_DIR, { phase: 2 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');

    // Verify iteration 1 is now in_progress
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.iterations[1].status).toBe('in_progress');
    }

    // Complete phase 2 planning → task expansion
    seedDoc(DOC_PATHS.phasePlan(2), { tasks: TASKS_FIXTURE });
    result = processEvent('phase_plan_created', PROJECT_DIR, {
      phase: 2,
      doc_path: DOC_PATHS.phasePlan(2),
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Verify iteration 1 body nodes are independently scaffolded
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const iter1 = phaseLoop.iterations[1];
      const taskLoop = iter1.nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations).toHaveLength(2);
      expect(taskLoop.iterations[0].index).toBe(0);
      expect(taskLoop.iterations[1].index).toBe(1);
      // Phase 1's task states should not bleed into phase 2
      const taskHandoff = taskLoop.iterations[0].nodes['task_handoff'] as StepNodeState;
      expect(taskHandoff.status).toBe('not_started');
    }
  });

  it('task 2 (iterations[1]) resolves correctly after task 1 completes', () => {
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

    // Complete task 1
    result = driveTask(io, 1, 1);
    expect(result.action).toBe('create_task_handoff');

    // Verify task iteration 0 completed and iteration 1 is next
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].status).toBe('completed');
      expect(taskLoop.iterations[0].index).toBe(0);
      // Walker already walked into iteration 1 to find next action, so it's in_progress
      expect(taskLoop.iterations[1].status).toBe('in_progress');
      expect(taskLoop.iterations[1].index).toBe(1);
    }

    // Start task 2
    result = processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 2 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task_handoff');

    // Verify iteration 1 is now in_progress
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[1].status).toBe('in_progress');
    }

    // Verify task 2 body nodes are independently scaffolded (not polluted by task 1)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const task2 = taskLoop.iterations[1];
      const executor = task2.nodes['task_executor'] as StepNodeState;
      expect(executor.status).toBe('not_started');
      const review = task2.nodes['code_review'] as StepNodeState;
      expect(review.status).toBe('not_started');
    }

    // Complete task 2 → task_loop completes → phase_report
    const handoffDoc = DOC_PATHS.taskHandoff(1, 2);
    seedDoc(handoffDoc);
    processEvent('task_handoff_created', PROJECT_DIR, {
      phase: 1,
      task: 2,
      doc_path: handoffDoc,
    }, io);
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 2 }, io);
    processEvent('execution_completed', PROJECT_DIR, { phase: 1, task: 2 }, io);
    processEvent('code_review_started', PROJECT_DIR, { phase: 1, task: 2 }, io);
    const reviewDoc = DOC_PATHS.codeReview(1, 2);
    seedDoc(reviewDoc);
    result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 2,
      doc_path: reviewDoc,
      verdict: 'approve',
    }, io);

    // Task gate fires — approve it to advance
    expect(result.action).toBe('gate_task');
    result = processEvent('task_gate_approved', PROJECT_DIR, { phase: 1, task: 2 }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('generate_phase_report');

    // Verify both task iterations completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.status).toBe('completed');
      expect(taskLoop.iterations[0].status).toBe('completed');
      expect(taskLoop.iterations[1].status).toBe('completed');
    }
  });
});
