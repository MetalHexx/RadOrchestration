import { describe, it, expect } from 'vitest';
import { getMutation } from '../lib/mutations.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  StepNodeState,
  GateNodeState,
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
      status: 'in_progress',
      current_node_path: null,
      nodes: {
        research: { kind: 'step', status: 'completed', doc_path: '/path/research.md', retries: 0 },
        prd: { kind: 'step', status: 'completed', doc_path: '/path/prd.md', retries: 0 },
        design: { kind: 'step', status: 'completed', doc_path: '/path/design.md', retries: 0 },
        architecture: { kind: 'step', status: 'completed', doc_path: '/path/arch.md', retries: 0 },
        master_plan: { kind: 'step', status: 'completed', doc_path: '/path/master-plan.md', retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'completed', gate_active: true },
        final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        final_review: { kind: 'step', status: 'completed', doc_path: '/path/final-review.md', retries: 0 },
        pr_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
        final_pr: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        phase_loop: {
          kind: 'for_each_phase',
          status: 'in_progress',
          iterations: [
            {
              index: 0,
              status: 'completed',
              nodes: {
                phase_gate: { kind: 'gate', status: 'completed', gate_active: true },
                phase_planning: { kind: 'step', status: 'completed', doc_path: '/path/phase-plan.md', retries: 0 },
                phase_review: { kind: 'step', status: 'completed', doc_path: '/path/phase-review.md', retries: 0 },
                task_loop: {
                  kind: 'for_each_task',
                  status: 'completed',
                  iterations: [
                    {
                      index: 0,
                      status: 'completed',
                      nodes: {
                        task_gate: { kind: 'gate', status: 'completed', gate_active: true },
                        task_handoff: { kind: 'step', status: 'completed', doc_path: '/path/handoff.md', retries: 0 },
                        task_executor: { kind: 'step', status: 'completed', doc_path: null, retries: 0 },
                        code_review: { kind: 'step', status: 'completed', doc_path: '/path/review.md', retries: 0 },
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

const baseTemplate: PipelineTemplate = {
  template: { id: 'full', version: '1.0', description: 'Full pipeline' },
  nodes: [],
};

// ── plan_rejected ─────────────────────────────────────────────────────────────

describe('plan_rejected mutation', () => {
  it('resets master_plan.status to not_started', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['master_plan'] as StepNodeState;
    expect(node.status).toBe('not_started');
  });

  it('clears master_plan.doc_path to null', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['master_plan'] as StepNodeState;
    expect(node.doc_path).toBeNull();
  });

  it('resets plan_approval_gate.status to not_started', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(node.status).toBe('not_started');
  });

  it('sets plan_approval_gate.gate_active to false', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(node.gate_active).toBe(false);
  });

  it('clears phase_loop.iterations to empty array', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const phaseLoop = result.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    expect(phaseLoop.iterations).toEqual([]);
  });

  it('does not mutate the original state object', () => {
    const state = makeState();
    const originalMasterPlanStatus = (state.graph.nodes['master_plan'] as StepNodeState).status;
    const originalIterationsLength = (() => {
      const p = state.graph.nodes['phase_loop'];
      if (p.kind !== 'for_each_phase') throw new Error('unexpected');
      return p.iterations.length;
    })();
    const mutation = getMutation('plan_rejected')!;
    mutation(state, {}, baseConfig, baseTemplate);
    // Original state should be unchanged
    expect((state.graph.nodes['master_plan'] as StepNodeState).status).toBe(originalMasterPlanStatus);
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    expect(phaseLoop.iterations.length).toBe(originalIterationsLength);
  });

  it('returns mutations_applied listing each field change', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const { mutations_applied } = mutation(state, {}, baseConfig, baseTemplate);
    expect(mutations_applied.length).toBeGreaterThan(0);
    expect(mutations_applied.some(m => m.includes('master_plan'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('plan_approval_gate'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('phase_loop'))).toBe(true);
  });

  // Iter 4: default.yml is a partial planning-only template with no phase_loop.
  // plan_rejected must still run cleanly — just reset master_plan + plan_approval_gate.
  it('does not throw when phase_loop is absent (default.yml partial template)', () => {
    const state = makeState();
    // Remove phase_loop to mimic a state scaffolded from default.yml (no execution tier yet).
    delete (state.graph.nodes as Record<string, unknown>)['phase_loop'];
    const mutation = getMutation('plan_rejected')!;
    const { state: result, mutations_applied } = mutation(state, {}, baseConfig, baseTemplate);

    // master_plan + plan_approval_gate still reset
    expect((result.graph.nodes['master_plan'] as StepNodeState).status).toBe('not_started');
    expect((result.graph.nodes['plan_approval_gate'] as GateNodeState).gate_active).toBe(false);

    // No phase_loop entry in mutations_applied (skipped, not crashed)
    expect(mutations_applied.some(m => m.includes('phase_loop'))).toBe(false);
    // And no phase_loop resurrected in state
    expect(result.graph.nodes['phase_loop']).toBeUndefined();
  });
});

// ── gate_rejected ─────────────────────────────────────────────────────────────

describe('gate_rejected mutation', () => {
  it('sets pipeline.current_tier to halted', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const { state: result } = mutation(state, { gate_type: 'task', reason: 'Reviewer rejected' }, baseConfig, baseTemplate);
    expect(result.pipeline.current_tier).toBe('halted');
  });

  it('sets graph.status to halted', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const { state: result } = mutation(state, { gate_type: 'task', reason: 'Reviewer rejected' }, baseConfig, baseTemplate);
    expect(result.graph.status).toBe('halted');
  });

  it('sets pipeline.halt_reason with explicit gate_type and reason', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const { state: result } = mutation(state, { gate_type: 'task', reason: 'Reviewer rejected' }, baseConfig, baseTemplate);
    expect(result.pipeline.halt_reason).toBe('Gate rejected (task): Reviewer rejected');
  });

  it('defaults reason to "No reason provided" when context.reason is missing', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const { state: result } = mutation(state, { gate_type: 'phase' }, baseConfig, baseTemplate);
    expect(result.pipeline.halt_reason).toBe('Gate rejected (phase): No reason provided');
  });

  it('defaults gate_type to "unknown" when context.gate_type is missing', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const { state: result } = mutation(state, { reason: 'Some reason' }, baseConfig, baseTemplate);
    expect(result.pipeline.halt_reason).toBe('Gate rejected (unknown): Some reason');
  });

  it('returns mutations_applied listing each field change', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const { mutations_applied } = mutation(state, { gate_type: 'task', reason: 'Rejected' }, baseConfig, baseTemplate);
    expect(mutations_applied.length).toBeGreaterThan(0);
    expect(mutations_applied.some(m => m.includes('current_tier'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('graph.status'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('halt_reason'))).toBe(true);
  });
});

// ── final_rejected ────────────────────────────────────────────────────────────

describe('final_rejected mutation', () => {
  it('resets final_review.status to not_started', () => {
    const state = makeState();
    const mutation = getMutation('final_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['final_review'] as StepNodeState;
    expect(node.status).toBe('not_started');
  });

  it('clears final_review.doc_path to null', () => {
    const state = makeState();
    const mutation = getMutation('final_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['final_review'] as StepNodeState;
    expect(node.doc_path).toBeNull();
  });

  it('resets final_approval_gate.status to not_started', () => {
    const state = makeState();
    const mutation = getMutation('final_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(node.status).toBe('not_started');
  });

  it('sets final_approval_gate.gate_active to false', () => {
    const state = makeState();
    // Set gate_active to true first so we can verify it resets
    (state.graph.nodes['final_approval_gate'] as GateNodeState).gate_active = true;
    (state.graph.nodes['final_approval_gate'] as GateNodeState).status = 'completed';
    const mutation = getMutation('final_rejected')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(node.gate_active).toBe(false);
  });

  it('does not mutate the original state object', () => {
    const state = makeState();
    const originalFinalReviewStatus = (state.graph.nodes['final_review'] as StepNodeState).status;
    const mutation = getMutation('final_rejected')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect((state.graph.nodes['final_review'] as StepNodeState).status).toBe(originalFinalReviewStatus);
  });

  it('returns mutations_applied listing each field change', () => {
    const state = makeState();
    const mutation = getMutation('final_rejected')!;
    const { mutations_applied } = mutation(state, {}, baseConfig, baseTemplate);
    expect(mutations_applied.length).toBeGreaterThan(0);
    expect(mutations_applied.some(m => m.includes('final_review'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('final_approval_gate'))).toBe(true);
  });
});

// ── halt ──────────────────────────────────────────────────────────────────────

describe('halt mutation', () => {
  it('sets pipeline.current_tier to halted', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const { state: result } = mutation(state, { reason: 'Operator halted pipeline' }, baseConfig, baseTemplate);
    expect(result.pipeline.current_tier).toBe('halted');
  });

  it('sets graph.status to halted', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const { state: result } = mutation(state, { reason: 'Operator halted pipeline' }, baseConfig, baseTemplate);
    expect(result.graph.status).toBe('halted');
  });

  it('sets pipeline.halt_reason to context.reason when provided', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const { state: result } = mutation(state, { reason: 'Custom halt reason' }, baseConfig, baseTemplate);
    expect(result.pipeline.halt_reason).toBe('Custom halt reason');
  });

  it('defaults pipeline.halt_reason to "Pipeline halted by operator" when context.reason is missing', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const { state: result } = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.pipeline.halt_reason).toBe('Pipeline halted by operator');
  });

  it('returns mutations_applied listing each field change', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const { mutations_applied } = mutation(state, { reason: 'Halted' }, baseConfig, baseTemplate);
    expect(mutations_applied.length).toBeGreaterThan(0);
    expect(mutations_applied.some(m => m.includes('current_tier'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('graph.status'))).toBe(true);
    expect(mutations_applied.some(m => m.includes('halt_reason'))).toBe(true);
  });
});

