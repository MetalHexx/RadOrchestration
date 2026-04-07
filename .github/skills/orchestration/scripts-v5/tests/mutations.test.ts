import { describe, it, expect } from 'vitest';
import { getMutation, resolveNodeState } from '../lib/mutations.js';
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
        phase_loop: {
          kind: 'for_each_phase',
          status: 'not_started',
          iterations: [
            {
              index: 0,
              status: 'not_started',
              nodes: {
                phase_gate: { kind: 'gate', status: 'not_started', gate_active: false },
                task_loop: {
                  kind: 'for_each_task',
                  status: 'not_started',
                  iterations: [
                    {
                      index: 0,
                      status: 'not_started',
                      nodes: {
                        task_gate: { kind: 'gate', status: 'not_started', gate_active: false },
                      },
                      corrective_tasks: [],
                    },
                  ],
                },
              },
              corrective_tasks: [],
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
};

const baseTemplate: PipelineTemplate = {
  template: { id: 'full', version: '1.0', description: 'Full pipeline' },
  nodes: [],
};

// ── getMutation — registry presence ──────────────────────────────────────────

describe('getMutation — planning events', () => {
  const planningEvents = [
    'research_started',
    'research_completed',
    'prd_started',
    'prd_completed',
    'design_started',
    'design_completed',
    'architecture_started',
    'architecture_completed',
    'master_plan_started',
    'master_plan_completed',
  ];

  for (const eventName of planningEvents) {
    it(`returns a function for '${eventName}'`, () => {
      expect(getMutation(eventName)).toBeTypeOf('function');
    });
  }
});

describe('getMutation — gate events', () => {
  const gateEvents = [
    'plan_approved',
    'task_gate_approved',
    'phase_gate_approved',
    'final_review_approved',
  ];

  for (const eventName of gateEvents) {
    it(`returns a function for '${eventName}'`, () => {
      expect(getMutation(eventName)).toBeTypeOf('function');
    });
  }
});

describe('getMutation — unknown events', () => {
  it('returns undefined for an unknown event', () => {
    expect(getMutation('bogus_event')).toBeUndefined();
  });
});

// ── research_started (also sets graph.status) ─────────────────────────────────

describe('research_started mutation', () => {
  it('sets research.status to in_progress', () => {
    const state = makeState();
    const mutation = getMutation('research_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['research'].status).toBe('in_progress');
  });

  it('sets graph.status to in_progress', () => {
    const state = makeState();
    const mutation = getMutation('research_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.status).toBe('in_progress');
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    const mutation = getMutation('research_started')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['research'].status).toBe('not_started');
    expect(state.graph.status).toBe('not_started');
  });

  it('returns a non-empty mutations_applied array', () => {
    const state = makeState();
    const mutation = getMutation('research_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── planning _started mutations ───────────────────────────────────────────────

describe('planning _started mutations', () => {
  const startedCases: Array<[string, string]> = [
    ['research_started', 'research'],
    ['prd_started', 'prd'],
    ['design_started', 'design'],
    ['architecture_started', 'architecture'],
    ['master_plan_started', 'master_plan'],
  ];

  for (const [eventName, nodeId] of startedCases) {
    it(`${eventName} sets ${nodeId}.status to in_progress`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, {}, baseConfig, baseTemplate);
      expect(result.state.graph.nodes[nodeId].status).toBe('in_progress');
    });

    it(`${eventName} does not mutate original state`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      mutation(state, {}, baseConfig, baseTemplate);
      expect(state.graph.nodes[nodeId].status).toBe('not_started');
    });

    it(`${eventName} returns non-empty mutations_applied`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, {}, baseConfig, baseTemplate);
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    });
  }
});

// ── planning _completed mutations ─────────────────────────────────────────────

describe('planning _completed mutations', () => {
  const completedCases: Array<[string, string]> = [
    ['research_completed', 'research'],
    ['prd_completed', 'prd'],
    ['design_completed', 'design'],
    ['architecture_completed', 'architecture'],
    ['master_plan_completed', 'master_plan'],
  ];

  for (const [eventName, nodeId] of completedCases) {
    it(`${eventName} sets ${nodeId}.status to completed`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { doc_path: '/path/to/doc.md' }, baseConfig, baseTemplate);
      expect(result.state.graph.nodes[nodeId].status).toBe('completed');
    });

    it(`${eventName} stores doc_path from context`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { doc_path: '/path/to/doc.md' }, baseConfig, baseTemplate);
      const node = result.state.graph.nodes[nodeId] as StepNodeState;
      expect(node.doc_path).toBe('/path/to/doc.md');
    });

    it(`${eventName} does not mutate original state`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      mutation(state, { doc_path: '/path/to/doc.md' }, baseConfig, baseTemplate);
      expect(state.graph.nodes[nodeId].status).toBe('not_started');
    });

    it(`${eventName} returns non-empty mutations_applied`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { doc_path: '/path/to/doc.md' }, baseConfig, baseTemplate);
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    });
  }
});

