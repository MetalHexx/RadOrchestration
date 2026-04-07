import { describe, it, expect } from 'vitest';
import { walkDAG, resolveNodeStatePath } from '../lib/dag-walker.js';
import type {
  PipelineState,
  PipelineTemplate,
  OrchestrationConfig,
  StepNodeDef,
  GateNodeDef,
  StepNodeState,
  GateNodeState,
  NodeState,
  NodeDef,
  ForEachPhaseNodeDef,
  ForEachPhaseNodeState,
} from '../lib/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<OrchestrationConfig['human_gates']>): OrchestrationConfig {
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
      execution_mode: 'ask',
      after_final_review: true,
      ...overrides,
    },
    source_control: {
      auto_commit: 'ask',
      auto_pr: 'ask',
      provider: 'github',
    },
  };
}

function makeState(nodes: Record<string, NodeState>): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '2026-01-01', updated: '2026-01-01' },
    config: {
      gate_mode: 'ask',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'ask', auto_pr: 'ask' },
    },
    graph: {
      template_id: 'test-template',
      status: 'in_progress',
      current_node_path: null,
      nodes,
    },
  };
}

function makeTemplate(nodes: NodeDef[]): PipelineTemplate {
  return {
    template: { id: 'test-template', version: '1.0', description: 'test' },
    nodes,
  };
}

function stepDef(id: string, action: string, opts?: { depends_on?: string[]; context?: Record<string, unknown> }): StepNodeDef {
  return {
    id,
    kind: 'step',
    action,
    events: { started: `${id}_started`, completed: `${id}_completed` },
    depends_on: opts?.depends_on,
    context: opts?.context,
  };
}

function gateDef(
  id: string,
  modeRef: string,
  actionIfNeeded: string,
  autoApproveModes?: string[],
  opts?: { depends_on?: string[] },
): GateNodeDef {
  return {
    id,
    kind: 'gate',
    mode_ref: modeRef,
    action_if_needed: actionIfNeeded,
    approved_event: `${id}_approved`,
    auto_approve_modes: autoApproveModes,
    depends_on: opts?.depends_on,
  };
}

function stepState(status: 'not_started' | 'in_progress' | 'completed' | 'halted' | 'skipped'): StepNodeState {
  return { kind: 'step', status, doc_path: null, retries: 0 };
}

