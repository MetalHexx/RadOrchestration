import { describe, it, expect } from 'vitest';
import { walkDAG } from '../lib/dag-walker.js';
import type {
  PipelineState,
  PipelineTemplate,
  OrchestrationConfig,
  StepNodeState,
  NodeDef,
} from '../lib/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(): OrchestrationConfig {
  return {
    system: { orch_root: '/tmp' },
    projects: { base_path: '/tmp/projects', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3,
    },
    human_gates: {
      after_planning: true,
      execution_mode: 'autonomous',
      after_final_review: true,
    },
    source_control: {
      auto_commit: 'ask',
      auto_pr: 'ask',
      provider: 'github',
    },
    default_template: 'full',
  };
}

function makeTemplate(nodes: NodeDef[]): PipelineTemplate {
  return {
    template: { id: 'test-template', version: '1.0', description: 'test' },
    nodes,
  };
}

function makeHaltedState(haltReason: string | null): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '2026-01-01', updated: '2026-01-01' },
    config: {
      gate_mode: 'autonomous',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'ask', auto_pr: 'ask' },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'halted',
      halt_reason: haltReason,
    },
    graph: {
      template_id: 'test-template',
      status: 'halted',
      current_node_path: null,
      nodes: {
        research: { kind: 'step', status: 'completed', doc_path: null, retries: 0 } as StepNodeState,
        prd: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 } as StepNodeState,
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('walkDAG — halted early return', () => {
  it('returns display_halted with halt_reason details when graph.status is halted and halt_reason is set', () => {
    const template = makeTemplate([
      { id: 'research', kind: 'step', action: 'spawn_research', events: { started: 'research_started', completed: 'research_completed' } },
      { id: 'prd', kind: 'step', action: 'spawn_prd', events: { started: 'prd_started', completed: 'prd_completed' } },
    ]);
    const state = makeHaltedState('Gate rejected by reviewer');
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({
      action: 'display_halted',
      context: { details: 'Gate rejected by reviewer' },
    });
  });

  it('returns display_halted with default message when graph.status is halted and halt_reason is null', () => {
    const template = makeTemplate([
      { id: 'research', kind: 'step', action: 'spawn_research', events: { started: 'research_started', completed: 'research_completed' } },
    ]);
    const state = makeHaltedState(null);
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({
      action: 'display_halted',
      context: { details: 'Pipeline is halted' },
    });
  });

  it('returns immediately without traversing nodes when graph.status is halted', () => {
    // All nodes are not_started — if traversal occurred, result would be a step action
    const template = makeTemplate([
      { id: 'research', kind: 'step', action: 'spawn_research', events: { started: 'research_started', completed: 'research_completed' } },
    ]);
    const state: PipelineState = {
      $schema: 'orchestration-state-v5',
      project: { name: 'TEST', created: '2026-01-01', updated: '2026-01-01' },
      config: {
        gate_mode: 'autonomous',
        limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
        source_control: { auto_commit: 'ask', auto_pr: 'ask' },
      },
      pipeline: { gate_mode: null, source_control: null, current_tier: 'halted', halt_reason: 'Manual halt' },
      graph: {
        template_id: 'test-template',
        status: 'halted',
        current_node_path: null,
        nodes: {
          research: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 } as StepNodeState,
        },
      },
    };
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    // Must return display_halted — NOT spawn_research (which would happen if traversal occurred)
    expect(result?.action).toBe('display_halted');
    expect(result?.context).toEqual({ details: 'Manual halt' });
  });

  it('returns next step action (not display_halted) when graph.status is in_progress', () => {
    const template = makeTemplate([
      { id: 'research', kind: 'step', action: 'spawn_research', events: { started: 'research_started', completed: 'research_completed' } },
    ]);
    const state: PipelineState = {
      $schema: 'orchestration-state-v5',
      project: { name: 'TEST', created: '2026-01-01', updated: '2026-01-01' },
      config: {
        gate_mode: 'autonomous',
        limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
        source_control: { auto_commit: 'ask', auto_pr: 'ask' },
      },
      pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
      graph: {
        template_id: 'test-template',
        status: 'in_progress',
        current_node_path: null,
        nodes: {
          research: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 } as StepNodeState,
        },
      },
    };
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result?.action).toBe('spawn_research');
  });
});
