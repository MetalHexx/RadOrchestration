import { describe, it, expect } from 'vitest';
import { getMutation } from '../lib/mutations.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  StepNodeState,
  IterationEntry,
  CorrectiveTaskEntry,
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeState(): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
    config: {
      gate_mode: 'auto',
      limits: {
        max_phases: 5,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'on', auto_pr: 'on' },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    },
    graph: {
      template_id: 'full',
      status: 'not_started',
      current_node_path: null,
      nodes: {
        research: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        prd: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        design: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        architecture: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        master_plan: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        final_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        pr_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
        final_pr: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        phase_loop: {
          kind: 'for_each_phase',
          status: 'not_started',
          iterations: [
            {
              index: 0,
              status: 'not_started',
              nodes: {
                phase_gate: { kind: 'gate', status: 'not_started', gate_active: false },
                phase_planning: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                phase_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                task_loop: {
                  kind: 'for_each_task',
                  status: 'not_started',
                  iterations: [
                    {
                      index: 0,
                      status: 'not_started',
                      nodes: {
                        task_gate: { kind: 'gate', status: 'not_started', gate_active: false },
                        task_handoff: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                        task_executor: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                        code_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                        commit_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
                      },
                      corrective_tasks: [],
                      commit_hash: null,
                    },
                  ],
                },
              },
              corrective_tasks: [],
              commit_hash: null,
            },
          ],
        },
      },
    },
  };
}

const baseConfig: OrchestrationConfig = {
  system: { orch_root: '/orch' },
  projects: { base_path: '/projects', naming: 'UPPER' },
  limits: {
    max_phases: 5,
    max_tasks_per_phase: 10,
    max_retries_per_task: 3,
    max_consecutive_review_rejections: 3,
  },
  human_gates: { after_planning: true, execution_mode: 'manual', after_final_review: true },
  source_control: { auto_commit: 'on', auto_pr: 'on', provider: 'github' },
  default_template: 'full',
};

// Iter 11 — the PHASE_REVIEW_COMPLETED mutation's corrective-birth branch now
// scaffolds body nodes via `findTaskLoopBodyDefs(template)`; it must find a
// for_each_task body or throw. Mirror the mutations.test.ts fixture so this
// test file can exercise the real birth path.
const baseTemplate: PipelineTemplate = {
  template: { id: 'full', version: '1.0', description: 'Full pipeline' },
  nodes: [
    {
      kind: 'for_each_phase',
      id: 'phase_loop',
      source_doc_ref: 'master_plan',
      total_field: 'phase_count',
      body: [
        {
          kind: 'for_each_task',
          id: 'task_loop',
          source_doc_ref: 'phase_plan',
          tasks_field: 'tasks',
          body: [
            { kind: 'step', id: 'task_handoff', action: 'create_task_handoff', events: { started: 'task_handoff_started', completed: 'task_handoff_created' } },
            { kind: 'step', id: 'task_executor', action: 'execute_task', events: { started: 'execution_started', completed: 'task_completed' } },
            { kind: 'step', id: 'code_review', action: 'spawn_code_reviewer', events: { started: 'code_review_started', completed: 'code_review_completed' } },
            { kind: 'gate', id: 'task_gate', mode_ref: 'gate_mode', action_if_needed: 'gate_task', approved_event: 'task_gate_approved' },
          ],
        },
      ],
    },
  ],
};

// ── Navigation helpers ────────────────────────────────────────────────────────

function getPhaseIteration(state: PipelineState): IterationEntry {
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  return phaseLoop.iterations[0];
}

function getPhaseNode(state: PipelineState, nodeId: string) {
  return getPhaseIteration(state).nodes[nodeId];
}

// ── Mediation context helpers (Iter 11) ──────────────────────────────────────
// Parallels the Iter-10 helpers in mutations.test.ts. Phase-scope mediation
// fields are identical in shape to code_review's: raw changes_requested +
// orchestrator_mediated + effective_outcome + (iff changes_requested)
// corrective_handoff_path.

function mediatedPhaseChangesRequestedCtx(
  handoffPath: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    verdict: 'changes_requested',
    orchestrator_mediated: true,
    effective_outcome: 'changes_requested',
    corrective_handoff_path: handoffPath,
    ...overrides,
  };
}