function gateState(status: 'not_started' | 'completed' | 'halted' | 'skipped', gateActive: boolean): GateNodeState {
  return { kind: 'gate', status, gate_active: gateActive };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('walkDAG', () => {
  it('returns action for a single not_started step with no dependencies', () => {
    const template = makeTemplate([stepDef('research', 'spawn_research')]);
    const state = makeState({ research: stepState('not_started') });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_research', context: {} });
  });

  it('returns step context when step node has a context field', () => {
    const ctx = { phase: 1, task: 2 };
    const template = makeTemplate([stepDef('execute', 'execute_task', { context: ctx })]);
    const state = makeState({ execute: stepState('not_started') });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'execute_task', context: { phase: 1, task: 2 } });
  });

  it('skips a step whose dependency is not_started and returns null', () => {
    const template = makeTemplate([
      stepDef('research', 'spawn_research'),
      stepDef('prd', 'spawn_prd', { depends_on: ['research'] }),
    ]);
    const state = makeState({
      research: stepState('not_started'),
      prd: stepState('not_started'),
    });
    const config = makeConfig();

    // First step is not_started → returns its action
    const result = walkDAG(state, template, config);
    expect(result).toEqual({ action: 'spawn_research', context: {} });
  });

  it('returns null when a not_started step depends on another not_started step and first step is in_progress', () => {
    const template = makeTemplate([
      stepDef('research', 'spawn_research'),
      stepDef('prd', 'spawn_prd', { depends_on: ['research'] }),
    ]);
    const state = makeState({
      research: stepState('in_progress'),
      prd: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('returns action when dependency is completed', () => {
    const template = makeTemplate([
      stepDef('research', 'spawn_research'),
      stepDef('prd', 'spawn_prd', { depends_on: ['research'] }),
    ]);
    const state = makeState({
      research: stepState('completed'),
      prd: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toEqual({ action: 'spawn_prd', context: {} });
  });

  it('treats skipped dependency as satisfied', () => {
    const template = makeTemplate([
      stepDef('research', 'spawn_research'),
      stepDef('prd', 'spawn_prd', { depends_on: ['research'] }),
    ]);
    const state = makeState({
      research: stepState('skipped'),
      prd: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toEqual({ action: 'spawn_prd', context: {} });
  });

  it('returns null when a step is in_progress', () => {
    const template = makeTemplate([stepDef('research', 'spawn_research')]);
    const state = makeState({ research: stepState('in_progress') });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('auto-approves gate when config value is a string in auto_approve_modes', () => {
    const template = makeTemplate([
      gateDef('plan_gate', 'human_gates.execution_mode', 'request_plan_approval', ['autonomous']),
      stepDef('next_step', 'spawn_prd'),
    ]);
    const state = makeState({
      plan_gate: gateState('not_started', false),
      next_step: stepState('not_started'),
    });
    const config = makeConfig({ execution_mode: 'autonomous' });

    const result = walkDAG(state, template, config);

    // Gate was auto-approved, walker continued to next step
    expect(result).toEqual({ action: 'spawn_prd', context: {} });
    // Gate state was mutated
    const gateNodeState = state.graph.nodes['plan_gate'] as GateNodeState;
    expect(gateNodeState.status).toBe('completed');
    expect(gateNodeState.gate_active).toBe(false);
  });

  it('returns action_if_needed when gate config value is not in auto_approve_modes', () => {
    const template = makeTemplate([
      gateDef('plan_gate', 'human_gates.execution_mode', 'request_plan_approval', ['autonomous']),
      stepDef('next_step', 'spawn_prd'),
    ]);
    const state = makeState({
      plan_gate: gateState('not_started', false),
      next_step: stepState('not_started'),
    });
    const config = makeConfig({ execution_mode: 'ask' });

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'request_plan_approval', context: {} });
    const gateNodeState = state.graph.nodes['plan_gate'] as GateNodeState;
    expect(gateNodeState.gate_active).toBe(true);
  });

  it('auto-approves gate when boolean config is false (falsy = gate not needed)', () => {
    const template = makeTemplate([
      gateDef('plan_gate', 'human_gates.after_planning', 'request_plan_approval'),
      stepDef('next_step', 'spawn_prd'),
    ]);
    const state = makeState({
      plan_gate: gateState('not_started', false),
      next_step: stepState('not_started'),
    });
    const config = makeConfig({ after_planning: false });

    const result = walkDAG(state, template, config);

    // Gate was auto-approved because config is false (falsy)
    expect(result).toEqual({ action: 'spawn_prd', context: {} });
    const gateNodeState = state.graph.nodes['plan_gate'] as GateNodeState;
    expect(gateNodeState.status).toBe('completed');
    expect(gateNodeState.gate_active).toBe(false);
  });

  it('returns action_if_needed when boolean config is true (gate active)', () => {
    const template = makeTemplate([
      gateDef('plan_gate', 'human_gates.after_planning', 'request_plan_approval'),
      stepDef('next_step', 'spawn_prd'),
    ]);
    const state = makeState({
      plan_gate: gateState('not_started', false),
      next_step: stepState('not_started'),
    });
    const config = makeConfig({ after_planning: true });

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'request_plan_approval', context: {} });
    const gateNodeState = state.graph.nodes['plan_gate'] as GateNodeState;
    expect(gateNodeState.gate_active).toBe(true);
  });

  it('returns display_complete when all nodes are completed or skipped', () => {
    const template = makeTemplate([
      stepDef('research', 'spawn_research'),
      stepDef('prd', 'spawn_prd', { depends_on: ['research'] }),
    ]);
    const state = makeState({
      research: stepState('completed'),
      prd: stepState('skipped'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toEqual({ action: 'display_complete', context: {} });
  });

  it('returns display_halted when any node has status halted', () => {
    const template = makeTemplate([
      stepDef('research', 'spawn_research'),
      stepDef('prd', 'spawn_prd', { depends_on: ['research'] }),
    ]);
    const state = makeState({
      research: stepState('halted'),
      prd: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toEqual({ action: 'display_halted', context: {} });
  });

  it('returns null for unsupported node kind (for_each_phase)', () => {
    const forEachDef: ForEachPhaseNodeDef = {
      id: 'phase_loop',
      kind: 'for_each_phase',
      source_doc_ref: 'master_plan',
      total_field: 'total_phases',
      body: [],
    };
    const forEachState: ForEachPhaseNodeState = {
      kind: 'for_each_phase',
      status: 'not_started',
      iterations: [],
    };
    const template = makeTemplate([forEachDef]);
    const state = makeState({ phase_loop: forEachState });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });
});

describe('resolveNodeStatePath', () => {
  it('returns the templatePath unchanged (pass-through)', () => {
    const result = resolveNodeStatePath('phase_loop.body.task_loop.body.code_review', { phase: 1 });
    expect(result).toBe('phase_loop.body.task_loop.body.code_review');
  });
});