// ── plan_approved mutation ────────────────────────────────────────────────────

describe('plan_approved mutation', () => {
  it('sets plan_approval_gate.status to completed', () => {
    const state = makeState();
    const mutation = getMutation('plan_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['plan_approval_gate'].status).toBe('completed');
  });

  it('sets plan_approval_gate.gate_active to true', () => {
    const state = makeState();
    const mutation = getMutation('plan_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.state.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(node.gate_active).toBe(true);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('plan_approved')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['plan_approval_gate'].status).toBe('not_started');
    const node = state.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(node.gate_active).toBe(false);
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('plan_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── task_gate_approved mutation ───────────────────────────────────────────────

describe('task_gate_approved mutation', () => {
  it('resolves task-scoped task_gate and sets status to completed', () => {
    const state = makeState();
    const mutation = getMutation('task_gate_approved')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    expect(taskLoop.iterations[0].nodes['task_gate'].status).toBe('completed');
  });

  it('sets task-scoped task_gate.gate_active to true', () => {
    const state = makeState();
    const mutation = getMutation('task_gate_approved')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    const taskGate = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(taskGate.gate_active).toBe(true);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('task_gate_approved')!;
    mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    expect(taskLoop.iterations[0].nodes['task_gate'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('task_gate_approved')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── phase_gate_approved mutation ──────────────────────────────────────────────

describe('phase_gate_approved mutation', () => {
  it('resolves phase-scoped phase_gate and sets status to completed', () => {
    const state = makeState();
    const mutation = getMutation('phase_gate_approved')!;
    const result = mutation(state, { phase: 1 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    expect(phaseLoop.iterations[0].nodes['phase_gate'].status).toBe('completed');
  });

  it('sets phase-scoped phase_gate.gate_active to true', () => {
    const state = makeState();
    const mutation = getMutation('phase_gate_approved')!;
    const result = mutation(state, { phase: 1 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    const phaseGate = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(phaseGate.gate_active).toBe(true);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('phase_gate_approved')!;
    mutation(state, { phase: 1 }, baseConfig, baseTemplate);
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    expect(phaseLoop.iterations[0].nodes['phase_gate'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('phase_gate_approved')!;
    const result = mutation(state, { phase: 1 }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── final_review_approved mutation ────────────────────────────────────────────

describe('final_review_approved mutation', () => {
  it('sets final_approval_gate.status to completed', () => {
    const state = makeState();
    const mutation = getMutation('final_review_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_approval_gate'].status).toBe('completed');
  });

  it('sets final_approval_gate.gate_active to true', () => {
    const state = makeState();
    const mutation = getMutation('final_review_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.state.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(node.gate_active).toBe(true);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('final_review_approved')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_approval_gate'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('final_review_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── resolveNodeState ──────────────────────────────────────────────────────────

describe('resolveNodeState', () => {
  it('resolves a top-level node', () => {
    const state = makeState();
    const node = resolveNodeState(state, 'research', 'top');
    expect(node.kind).toBe('step');
    expect(node.status).toBe('not_started');
  });

  it('resolves a phase-scoped node', () => {
    const state = makeState();
    const node = resolveNodeState(state, 'phase_gate', 'phase', 1);
    expect(node.kind).toBe('gate');
    expect(node.status).toBe('not_started');
  });

  it('resolves a task-scoped node', () => {
    const state = makeState();
    const node = resolveNodeState(state, 'task_gate', 'task', 1, 1);
    expect(node.kind).toBe('gate');
    expect(node.status).toBe('not_started');
  });

  it('throws if phase_loop is not a for_each_phase node', () => {
    const state = makeState();
    // Replace phase_loop with a step node to force error
    state.graph.nodes['phase_loop'] = { kind: 'step', status: 'not_started', doc_path: null, retries: 0 };
    expect(() => resolveNodeState(state, 'phase_gate', 'phase', 1)).toThrow();
  });

  it('throws if task_loop is not a for_each_task node', () => {
    const state = makeState();
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    phaseLoop.iterations[0].nodes['task_loop'] = {
      kind: 'step',
      status: 'not_started',
      doc_path: null,
      retries: 0,
    };
    expect(() => resolveNodeState(state, 'task_gate', 'task', 1, 1)).toThrow();
  });
});