function mediatedPhaseApprovedCtx(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    verdict: 'changes_requested',
    orchestrator_mediated: true,
    effective_outcome: 'approved',
    ...overrides,
  };
}

// ── phase_review_completed — Iter 11 append-only corrective birth ─────────────
//
// Rewrite per iter-11 plan: the phase-scope corrective is BORN via orchestrator
// mediation (handoff-path supplied on changes_requested) and APPENDED to
// `phaseIter.corrective_tasks`. The old reset-and-empty-nodes behaviour is
// deleted — phaseIter.nodes['phase_planning'], `task_loop.iterations`,
// `phase_review`, `phase_gate` are NOT mutated by the corrective-birth path.

describe('phase_review_completed — Iter 11 phase-scope corrective birth (append-only)', () => {
  const mutation = getMutation('phase_review_completed')!;

  it('mediated changes_requested with handoff path + budget available injects one CorrectiveTaskEntry with correct shape', () => {
    const state = makeState();
    const handoffPath = 'tasks/TEST-TASK-P01-PHASE-C1.md';
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx(handoffPath) },
      baseConfig,
      baseTemplate,
    );
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(1);
    const entry = iteration.corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.index).toBe(1);
    expect(entry.status).toBe('not_started');
    expect(entry.reason).toBe('Phase review requested changes');
    expect(entry.injected_after).toBe('phase_review');
    // Body-def scaffold (4 task-body nodes) + synthesized task_handoff
    expect(Object.keys(entry.nodes)).toHaveLength(4);
  });

  it('synthesized task_handoff sub-node is pre-completed at the orchestrator-supplied path', () => {
    const state = makeState();
    const handoffPath = 'tasks/TEST-TASK-P01-PHASE-C1.md';
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx(handoffPath) },
      baseConfig,
      baseTemplate,
    );
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.nodes['task_handoff']).toEqual({
      kind: 'step',
      status: 'completed',
      doc_path: handoffPath,
      retries: 0,
    });
    expect(entry.nodes['task_gate']).toEqual({ kind: 'gate', status: 'not_started', gate_active: false });
  });

  it('leading/trailing whitespace in corrective_handoff_path is trimmed in state', () => {
    const state = makeState();
    const rawPath = '   tasks/TEST-TASK-P01-PHASE-C1.md   ';
    const trimmed = 'tasks/TEST-TASK-P01-PHASE-C1.md';
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx(rawPath) },
      baseConfig,
      baseTemplate,
    );
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect((entry.nodes['task_handoff'] as StepNodeState).doc_path).toBe(trimmed);
  });

  it('phase_review.verdict is written as effective_outcome (not raw verdict) when mediated', () => {
    const state = makeState();
    const handoffPath = 'tasks/X-P01-PHASE-C1.md';
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx(handoffPath) },
      baseConfig,
      baseTemplate,
    );
    expect((getPhaseNode(result.state, 'phase_review') as StepNodeState).verdict).toBe('changes_requested');
    expect((getPhaseNode(result.state, 'phase_review') as StepNodeState).doc_path).toBe('/r.md');
  });

  it('mediated filter-down (raw changes_requested + effective approved) births no corrective, writes approved to state', () => {
    const state = makeState();
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseApprovedCtx() },
      baseConfig,
      baseTemplate,
    );
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect((getPhaseNode(result.state, 'phase_review') as StepNodeState).verdict).toBe('approved');
    expect(result.state.graph.status).not.toBe('halted');
  });

  it('budget exhausted + supplied handoff path → hard-error halt with descriptive reason', () => {
    const state = makeState();
    // Pre-fill corrective_tasks to max (3).
    const iteration = getPhaseIteration(state);
    for (let i = 0; i < 3; i++) {
      iteration.corrective_tasks.push({
        index: i + 1,
        reason: 'prior',
        injected_after: 'phase_review',
        status: 'not_started',
        nodes: {},
        commit_hash: null,
      });
    }
    const result = mutation(
      state,
      { phase: 1, ...mediatedPhaseChangesRequestedCtx('tasks/exhausted-P01-PHASE-C4.md') },
      baseConfig,
      baseTemplate,
    );
    const resultIteration = getPhaseIteration(result.state);
    // No new entry birthed — already at max.
    expect(resultIteration.corrective_tasks).toHaveLength(3);
    expect(resultIteration.status).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toContain('Retry budget exhausted');
    expect(result.state.pipeline.halt_reason).toContain('phase');
  });

  it('effective_outcome=changes_requested with no handoff path → clean halt (budget-exhausted signal)', () => {
    const state = makeState();
    const result = mutation(
      state,
      {
        phase: 1,
        doc_path: '/r.md',
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
        // corrective_handoff_path intentionally omitted
      } as Record<string, unknown>,
      baseConfig,
      baseTemplate,
    );
    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toMatch(/budget-exhausted halt signal|no corrective_handoff_path/);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.status).toBe('halted');
    expect(iteration.corrective_tasks).toHaveLength(0);
  });

  it('multiple mediated corrections on same phase produce entries with consecutive indices and distinct handoff paths', () => {
    const state = makeState();
    const result1 = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
      baseConfig,
      baseTemplate,
    );
    const result2 = mutation(
      result1.state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C2.md') },
      baseConfig,
      baseTemplate,
    );
    const iteration = getPhaseIteration(result2.state);
    expect(iteration.corrective_tasks).toHaveLength(2);
    expect(iteration.corrective_tasks[0].index).toBe(1);
    expect(iteration.corrective_tasks[1].index).toBe(2);
    expect((iteration.corrective_tasks[0].nodes['task_handoff'] as StepNodeState).doc_path).toBe('tasks/X-P01-PHASE-C1.md');
    expect((iteration.corrective_tasks[1].nodes['task_handoff'] as StepNodeState).doc_path).toBe('tasks/X-P01-PHASE-C2.md');
  });

  it('uses context.reason in corrective entry when provided', () => {
    const state = makeState();
    const result = mutation(
      state,
      {
        phase: 1,
        doc_path: '/r.md',
        reason: 'Custom reason',
        ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md'),
      },
      baseConfig,
      baseTemplate,
    );
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.reason).toBe('Custom reason');
  });

  it('uses default reason when context.reason is absent', () => {
    const state = makeState();
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
      baseConfig,
      baseTemplate,
    );
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.reason).toBe('Phase review requested changes');
  });

  // Iter 11 — the reset block is GONE. Neither phase_planning, phase_review,
  // phase_gate, nor task_loop.iterations are mutated by the corrective-birth
  // path. The corrective appends to `phaseIter.corrective_tasks` and the body
  // nodes live INSIDE the corrective entry's `nodes` map.
  it('does NOT reset phase_planning when birthing a corrective (iter-11 append-only)', () => {
    const state = makeState();
    // Pre-populate phase_planning as completed to confirm the mutation leaves it alone.
    (getPhaseIteration(state).nodes['phase_planning'] as StepNodeState).status = 'completed';
    (getPhaseIteration(state).nodes['phase_planning'] as StepNodeState).doc_path = '/plan.md';
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
      baseConfig,
      baseTemplate,
    );
    const phasePlanning = getPhaseNode(result.state, 'phase_planning') as StepNodeState;
    expect(phasePlanning.status).toBe('completed');
    expect(phasePlanning.doc_path).toBe('/plan.md');
  });

  it('does NOT clear task_loop.iterations when birthing a corrective (iter-11 append-only)', () => {
    const state = makeState();
    const taskLoop = getPhaseIteration(state).nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected kind');
    const originalIterationCount = taskLoop.iterations.length;
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
      baseConfig,
      baseTemplate,
    );
    const resultTaskLoop = getPhaseNode(result.state, 'task_loop');
    if (resultTaskLoop.kind !== 'for_each_task') throw new Error('unexpected kind');
    expect(resultTaskLoop.iterations).toHaveLength(originalIterationCount);
  });

  it('does NOT reset phase_review to not_started (iter-11 single-pass phase_review clause)', () => {
    const state = makeState();
    // phase_review is already in_progress when phase_review_completed fires.
    (getPhaseIteration(state).nodes['phase_review'] as StepNodeState).status = 'in_progress';
    const result = mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
      baseConfig,
      baseTemplate,
    );
    const phaseReview = getPhaseNode(result.state, 'phase_review') as StepNodeState;
    // Mutation writes verdict + doc_path. Status remains the mutation's own
    // assignment (not reset to not_started).
    expect(phaseReview.status).not.toBe('not_started');
    expect(phaseReview.verdict).toBe('changes_requested'); // from effective_outcome
    expect(phaseReview.doc_path).toBe('/r.md');
  });

  it('rejected verdict halts phase iteration and graph, adds no corrective entry', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, doc_path: '/r.md', verdict: 'rejected', exit_criteria_met: false }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect(iteration.status).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toMatch(/rejected verdict|Phase review rejected/);
  });

  it('approved verdict sets phase_review completed, no corrective entry, status unchanged', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, doc_path: '/r.md', verdict: 'approved', exit_criteria_met: true }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect(iteration.status).toBe('not_started');
    expect(result.state.graph.status).toBe('not_started');
    expect(getPhaseNode(result.state, 'phase_review').status).toBe('completed');
  });

  it('immutability — original state is not mutated', () => {
    const state = makeState();
    const originalCorLen = getPhaseIteration(state).corrective_tasks.length;
    mutation(
      state,
      { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
      baseConfig,
      baseTemplate,
    );
    expect(getPhaseNode(state, 'phase_planning').status).toBe('not_started');
    expect(getPhaseIteration(state).corrective_tasks.length).toBe(originalCorLen);
  });

  it('all verdict paths return non-empty mutations_applied', () => {
    const cases: Array<Record<string, unknown>> = [
      { verdict: 'approved', exit_criteria_met: true },
      mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md'),
      { verdict: 'rejected', exit_criteria_met: false },
    ];
    for (const ctx of cases) {
      const state = makeState();
      const result = mutation(state, { phase: 1, doc_path: '/r.md', ...ctx }, baseConfig, baseTemplate);
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    }
  });

  it('throws when template has no for_each_task body (with mediation handoff supplied)', () => {
    const emptyTemplate: PipelineTemplate = {
      template: { id: 'full', version: '1.0', description: 'Full pipeline' },
      nodes: [],
    };
    const state = makeState();
    expect(() =>
      mutation(
        state,
        { phase: 1, doc_path: '/r.md', ...mediatedPhaseChangesRequestedCtx('tasks/X-P01-PHASE-C1.md') },
        baseConfig,
        emptyTemplate,
      ),
    ).toThrow('findTaskLoopBodyDefs: no for_each_task body found in template');
  });
});