// ── getMutation registry presence ────────────────────────────────────────────

describe('getMutation — negative-path OOB events', () => {
  const oobEvents = ['plan_rejected', 'gate_rejected', 'final_rejected', 'halt'];
  for (const eventName of oobEvents) {
    it(`returns a function for '${eventName}'`, () => {
      expect(getMutation(eventName)).toBeTypeOf('function');
    });
  }
});

// ── Iter 10 — code_review_completed mediation-contract hard errors ───────────
//
// The validator is the primary enforcer of the orchestrator-mediation contract
// (see 05-frontmatter-validation.test.ts + frontmatter-validators.ts). The
// mutation itself is a backstop for validator bypasses — unit tests constructing
// the event context directly, or future refactors that route around pre-reads.
//
// These tests fix the bypass cases at the mutation layer to catch regressions.

function makeExecutionState(): PipelineState {
  // Minimal state shape with an in_progress code_review at phase 1 / task 1,
  // suitable for exercising the CODE_REVIEW_COMPLETED handler's routing.
  const state = makeState();
  // `makeState` above has `graph.status: 'in_progress'`; set the task iteration
  // and child nodes to in_progress so resolveNodeState + resolveTaskIteration
  // both succeed without ambiguity.
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  phaseLoop.status = 'in_progress';
  phaseLoop.iterations[0].status = 'in_progress';
  const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
  if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
  taskLoop.status = 'in_progress';
  taskLoop.iterations[0].status = 'in_progress';
  taskLoop.iterations[0].nodes['code_review'] = {
    kind: 'step',
    status: 'in_progress',
    doc_path: null,
    retries: 0,
  };
  return state;
}

