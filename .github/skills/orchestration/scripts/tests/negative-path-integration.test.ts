import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkDAG } from '../lib/dag-walker.js';
import { getMutation } from '../lib/mutations.js';
import { loadTemplate } from '../lib/template-loader.js';
import type {
  PipelineState,
  OrchestrationConfig,
  StepNodeState,
  GateNodeState,
} from '../lib/types.js';

// ── Template loading ──────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/full.yml');
const { template } = loadTemplate(TEMPLATE_PATH);

// ── Config ────────────────────────────────────────────────────────────────────

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

// ── State helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a state where all planning steps and the plan approval gate are
 * completed, plus phase_loop has one completed iteration. This models the
 * "post-approval, mid-execution" snapshot that plan_rejected would reset.
 */
function makePlanningCompletedState(): PipelineState {
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
      current_tier: 'execution',
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
        master_plan: { kind: 'step', status: 'completed', doc_path: '/path/plan.md', retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'completed', gate_active: true },
        phase_loop: {
          kind: 'for_each_phase',
          status: 'in_progress',
          iterations: [
            {
              index: 0,
              status: 'in_progress',
              nodes: {
                phase_planning: { kind: 'step', status: 'completed', doc_path: '/path/phase-plan.md', retries: 0 },
                task_loop: { kind: 'for_each_task', status: 'not_started', iterations: [] },
                phase_report: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                phase_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
                phase_gate: { kind: 'gate', status: 'not_started', gate_active: false },
              },
              corrective_tasks: [],
              commit_hash: null,
            },
          ],
        },
        final_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        pr_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
        final_pr: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      },
    },
  };
}

/**
 * Builds a state where the entire pipeline up to and including final_review is
 * completed. This models the "post-final-review" snapshot that final_rejected
 * would reset back to spawn_final_reviewer.
 */
function makeAllPhasesCompletedState(): PipelineState {
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
      current_tier: 'review',
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
        master_plan: { kind: 'step', status: 'completed', doc_path: '/path/plan.md', retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'completed', gate_active: true },
        phase_loop: { kind: 'for_each_phase', status: 'completed', iterations: [] },
        final_review: { kind: 'step', status: 'completed', doc_path: '/path/final-review.md', retries: 0 },
        final_approval_gate: { kind: 'gate', status: 'completed', gate_active: true },
        pr_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
        final_pr: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      },
    },
  };
}

/**
 * Builds a baseline mid-planning state used for gate_rejected and halt tests.
 * Any active pipeline state will do since these mutations halt immediately.
 */
function makeActiveState(): PipelineState {
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
      current_tier: 'execution',
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
        master_plan: { kind: 'step', status: 'completed', doc_path: '/path/plan.md', retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'completed', gate_active: true },
        phase_loop: { kind: 'for_each_phase', status: 'in_progress', iterations: [] },
        final_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        final_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
        pr_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
        final_pr: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      },
    },
  };
}

// ── Integration tests ─────────────────────────────────────────────────────────

describe('negative-path integration — plan_rejected → walkDAG', () => {
  it('walker returns spawn_master_plan after plan_rejected resets master_plan', () => {
    const state = makePlanningCompletedState();
    const mutation = getMutation('plan_rejected')!;
    const { state: mutated } = mutation(state, {}, baseConfig, template);

    // Verify mutation took effect
    expect((mutated.graph.nodes['master_plan'] as StepNodeState).status).toBe('not_started');

    const result = walkDAG(mutated, template, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('spawn_master_plan');
    expect(result!.context).toMatchObject({ step: 'master_plan' });
  });
});

describe('negative-path integration — gate_rejected → walkDAG', () => {
  it('walker returns display_halted with halt_reason after gate_rejected', () => {
    const state = makeActiveState();
    const mutation = getMutation('gate_rejected')!;
    const { state: mutated } = mutation(
      state,
      { gate_type: 'task', reason: 'Testing gate rejection' },
      baseConfig,
      template,
    );

    expect(mutated.graph.status).toBe('halted');
    const result = walkDAG(mutated, template, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('display_halted');
    expect(result!.context.details).toBe('Gate rejected (task): Testing gate rejection');
  });
});

describe('negative-path integration — halt → walkDAG', () => {
  it('walker returns display_halted with halt_reason after halt', () => {
    const state = makeActiveState();
    const mutation = getMutation('halt')!;
    const { state: mutated } = mutation(
      state,
      { reason: 'Emergency stop by operator' },
      baseConfig,
      template,
    );

    expect(mutated.graph.status).toBe('halted');
    const result = walkDAG(mutated, template, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('display_halted');
    expect(result!.context.details).toBe('Emergency stop by operator');
  });
});

describe('negative-path integration — final_rejected → walkDAG', () => {
  it('walker returns spawn_final_reviewer after final_rejected resets final_review', () => {
    const state = makeAllPhasesCompletedState();
    const mutation = getMutation('final_rejected')!;
    const { state: mutated } = mutation(state, {}, baseConfig, template);

    // Verify mutation took effect
    expect((mutated.graph.nodes['final_review'] as StepNodeState).status).toBe('not_started');
    expect((mutated.graph.nodes['final_approval_gate'] as GateNodeState).gate_active).toBe(false);

    const result = walkDAG(mutated, template, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('spawn_final_reviewer');
  });
});
