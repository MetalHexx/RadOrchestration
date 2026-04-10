import { describe, it, expect } from 'vitest';
import { getMutation } from '../lib/mutations.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  StepNodeState,
  GateNodeState,
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
                phase_report: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                phase_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                phase_commit_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
                phase_commit: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
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

// ── Navigation helpers ────────────────────────────────────────────────────────

function getPhaseIteration(state: PipelineState): IterationEntry {
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  return phaseLoop.iterations[0];
}

function getPhaseNode(state: PipelineState, nodeId: string) {
  return getPhaseIteration(state).nodes[nodeId];
}

// ── phase_review_completed — corrective re-planning (changes_requested) ───────

describe('phase_review_completed — corrective re-planning', () => {
  const mutation = getMutation('phase_review_completed')!;

  it('resets phase_planning.status to not_started', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    expect(getPhaseNode(result.state, 'phase_planning').status).toBe('not_started');
  });

  it('clears phase_planning.doc_path to null', () => {
    const state = makeState();
    // Pre-populate doc_path to confirm it gets cleared
    (getPhaseIteration(state).nodes['phase_planning'] as StepNodeState).doc_path = '/old/plan.md';
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    expect((getPhaseNode(result.state, 'phase_planning') as StepNodeState).doc_path).toBeNull();
  });

  it('resets task_loop.status to not_started', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    expect(getPhaseNode(result.state, 'task_loop').status).toBe('not_started');
  });

  it('clears task_loop.iterations to empty array', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const taskLoop = getPhaseNode(result.state, 'task_loop');
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected kind');
    expect(taskLoop.iterations).toHaveLength(0);
  });

  it('resets phase_report to not_started and clears doc_path and verdict', () => {
    const state = makeState();
    const phaseReport = getPhaseIteration(state).nodes['phase_report'] as StepNodeState;
    phaseReport.status = 'completed';
    phaseReport.doc_path = '/report.md';
    phaseReport.verdict = 'approved';
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_report') as StepNodeState;
    expect(node.status).toBe('not_started');
    expect(node.doc_path).toBeNull();
    expect(node.verdict).toBeNull();
  });

  it('resets phase_review to not_started and clears verdict but preserves doc_path', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, doc_path: '/review.md', verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_review') as StepNodeState;
    expect(node.status).toBe('not_started');
    expect(node.doc_path).toBe('/review.md');  // doc_path preserved for context-enrichment previous_review
    expect(node.verdict).toBeNull();
  });

  it('resets phase_gate to not_started and clears gate_active', () => {
    const state = makeState();
    const phaseGate = getPhaseIteration(state).nodes['phase_gate'] as GateNodeState;
    phaseGate.status = 'completed';
    phaseGate.gate_active = true;
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_gate') as GateNodeState;
    expect(node.status).toBe('not_started');
    expect(node.gate_active).toBe(false);
  });

  it('pushes corrective entry with nodes: {} (empty object — no scaffolded body nodes)', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(1);
    const entry = iteration.corrective_tasks[0] as CorrectiveTaskEntry;
    expect(Object.keys(entry.nodes)).toHaveLength(0);
  });

  it('corrective entry has status: in_progress and injected_after: phase_review', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.status).toBe('in_progress');
    expect(entry.injected_after).toBe('phase_review');
  });

  it('uses context.reason in corrective entry when provided', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested', reason: 'Custom reason' }, baseConfig, baseTemplate);
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.reason).toBe('Custom reason');
  });

  it('uses default reason when context.reason is absent', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const entry = getPhaseIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.reason).toBe('Phase review requested changes');
  });

  it('immutability — original state is not mutated', () => {
    const state = makeState();
    const originalCorLen = getPhaseIteration(state).corrective_tasks.length;
    mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    expect(getPhaseNode(state, 'phase_planning').status).toBe('not_started');
    expect(getPhaseIteration(state).corrective_tasks.length).toBe(originalCorLen);
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