// Task-body template fixture — the CODE_REVIEW_COMPLETED handler's corrective
// scaffold path calls `findTaskLoopBodyDefs(template)`; it must find a
// for_each_task body or throw. Mirror the mutations.test.ts fixture.
function taskBodyTemplate(): PipelineTemplate {
  return {
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
}

describe('code_review_completed (Iter 10) — mutation-side backstop hard errors', () => {
  it('effective_outcome=changes_requested with no corrective_handoff_path → throws "contract bypassed" error', () => {
    const state = makeExecutionState();
    const mutation = getMutation('code_review_completed')!;
    expect(() =>
      mutation(
        state,
        {
          phase: 1,
          task: 1,
          doc_path: '/r.md',
          verdict: 'changes_requested',
          orchestrator_mediated: true,
          effective_outcome: 'changes_requested',
        } as Record<string, unknown>,
        baseConfig,
        taskBodyTemplate(),
      ),
    ).toThrow(/corrective_handoff_path/);
  });

  it('effective_outcome=changes_requested with empty-string corrective_handoff_path → throws', () => {
    const state = makeExecutionState();
    const mutation = getMutation('code_review_completed')!;
    expect(() =>
      mutation(
        state,
        {
          phase: 1,
          task: 1,
          doc_path: '/r.md',
          verdict: 'changes_requested',
          orchestrator_mediated: true,
          effective_outcome: 'changes_requested',
          corrective_handoff_path: '   ',
        } as Record<string, unknown>,
        baseConfig,
        taskBodyTemplate(),
      ),
    ).toThrow(/corrective_handoff_path/);
  });

  it('effective_outcome=approved with corrective_handoff_path present → mutation tolerates (approved filter-down births no corrective)', () => {
    // The mutation does not treat this as a hard error — only the validator
    // does (05-frontmatter-validation.test.ts covers that path). The mutation
    // sees routingVerdict=approved, takes the no-op branch, and succeeds.
    // This test pins the layered-responsibility contract: validator is
    // primary enforcer, mutation doesn't duplicate the check.
    const state = makeExecutionState();
    const mutation = getMutation('code_review_completed')!;
    const result = mutation(
      state,
      {
        phase: 1,
        task: 1,
        doc_path: '/r.md',
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'approved',
        corrective_handoff_path: 'tasks/ghost-C1.md',
      } as Record<string, unknown>,
      baseConfig,
      taskBodyTemplate(),
    );
    // No corrective birthed, no halt.
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected');
    expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(0);
    expect(result.state.graph.status).not.toBe('halted');
    // State records the effective outcome.
    const codeReview = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    expect(codeReview.verdict).toBe('approved');
  });

  it('budget exhausted + corrective_handoff_path supplied → hard error halt with descriptive reason', () => {
    const state = makeExecutionState();
    // Pre-fill corrective_tasks to the budget (3 per baseConfig).
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected');
    const iteration = taskLoop.iterations[0];
    for (let i = 0; i < baseConfig.limits.max_retries_per_task; i++) {
      iteration.corrective_tasks.push({
        index: i + 1,
        reason: 'prior',
        injected_after: 'code_review',
        status: 'not_started',
        nodes: {},
        commit_hash: null,
      });
    }

    const mutation = getMutation('code_review_completed')!;
    const result = mutation(
      state,
      {
        phase: 1,
        task: 1,
        doc_path: '/r.md',
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
        corrective_handoff_path: 'tasks/exhausted-C4.md',
      } as Record<string, unknown>,
      baseConfig,
      taskBodyTemplate(),
    );

    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toContain('Retry budget exhausted');
    expect(result.state.pipeline.halt_reason).toContain('corrective_handoff_path');
    // Iteration halted too.
    const finalPhaseLoop = result.state.graph.nodes['phase_loop'];
    if (finalPhaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    const finalTaskLoop = finalPhaseLoop.iterations[0].nodes['task_loop'];
    if (finalTaskLoop.kind !== 'for_each_task') throw new Error('unexpected');
    expect(finalTaskLoop.iterations[0].status).toBe('halted');
    // No new corrective entry was birthed — the budget was already at max.
    expect(finalTaskLoop.iterations[0].corrective_tasks).toHaveLength(
      baseConfig.limits.max_retries_per_task,
    );
  });
});
