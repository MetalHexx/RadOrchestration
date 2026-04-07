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
  ForEachTaskNodeDef,
  ForEachTaskNodeState,
  ConditionalNodeDef,
  ConditionalNodeState,
  ParallelNodeDef,
  ParallelNodeState,
  ConditionExpression,
  IterationEntry,
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

function condDef(
  id: string,
  condition: ConditionExpression,
  branches: { true: NodeDef[]; false: NodeDef[] },
  opts?: { depends_on?: string[] },
): ConditionalNodeDef {
  return {
    id,
    kind: 'conditional',
    condition,
    branches,
    depends_on: opts?.depends_on,
  };
}

function condState(
  status: 'not_started' | 'in_progress' | 'completed',
  branchTaken: 'true' | 'false' | null,
): ConditionalNodeState {
  return { kind: 'conditional', status, branch_taken: branchTaken };
}

function parallelDef(
  id: string,
  children: NodeDef[],
  opts?: { depends_on?: string[] },
): ParallelNodeDef {
  return {
    id,
    kind: 'parallel',
    serialize: true,
    children,
    depends_on: opts?.depends_on,
  };
}

function pState(
  status: 'not_started' | 'in_progress' | 'completed',
  nodes: Record<string, NodeState> = {},
): ParallelNodeState {
  return { kind: 'parallel', status, nodes };
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

  it('returns first eligible step when a later step has unmet dependency', () => {
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

  it('returns null for for_each_phase with not_started and empty iterations when no readDocument callback', () => {
    const forEachDef: ForEachPhaseNodeDef = {
      id: 'phase_loop',
      kind: 'for_each_phase',
      source_doc_ref: '$.nodes.master_plan.doc_path',
      total_field: 'total_phases',
      body: [stepDef('plan_phase', 'create_phase_plan')],
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

  // ── T01 carry-forward ───────────────────────────────────────────────────────

  it('returns null when the only node has an unsatisfied dependency', () => {
    const template = makeTemplate([
      stepDef('prd', 'spawn_prd', { depends_on: ['missing'] }),
    ]);
    const state = makeState({
      missing: stepState('not_started'),
      prd: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  // ── Conditional node tests ──────────────────────────────────────────────────

  it('walks into branches.true when condition evaluates to true', () => {
    const template = makeTemplate([
      condDef('cond1', {
        config_ref: 'human_gates.after_planning',
        operator: 'eq',
        value: true,
      }, {
        true: [stepDef('branch_step', 'spawn_research')],
        false: [stepDef('alt_step', 'spawn_prd')],
      }),
    ]);
    const state = makeState({
      cond1: condState('not_started', null),
    });
    const config = makeConfig({ after_planning: true });

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_research', context: {} });
    const cs = state.graph.nodes['cond1'] as ConditionalNodeState;
    expect(cs.branch_taken).toBe('true');
    expect(cs.status).toBe('in_progress');
    expect(state.graph.nodes['branch_step']).toBeDefined();
  });

  it('walks into branches.false when condition evaluates to false', () => {
    const template = makeTemplate([
      condDef('cond1', {
        config_ref: 'human_gates.after_planning',
        operator: 'eq',
        value: true,
      }, {
        true: [stepDef('branch_step', 'spawn_research')],
        false: [stepDef('alt_step', 'spawn_prd')],
      }),
    ]);
    const state = makeState({
      cond1: condState('not_started', null),
    });
    const config = makeConfig({ after_planning: false });

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_prd', context: {} });
    const cs = state.graph.nodes['cond1'] as ConditionalNodeState;
    expect(cs.branch_taken).toBe('false');
    expect(cs.status).toBe('in_progress');
    expect(state.graph.nodes['alt_step']).toBeDefined();
  });

  it('completes conditional and continues when taken branch is empty', () => {
    const template = makeTemplate([
      condDef('cond1', {
        config_ref: 'human_gates.after_planning',
        operator: 'eq',
        value: true,
      }, {
        true: [],
        false: [stepDef('alt_step', 'spawn_prd')],
      }),
      stepDef('next_step', 'spawn_architecture'),
    ]);
    const state = makeState({
      cond1: condState('not_started', null),
      next_step: stepState('not_started'),
    });
    const config = makeConfig({ after_planning: true });

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_architecture', context: {} });
    const cs = state.graph.nodes['cond1'] as ConditionalNodeState;
    expect(cs.status).toBe('completed');
    expect(cs.branch_taken).toBe('true');
  });

  it('returns null when branch node is in_progress', () => {
    const template = makeTemplate([
      condDef('cond1', {
        config_ref: 'human_gates.after_planning',
        operator: 'eq',
        value: true,
      }, {
        true: [stepDef('branch_step', 'spawn_research')],
        false: [],
      }),
    ]);
    const state = makeState({
      cond1: condState('in_progress', 'true'),
      branch_step: stepState('in_progress'),
    });
    const config = makeConfig({ after_planning: true });

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('completes conditional when all branch nodes are completed', () => {
    const template = makeTemplate([
      condDef('cond1', {
        config_ref: 'human_gates.after_planning',
        operator: 'eq',
        value: true,
      }, {
        true: [stepDef('branch_step', 'spawn_research')],
        false: [],
      }),
      stepDef('next_step', 'spawn_architecture'),
    ]);
    const state = makeState({
      cond1: condState('in_progress', 'true'),
      branch_step: stepState('completed'),
      next_step: stepState('not_started'),
    });
    const config = makeConfig({ after_planning: true });

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_architecture', context: {} });
    const cs = state.graph.nodes['cond1'] as ConditionalNodeState;
    expect(cs.status).toBe('completed');
  });

  // ── Parallel node tests ─────────────────────────────────────────────────────

  it('returns action for first not_started parallel child', () => {
    const template = makeTemplate([
      parallelDef('par1', [
        stepDef('child1', 'spawn_research'),
        stepDef('child2', 'spawn_prd'),
      ]),
    ]);
    const state = makeState({
      par1: pState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_research', context: {} });
    const ps = state.graph.nodes['par1'] as ParallelNodeState;
    expect(ps.status).toBe('in_progress');
    expect(ps.nodes['child1']).toBeDefined();
    expect(ps.nodes['child2']).toBeDefined();
  });

  it('completes parallel and continues when all children are completed', () => {
    const template = makeTemplate([
      parallelDef('par1', [
        stepDef('child1', 'spawn_research'),
        stepDef('child2', 'spawn_prd'),
      ]),
      stepDef('next_step', 'spawn_architecture'),
    ]);
    const state = makeState({
      par1: pState('in_progress', {
        child1: stepState('completed'),
        child2: stepState('completed'),
      }),
      next_step: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_architecture', context: {} });
    const ps = state.graph.nodes['par1'] as ParallelNodeState;
    expect(ps.status).toBe('completed');
  });

  it('returns null when a parallel child is in_progress', () => {
    const template = makeTemplate([
      parallelDef('par1', [
        stepDef('child1', 'spawn_research'),
        stepDef('child2', 'spawn_prd'),
      ]),
    ]);
    const state = makeState({
      par1: pState('in_progress', {
        child1: stepState('in_progress'),
        child2: stepState('not_started'),
      }),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });
});

// ── for_each_phase tests ──────────────────────────────────────────────────────

describe('for_each_phase handling', () => {

  function forEachPhaseDef(
    id: string,
    body: NodeDef[],
    opts?: { depends_on?: string[]; source_doc_ref?: string; total_field?: string },
  ): ForEachPhaseNodeDef {
    return {
      id,
      kind: 'for_each_phase',
      source_doc_ref: opts?.source_doc_ref ?? '$.nodes.master_plan.doc_path',
      total_field: opts?.total_field ?? 'total_phases',
      body,
      depends_on: opts?.depends_on,
    };
  }

  function forEachPhaseState(
    status: 'not_started' | 'in_progress' | 'completed',
    iterations: IterationEntry[] = [],
  ): ForEachPhaseNodeState {
    return { kind: 'for_each_phase', status, iterations };
  }

  function makeIteration(
    index: number,
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped',
    nodes: Record<string, NodeState>,
  ): IterationEntry {
    return { index, status, nodes, corrective_tasks: [] };
  }

  const mockReadDocument = (totalPhases: number) =>
    (_docPath: string) => ({ frontmatter: { total_phases: totalPhases } });

  it('expands iterations from frontmatter and returns first body node action', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('not_started'),
      master_plan: stepState('completed'),
    });
    // Set up the doc_path in the master_plan node state
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/projects/TEST/master-plan.md';

    const config = makeConfig();
    const result = walkDAG(state, template, config, mockReadDocument(3));

    expect(result).toEqual({ action: 'create_phase_plan', context: {} });
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.status).toBe('in_progress');
    expect(fepState.iterations).toHaveLength(3);
    expect(fepState.iterations[0].index).toBe(0);
    expect(fepState.iterations[0].status).toBe('in_progress');
    expect(fepState.iterations[0].nodes['plan_phase']).toBeDefined();
    expect(fepState.iterations[1].index).toBe(1);
    expect(fepState.iterations[1].status).toBe('not_started');
    expect(fepState.iterations[2].index).toBe(2);
    expect(fepState.iterations[2].status).toBe('not_started');
  });

  it('resolves source_doc_ref via resolveStateRef to get document path', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body, { source_doc_ref: '$.nodes.master_plan.doc_path' }),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('not_started'),
      master_plan: stepState('completed'),
    });
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/projects/TEST/custom-path.md';

    const readDoc = (docPath: string) => {
      expect(docPath).toBe('/projects/TEST/custom-path.md');
      return { frontmatter: { total_phases: 2 } };
    };

    const config = makeConfig();
    const result = walkDAG(state, template, config, readDoc);

    expect(result).toEqual({ action: 'create_phase_plan', context: {} });
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.iterations).toHaveLength(2);
  });

  it('walks into in_progress iteration and returns first actionable body node', () => {
    const body = [
      stepDef('plan_phase', 'create_phase_plan'),
      stepDef('execute_task', 'execute_task', { depends_on: ['plan_phase'] }),
    ];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'in_progress', {
          plan_phase: stepState('not_started'),
          execute_task: stepState('not_started'),
        }),
        makeIteration(1, 'not_started', {
          plan_phase: stepState('not_started'),
          execute_task: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_phase_plan', context: {} });
  });

  it('advances to next iteration when all body nodes in current iteration complete', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'in_progress', {
          plan_phase: stepState('completed'),
        }),
        makeIteration(1, 'not_started', {
          plan_phase: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_phase_plan', context: {} });
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.iterations[0].status).toBe('completed');
    expect(fepState.iterations[1].status).toBe('in_progress');
  });

  it('completes loop and continues to next sibling when all iterations complete', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
      stepDef('final_review', 'spawn_final_reviewer'),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'completed', {
          plan_phase: stepState('completed'),
        }),
        makeIteration(1, 'in_progress', {
          plan_phase: stepState('completed'),
        }),
      ]),
      final_review: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'spawn_final_reviewer', context: {} });
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.status).toBe('completed');
    expect(fepState.iterations[1].status).toBe('completed');
  });

  it('returns display_complete when loop is only node and all iterations complete', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'completed', {
          plan_phase: stepState('completed'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'display_complete', context: {} });
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.status).toBe('completed');
  });

  it('returns null when a body node inside an iteration is in_progress', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'in_progress', {
          plan_phase: stepState('in_progress'),
        }),
        makeIteration(1, 'not_started', {
          plan_phase: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('walks pre-expanded state without needing readDocument callback', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'not_started', {
          plan_phase: stepState('not_started'),
        }),
        makeIteration(1, 'not_started', {
          plan_phase: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    // No readDocument callback provided — should still walk correctly
    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_phase_plan', context: {} });
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.iterations[0].status).toBe('in_progress');
  });

  it('returns null when readDocument is not provided and expansion is needed', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('not_started'),
      master_plan: stepState('completed'),
    });
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/projects/TEST/master-plan.md';
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('returns null when readDocument returns null during expansion', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('not_started'),
      master_plan: stepState('completed'),
    });
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/projects/TEST/master-plan.md';
    const config = makeConfig();

    const result = walkDAG(state, template, config, (_docPath: string) => null);
    expect(result).toBe(null);
    // Verify iterations were NOT created
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.iterations).toHaveLength(0);
    expect(fepState.status).toBe('not_started');
  });

  it('returns null when total_field is a non-integer number', () => {
    const body = [stepDef('plan_phase', 'create_phase_plan')];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', body),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('not_started'),
      master_plan: stepState('completed'),
    });
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/projects/TEST/master-plan.md';
    const config = makeConfig();

    const readDoc = (_docPath: string) => ({ frontmatter: { total_phases: 2.5 } });
    const result = walkDAG(state, template, config, readDoc);
    expect(result).toBe(null);
    // Verify iterations were NOT created
    const fepState = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(fepState.iterations).toHaveLength(0);
    expect(fepState.status).toBe('not_started');
  });
});

