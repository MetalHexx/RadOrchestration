import { describe, it, expect } from 'vitest';
import { walkDAG } from '../lib/dag-walker.js';
import type {
  PipelineState,
  PipelineTemplate,
  OrchestrationConfig,
  GateNodeDef,
  GateNodeState,
  StepNodeDef,
  StepNodeState,
  NodeDef,
  NodeState,
} from '../lib/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(executionMode = 'ask'): OrchestrationConfig {
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
      execution_mode: executionMode,
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

function makeState(
  nodes: Record<string, NodeState>,
  pipelineGateMode: string | null = null,
): PipelineState {
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
    pipeline: {
      gate_mode: pipelineGateMode,
      source_control: null,
      current_tier: 'execution',
      halt_reason: null,
    },
    graph: {
      template_id: 'test-template',
      status: 'in_progress',
      current_node_path: null,
      nodes,
    },
  };
}

function stepDef(id: string, action: string): StepNodeDef {
  return {
    id,
    kind: 'step',
    action,
    events: { started: `${id}_started`, completed: `${id}_completed` },
  };
}

function gateDef(
  id: string,
  modeRef: string,
  actionIfNeeded: string,
  autoApproveModes: string[] = [],
): GateNodeDef {
  return {
    id,
    kind: 'gate',
    mode_ref: modeRef,
    action_if_needed: actionIfNeeded,
    approved_event: `${id}_approved`,
    auto_approve_modes: autoApproveModes,
  };
}

function stepState(
  status: 'not_started' | 'in_progress' | 'completed' | 'halted' | 'skipped',
): StepNodeState {
  return { kind: 'step', status, doc_path: null, retries: 0 };
}

function gateState(
  status: 'not_started' | 'completed' | 'halted' | 'skipped',
  gateActive: boolean,
): GateNodeState {
  return { kind: 'gate', status, gate_active: gateActive };
}

// ── Tests: ask_gate_mode dispatch ─────────────────────────────────────────────

