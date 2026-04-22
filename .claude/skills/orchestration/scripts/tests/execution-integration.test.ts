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

const PROJECT_DIR = '/tmp/test-project/EXEC-INTEGRATION';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORCH_ROOT = path.resolve(__dirname, '../../../..');

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
 * Mirrors the production explosion script: wipes and re-seeds phase_loop with
 * one iteration per entry in `phaseTasks`. Each phase iteration carries
 * `doc_path = DOC_PATHS.phasePlan(n)` and a task_loop whose iterations carry
 * `doc_path = DOC_PATHS.taskHandoff(p, t)` directly. Body nodes are not
 * pre-scaffolded; the walker scaffolds them on each iteration's first
 * in_progress transition.
 */
function seedExplosionState(io: MockIO, phaseTasks: Array<typeof TASKS_FIXTURE>): void {
  const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  phaseLoop.iterations = [];
  phaseLoop.status = 'not_started';
  for (let pIdx = 0; pIdx < phaseTasks.length; pIdx++) {
    const phaseNum = pIdx + 1;
    const phaseDoc = DOC_PATHS.phasePlan(phaseNum);
    seedDoc(phaseDoc, { tasks: phaseTasks[pIdx] });

    const taskLoop: ForEachTaskNodeState = {
      kind: 'for_each_task',
      status: 'not_started',
      iterations: phaseTasks[pIdx].map((_, tIdx) => {
        const handoffDoc = DOC_PATHS.taskHandoff(phaseNum, tIdx + 1);
        seedDoc(handoffDoc);
        return {
          index: tIdx,
          status: 'not_started' as const,
          nodes: {},
          corrective_tasks: [],
          doc_path: handoffDoc,
          commit_hash: null,
        };
      }),
    };

    phaseLoop.iterations.push({
      index: pIdx,
      status: 'not_started',
      nodes: { task_loop: taskLoop },
      corrective_tasks: [],
      doc_path: phaseDoc,
      commit_hash: null,
    });
  }
}

/**
 * Drives the planning tier from init through plan_approved. Seeds the
 * explosion state (phase iterations + task iterations with `doc_path` on each)
 * before plan_approved fires, so the walker's first pass after plan_approved
 * advances directly into the execution tier without a re-walk workaround.
 *
 * In 'autonomous' / 'task' / 'phase' gate modes, returns the first execution
 * action (`execute_task`). In 'ask' mode the walker halts at the
 * `gate_mode_selection` gate before advancing; the test must dispatch
 * `gate_mode_set` itself.
 */
function drivePlanningTier(io: MockIO): PipelineResult {
  // Init scaffold
  processEvent('start', PROJECT_DIR, {}, io);

  // master_plan
  processEvent('master_plan_started', PROJECT_DIR, {}, io);
  seedDoc(DOC_PATHS.masterPlan, { total_phases: 2, total_tasks: 4 });
  processEvent('master_plan_completed', PROJECT_DIR, { doc_path: DOC_PATHS.masterPlan }, io);

  // Mirror the production explosion script: seed phase_loop iterations with
  // doc_path on each iteration + task_loop.iterations BEFORE plan_approved so
  // the walker can advance through phase_loop in a single pass.
  seedExplosionState(io, [TASKS_FIXTURE, TASKS_FIXTURE]);

  return processEvent('plan_approved', PROJECT_DIR, { doc_path: DOC_PATHS.masterPlan }, io);
}

