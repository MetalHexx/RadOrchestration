import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import { enrichActionContext } from '../lib/context-enrichment.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = '/tmp/test-project/CORRECTIVE-INTEGRATION';
const ORCH_ROOT = path.resolve(__dirname, '../../../..');

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
  masterPlan: path.join(PROJECT_DIR, 'docs', 'master-plan.md'),
  phasePlan: (phase: number) => path.join(PROJECT_DIR, 'phases', `phase-${phase}-plan.md`),
  taskHandoff: (phase: number, task: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-handoff.md`),
  correctiveHandoff: (phase: number, task: number, corrective: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-handoff-C${corrective}.md`),
  codeReview: (phase: number, task: number) =>
    path.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-review.md`),
  phaseReview: (phase: number) => path.join(PROJECT_DIR, 'phases', `phase-${phase}-review.md`),
  finalReview: path.join(PROJECT_DIR, 'docs', 'final-review.md'),
};

const TASKS_FIXTURE = [
  { id: 'T01', title: 'Task 1' },
  { id: 'T02', title: 'Task 2' },
];

/**
 * Pre-seeds phase_planning + task_handoff iteration child nodes (mirroring the
 * Iter 5 explosion-script post-condition) so the walker can advance into the
 * execution tier without per-loop authoring events.
 */
function seedExplosionState(io: MockIO, phaseTasks: Array<typeof TASKS_FIXTURE>): void {
  const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  for (let pIdx = 0; pIdx < phaseTasks.length; pIdx++) {
    const phaseNum = pIdx + 1;
    const phaseDoc = DOC_PATHS.phasePlan(phaseNum);
    seedDoc(phaseDoc, { tasks: phaseTasks[pIdx] });

    const phaseIter = phaseLoop.iterations[pIdx];
    phaseIter.nodes['phase_planning'] = {
      kind: 'step',
      status: 'completed',
      doc_path: phaseDoc,
      retries: 0,
    };

    const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    taskLoop.iterations = phaseTasks[pIdx].map((_, tIdx) => {
      const handoffDoc = DOC_PATHS.taskHandoff(phaseNum, tIdx + 1);
      seedDoc(handoffDoc);
      return {
        index: tIdx,
        status: 'not_started' as const,
        nodes: {
          task_handoff: {
            kind: 'step' as const,
            status: 'completed' as const,
            doc_path: handoffDoc,
            retries: 0,
          },
          task_executor: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          commit_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
          commit: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          code_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          task_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        },
        corrective_tasks: [],
        commit_hash: null,
      };
    });
  }
}

/**
 * Drives the planning tier from init through plan_approved AND the post-Iter-5
 * explosion-script seeding, leaving the pipeline at the first execution action
 * (`execute_task`). Returns that first result.
 */
function drivePlanningTier(io: MockIO): PipelineResult {
  // Init scaffold
  processEvent('start', PROJECT_DIR, {}, io);

  // master_plan
  processEvent('master_plan_started', PROJECT_DIR, {}, io);
  seedDoc(DOC_PATHS.masterPlan, { total_phases: 2, total_tasks: 4 });
  processEvent('master_plan_completed', PROJECT_DIR, { doc_path: DOC_PATHS.masterPlan }, io);

  // plan_approved → triggers phase_loop expansion on the next walker invocation
  processEvent('plan_approved', PROJECT_DIR, { doc_path: DOC_PATHS.masterPlan }, io);

  // Mirror Iter 5's explosion seeding then re-walk so subsequent events see
  // a state shape consistent with post-explosion production.
  seedExplosionState(io, [TASKS_FIXTURE, TASKS_FIXTURE]);
  return processEvent('start', PROJECT_DIR, {}, io);
}

/**
 * Drives one task through execute → review (approve). Post-Iter 7: no
 * task_handoff events; handoff is pre-seeded by seedExplosionState.
 */
function driveTask(io: MockIO, phase: number, task: number): PipelineResult {
  const ctx = { phase, task };

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
 * Iter 10 — build the review-doc frontmatter for a given raw verdict.
 * On `changes_requested` the orchestrator's mediation contract requires
 * `orchestrator_mediated: true`, `effective_outcome`, and (iff the
 * effective_outcome is `changes_requested`) a `corrective_handoff_path`.
 * Approved / rejected verdicts pass through with no mediation fields.
 */
function buildReviewFrontmatter(
  verdict: string,
  opts: { effectiveOutcome?: string; correctiveHandoffPath?: string } = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = { verdict };
  if (verdict === 'changes_requested') {
    const effective = opts.effectiveOutcome ?? 'changes_requested';
    base.orchestrator_mediated = true;
    base.effective_outcome = effective;
    if (effective === 'changes_requested' && opts.correctiveHandoffPath) {
      base.corrective_handoff_path = opts.correctiveHandoffPath;
    }
  }
  return base;
}

/**
 * Drives a task through execute → code review with a configurable verdict.
 * On `changes_requested`, automatically allocates a corrective handoff path at
 * C1 (this is the first corrective for the task) — the orchestrator mediation
 * contract requires both the frontmatter fields AND the same fields echoed onto
 * the event context (they flow from frontmatter via pre-reads in production,
 * but integration tests pass them both via seedDoc + processEvent context).
 */
function driveTaskWithVerdict(
  io: MockIO,
  phase: number,
  task: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase, task };

  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);

  processEvent('code_review_started', PROJECT_DIR, ctx, io);

  const reviewDoc = DOC_PATHS.codeReview(phase, task);
  const correctiveHandoffPath = verdict === 'changes_requested'
    ? DOC_PATHS.correctiveHandoff(phase, task, 1)
    : undefined;
  const reviewFrontmatter = buildReviewFrontmatter(verdict, {
    correctiveHandoffPath,
  });
  seedDoc(reviewDoc, reviewFrontmatter);
  return processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    ...reviewFrontmatter,
  } as Record<string, unknown>, io);
}

/**
 * Drives a corrective task through execute → review. The events use the same
 * {phase, task} context because the engine's mutations route to the latest
 * corrective task's nodes via resolveNodeState. Looks up the current
 * corrective count off state to compute the next C-index for the review's
 * `corrective_handoff_path`.
 */
function driveCorrectiveTask(
  io: MockIO,
  phase: number,
  task: number,
  corrective: number,
  verdict: string,
): PipelineResult {
  const ctx = { phase, task };

  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);

  processEvent('code_review_started', PROJECT_DIR, ctx, io);

  const reviewDoc = DOC_PATHS.codeReview(phase, task);
  // On `changes_requested`, the next corrective index is (corrective + 1)
  // because `corrective` is the index of the corrective that just completed.
  const nextCorrectiveIndex = corrective + 1;
  const correctiveHandoffPath = verdict === 'changes_requested'
    ? DOC_PATHS.correctiveHandoff(phase, task, nextCorrectiveIndex)
    : undefined;
  const reviewFrontmatter = buildReviewFrontmatter(verdict, {
    correctiveHandoffPath,
  });
  seedDoc(reviewDoc, reviewFrontmatter);
  let result = processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    ...reviewFrontmatter,
  } as Record<string, unknown>, io);

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
 * Drives post-task-loop phase steps: review, gate.
 * Returns the result of the last event for the phase.
 * Post-Iter 8: phase_review absorbs phase_report — only one doc emitted.
 */
function drivePhasePostTasks(io: MockIO, phase: number): PipelineResult {
  const ctx = { phase };

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
    expect(result.action).toBe('execute_task');

    // ── Phase 1, Task 1 — drive with changes_requested ──────────────────
    result = driveTaskWithVerdict(io, 1, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

    // Verify corrective entry was created and synthesized task_handoff is pre-completed
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
      // Iter 10 — synthesized task_handoff shape (birth-on-handoff-path).
      const taskHandoff = ct.nodes['task_handoff'] as StepNodeState;
      expect(taskHandoff).toEqual({
        kind: 'step',
        status: 'completed',
        doc_path: DOC_PATHS.correctiveHandoff(1, 1, 1),
        retries: 0,
      });
    }

    // ── Drive corrective task 1 with approve ─────────────────────────────
    result = driveCorrectiveTask(io, 1, 1, 1, 'approved');
    expect(result.success).toBe(true);
    // task_gate auto-approves → corrective completes → iteration completes → next task
    expect(result.action).toBe('execute_task');

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
    const config = makeConfig();
    let result: PipelineResult;

    drivePlanningTier(io);

    // Phase 1 setup

    // Task 1 — first changes_requested → births corrective 1
    result = driveTaskWithVerdict(io, 1, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

    // Iter 10 multi-round persistence: after corrective 1 is born, enriching
    // execute_task must surface the corrective's synthesized task_handoff path
    // as handoff_doc (not the original iteration's handoff). This is the
    // guarantee the v7 carry-forward test was parked on; Iter 10 resolves it.
    {
      const enrichedExec = enrichActionContext({
        action: 'execute_task',
        walkerContext: {},
        state: io.currentState!,
        config,
        cliContext: {},
      });
      expect(enrichedExec.handoff_doc).toBe(DOC_PATHS.correctiveHandoff(1, 1, 1));
      // spawn_code_reviewer enrichment exposes corrective_index for round 1
      const enrichedReviewer = enrichActionContext({
        action: 'spawn_code_reviewer',
        walkerContext: {},
        state: io.currentState!,
        config,
        cliContext: {},
      });
      expect(enrichedReviewer.is_correction).toBe(true);
      expect(enrichedReviewer.corrective_index).toBe(1);
      // Synthesized task_handoff shape on corrective 1
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect((taskLoop.iterations[0].corrective_tasks[0].nodes['task_handoff'] as StepNodeState)).toEqual({
        kind: 'step',
        status: 'completed',
        doc_path: DOC_PATHS.correctiveHandoff(1, 1, 1),
        retries: 0,
      });
    }

    // Corrective task 1 — also changes_requested → births corrective 2
    result = driveCorrectiveTask(io, 1, 1, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

    // Verify two corrective entries
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const iteration = taskLoop.iterations[0];
      expect(iteration.corrective_tasks).toHaveLength(2);
      expect(iteration.corrective_tasks[0].index).toBe(1);
      expect(iteration.corrective_tasks[1].index).toBe(2);
      // Synthesized handoffs — each corrective carries its own path.
      expect((iteration.corrective_tasks[0].nodes['task_handoff'] as StepNodeState).doc_path)
        .toBe(DOC_PATHS.correctiveHandoff(1, 1, 1));
      expect((iteration.corrective_tasks[1].nodes['task_handoff'] as StepNodeState).doc_path)
        .toBe(DOC_PATHS.correctiveHandoff(1, 1, 2));
    }

    // Iter 10 round-2 persistence: after the second corrective is born and
    // becomes the active one, execute_task enrichment routes handoff_doc to
    // the C2 path; spawn_code_reviewer's corrective_index advances to 2.
    {
      const enrichedExec = enrichActionContext({
        action: 'execute_task',
        walkerContext: {},
        state: io.currentState!,
        config,
        cliContext: {},
      });
      expect(enrichedExec.handoff_doc).toBe(DOC_PATHS.correctiveHandoff(1, 1, 2));
      const enrichedReviewer = enrichActionContext({
        action: 'spawn_code_reviewer',
        walkerContext: {},
        state: io.currentState!,
        config,
        cliContext: {},
      });
      expect(enrichedReviewer.is_correction).toBe(true);
      expect(enrichedReviewer.corrective_index).toBe(2);
    }

    // Corrective task 2 — approve
    result = driveCorrectiveTask(io, 1, 1, 2, 'approved');
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

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

  // Skipped in Iter 7; Iter 11 rewires corrective cycles via corrective-task-append. See docs/internals/cheaper-execution/iter-11-phase-corrective-cycles.md.
  it.skip('phase-level corrective loop — phase review changes_requested → re-planning → complete → advances', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // ── Phase 1 — first pass: complete all tasks normally ────────────────

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // ── Phase review with changes_requested → corrective re-planning ─────
    result = drivePhasePostTasksWithVerdict(io, 1, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
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
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

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
    expect(result.action).toBe('execute_task');
  });

  it('phase review rejected halts — rejected verdict → display_halted, graph halted', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // Phase 1 — complete all tasks normally

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

    // Manually corrupt: set phase_loop to 'completed' while children are still in_progress/not_started.
    // This violates the checkCompletedParentChildren invariant.
    (io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState).status = 'completed';

    const writeCountBefore = io.writeCalls.length;

    // Fire a subsequent event — mutation sets phase_review to in_progress,
    // validator sees completed phase_loop with in_progress child → rejects.
    // (Post-Iter 8: phase_review_started is the first post-task-loop _started event.)
    const result = processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(false);

    // No state write should have occurred
    expect(io.writeCalls.length).toBe(writeCountBefore);
  });
});
