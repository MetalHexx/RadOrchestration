import { describe, it, expect } from 'vitest';
import { getMutation, resolveNodeState } from '../lib/mutations.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  StepNodeState,
  GateNodeState,
  IterationEntry,
  CorrectiveTaskEntry,
} from '../lib/types.js';

// ── Navigation helpers ────────────────────────────────────────────────────────

function getPhaseNode(state: PipelineState, nodeId: string) {
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  return phaseLoop.iterations[0].nodes[nodeId];
}

function getTaskNode(state: PipelineState, nodeId: string) {
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
  if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
  return taskLoop.iterations[0].nodes[nodeId];
}

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
      source_control: { auto_commit: 'always', auto_pr: 'always' },
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
                        commit: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
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
  source_control: { auto_commit: 'always', auto_pr: 'always', provider: 'github' },
  default_template: 'full',
};

const baseTemplate: PipelineTemplate = {
  template: { id: 'full', version: '1.0', description: 'Full pipeline' },
  nodes: [],
};

// ── getMutation — registry presence ──────────────────────────────────────────

describe('getMutation — planning events', () => {
  const planningEvents = [
    'requirements_started',
    'requirements_completed',
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
    'final_approved',
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

// ── requirements_started (Iter 4: new first planning step; owns graph.status flip) ─

describe('requirements_started mutation', () => {
  it('sets requirements.status to in_progress', () => {
    const state = makeState();
    // makeState() fixture predates Iter 4 (no `requirements` node); inject one.
    state.graph.nodes['requirements'] = { kind: 'step', status: 'not_started', doc_path: null, retries: 0 };
    const mutation = getMutation('requirements_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['requirements'].status).toBe('in_progress');
  });

  it('sets graph.status to in_progress', () => {
    const state = makeState();
    state.graph.nodes['requirements'] = { kind: 'step', status: 'not_started', doc_path: null, retries: 0 };
    const mutation = getMutation('requirements_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.status).toBe('in_progress');
  });
});

// ── master_plan_started (Iter 4: no longer sets graph.status) ────────────────

describe('master_plan_started mutation', () => {
  it('sets master_plan.status to in_progress', () => {
    const state = makeState();
    const mutation = getMutation('master_plan_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['master_plan'].status).toBe('in_progress');
  });

  it('does NOT set graph.status (relocated to requirements_started in Iter 4)', () => {
    const state = makeState();
    const mutation = getMutation('master_plan_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    // graph.status in the fixture starts as 'not_started'; master_plan_started no longer flips it
    expect(result.state.graph.status).toBe('not_started');
    expect(result.mutations_applied.some((m) => m.includes('graph.status'))).toBe(false);
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    const mutation = getMutation('master_plan_started')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['master_plan'].status).toBe('not_started');
    expect(state.graph.status).toBe('not_started');
  });

  it('returns a non-empty mutations_applied array', () => {
    const state = makeState();
    const mutation = getMutation('master_plan_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── planning _started mutations ───────────────────────────────────────────────

describe('planning _started mutations', () => {
  const startedCases: Array<[string, string]> = [
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

// ── final_approved mutation ────────────────────────────────────────────

describe('final_approved mutation', () => {
  it('sets final_approval_gate.status to completed', () => {
    const state = makeState();
    const mutation = getMutation('final_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_approval_gate'].status).toBe('completed');
  });

  it('sets final_approval_gate.gate_active to true', () => {
    const state = makeState();
    const mutation = getMutation('final_approved')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const node = result.state.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(node.gate_active).toBe(true);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('final_approved')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_approval_gate'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('final_approved')!;
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

  it('throws when scope is "phase" but phase is undefined', () => {
    const state = makeState();
    expect(() => resolveNodeState(state, 'phase_gate', 'phase')).toThrow(
      "scope is 'phase' but phase is undefined"
    );
  });

  it('throws when scope is "task" but phase is undefined', () => {
    const state = makeState();
    expect(() => resolveNodeState(state, 'task_gate', 'task')).toThrow(
      "scope is 'task' but phase is undefined"
    );
  });
});

// ── getMutation — new execution/review/source-control events ─────────────────
// Note: out-of-band (operator-triggered) events — plan_rejected, gate_rejected, final_rejected,
// halt, gate_mode_set, source_control_init — also have mutations (see describe blocks below).

describe('getMutation — new T03 events', () => {
  const newEvents = [
    'phase_planning_started',
    'phase_plan_created',
    'task_handoff_started',
    'task_handoff_created',
    'execution_started',
    'task_completed',
    'code_review_started',
    'code_review_completed',
    'phase_report_started',
    'phase_report_created',
    'phase_review_started',
    'phase_review_completed',
    'final_review_started',
    'final_review_completed',
    'commit_started',
    'commit_completed',
    'pr_requested',
    'pr_created',
  ];

  for (const eventName of newEvents) {
    it(`returns a function for '${eventName}'`, () => {
      expect(getMutation(eventName)).toBeTypeOf('function');
    });
  }
});

// ── phase execution _started mutations ───────────────────────────────────────

describe('phase execution _started mutations', () => {
  const cases: Array<[string, string]> = [
    ['phase_planning_started', 'phase_planning'],
    ['phase_report_started', 'phase_report'],
    ['phase_review_started', 'phase_review'],
  ];

  for (const [eventName, nodeId] of cases) {
    it(`${eventName} sets ${nodeId}.status to in_progress at phase scope`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { phase: 1 }, baseConfig, baseTemplate);
      expect(getPhaseNode(result.state, nodeId).status).toBe('in_progress');
    });

    it(`${eventName} does not mutate original state`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      mutation(state, { phase: 1 }, baseConfig, baseTemplate);
      expect(getPhaseNode(state, nodeId).status).toBe('not_started');
    });

    it(`${eventName} returns non-empty mutations_applied`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { phase: 1 }, baseConfig, baseTemplate);
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    });
  }
});

// ── phase_plan_created mutation ───────────────────────────────────────────────

describe('phase_plan_created mutation', () => {
  it('sets phase_planning.status to completed at phase scope', () => {
    const state = makeState();
    const mutation = getMutation('phase_plan_created')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/plan.md' }, baseConfig, baseTemplate);
    expect(getPhaseNode(result.state, 'phase_planning').status).toBe('completed');
  });

  it('stores doc_path from context', () => {
    const state = makeState();
    const mutation = getMutation('phase_plan_created')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/plan.md' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_planning') as StepNodeState;
    expect(node.doc_path).toBe('/path/plan.md');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('phase_plan_created')!;
    mutation(state, { phase: 1, doc_path: '/path/plan.md' }, baseConfig, baseTemplate);
    expect(getPhaseNode(state, 'phase_planning').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('phase_plan_created')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/plan.md' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── phase_report_created mutation ──────────────────────────────────────────

describe('phase_report_created mutation', () => {
  it('sets phase_report.status to completed at phase scope', () => {
    const state = makeState();
    const mutation = getMutation('phase_report_created')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/report.md' }, baseConfig, baseTemplate);
    expect(getPhaseNode(result.state, 'phase_report').status).toBe('completed');
  });

  it('stores doc_path from context', () => {
    const state = makeState();
    const mutation = getMutation('phase_report_created')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/report.md' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_report') as StepNodeState;
    expect(node.doc_path).toBe('/path/report.md');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('phase_report_created')!;
    mutation(state, { phase: 1, doc_path: '/path/report.md' }, baseConfig, baseTemplate);
    expect(getPhaseNode(state, 'phase_report').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('phase_report_created')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/report.md' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── phase_review_completed mutation ──────────────────────────────────────────

describe('phase_review_completed mutation', () => {
  it('sets phase_review.status to completed at phase scope', () => {
    const state = makeState();
    const mutation = getMutation('phase_review_completed')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(getPhaseNode(result.state, 'phase_review').status).toBe('completed');
  });

  it('stores doc_path from context', () => {
    const state = makeState();
    const mutation = getMutation('phase_review_completed')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_review') as StepNodeState;
    expect(node.doc_path).toBe('/path/review.md');
  });

  it('stores verdict from context', () => {
    const state = makeState();
    const mutation = getMutation('phase_review_completed')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const node = getPhaseNode(result.state, 'phase_review') as StepNodeState;
    expect(node.verdict).toBe('approved');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('phase_review_completed')!;
    mutation(state, { phase: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(getPhaseNode(state, 'phase_review').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('phase_review_completed')!;
    const result = mutation(state, { phase: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── phase_review_completed — corrective injection ─────────────────────────────

// Navigation helper: returns the phase IterationEntry for phase 1
function getPhaseIteration(state: PipelineState): IterationEntry {
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  return phaseLoop.iterations[0];
}

describe('phase_review_completed — corrective injection', () => {
  const mutation = getMutation('phase_review_completed')!;

  it('changes_requested injects one CorrectiveTaskEntry with correct shape', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, doc_path: '/r.md', verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(1);
    const entry = iteration.corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.index).toBe(1);
    expect(entry.status).toBe('in_progress');
    expect(entry.reason).toBe('Phase review requested changes');
    expect(entry.injected_after).toBe('phase_review');
    expect(Object.keys(entry.nodes)).toHaveLength(0);
    expect((getPhaseNode(result.state, 'phase_review') as StepNodeState).verdict).toBeNull();
    expect((getPhaseNode(result.state, 'phase_review') as StepNodeState).doc_path).toBe('/r.md');
  });

  it('rejected verdict halts phase iteration and graph, adds no corrective entry', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, verdict: 'rejected' }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect(iteration.status).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
  });

  it('approved verdict sets phase_review completed, no corrective entry, status unchanged', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, doc_path: '/r.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect(iteration.status).toBe('not_started');
    expect(result.state.graph.status).toBe('not_started');
    expect(getPhaseNode(result.state, 'phase_review').status).toBe('completed');
  });

  it('multiple changes_requested on same phase produce consecutive indices', () => {
    const state = makeState();
    const result1 = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const result2 = mutation(result1.state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const iteration = getPhaseIteration(result2.state);
    expect(iteration.corrective_tasks).toHaveLength(2);
    expect(iteration.corrective_tasks[0].index).toBe(1);
    expect(iteration.corrective_tasks[1].index).toBe(2);
  });

  it('original phase iteration nodes are untouched after corrective injection', () => {
    const state = makeState();
    const originalNodeKeys = Object.keys(getPhaseIteration(state).nodes);
    const result = mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    const resultNodeKeys = Object.keys(getPhaseIteration(result.state).nodes);
    expect(resultNodeKeys).toEqual(originalNodeKeys);
  });

  it('immutability — original state is never modified', () => {
    const state = makeState();
    const originalCorLen = getPhaseIteration(state).corrective_tasks.length;
    mutation(state, { phase: 1, verdict: 'changes_requested' }, baseConfig, baseTemplate);
    expect(getPhaseIteration(state).corrective_tasks.length).toBe(originalCorLen);
    expect(state.graph.status).toBe('not_started');
  });

  it('all verdict paths return non-empty mutations_applied', () => {
    const verdicts = ['approved', 'changes_requested', 'rejected'];
    for (const verdict of verdicts) {
      const state = makeState();
      const result = mutation(state, { phase: 1, verdict }, baseConfig, baseTemplate);
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    }
  });
});

// ── task execution _started mutations ────────────────────────────────────────

describe('task execution _started mutations', () => {
  const cases: Array<[string, string]> = [
    ['task_handoff_started', 'task_handoff'],
    ['execution_started', 'task_executor'],
    ['code_review_started', 'code_review'],
  ];

  for (const [eventName, nodeId] of cases) {
    it(`${eventName} sets ${nodeId}.status to in_progress at task scope`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
      expect(getTaskNode(result.state, nodeId).status).toBe('in_progress');
    });

    it(`${eventName} does not mutate original state`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
      expect(getTaskNode(state, nodeId).status).toBe('not_started');
    });

    it(`${eventName} returns non-empty mutations_applied`, () => {
      const state = makeState();
      const mutation = getMutation(eventName)!;
      const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    });
  }
});

// ── task_handoff_created mutation ─────────────────────────────────────────────

describe('task_handoff_created mutation', () => {
  it('sets task_handoff.status to completed at task scope', () => {
    const state = makeState();
    const mutation = getMutation('task_handoff_created')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/handoff.md' }, baseConfig, baseTemplate);
    expect(getTaskNode(result.state, 'task_handoff').status).toBe('completed');
  });

  it('stores doc_path from context', () => {
    const state = makeState();
    const mutation = getMutation('task_handoff_created')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/handoff.md' }, baseConfig, baseTemplate);
    const node = getTaskNode(result.state, 'task_handoff') as StepNodeState;
    expect(node.doc_path).toBe('/path/handoff.md');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('task_handoff_created')!;
    mutation(state, { phase: 1, task: 1, doc_path: '/path/handoff.md' }, baseConfig, baseTemplate);
    expect(getTaskNode(state, 'task_handoff').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('task_handoff_created')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/handoff.md' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── task_completed mutation ──────────────────────────────────────────────

describe('task_completed mutation', () => {
  it('sets task_executor.status to completed at task scope', () => {
    const state = makeState();
    const mutation = getMutation('task_completed')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(getTaskNode(result.state, 'task_executor').status).toBe('completed');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('task_completed')!;
    mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(getTaskNode(state, 'task_executor').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('task_completed')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });

  it('auto-resolves phase and task from state when omitted', () => {
    const state = makeState();
    // Set phase iteration in_progress
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    phaseLoop.iterations[0].status = 'in_progress';
    // Set task iteration in_progress
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    taskLoop.iterations[0].status = 'in_progress';
    taskLoop.iterations[0].nodes['task_executor'].status = 'in_progress';
    const mutation = getMutation('task_completed')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(getTaskNode(result.state, 'task_executor').status).toBe('completed');
  });

  it('throws descriptive error containing "task_completed" and "--phase" when phase resolution fails', () => {
    const state = makeState();
    // Empty phase_loop iterations so resolveNodeState throws (no iteration at index 0)
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    phaseLoop.iterations = [];
    const mutation = getMutation('task_completed')!;
    const fn = () => mutation(state, {}, baseConfig, baseTemplate);
    expect(fn).toThrow(/task_completed/);
    expect(fn).toThrow(/--phase/);
  });

  it('throws descriptive error containing "task_completed" and "--task" when task resolution fails', () => {
    const state = makeState();
    // Set phase iteration in_progress but empty task iterations
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    phaseLoop.iterations[0].status = 'in_progress';
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    taskLoop.iterations = [];
    const mutation = getMutation('task_completed')!;
    const fn = () => mutation(state, { phase: 1 }, baseConfig, baseTemplate);
    expect(fn).toThrow(/task_completed/);
    expect(fn).toThrow(/--task/);
  });

  it('discriminator: throws "--task" (not "--phase") when phase is in_progress but task resolution fails with no explicit context', () => {
    const state = makeState();
    // Set up: phase iteration in_progress so phase resolves, but task_loop has no iterations
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    phaseLoop.iterations[0].status = 'in_progress';
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    taskLoop.iterations = [];
    const mutation = getMutation('task_completed')!;
    // Pass {} — no --phase, no --task
    const fn = () => mutation(state, {}, baseConfig, baseTemplate);
    expect(fn).toThrow(/--task/);
    expect(fn).not.toThrow(/--phase/);
  });
});

// ── code_review_completed mutation ────────────────────────────────────────────

describe('code_review_completed mutation', () => {
  it('sets code_review.status to completed at task scope', () => {
    const state = makeState();
    const mutation = getMutation('code_review_completed')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(getTaskNode(result.state, 'code_review').status).toBe('completed');
  });

  it('stores doc_path from context', () => {
    const state = makeState();
    const mutation = getMutation('code_review_completed')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const node = getTaskNode(result.state, 'code_review') as StepNodeState;
    expect(node.doc_path).toBe('/path/review.md');
  });

  it('stores verdict from context', () => {
    const state = makeState();
    const mutation = getMutation('code_review_completed')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const node = getTaskNode(result.state, 'code_review') as StepNodeState;
    expect(node.verdict).toBe('approved');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('code_review_completed')!;
    mutation(state, { phase: 1, task: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(getTaskNode(state, 'code_review').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('code_review_completed')!;
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/path/review.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── code_review_completed — corrective injection ──────────────────────────────

// Template fixture with for_each_phase → for_each_task body containing the 4 task body nodes
function makeTemplateWithTaskBody(): PipelineTemplate {
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

// Navigation helper: returns the task IterationEntry for phase 1, task 1
function getTaskIteration(state: PipelineState): IterationEntry {
  const phaseLoop = state.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
  const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
  if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
  return taskLoop.iterations[0];
}

describe('code_review_completed — corrective injection', () => {
  const mutation = getMutation('code_review_completed')!;

  it('changes_requested with budget available injects one CorrectiveTaskEntry with correct shape', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/r.md', verdict: 'changes_requested' }, baseConfig, template);
    const iteration = getTaskIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(1);
    const entry = iteration.corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.index).toBe(1);
    expect(entry.status).toBe('not_started');
    expect(entry.reason).toBe('Code review requested changes');
    expect(entry.injected_after).toBe('code_review');
    expect(Object.keys(entry.nodes)).toHaveLength(4);
  });

  it('scaffolded nodes have correct shape — task_handoff is step, task_gate is gate', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/r.md', verdict: 'changes_requested' }, baseConfig, template);
    const entry = getTaskIteration(result.state).corrective_tasks[0] as CorrectiveTaskEntry;
    expect(entry.nodes['task_handoff']).toEqual({ kind: 'step', status: 'not_started', doc_path: null, retries: 0 });
    expect(entry.nodes['task_gate']).toEqual({ kind: 'gate', status: 'not_started', gate_active: false });
  });

  it('changes_requested with budget exhausted halts iteration and graph, no new entry added', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    // Pre-fill corrective_tasks to max (3)
    const iteration = getTaskIteration(state);
    for (let i = 0; i < 3; i++) {
      iteration.corrective_tasks.push({ index: i + 1, reason: 'prior', injected_after: 'code_review', status: 'not_started', nodes: {}, commit_hash: null });
    }
    const result = mutation(state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, template);
    const resultIteration = getTaskIteration(result.state);
    expect(resultIteration.corrective_tasks).toHaveLength(3);
    expect(resultIteration.status).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
  });

  it('budget boundary — retries = max - 1 still injects a corrective entry', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    // Pre-fill to max - 1 (2 entries)
    const iteration = getTaskIteration(state);
    for (let i = 0; i < 2; i++) {
      iteration.corrective_tasks.push({ index: i + 1, reason: 'prior', injected_after: 'code_review', status: 'not_started', nodes: {}, commit_hash: null });
    }
    const result = mutation(state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, template);
    const resultIteration = getTaskIteration(result.state);
    expect(resultIteration.corrective_tasks).toHaveLength(3);
    expect(resultIteration.status).not.toBe('halted');
    expect(result.state.graph.status).not.toBe('halted');
  });

  it('rejected verdict halts iteration and graph, adds no corrective entry', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, task: 1, verdict: 'rejected' }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect(iteration.status).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
  });

  it('approved verdict sets code_review completed, no corrective entry, iteration and graph status unchanged', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, task: 1, doc_path: '/r.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state);
    expect(iteration.corrective_tasks).toHaveLength(0);
    expect(iteration.status).toBe('not_started');
    expect(result.state.graph.status).toBe('not_started');
    expect(getTaskNode(result.state, 'code_review').status).toBe('completed');
  });

  it('multiple corrections on same task produce entries with consecutive indices', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    const result1 = mutation(state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, template);
    const result2 = mutation(result1.state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, template);
    const iteration = getTaskIteration(result2.state);
    expect(iteration.corrective_tasks).toHaveLength(2);
    expect(iteration.corrective_tasks[0].index).toBe(1);
    expect(iteration.corrective_tasks[1].index).toBe(2);
  });

  it('original iteration nodes are untouched after corrective injection', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    const originalNodeKeys = Object.keys(getTaskIteration(state).nodes);
    const result = mutation(state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, template);
    const resultNodeKeys = Object.keys(getTaskIteration(result.state).nodes);
    expect(resultNodeKeys).toEqual(originalNodeKeys);
  });

  it('immutability — original state is never modified', () => {
    const state = makeState();
    const template = makeTemplateWithTaskBody();
    const originalCorLen = getTaskIteration(state).corrective_tasks.length;
    mutation(state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, template);
    expect(getTaskIteration(state).corrective_tasks.length).toBe(originalCorLen);
    expect(state.graph.status).toBe('not_started');
  });

  it('all verdict paths return non-empty mutations_applied', () => {
    const verdicts = ['approved', 'changes_requested', 'rejected'];
    for (const verdict of verdicts) {
      const state = makeState();
      const result = mutation(state, { phase: 1, task: 1, verdict }, baseConfig, makeTemplateWithTaskBody());
      expect(result.mutations_applied.length).toBeGreaterThan(0);
    }
  });

  it('throws when template has no for_each_task body', () => {
    const emptyTemplate = { ...makeTemplateWithTaskBody(), nodes: [] };
    const state = makeState();
    expect(() => mutation(state, { phase: 1, task: 1, verdict: 'changes_requested' }, baseConfig, emptyTemplate))
      .toThrow('findTaskLoopBodyDefs: no for_each_task body found in template');
  });
});

// ── final_review_started mutation ────────────────────────────────────────────

describe('final_review_started mutation', () => {
  it('sets final_review.status to in_progress at top scope', () => {
    const state = makeState();
    const mutation = getMutation('final_review_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_review'].status).toBe('in_progress');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('final_review_started')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_review'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('final_review_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── final_review_completed mutation ──────────────────────────────────────────

describe('final_review_completed mutation', () => {
  it('sets final_review.status to completed at top scope', () => {
    const state = makeState();
    const mutation = getMutation('final_review_completed')!;
    const result = mutation(state, { doc_path: '/path/final.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_review'].status).toBe('completed');
  });

  it('stores doc_path from context', () => {
    const state = makeState();
    const mutation = getMutation('final_review_completed')!;
    const result = mutation(state, { doc_path: '/path/final.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const node = result.state.graph.nodes['final_review'] as StepNodeState;
    expect(node.doc_path).toBe('/path/final.md');
  });

  it('stores verdict from context', () => {
    const state = makeState();
    const mutation = getMutation('final_review_completed')!;
    const result = mutation(state, { doc_path: '/path/final.md', verdict: 'approved' }, baseConfig, baseTemplate);
    const node = result.state.graph.nodes['final_review'] as StepNodeState;
    expect(node.verdict).toBe('approved');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('final_review_completed')!;
    mutation(state, { doc_path: '/path/final.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_review'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('final_review_completed')!;
    const result = mutation(state, { doc_path: '/path/final.md', verdict: 'approved' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── source_control_commit mutations ──────────────────────────────────────────

describe('commit_started mutation', () => {
  it('sets commit.status to in_progress at task scope', () => {
    const state = makeState();
    const mutation = getMutation('commit_started')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(getTaskNode(result.state, 'commit').status).toBe('in_progress');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('commit_started')!;
    mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(getTaskNode(state, 'commit').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('commit_started')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

describe('commit_completed mutation', () => {
  it('sets commit.status to completed at task scope', () => {
    const state = makeState();
    const mutation = getMutation('commit_completed')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(getTaskNode(result.state, 'commit').status).toBe('completed');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('commit_completed')!;
    mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(getTaskNode(state, 'commit').status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('commit_completed')!;
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });

  it('writes commit_hash to task iteration when no active corrective', () => {
    const state = makeState();
    const mutation = getMutation('commit_completed')!;
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'abc123' }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state);
    expect(iteration.commit_hash).toBe('abc123');
  });

  it('writes commit_hash to active corrective entry', () => {
    const state = makeState();
    const iteration = getTaskIteration(state);
    iteration.corrective_tasks.push({
      index: 1,
      reason: 'prior review',
      injected_after: 'code_review',
      status: 'in_progress',
      nodes: {},
      commit_hash: null,
    });
    const mutation = getMutation('commit_completed')!;
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'def456' }, baseConfig, baseTemplate);
    const resultIteration = getTaskIteration(result.state);
    expect(resultIteration.corrective_tasks[0].commit_hash).toBe('def456');
    expect(resultIteration.commit_hash).toBeNull();
  });
});

// ── source_control_pr mutations ───────────────────────────────────────────────

describe('pr_requested mutation', () => {
  it('sets final_pr.status to in_progress at top scope', () => {
    const state = makeState();
    const mutation = getMutation('pr_requested')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_pr'].status).toBe('in_progress');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('pr_requested')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_pr'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('pr_requested')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });

  it('defensively scaffolds final_pr when it is missing', () => {
    const state = makeState();
    delete state.graph.nodes['final_pr'];
    const mutation = getMutation('pr_requested')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_pr']).toBeDefined();
    expect(result.state.graph.nodes['final_pr'].status).toBe('in_progress');
    expect(result.mutations_applied).toEqual(['scaffold final_pr (was not yet initialized)', 'set final_pr.status = in_progress']);
  });

  it('does not scaffold when final_pr already exists', () => {
    const state = makeState();
    const mutation = getMutation('pr_requested')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_pr'].status).toBe('in_progress');
    expect(result.mutations_applied).not.toContain('scaffold final_pr (was not yet initialized)');
    expect(result.mutations_applied.length).toBe(1);
  });

  it('does not mutate original state when defensive scaffolding triggers', () => {
    const state = makeState();
    delete state.graph.nodes['final_pr'];
    const mutation = getMutation('pr_requested')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_pr']).toBeUndefined();
  });
});

describe('pr_created mutation', () => {
  it('sets final_pr.status to completed at top scope', () => {
    const state = makeState();
    const mutation = getMutation('pr_created')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_pr'].status).toBe('completed');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('pr_created')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_pr'].status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('pr_created')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });

  it('writes pr_url to pipeline.source_control.pr_url', () => {
    const state = makeState();
    state.pipeline.source_control = {
      branch: 'main', base_branch: 'main', worktree_path: '.',
      auto_commit: 'always', auto_pr: 'always', remote_url: null, compare_url: null, pr_url: null,
    };
    const mutation = getMutation('pr_created')!;
    const result = mutation(state, { pr_url: 'https://github.com/org/repo/pull/7' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.source_control!.pr_url).toBe('https://github.com/org/repo/pull/7');
  });

  it('throws when source_control is null and pr_url is provided', () => {
    const state = makeState();
    // source_control is null by default in makeState()
    const mutation = getMutation('pr_created')!;
    expect(() => mutation(state, { pr_url: 'https://example.com/pr/1' }, baseConfig, baseTemplate))
      .toThrow(/source_control_init/);
  });

  it('skips pr_url write when context.pr_url is undefined', () => {
    const state = makeState();
    state.pipeline.source_control = {
      branch: 'main', base_branch: 'main', worktree_path: '.',
      auto_commit: 'always', auto_pr: 'always', remote_url: null, compare_url: null, pr_url: null,
    };
    const mutation = getMutation('pr_created')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.pipeline.source_control!.pr_url).toBeNull();
  });
});

// ── Multi-iteration tests (Phase 2 carry-forward) ─────────────────────────────

function makeIterationNodes() {
  return {
    phase_gate: { kind: 'gate' as const, status: 'not_started' as const, gate_active: false },
    phase_planning: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
    phase_report: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
    phase_review: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
    task_loop: {
      kind: 'for_each_task' as const,
      status: 'not_started' as const,
      iterations: [
        {
          index: 0,
          status: 'not_started' as const,
          nodes: {
            task_gate: { kind: 'gate' as const, status: 'not_started' as const, gate_active: false },
            task_handoff: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
            task_executor: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
            code_review: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
            commit_gate: { kind: 'conditional' as const, status: 'not_started' as const, branch_taken: null },
            commit: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
          },
          corrective_tasks: [],
          commit_hash: null as null,
        },
        {
          index: 1,
          status: 'not_started' as const,
          nodes: {
            task_gate: { kind: 'gate' as const, status: 'not_started' as const, gate_active: false },
            task_handoff: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
            task_executor: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
            code_review: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
            commit_gate: { kind: 'conditional' as const, status: 'not_started' as const, branch_taken: null },
            commit: { kind: 'step' as const, status: 'not_started' as const, doc_path: null, retries: 0 },
          },
          corrective_tasks: [],
          commit_hash: null as null,
        },
      ],
    },
  };
}

function makeMultiIterationState(): PipelineState {
  const base = makeState();
  const phaseLoop = base.graph.nodes['phase_loop'];
  if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
  phaseLoop.iterations = [
    { index: 0, status: 'not_started', nodes: makeIterationNodes(), corrective_tasks: [], commit_hash: null },
    { index: 1, status: 'not_started', nodes: makeIterationNodes(), corrective_tasks: [], commit_hash: null },
  ];
  return base;
}

describe('multi-iteration phase mutation (phase ≥ 2)', () => {
  it('phase_planning_started with { phase: 2 } sets iterations[1].nodes.phase_planning.status to in_progress', () => {
    const state = makeMultiIterationState();
    const mutation = getMutation('phase_planning_started')!;
    const result = mutation(state, { phase: 2 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    expect(phaseLoop.iterations[1].nodes['phase_planning'].status).toBe('in_progress');
  });

  it('does not affect iteration[0] when phase: 2', () => {
    const state = makeMultiIterationState();
    const mutation = getMutation('phase_planning_started')!;
    const result = mutation(state, { phase: 2 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    expect(phaseLoop.iterations[0].nodes['phase_planning'].status).toBe('not_started');
  });
});

describe('multi-iteration task mutation (task ≥ 2)', () => {
  it('task_handoff_started with { phase: 1, task: 2 } sets iterations[0].task_loop.iterations[1].task_handoff to in_progress', () => {
    const state = makeMultiIterationState();
    const mutation = getMutation('task_handoff_started')!;
    const result = mutation(state, { phase: 1, task: 2 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    expect(taskLoop.iterations[1].nodes['task_handoff'].status).toBe('in_progress');
  });

  it('does not affect task iteration[0] when task: 2', () => {
    const state = makeMultiIterationState();
    const mutation = getMutation('task_handoff_started')!;
    const result = mutation(state, { phase: 1, task: 2 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected node kind');
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'];
    if (taskLoop.kind !== 'for_each_task') throw new Error('unexpected node kind');
    expect(taskLoop.iterations[0].nodes['task_handoff'].status).toBe('not_started');
  });
});

// ── plan_rejected mutation ────────────────────────────────────────────────────

describe('plan_rejected mutation', () => {
  it('resets master_plan status and doc_path', () => {
    const state = makeState();
    state.graph.nodes['master_plan'].status = 'completed';
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/plan.md';
    const mutation = getMutation('plan_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const masterPlan = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(masterPlan.status).toBe('not_started');
    expect(masterPlan.doc_path).toBeNull();
  });

  it('resets plan_approval_gate status and gate_active', () => {
    const state = makeState();
    state.graph.nodes['plan_approval_gate'].status = 'completed';
    (state.graph.nodes['plan_approval_gate'] as GateNodeState).gate_active = true;
    const mutation = getMutation('plan_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const gate = result.state.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(gate.status).toBe('not_started');
    expect(gate.gate_active).toBe(false);
  });

  it('clears phase_loop.iterations', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    expect(phaseLoop.iterations).toHaveLength(0);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['master_plan'].status).toBe('not_started');
    const phaseLoop = state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    expect(phaseLoop.iterations).toHaveLength(1);
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('plan_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── gate_rejected mutation ────────────────────────────────────────────────────

describe('gate_rejected mutation', () => {
  it('sets pipeline.current_tier to halted and graph.status to halted', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const result = mutation(state, { gate_type: 'phase_gate', reason: 'Operator declined' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.current_tier).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
  });

  it('sets halt_reason containing gate_type and reason', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const result = mutation(state, { gate_type: 'phase_gate', reason: 'Declined' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.halt_reason).toContain('phase_gate');
    expect(result.state.pipeline.halt_reason).toContain('Declined');
  });

  it('falls back to "No reason provided" when reason is omitted', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const result = mutation(state, { gate_type: 'task_gate' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.halt_reason).toContain('No reason provided');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    mutation(state, { gate_type: 'phase_gate', reason: 'x' }, baseConfig, baseTemplate);
    expect(state.pipeline.current_tier).toBe('planning');
    expect(state.graph.status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('gate_rejected')!;
    const result = mutation(state, { gate_type: 'phase_gate', reason: 'x' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── final_rejected mutation ───────────────────────────────────────────────────

describe('final_rejected mutation', () => {
  it('resets final_review status and doc_path', () => {
    const state = makeState();
    state.graph.nodes['final_review'].status = 'completed';
    (state.graph.nodes['final_review'] as StepNodeState).doc_path = '/final.md';
    const mutation = getMutation('final_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const finalReview = result.state.graph.nodes['final_review'] as StepNodeState;
    expect(finalReview.status).toBe('not_started');
    expect(finalReview.doc_path).toBeNull();
  });

  it('resets final_approval_gate status and gate_active', () => {
    const state = makeState();
    state.graph.nodes['final_approval_gate'].status = 'completed';
    (state.graph.nodes['final_approval_gate'] as GateNodeState).gate_active = true;
    const mutation = getMutation('final_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const gate = result.state.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(gate.status).toBe('not_started');
    expect(gate.gate_active).toBe(false);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('final_rejected')!;
    mutation(state, {}, baseConfig, baseTemplate);
    expect(state.graph.nodes['final_review'].status).toBe('not_started');
    const gate = state.graph.nodes['final_approval_gate'] as GateNodeState;
    expect(gate.gate_active).toBe(false);
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('final_rejected')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── halt mutation ─────────────────────────────────────────────────────────────

describe('halt mutation', () => {
  it('sets pipeline.current_tier to halted and graph.status to halted', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const result = mutation(state, { reason: 'Emergency stop' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.current_tier).toBe('halted');
    expect(result.state.graph.status).toBe('halted');
  });

  it('sets halt_reason from context.reason', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const result = mutation(state, { reason: 'Emergency stop' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.halt_reason).toBe('Emergency stop');
  });

  it('defaults halt_reason to "Pipeline halted by operator" when reason is omitted', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.pipeline.halt_reason).toBe('Pipeline halted by operator');
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    mutation(state, { reason: 'test' }, baseConfig, baseTemplate);
    expect(state.pipeline.current_tier).toBe('planning');
    expect(state.graph.status).toBe('not_started');
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('halt')!;
    const result = mutation(state, { reason: 'test' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── gate_mode_set mutation ────────────────────────────────────────────────────

describe('gate_mode_set mutation', () => {
  it.each(['task', 'phase', 'autonomous'])('sets pipeline.gate_mode to "%s"', (mode) => {
    const state = makeState();
    const mutation = getMutation('gate_mode_set')!;
    const result = mutation(state, { gate_mode: mode }, baseConfig, baseTemplate);
    expect(result.state.pipeline.gate_mode).toBe(mode);
  });

  it('throws on invalid gate_mode value', () => {
    const state = makeState();
    const mutation = getMutation('gate_mode_set')!;
    expect(() => mutation(state, { gate_mode: 'invalid' }, baseConfig, baseTemplate)).toThrow(
      /Invalid gate mode/
    );
  });

  it('throws when gate_mode is not provided', () => {
    const state = makeState();
    const mutation = getMutation('gate_mode_set')!;
    expect(() => mutation(state, {}, baseConfig, baseTemplate)).toThrow(/Invalid gate mode/);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('gate_mode_set')!;
    mutation(state, { gate_mode: 'task' }, baseConfig, baseTemplate);
    expect(state.pipeline.gate_mode).toBeNull();
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('gate_mode_set')!;
    const result = mutation(state, { gate_mode: 'task' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── source_control_init mutation ──────────────────────────────────────────────

describe('source_control_init mutation', () => {
  it('creates pipeline.source_control with branch and base_branch', () => {
    const state = makeState();
    const mutation = getMutation('source_control_init')!;
    const result = mutation(state, { branch: 'feature/my-branch', base_branch: 'main' }, baseConfig, baseTemplate);
    const sc = result.state.pipeline.source_control;
    expect(sc).not.toBeNull();
    expect(sc!.branch).toBe('feature/my-branch');
    expect(sc!.base_branch).toBe('main');
  });

  it('defaults worktree_path to "." when not provided', () => {
    const state = makeState();
    const mutation = getMutation('source_control_init')!;
    const result = mutation(state, { branch: 'b', base_branch: 'main' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.source_control!.worktree_path).toBe('.');
  });

  it('throws when branch is missing', () => {
    const state = makeState();
    const mutation = getMutation('source_control_init')!;
    expect(() => mutation(state, { base_branch: 'main' }, baseConfig, baseTemplate)).toThrow(
      /--branch/
    );
  });

  it('throws when base_branch is missing', () => {
    const state = makeState();
    const mutation = getMutation('source_control_init')!;
    expect(() => mutation(state, { branch: 'feature/x' }, baseConfig, baseTemplate)).toThrow(
      /--base-branch/
    );
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const mutation = getMutation('source_control_init')!;
    mutation(state, { branch: 'b', base_branch: 'main' }, baseConfig, baseTemplate);
    expect(state.pipeline.source_control).toBeNull();
  });

  it('returns non-empty mutations_applied', () => {
    const state = makeState();
    const mutation = getMutation('source_control_init')!;
    const result = mutation(state, { branch: 'b', base_branch: 'main' }, baseConfig, baseTemplate);
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });
});

// ── Iter 5 — Explosion script mutations ─────────────────────────────────────

/**
 * Minimal state with explode_master_plan node wired into top-level graph, mirroring
 * default.yml's 4-node planning chain. Used by the explosion mutation tests below.
 */
function makeStateWithExplodeNode(opts: {
  masterPlanStatus?: 'not_started' | 'in_progress' | 'completed';
  explodeStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  parseRetryCount?: number;
  lastParseError?: { line: number; expected: string; found: string; message: string } | null;
} = {}): PipelineState {
  const {
    masterPlanStatus = 'completed',
    explodeStatus = 'in_progress',
    parseRetryCount = 0,
    lastParseError = null,
  } = opts;
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'EXPLODE', created: '2026-04-18T00:00:00Z', updated: '2026-04-18T00:00:00Z' },
    config: {
      gate_mode: 'autonomous',
      limits: {
        max_phases: 5,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    },
    pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
    graph: {
      template_id: 'default',
      status: 'in_progress',
      current_node_path: null,
      nodes: {
        requirements: { kind: 'step', status: 'completed', doc_path: '/tmp/req.md', retries: 0 },
        master_plan: {
          kind: 'step',
          status: masterPlanStatus,
          doc_path: '/tmp/master-plan.md',
          retries: 0,
          last_parse_error: lastParseError,
          parse_retry_count: parseRetryCount,
        },
        explode_master_plan: { kind: 'step', status: explodeStatus, doc_path: null, retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
      },
    },
  };
}

describe('explosion_started mutation', () => {
  it('is registered', () => {
    expect(getMutation('explosion_started')).toBeTypeOf('function');
  });

  it('flips explode_master_plan to in_progress', () => {
    const state = makeStateWithExplodeNode({ explodeStatus: 'not_started' });
    const mutation = getMutation('explosion_started')!;
    const result = mutation(state, {}, baseConfig, baseTemplate);
    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('in_progress');
  });

  it('does not mutate original state', () => {
    const state = makeStateWithExplodeNode({ explodeStatus: 'not_started' });
    const mutation = getMutation('explosion_started')!;
    mutation(state, {}, baseConfig, baseTemplate);
    const explodeNode = state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('not_started');
  });
});

describe('explosion_completed mutation', () => {
  it('is registered', () => {
    expect(getMutation('explosion_completed')).toBeTypeOf('function');
  });

  it('marks explode_master_plan completed, stores doc_path, clears master_plan recovery state', () => {
    const state = makeStateWithExplodeNode({
      parseRetryCount: 2,
      lastParseError: { line: 1, expected: 'e', found: 'f', message: 'm' },
    });
    const mutation = getMutation('explosion_completed')!;
    const result = mutation(state, { doc_path: '/tmp/mp.md' }, baseConfig, baseTemplate);
    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('completed');
    expect(explodeNode.doc_path).toBe('/tmp/mp.md');
    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.last_parse_error).toBeNull();
    expect(mpNode.parse_retry_count).toBe(0);
  });

  it('no-op on recovery state when there was no prior parse failure', () => {
    const state = makeStateWithExplodeNode({ parseRetryCount: 0, lastParseError: null });
    const mutation = getMutation('explosion_completed')!;
    const result = mutation(state, { doc_path: '/tmp/mp.md' }, baseConfig, baseTemplate);
    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.last_parse_error).toBeNull();
    expect(mpNode.parse_retry_count).toBe(0);
  });
});

describe('explosion_failed mutation', () => {
  it('is registered', () => {
    expect(getMutation('explosion_failed')).toBeTypeOf('function');
  });

  it('1st failure: increments parse_retry_count to 1, stores error, resets explode_master_plan to not_started, flips master_plan back to in_progress', () => {
    const state = makeStateWithExplodeNode({ parseRetryCount: 0 });
    const parseError = { line: 42, expected: 'phase heading', found: 'task heading', message: 'at line 42' };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: parseError }, baseConfig, baseTemplate);

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.status).toBe('in_progress');
    expect(mpNode.parse_retry_count).toBe(1);
    expect(mpNode.last_parse_error).toEqual(parseError);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('not_started');

    expect(result.state.graph.status).not.toBe('halted');
  });

  it('4th failure (cap=3 exceeded): halts the graph with halt_reason and explode_master_plan.status=failed', () => {
    const state = makeStateWithExplodeNode({ parseRetryCount: 3 });
    const parseError = { line: 99, expected: 'x', found: 'y', message: 'irrecoverable' };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: parseError }, baseConfig, baseTemplate);

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.parse_retry_count).toBe(4);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('failed');

    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toBeTruthy();
    expect(result.state.pipeline.halt_reason).toContain('cap=3');
  });
});
