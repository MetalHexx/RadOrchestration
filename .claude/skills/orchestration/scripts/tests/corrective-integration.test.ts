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

  it('budget exhaustion — rogue orchestrator supplies handoff anyway → contract-violation halt', () => {
    // This test exercises the mutation-side BACKSTOP halt branch: the
    // orchestrator incorrectly authored a handoff after budget was exhausted
    // (violates the playbook's soft contract). The mutation halts with a
    // halt_reason calling out the contract violation.
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
    // (rogue-orchestrator path: driveCorrectiveTask always supplies a handoff
    // path, so this hits the contract-violation backstop, not the clean halt).
    result = driveCorrectiveTask(io, 1, 1, 2, 'changes_requested');
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');
    expect(io.currentState!.pipeline.halt_reason).toMatch(/contract violation|budget exhausted/);

    // Verify iteration is halted
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].status).toBe('halted');
    }
  });

  it('budget exhaustion — orchestrator correctly omits handoff → clean halt (canonical playbook path)', () => {
    // This test exercises the CANONICAL clean-halt path: after budget is
    // exhausted, the orchestrator follows the playbook and signals
    // code_review_completed with effective_outcome=changes_requested but NO
    // corrective_handoff_path. The validator accepts the absence; the
    // mutation converts it into a clean pipeline halt with a descriptive
    // halt_reason naming the budget-exhausted signal. This is the path the
    // playbook documents as production behavior; the rogue-orchestrator
    // backstop test above covers the contract-violation branch.
    const io = createMockIO(null, makeConfig({ max_retries_per_task: 2 }));
    let result: PipelineResult;

    drivePlanningTier(io);

    // Drive to budget exhaustion (2 correctives = max_retries_per_task).
    driveTaskWithVerdict(io, 1, 1, 'changes_requested');
    driveCorrectiveTask(io, 1, 1, 1, 'changes_requested');

    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(2);
    }

    // Now drive the next code_review cycle manually WITHOUT supplying a
    // corrective_handoff_path — simulating the orchestrator following the
    // playbook's budget-exhaustion protocol.
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);

    const reviewDoc = DOC_PATHS.codeReview(1, 1);
    const reviewFrontmatter = {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      // corrective_handoff_path intentionally omitted — budget-exhausted signal.
    };
    seedDoc(reviewDoc, reviewFrontmatter);
    result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: reviewDoc,
      ...reviewFrontmatter,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('display_halted');
    expect(io.currentState!.graph.status).toBe('halted');
    expect(io.currentState!.pipeline.halt_reason).toMatch(/no corrective_handoff_path|budget exhausted/);

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskIter = taskLoop.iterations[0];
    expect(taskIter.status).toBe('halted');
    // Critically: no new corrective should have been birthed (the handoff
    // omission is the halt signal, not a request to scaffold another cycle).
    expect(taskIter.corrective_tasks).toHaveLength(2);
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

  // Helpers for phase-scope corrective flows — parallel the task-scope helpers
  // above but target the phase_review_completed event with mediation fields.

  /** Path for a phase-scope corrective handoff under a phase. */
  function phaseCorrectiveHandoff(phase: number, corrective: number): string {
    return path.join(PROJECT_DIR, 'tasks', `CORRECTIVE-MEDIATION-TASK-P0${phase}-PHASE-C${corrective}.md`);
  }

  /** Path for the task-level code review of a phase-scope corrective. */
  function phaseCorrectiveCodeReview(phase: number, corrective: number): string {
    return path.join(PROJECT_DIR, 'reports', `CORRECTIVE-MEDIATION-CODE-REVIEW-P0${phase}-PHASE-C${corrective}.md`);
  }

  /** Drive phase review with mediation contract to yield a phase-scope corrective. */
  function drivePhaseReviewMediated(
    io: MockIO,
    phase: number,
    effective: 'changes_requested' | 'approved',
    handoffPath?: string,
  ): PipelineResult {
    const ctx = { phase };
    processEvent('phase_review_started', PROJECT_DIR, ctx, io);
    const reviewDoc = DOC_PATHS.phaseReview(phase);
    const frontmatter: Record<string, unknown> = {
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: effective,
    };
    if (effective === 'changes_requested' && handoffPath) {
      frontmatter.corrective_handoff_path = handoffPath;
    }
    seedDoc(reviewDoc, frontmatter);
    return processEvent('phase_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: reviewDoc,
      ...frontmatter,
    } as Record<string, unknown>, io);
  }

  /**
   * Drive a phase-scope corrective's task-level cycle: execute_task →
   * task_completed → code_review_started → code_review_completed. Returns the
   * final processEvent result. `reviewVerdict` selects the review outcome.
   * For mediated changes_requested, supply `nextHandoffPath`.
   */
  function drivePhaseCorrectiveCycle(
    io: MockIO,
    phase: number,
    corrective: number,
    reviewVerdict: 'approved' | 'rejected' | 'changes_requested',
    nextHandoffPath?: string,
  ): PipelineResult {
    // Task context is `task: 1` (phase-scope dispatch uses the first task slot
    // for resolution; the engine's `task_id` sentinel is `{phase_id}-PHASE`).
    const ctx = { phase, task: 1 };

    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);

    const reviewDoc = phaseCorrectiveCodeReview(phase, corrective);
    const fm: Record<string, unknown> = { verdict: reviewVerdict };
    if (reviewVerdict === 'changes_requested') {
      fm.orchestrator_mediated = true;
      fm.effective_outcome = 'changes_requested';
      if (nextHandoffPath) fm.corrective_handoff_path = nextHandoffPath;
    }
    seedDoc(reviewDoc, fm);

    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: reviewDoc,
      ...fm,
    } as Record<string, unknown>, io);

    // Commit conditional / task gate approvals (autonomous mode auto-approves).
    if (result.action === 'invoke_source_control_commit') {
      processEvent('commit_started', PROJECT_DIR, ctx, io);
      result = processEvent('commit_completed', PROJECT_DIR, ctx, io);
    }
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }
    return result;
  }

  // Iter 11 — un-skipped. Append-only phase-scope corrective cycle:
  // phase_review changes_requested (mediated) → corrective handoff authored
  // → corrective executes (execute_task + code_review) → task-level review
  // approves → phase iteration completes without phase_review re-running.
  it('phase-level corrective loop — phase review changes_requested → mediation → corrective cycle → approved → phase completes', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // ── Phase 1 — first pass: complete all tasks normally ────────────────

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // ── Phase review with mediated changes_requested → phase-scope corrective ─
    const handoffPath = phaseCorrectiveHandoff(1, 1);
    result = drivePhaseReviewMediated(io, 1, 'changes_requested', handoffPath);
    expect(result.success).toBe(true);
    // Walker dispatches execute_task (the corrective's synthesized task_handoff
    // is pre-completed, so the walker skips authoring and jumps to execution).
    expect(result.action).toBe('execute_task');

    // Verify phase-scope corrective appended append-only (no resets).
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const iteration = phaseLoop.iterations[0];
      expect(iteration.corrective_tasks).toHaveLength(1);
      const ct = iteration.corrective_tasks[0];
      expect(ct.index).toBe(1);
      expect(ct.injected_after).toBe('phase_review');
      expect(ct.reason).toBe('Phase review requested changes');
      expect(ct.status).toBe('in_progress'); // walker promotes not_started → in_progress
      // Synthesized task_handoff pre-completed at the orchestrator path.
      expect((ct.nodes['task_handoff'] as StepNodeState).doc_path).toBe(handoffPath);
      // Iter 11 append-only: phase_planning / task_loop are NOT reset.
      expect(iteration.nodes['phase_planning'].status).toBe('completed');
      const taskLoop = iteration.nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations).toHaveLength(2);
      expect(taskLoop.iterations[0].status).toBe('completed');
      expect(taskLoop.iterations[1].status).toBe('completed');
    }

    // ── Enrichment check — handoff_doc routes to phase-scope corrective ──
    {
      const enrichedExec = enrichActionContext({
        action: 'execute_task',
        walkerContext: {},
        state: io.currentState!,
        config: makeConfig(),
        cliContext: {},
      });
      expect(enrichedExec.handoff_doc).toBe(handoffPath);
      // task_number → null, task_id → P01-PHASE sentinel.
      expect(enrichedExec.task_number).toBeNull();
      expect(enrichedExec.task_id).toBe('P01-PHASE');
    }

    // ── Drive corrective cycle to approval ───────────────────────────────
    result = drivePhaseCorrectiveCycle(io, 1, 1, 'approved');
    expect(result.success).toBe(true);

    // Verify corrective completed, phase iteration completed, no second
    // phase_review pass (single-pass clause — phase_review runs exactly once).
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const iteration = phaseLoop.iterations[0];
      expect(iteration.corrective_tasks[0].status).toBe('completed');
      expect(iteration.status).toBe('completed');
      // phase_review remains completed from its original pass.
      const phaseReview = iteration.nodes['phase_review'] as StepNodeState;
      expect(phaseReview.status).toBe('completed');
    }
  });

  // Iter 11 — multi-round phase-scope correctives (parallel to iter-10 task-scope
  // multi-round test). Two phase-scope correctives in succession via
  // ancestor-derivation on the first corrective's task-level review.
  it('multi-round phase-scope corrective — two phase-scope correctives in succession via ancestor-derivation', () => {
    const io = createMockIO(null, makeConfig({ max_retries_per_task: 3 }));
    let result: PipelineResult;
    const config = makeConfig({ max_retries_per_task: 3 });

    drivePlanningTier(io);

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // Phase review → phase-scope corrective 1.
    const h1 = phaseCorrectiveHandoff(1, 1);
    result = drivePhaseReviewMediated(io, 1, 'changes_requested', h1);
    expect(result.success).toBe(true);

    // Corrective 1's task-level code review returns changes_requested →
    // mediation fires → NEW corrective appends to phaseIter (ancestor-derivation).
    const h2 = phaseCorrectiveHandoff(1, 2);
    result = drivePhaseCorrectiveCycle(io, 1, 1, 'changes_requested', h2);
    expect(result.success).toBe(true);

    // Verify TWO phase-scope correctives now exist, task-scope has none.
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const phaseIter = phaseLoop.iterations[0];
      expect(phaseIter.corrective_tasks).toHaveLength(2);
      expect(phaseIter.corrective_tasks[0].index).toBe(1);
      expect(phaseIter.corrective_tasks[1].index).toBe(2);
      expect((phaseIter.corrective_tasks[0].nodes['task_handoff'] as StepNodeState).doc_path).toBe(h1);
      expect((phaseIter.corrective_tasks[1].nodes['task_handoff'] as StepNodeState).doc_path).toBe(h2);

      // Task-scope has no correctives (ancestor-derivation routed to phase).
      const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(0);
      expect(taskLoop.iterations[1].corrective_tasks).toHaveLength(0);
    }

    // Enrichment round 2: handoff_doc + corrective_index resolve to C2.
    {
      const enrichedExec = enrichActionContext({
        action: 'execute_task',
        walkerContext: {},
        state: io.currentState!,
        config,
        cliContext: {},
      });
      expect(enrichedExec.handoff_doc).toBe(h2);
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

    // Drive corrective 2 to approval → phase completes.
    result = drivePhaseCorrectiveCycle(io, 1, 2, 'approved');
    expect(result.success).toBe(true);
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const phaseIter = phaseLoop.iterations[0];
      expect(phaseIter.corrective_tasks[1].status).toBe('completed');
      expect(phaseIter.status).toBe('completed');
    }
  });

  // Iter 11 — ancestor-derivation integration: phase-scope corrective's
  // task-level code review returns changes_requested → mediation fires → new
  // corrective appends to phaseIter (NOT taskIter).
  it('ancestor-derivation — phase-scope corrective code review changes_requested routes to phaseIter.corrective_tasks', () => {
    const io = createMockIO(null, makeConfig({ max_retries_per_task: 3 }));
    let result: PipelineResult;

    drivePlanningTier(io);
    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // Birth phase-scope corrective C1.
    const h1 = phaseCorrectiveHandoff(1, 1);
    drivePhaseReviewMediated(io, 1, 'changes_requested', h1);

    // Pre-check: phaseIter has 1 corrective, taskIter has 0.
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const phaseIter = phaseLoop.iterations[0];
      expect(phaseIter.corrective_tasks).toHaveLength(1);
      const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(0);
    }

    // Drive C1's task-level review to changes_requested → mediation fires.
    const h2 = phaseCorrectiveHandoff(1, 2);
    result = drivePhaseCorrectiveCycle(io, 1, 1, 'changes_requested', h2);
    expect(result.success).toBe(true);

    // Post-check: phaseIter corrective count = 2, taskIter still 0.
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.corrective_tasks).toHaveLength(2);
    const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    for (const taskIter of taskLoop.iterations) {
      expect(taskIter.corrective_tasks).toHaveLength(0);
    }
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
