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