/**
 * Drives one task through execute → review. Post-Iter 7 the per-task `task_handoff`
 * authoring step is gone — the pre-seeded `task_handoff` child node already
 * carries `status: completed` + `doc_path`.
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
 * Drives post-task-loop phase steps: review, gate.
 * Returns the result of the last event for the phase.
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

    // ── Planning tier (drives master_plan + plan_approved + explosion seeding) ──
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    // Post-unify: iterations carry doc_path directly; walker scaffolds body
    // nodes and advances straight to the first task executor.
    expect(result.action).toBe('execute_task');

    // ── Verify phase_loop expansion + explosion seeding ──────────────────
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.status).toBe('in_progress');
      expect(phaseLoop.iterations).toHaveLength(2);
      expect(phaseLoop.iterations[0].index).toBe(0);
      expect(phaseLoop.iterations[1].index).toBe(1);
      // Each phase iteration carries doc_path directly; task iterations do too.
      expect(phaseLoop.iterations[0].doc_path).toBe(DOC_PATHS.phasePlan(1));
      const taskLoop0 = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop0.iterations).toHaveLength(2);
      expect(taskLoop0.iterations[0].doc_path).toBe(DOC_PATHS.taskHandoff(1, 1));
    }

    // ══════════════════════════════════════════════════════════════════════
    // Phase 1
    // ══════════════════════════════════════════════════════════════════════

    // ── Phase 1, Task 1 ──────────────────────────────────────────────────
    result = driveTask(io, 1, 1);
    expect(result.success).toBe(true);
    // task_gate auto-approves in autonomous mode (verdict=approved) → advance to task 2
    expect(result.action).toBe('execute_task');

    // Verify task_gate completed (gate fires after commit_gate at task scope)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
    }

    // ── Phase 1, Task 2 ──────────────────────────────────────────────────
    result = driveTask(io, 1, 2);
    expect(result.success).toBe(true);
    // task_gate auto-approves → task_loop completes → phase_review (post-Iter 8)
    expect(result.action).toBe('spawn_phase_reviewer');

    // Verify task_gate for task 2 completed
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[1].nodes['task_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
    }

    // ── Phase 1 post-task steps ──────────────────────────────────────────
    result = drivePhasePostTasks(io, 1);
    expect(result.success).toBe(true);
    // Phase gate auto-approves → advance to phase 2's first execute_task
    expect(result.action).toBe('execute_task');

    // Verify phase_gate auto-approved via walker's autonomous verdict check (gate_active = false, gate never fires as an action)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const gate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
      expect(gate.status).toBe('completed');
      expect(gate.gate_active).toBe(false);
    }

    // Verify commit conditional branch_taken (task-scope)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const cond = taskLoop.iterations[0].nodes['commit_gate'] as ConditionalNodeState;
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

    // ── Phase 2, Task 1 ──────────────────────────────────────────────────
    result = driveTask(io, 2, 1);
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

    // ── Phase 2, Task 2 ──────────────────────────────────────────────────
    result = driveTask(io, 2, 2);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_phase_reviewer');

    // ── Phase 2 post-task steps ──────────────────────────────────────────
    result = drivePhasePostTasks(io, 2);
    expect(result.success).toBe(true);
    // Phase 2 complete → phase_loop completes → final_review
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
      verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    // pr_gate: auto_pr='always' neq 'never' → true branch → invoke PR
    expect(result.action).toBe('invoke_source_control_pr');

    // Verify PR conditional branch_taken
    {
      const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
      expect(prGate.branch_taken).toBe('true');
      expect(prGate.status).toBe('in_progress');
    }

    // ── source_control_init ──────────────────────────────────────────────
    result = processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/test-branch',
      base_branch: 'main',
      worktree_path: '.',
      auto_commit: 'always',
      auto_pr: 'always',
      remote_url: 'https://github.com/test/repo',
    }, io);
    expect(result.success).toBe(true);

    // ── pr_requested ────────────────────────────────────────
    result = processEvent('pr_requested', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');

    // ── pr_created → final_approval_gate ───────────────────
    result = processEvent('pr_created', PROJECT_DIR, { pr_url: 'https://github.com/test/repo/pull/1' }, io);
    expect(result.success).toBe(true);
    // final_approval_gate active (after_final_review = true)
    expect(result.action).toBe('request_final_approval');
    expect(result.context.pr_url).toBe('https://github.com/test/repo/pull/1');

    // ── final_approved → display_complete ────────────────────────
    result = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');

    // ── Final state assertions ───────────────────────────────────────────
    // Verify all top-level nodes completed
    const nodes = io.currentState!.graph.nodes;
    expect((nodes['master_plan'] as StepNodeState).status).toBe('completed');
    expect((nodes['plan_approval_gate'] as GateNodeState).status).toBe('completed');
    expect((nodes['phase_loop'] as ForEachPhaseNodeState).status).toBe('completed');
    expect((nodes['final_review'] as StepNodeState).status).toBe('completed');
    expect((nodes['final_approval_gate'] as GateNodeState).status).toBe('completed');
    expect((nodes['pr_gate'] as ConditionalNodeState).status).toBe('completed');

    expect(io.currentState!.graph.status).toBe('completed');
  });

  // Iter 13 — for executor enrichment, `handoff_doc` is the only doc-path
  // input. The enriched context for `execute_task` still carries the
  // phase/task identifiers, but NOTHING that names an upstream planning doc
  // (Requirements / Master Plan / PRD / Design / Architecture). Guards
  // against executor-contract regressions if future enrichment code
  // accidentally surfaces upstream doc paths.
  it('execute_task enrichment exposes handoff_doc as the only doc-path field — no upstream-doc fields', () => {
    const config = makeConfig();
    const io = createMockIO(null, config);

    // Drive to first execute_task so the walker has resolved the active
    // phase/task and the pre-seeded task_handoff doc_path is readable.
    const result = drivePlanningTier(io);
    expect(result.action).toBe('execute_task');

    const ctx = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state: io.currentState!,
      config,
      cliContext: {},
    });

    // Present — the handoff doc path and the identity fields the coder needs.
    expect(ctx).toHaveProperty('handoff_doc');
    expect(ctx.handoff_doc).toBe(DOC_PATHS.taskHandoff(1, 1));
    expect(ctx).toHaveProperty('phase_number', 1);
    expect(ctx).toHaveProperty('phase_id', 'P01');
    expect(ctx).toHaveProperty('task_number', 1);
    expect(ctx).toHaveProperty('task_id', 'P01-T01');

    // Absent — no upstream planning-doc fields may leak into the coder context.
    expect(ctx).not.toHaveProperty('requirements_doc');
    expect(ctx).not.toHaveProperty('master_plan_doc');
    expect(ctx).not.toHaveProperty('prd_doc');
    expect(ctx).not.toHaveProperty('design_doc');
    expect(ctx).not.toHaveProperty('architecture_doc');
  });

  // Post-Iter 7: scratch project drives requirements-style flow and verifies that
  // no legacy per-phase / per-task authoring event fires. Pre-seeded task_handoff
  // child step nodes (Iter 5 explosion behavior) are the only source of handoff
  // doc paths during execution.
  it('scratch project: no phase_planning / task_handoff authoring event fires during execution', () => {
    const io = createMockIO(null, makeConfig());

    // Record every event dispatched through processEvent by wrapping in a helper
    const dispatched: string[] = [];
    function signal(event: string, ctx: Record<string, unknown> = {}) {
      dispatched.push(event);
      return processEvent(event, PROJECT_DIR, ctx, io);
    }

    // ── Planning tier — mirrors post-Iter-7 flow: requirements → master_plan →
    // (explosion pre-seeds phase_planning + task_handoff children). No legacy
    // phase_planning_started / task_handoff_started / phase_plan_created /
    // task_handoff_created events participate.
    signal('start');
    signal('requirements_started');
    const requirementsDoc = path.join(PROJECT_DIR, 'docs', 'requirements.md');
    seedDoc(requirementsDoc, { requirement_count: 4 });
    signal('requirements_completed', { doc_path: requirementsDoc });
    signal('master_plan_started');
    seedDoc(DOC_PATHS.masterPlan, { total_phases: 1, total_tasks: 1 });
    signal('master_plan_completed', { doc_path: DOC_PATHS.masterPlan });

    // Simulate the explosion-script's pre-seeding: iterations carry doc_path
    // directly. Seed before plan_approved so the walker's first pass after
    // plan_approved advances straight into execute_task.
    const oneTask = [{ id: 'T01', title: 'Task 1' }];
    seedExplosionState(io, [oneTask]);

    const planApproved = signal('plan_approved', { doc_path: DOC_PATHS.masterPlan });
    expect(planApproved.success).toBe(true);
    expect(planApproved.action).toBe('execute_task');

    const ctx = { phase: 1, task: 1 };
    signal('execution_started', ctx);
    signal('task_completed', ctx);

    signal('code_review_started', ctx);
    const reviewDoc = DOC_PATHS.codeReview(1, 1);
    seedDoc(reviewDoc);
    const afterReview = signal('code_review_completed', {
      ...ctx,
      doc_path: reviewDoc,
      verdict: 'approved',
    });

    // Commit + task gate auto-approve in autonomous mode
    if (afterReview.action === 'invoke_source_control_commit') {
      signal('commit_started', ctx);
      signal('commit_completed', { ...ctx, commit_hash: 'abc123', pushed: true });
    }

    // Negative assertion — these events are removed post-Iter 7; the strings
    // appear here only as forbidden-list entries, not as active event names.
    // Assertion: the dispatched event list contains zero authoring events.
    const forbidden = [
      'phase_planning_started',
      'phase_plan_created',
      'task_handoff_started',
      'task_handoff_created',
    ];
    for (const evt of forbidden) {
      expect(dispatched).not.toContain(evt);
    }

    // And the execute_task context reads the pre-seeded handoff doc from the
    // task iteration's doc_path (see execute_task enrichment in
    // context-enrichment.ts).
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    expect(taskLoop.iterations[0].doc_path).toBe(DOC_PATHS.taskHandoff(1, 1));
  });
});

describe('Execution-tier integration — gate mode variations', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('ask_gate_mode fires when execution_mode is ask and pipeline.gate_mode is null', () => {
    const config = makeConfig({ execution_mode: 'ask' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    // Drive planning tier — ask mode fires ask_gate_mode at gate_mode_selection
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('ask_gate_mode');

    // Pass through gate_mode_selection — phase_loop expands during this event.
    // Then seed explosion-script child nodes (Iter 5 behavior) so the walker
    // can advance past the missing phase_planning / task_handoff body nodes.
    result = processEvent('gate_mode_set', PROJECT_DIR, { gate_mode: 'task' }, io);
    expect(result.success).toBe(true);
    seedExplosionState(io, [TASKS_FIXTURE, TASKS_FIXTURE]);
    result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.action).toBe('execute_task');
    // Reset gate_mode so subsequent gates see ask behavior
    io.currentState!.pipeline.gate_mode = null;

    // Phase 1, Task 1 — drive up to code review completion
    {
      const ctx = { phase: 1, task: 1 };
      processEvent('execution_started', PROJECT_DIR, ctx, io);
      processEvent('task_completed', PROJECT_DIR, ctx, io);
      processEvent('code_review_started', PROJECT_DIR, ctx, io);
      const r = DOC_PATHS.codeReview(1, 1); seedDoc(r);
      result = processEvent('code_review_completed', PROJECT_DIR, { ...ctx, doc_path: r, verdict: 'approved' }, io);
    }
    expect(result.success).toBe(true);
    // commit_gate fires before task_gate → invoke_source_control_commit
    expect(result.action).toBe('invoke_source_control_commit');

    // Drive commit events at task scope
    processEvent('commit_started', PROJECT_DIR, { phase: 1, task: 1 }, io);
    result = processEvent('commit_completed', PROJECT_DIR, { phase: 1, task: 1 }, io);
    expect(result.success).toBe(true);
    // pipeline.gate_mode is null and execution_mode='ask' → walker returns ask_gate_mode
    // before activating the task_gate, prompting the operator to choose a gate mode
    expect(result.action).toBe('ask_gate_mode');

    // Verify task_gate has NOT been activated (ask_gate_mode fires before gate evaluation)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const gate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
      expect(gate.gate_active).toBe(false);
      expect(gate.status).toBe('not_started');
    }
  });

  it('execution_mode=task fires task gates and phase gate (requires explicit approvals)', () => {
    const config = makeConfig({ execution_mode: 'task' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    // Drive planning tier (auto-expands + seeds in 'task' mode — gate_mode_selection auto-approves)
    result = drivePlanningTier(io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

    // Phase 1, Task 1 — driveTask approves gate internally
    result = driveTask(io, 1, 1);
    expect(result.success).toBe(true);
    // task_gate fires in 'task' mode → driveTask approves it → advance to task 2
    expect(result.action).toBe('execute_task');

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
    expect(result.action).toBe('spawn_phase_reviewer');

    // Drive phase review (post-Iter 8: phase_report absorbed into phase_review)
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const reviewDoc = DOC_PATHS.phaseReview(1);
    seedDoc(reviewDoc);
    result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: reviewDoc,
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    // phase_gate fires in 'task' mode
    expect(result.action).toBe('gate_phase');

    // Approve phase gate → advance to next phase's first execute_task
    result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');

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
    expect(result.action).toBe('execute_task');

    driveTask(io, 1, 1);
    driveTask(io, 1, 2);

    // Phase review completes → phase_gate auto-approves (autonomous) →
    // commit conditional: 'never' neq 'never' → false → branch_taken='false' → skip → next phase
    result = drivePhasePostTasks(io, 1);
    expect(result.success).toBe(true);
    // Walker should proceed to phase 2's first execute_task (commit skipped at task scope)
    expect(result.action).toBe('execute_task');

    // Verify commit conditional took false branch (task-scope)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const cond = taskLoop.iterations[0].nodes['commit_gate'] as ConditionalNodeState;
      expect(cond.branch_taken).toBe('false');
      expect(cond.status).toBe('completed');
    }
  });

  it('auto_pr=never skips PR step, display_complete follows final approval directly', () => {
    const config = makeConfig({ auto_pr: 'never' });
    const io = createMockIO(null, config);
    let result: PipelineResult;

    result = drivePlanningTier(io);
    expect(result.action).toBe('execute_task');

    // Drive 2 phases × 2 tasks through completion
    for (let phase = 1; phase <= 2; phase++) {
      driveTask(io, phase, 1);
      driveTask(io, phase, 2);
      drivePhasePostTasks(io, phase);
    }

    // Final review
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    seedDoc(DOC_PATHS.finalReview);
    result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: DOC_PATHS.finalReview,
      verdict: 'approved',
    }, io);
    expect(result.action).toBe('request_final_approval');

    // final_approved → display_complete (pr_gate already completed with false branch after final_review)
    result = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('display_complete');

    // Verify PR conditional took false branch
    {
      const prGate = io.currentState!.graph.nodes['pr_gate'] as ConditionalNodeState;
      expect(prGate.branch_taken).toBe('false');
      expect(prGate.status).toBe('completed');
    }
  });

  it('auto_commit=always emits invoke_source_control_commit at task scope', () => {
    const config = makeConfig({ auto_commit: 'always' });
    const io = createMockIO(null, config);

    drivePlanningTier(io);

    // Drive task 1 manually to observe invoke_source_control_commit action
    {
      const ctx = { phase: 1, task: 1 };
      processEvent('execution_started', PROJECT_DIR, ctx, io);
      processEvent('task_completed', PROJECT_DIR, ctx, io);
      processEvent('code_review_started', PROJECT_DIR, ctx, io);
      const reviewDoc = DOC_PATHS.codeReview(1, 1);
      seedDoc(reviewDoc);
      const result = processEvent('code_review_completed', PROJECT_DIR, {
        ...ctx,
        doc_path: reviewDoc,
        verdict: 'approved',
      }, io);
      expect(result.success).toBe(true);
      // commit_gate: auto_commit=always neq never → true branch → invoke_source_control_commit
      expect(result.action).toBe('invoke_source_control_commit');
    }

    // Verify commit conditional took true branch (task-scope)
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      const cond = taskLoop.iterations[0].nodes['commit_gate'] as ConditionalNodeState;
      expect(cond.branch_taken).toBe('true');
    }
  });

  it('auto_pr=always emits invoke_source_control_pr', () => {
    const config = makeConfig({ auto_pr: 'always' });
    const io = createMockIO(null, config);

    drivePlanningTier(io);

    // Drive 2 phases × 2 tasks through completion
    for (let phase = 1; phase <= 2; phase++) {
      driveTask(io, phase, 1);
      driveTask(io, phase, 2);
      drivePhasePostTasks(io, phase);
    }

    // Final review
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    seedDoc(DOC_PATHS.finalReview);
    // final_review_completed → pr_gate: 'always' neq 'never' → true → invoke PR
    const result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: DOC_PATHS.finalReview,
      verdict: 'approved',
    }, io);
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
    driveTask(io, 1, 1);
    driveTask(io, 1, 2);
    result = drivePhasePostTasks(io, 1);
    expect(result.action).toBe('execute_task');

    // Verify iteration 0 completed and iteration 1 is in progress
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.iterations[0].status).toBe('completed');
      expect(phaseLoop.iterations[0].index).toBe(0);
      expect(phaseLoop.iterations[1].status).toBe('in_progress');
      expect(phaseLoop.iterations[1].index).toBe(1);

      // Verify iteration 1 body nodes are independently scaffolded by seedExplosionState.
      // Phase 1's task states should not bleed into phase 2.
      const taskLoop = phaseLoop.iterations[1].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations).toHaveLength(2);
      expect(taskLoop.iterations[0].index).toBe(0);
      expect(taskLoop.iterations[1].index).toBe(1);
      // task_handoff is pre-seeded as completed (Iter 5 explosion behavior); the
      // executor itself remains not_started until execution_started fires.
      const executor = taskLoop.iterations[0].nodes['task_executor'] as StepNodeState;
      expect(executor.status).toBe('not_started');
    }
  });

  it('task 2 (iterations[1]) resolves correctly after task 1 completes', () => {
    const io = createMockIO(null, makeConfig());
    let result: PipelineResult;

    drivePlanningTier(io);

    // Complete task 1 → walker advances to task 2's execute_task
    result = driveTask(io, 1, 1);
    expect(result.action).toBe('execute_task');

    // Verify task iteration 0 completed and iteration 1 is in progress
    {
      const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
      expect(taskLoop.iterations[0].status).toBe('completed');
      expect(taskLoop.iterations[0].index).toBe(0);
      // Walker already walked into iteration 1 to find next action, so it's in_progress
      expect(taskLoop.iterations[1].status).toBe('in_progress');
      expect(taskLoop.iterations[1].index).toBe(1);
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

    // Complete task 2 → task_loop completes → phase_review
    processEvent('execution_started', PROJECT_DIR, { phase: 1, task: 2 }, io);
    processEvent('task_completed', PROJECT_DIR, { phase: 1, task: 2 }, io);
    processEvent('code_review_started', PROJECT_DIR, { phase: 1, task: 2 }, io);
    const reviewDoc = DOC_PATHS.codeReview(1, 2);
    seedDoc(reviewDoc);
    result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 2,
      doc_path: reviewDoc,
      verdict: 'approved',
    }, io);

    // commit_gate fires at task scope → invoke_source_control_commit
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');

    // Drive commit events at task scope
    processEvent('commit_started', PROJECT_DIR, { phase: 1, task: 2 }, io);
    result = processEvent('commit_completed', PROJECT_DIR, { phase: 1, task: 2 }, io);

    // Task gate fires after commit → approve it
    expect(result.success).toBe(true);
    if (result.action === 'gate_task') {
      result = processEvent('task_gate_approved', PROJECT_DIR, { phase: 1, task: 2 }, io);
    }

    // task_loop completes → spawn_phase_reviewer (post-Iter 8)
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_phase_reviewer');

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