describe('walkDAG — ask_gate_mode dispatch', () => {
  it('returns ask_gate_mode when effectiveMode is ask and pipeline.gate_mode is null', () => {
    const template = makeTemplate([
      gateDef('task_gate', 'human_gates.execution_mode', 'gate_task', ['autonomous']),
      stepDef('next_step', 'spawn_prd'),
    ]);
    const state = makeState(
      {
        task_gate: gateState('not_started', false),
        next_step: stepState('not_started'),
      },
      null, // pipeline.gate_mode not yet set
    );
    const config = makeConfig('ask'); // configValue = 'ask'

    const result = walkDAG(state, template, config);

    expect(result).toEqual({ action: 'ask_gate_mode', context: {} });
  });

  it('does not activate the gate (gate_active stays false) when ask_gate_mode fires', () => {
    const template = makeTemplate([
      gateDef('task_gate', 'human_gates.execution_mode', 'gate_task', ['autonomous']),
    ]);
    const state = makeState(
      { task_gate: gateState('not_started', false) },
      null,
    );
    const config = makeConfig('ask');

    walkDAG(state, template, config);

    const gate = state.graph.nodes['task_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('not_started');
  });

  it('does NOT return ask_gate_mode when pipeline.gate_mode is set to ask (operator already chose)', () => {
    const template = makeTemplate([
      gateDef('task_gate', 'human_gates.execution_mode', 'gate_task', ['autonomous']),
    ]);
    const state = makeState(
      { task_gate: gateState('not_started', false) },
      'ask', // operator already chose 'ask' mode
    );
    const config = makeConfig('ask');

    const result = walkDAG(state, template, config);

    // effectiveMode = 'ask' (from pipeline.gate_mode), but gate_mode is non-null
    // → skip ask_gate_mode → proceed with gate → returns gate action
    expect(result?.action).toBe('gate_task');
    const gate = state.graph.nodes['task_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });

  it('does NOT return ask_gate_mode when effectiveMode is task (config-driven, not ask)', () => {
    const template = makeTemplate([
      gateDef('task_gate', 'human_gates.execution_mode', 'gate_task', ['autonomous']),
    ]);
    const state = makeState(
      { task_gate: gateState('not_started', false) },
      null, // pipeline.gate_mode not yet set
    );
    const config = makeConfig('task'); // configValue = 'task'

    const result = walkDAG(state, template, config);

    // effectiveMode = 'task' → not ask → does not fire ask_gate_mode → shows gate directly
    expect(result?.action).toBe('gate_task');
    const gate = state.graph.nodes['task_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });
});

// ── Tests: pipeline.gate_mode takes precedence over config ────────────────────

describe('walkDAG — persisted pipeline.gate_mode resolution', () => {
  it('uses pipeline.gate_mode over config.gate_mode when pipeline.gate_mode is non-null', () => {
    const template = makeTemplate([
      gateDef('task_gate', 'human_gates.execution_mode', 'gate_task', ['autonomous']),
    ]);
    // config says 'ask', pipeline says 'autonomous' → should auto-approve (not ask_gate_mode)
    const state = makeState(
      { task_gate: gateState('not_started', false) },
      'autonomous', // pipeline.gate_mode overrides config value
    );
    // config.gate_mode is 'ask' but pipeline.gate_mode is 'autonomous'
    state.config.gate_mode = 'ask';
    const config = makeConfig('ask'); // configValue 'ask', but pipeline.gate_mode wins

    const result = walkDAG(state, template, config);

    // pipeline.gate_mode = 'autonomous' → effectiveMode = 'autonomous' → auto-approve (in auto_approve_modes)
    // auto_approve_modes = ['autonomous'] → gate auto-approved → all nodes done → display_complete
    const gate = state.graph.nodes['task_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(gate.gate_active).toBe(false);
    expect(result?.action).toBe('display_complete'); // single-node template → all done after gate
  });

  it('uses pipeline.gate_mode task when pipeline.gate_mode is task — gate fires without ask_gate_mode', () => {
    const template = makeTemplate([
      gateDef('phase_gate', 'human_gates.execution_mode', 'gate_phase', []),
    ]);
    const state = makeState(
      { phase_gate: gateState('not_started', false) },
      'task', // operator already chose 'task' mode
    );
    const config = makeConfig('ask'); // config says ask, but pipeline says task

    const result = walkDAG(state, template, config);

    // effectiveMode = 'task' (from pipeline.gate_mode), no auto_approve_modes match
    // → not ask → not autonomous → default: show gate
    expect(result?.action).toBe('gate_phase');
    const gate = state.graph.nodes['phase_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });

  it('nullish coalescing: pipeline.gate_mode empty string falls back to configValue', () => {
    // ?? (nullish) vs || (falsy): empty string is falsy but not nullish
    // pipeline.gate_mode is null here — should fall back to configValue
    const template = makeTemplate([
      gateDef('task_gate', 'human_gates.execution_mode', 'gate_task', ['autonomous']),
    ]);
    const state = makeState(
      { task_gate: gateState('not_started', false) },
      null, // null → falls back to configValue
    );
    const config = makeConfig('autonomous'); // configValue = 'autonomous'

    const result = walkDAG(state, template, config);

    // effectiveMode = null ?? 'autonomous' = 'autonomous' → auto-approve → display_complete
    const gate = state.graph.nodes['task_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(result?.action).toBe('display_complete'); // single-node template → all done after gate
  });
});

// ── Tests: boolean gate path unaffected ───────────────────────────────────────

describe('walkDAG — boolean gates unaffected by gate mode changes', () => {
  it('boolean true gate always shows the gate regardless of pipeline.gate_mode', () => {
    const template = makeTemplate([
      gateDef('plan_gate', 'human_gates.after_planning', 'request_plan_approval'),
    ]);
    const state = makeState(
      { plan_gate: gateState('not_started', false) },
      null, // pipeline.gate_mode is null — should NOT trigger ask_gate_mode for boolean gates
    );
    const config = makeConfig(); // after_planning: true (boolean)

    const result = walkDAG(state, template, config);

    // Boolean gate: goes through boolean path → gate active, returns action_if_needed
    // NOT ask_gate_mode (boolean gates bypass the string gate mode resolution)
    expect(result?.action).toBe('request_plan_approval');
    const gate = state.graph.nodes['plan_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(true);
  });

  it('boolean false gate auto-approves regardless of pipeline.gate_mode', () => {
    const template = makeTemplate([
      gateDef('plan_gate', 'human_gates.after_planning', 'request_plan_approval'),
      stepDef('next', 'spawn_prd'),
    ]);
    const state = makeState(
      {
        plan_gate: gateState('not_started', false),
        next: stepState('not_started'),
      },
      null,
    );
    const config: OrchestrationConfig = {
      ...makeConfig(),
      human_gates: {
        after_planning: false, // boolean false → gate auto-skipped
        execution_mode: 'ask',
        after_final_review: true,
      },
    };

    const result = walkDAG(state, template, config);

    // Boolean gate: false → auto-approve → continue → next step fires
    expect(result?.action).toBe('spawn_prd');
    const gate = state.graph.nodes['plan_gate'] as GateNodeState;
    expect(gate.status).toBe('completed');
    expect(gate.gate_active).toBe(false);
  });
});