// ── for_each_task tests ─────────────────────────────────────────────────────────────────────────────

describe('for_each_task handling', () => {

  function forEachTaskDef(
    id: string,
    body: NodeDef[],
    opts?: { depends_on?: string[]; source_doc_ref?: string; tasks_field?: string },
  ): ForEachTaskNodeDef {
    return {
      id,
      kind: 'for_each_task',
      source_doc_ref: opts?.source_doc_ref ?? '$.current_phase.doc_path',
      tasks_field: opts?.tasks_field ?? 'tasks',
      body,
      depends_on: opts?.depends_on,
    };
  }

  function forEachTaskState(
    status: 'not_started' | 'in_progress' | 'completed',
    iterations: IterationEntry[] = [],
  ): ForEachTaskNodeState {
    return { kind: 'for_each_task', status, iterations };
  }

  function makeIteration(
    index: number,
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped',
    nodes: Record<string, NodeState>,
  ): IterationEntry {
    return { index, status, nodes, corrective_tasks: [] };
  }

  // Helpers for nesting for_each_task inside for_each_phase in scope tests
  function forEachPhaseDef(
    id: string,
    body: NodeDef[],
    opts?: { depends_on?: string[]; source_doc_ref?: string; total_field?: string },
  ): ForEachPhaseNodeDef {
    return {
      id,
      kind: 'for_each_phase',
      source_doc_ref: opts?.source_doc_ref ?? '$.nodes.master_plan.doc_path',
      total_field: opts?.total_field ?? 'total_phases',
      body,
      depends_on: opts?.depends_on,
    };
  }

  function forEachPhaseState(
    status: 'not_started' | 'in_progress' | 'completed',
    iterations: IterationEntry[] = [],
  ): ForEachPhaseNodeState {
    return { kind: 'for_each_phase', status, iterations };
  }

  it('expands iterations from tasks array and returns first body node action', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('not_started'),
      phase_plan: stepState('completed'),
    });
    (state.graph.nodes['phase_plan'] as StepNodeState).doc_path = '/projects/TEST/phase-plan.md';

    const config = makeConfig();
    const tasks = [{ id: 'T01', title: 'First' }, { id: 'T02', title: 'Second' }];
    const result = walkDAG(
      state,
      template,
      config,
      (_docPath: string) => ({ frontmatter: { tasks } }),
    );

    expect(result).toEqual({ action: 'create_task_handoff', context: {} });
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.status).toBe('in_progress');
    expect(fetState.iterations).toHaveLength(2);
    expect(fetState.iterations[0].index).toBe(0);
    expect(fetState.iterations[0].status).toBe('in_progress');
    expect(fetState.iterations[0].nodes['task_handoff']).toBeDefined();
    expect(fetState.iterations[1].index).toBe(1);
    expect(fetState.iterations[1].status).toBe('not_started');
  });

  it('resolves source_doc_ref via phase_planning sibling when ref is $.current_phase.doc_path', () => {
    const phaseBody = [
      stepDef('phase_planning', 'create_phase_plan'),
      forEachTaskDef('task_loop', [stepDef('task_handoff', 'create_task_handoff')]),
    ];
    const template = makeTemplate([
      forEachPhaseDef('phase_loop', phaseBody),
    ]);
    const state = makeState({
      phase_loop: forEachPhaseState('in_progress', [
        makeIteration(0, 'in_progress', {
          phase_planning: { kind: 'step', status: 'completed', doc_path: '/projects/TEST/phase-plan.md', retries: 0 },
          task_loop: forEachTaskState('not_started'),
        }),
      ]),
    });

    const config = makeConfig();
    const readDoc = (docPath: string) => {
      expect(docPath).toBe('/projects/TEST/phase-plan.md');
      return { frontmatter: { tasks: [{ id: 'T01' }, { id: 'T02' }] } };
    };

    const result = walkDAG(state, template, config, readDoc);

    expect(result).toEqual({ action: 'create_task_handoff', context: {} });
    const phaseIter = (state.graph.nodes['phase_loop'] as ForEachPhaseNodeState).iterations[0];
    const fetState = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.iterations).toHaveLength(2);
  });

  it('walks into in_progress iteration and returns first actionable body node', () => {
    const body = [
      stepDef('task_handoff', 'create_task_handoff'),
      stepDef('task_executor', 'execute_task', { depends_on: ['task_handoff'] }),
    ];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('in_progress', [
        makeIteration(0, 'in_progress', {
          task_handoff: stepState('not_started'),
          task_executor: stepState('not_started'),
        }),
        makeIteration(1, 'not_started', {
          task_handoff: stepState('not_started'),
          task_executor: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_task_handoff', context: {} });
  });

  it('advances to next iteration when all body nodes in current iteration complete', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('in_progress', [
        makeIteration(0, 'in_progress', {
          task_handoff: stepState('completed'),
        }),
        makeIteration(1, 'not_started', {
          task_handoff: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_task_handoff', context: {} });
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.iterations[0].status).toBe('completed');
    expect(fetState.iterations[1].status).toBe('in_progress');
  });

  it('completes task loop and continues to next sibling when all iterations complete', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
      stepDef('phase_report', 'create_phase_report'),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('in_progress', [
        makeIteration(0, 'completed', {
          task_handoff: stepState('completed'),
        }),
        makeIteration(1, 'in_progress', {
          task_handoff: stepState('completed'),
        }),
      ]),
      phase_report: stepState('not_started'),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_phase_report', context: {} });
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.status).toBe('completed');
    expect(fetState.iterations[1].status).toBe('completed');
  });

  it('returns null when a body node inside a task iteration is in_progress', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('in_progress', [
        makeIteration(0, 'in_progress', {
          task_handoff: stepState('in_progress'),
        }),
        makeIteration(1, 'not_started', {
          task_handoff: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('walks pre-expanded state without readDocument callback', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('in_progress', [
        makeIteration(0, 'not_started', {
          task_handoff: stepState('not_started'),
        }),
      ]),
    });
    const config = makeConfig();

    // No readDocument callback — should still walk correctly since iterations are populated
    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'create_task_handoff', context: {} });
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.iterations[0].status).toBe('in_progress');
  });

  it('returns null when readDocument is not provided and expansion is needed', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('not_started'),
      phase_plan: stepState('completed'),
    });
    (state.graph.nodes['phase_plan'] as StepNodeState).doc_path = '/projects/TEST/phase-plan.md';
    const config = makeConfig();

    const result = walkDAG(state, template, config);
    expect(result).toBe(null);
  });

  it('returns null when readDocument returns null during expansion', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('not_started'),
      phase_plan: stepState('completed'),
    });
    (state.graph.nodes['phase_plan'] as StepNodeState).doc_path = '/projects/TEST/phase-plan.md';
    const config = makeConfig();

    const result = walkDAG(state, template, config, (_docPath: string) => null);
    expect(result).toBe(null);
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.iterations).toHaveLength(0);
    expect(fetState.status).toBe('not_started');
  });

  it('returns null when tasks_field value is not an array', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('not_started'),
      phase_plan: stepState('completed'),
    });
    (state.graph.nodes['phase_plan'] as StepNodeState).doc_path = '/projects/TEST/phase-plan.md';
    const config = makeConfig();

    const readDoc = (_docPath: string) => ({ frontmatter: { tasks: 3 } });
    const result = walkDAG(state, template, config, readDoc);
    expect(result).toBe(null);
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.iterations).toHaveLength(0);
    expect(fetState.status).toBe('not_started');
  });

  it('returns null when tasks array is empty', () => {
    const body = [stepDef('task_handoff', 'create_task_handoff')];
    const template = makeTemplate([
      forEachTaskDef('task_loop', body, { source_doc_ref: '$.nodes.phase_plan.doc_path' }),
    ]);
    const state = makeState({
      task_loop: forEachTaskState('not_started'),
      phase_plan: stepState('completed'),
    });
    (state.graph.nodes['phase_plan'] as StepNodeState).doc_path = '/projects/TEST/phase-plan.md';
    const config = makeConfig();

    const readDoc = (_docPath: string) => ({ frontmatter: { tasks: [] } });
    const result = walkDAG(state, template, config, readDoc);
    expect(result).toBe(null);
    const fetState = state.graph.nodes['task_loop'] as ForEachTaskNodeState;
    expect(fetState.iterations).toHaveLength(0);
    expect(fetState.status).toBe('not_started');
  });
});

describe('resolveNodeStatePath', () => {
  it('returns the templatePath unchanged (pass-through)', () => {
    const result = resolveNodeStatePath('phase_loop.body.task_loop.body.code_review', { phase: 1 });
    expect(result).toBe('phase_loop.body.task_loop.body.code_review');
  });
});