// ── plan_approved — current_tier advancement ──────────────────────────────────

describe('plan_approved — current_tier advancement', () => {
  const mutation = getMutation('plan_approved')!;

  it('sets pipeline.current_tier to execution', () => {
    const state = makeState();
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.pipeline.current_tier).toBe('execution');
  });

  it('immutability — original state is not mutated', () => {
    const state = makeState();
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.pipeline.current_tier).toBe('planning');
  });
});

// ── final_review_completed — current_tier advancement ─────────────────────────

describe('final_review_completed — current_tier advancement', () => {
  const mutation = getMutation('final_review_completed')!;

  it('sets pipeline.current_tier to review when verdict === approved', () => {
    const state = makeState();
    const result = mutation(state, { verdict: 'approved', doc_path: '/final.md' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.current_tier).toBe('review');
  });

  it('does NOT change current_tier when verdict === changes_requested', () => {
    const state = makeState();
    const result = mutation(state, { verdict: 'changes_requested', doc_path: '/final.md' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.current_tier).toBe('planning');
  });

  it('does NOT change current_tier when verdict is absent', () => {
    const state = makeState();
    const result = mutation(state, { doc_path: '/final.md' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.current_tier).toBe('planning');
  });

  it('immutability — original state is not mutated when approved', () => {
    const state = makeState();
    mutation(state, { verdict: 'approved', doc_path: '/final.md' }, baseConfig, baseTemplate);
    expect(state.pipeline.current_tier).toBe('planning');
  });
});
