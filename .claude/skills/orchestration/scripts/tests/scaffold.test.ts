import { describe, it, expect } from 'vitest';
import { scaffoldNodeState } from '../lib/scaffold.js';
import type {
  StepNodeDef,
  GateNodeDef,
  ConditionalNodeDef,
  ParallelNodeDef,
  ForEachPhaseNodeDef,
  ForEachTaskNodeDef,
} from '../lib/types.js';

describe('scaffoldNodeState', () => {
  it('returns initial step state for a step node', () => {
    const nodeDef: StepNodeDef = {
      id: 'step_1',
      kind: 'step',
      action: 'some_action',
      events: { started: 'step_started', completed: 'step_completed' },
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'step',
      status: 'not_started',
      doc_path: null,
      retries: 0,
    });
  });

  it('returns initial gate state for a gate node', () => {
    const nodeDef: GateNodeDef = {
      id: 'gate_1',
      kind: 'gate',
      mode_ref: 'human_gates.after_planning',
      action_if_needed: 'request_approval',
      approved_event: 'gate_approved',
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'gate',
      status: 'not_started',
      gate_active: false,
    });
  });

  it('returns initial conditional state for a conditional node', () => {
    const nodeDef: ConditionalNodeDef = {
      id: 'cond_1',
      kind: 'conditional',
      condition: { config_ref: 'some.flag', operator: 'truthy' },
      branches: { true: [], false: [] },
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'conditional',
      status: 'not_started',
      branch_taken: null,
    });
  });

  it('returns initial for_each_phase state for a for_each_phase node', () => {
    const nodeDef: ForEachPhaseNodeDef = {
      id: 'fep_1',
      kind: 'for_each_phase',
      source_doc_ref: '$.nodes.plan.doc_path',
      total_field: 'phases.total',
      body: [],
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'for_each_phase',
      status: 'not_started',
      iterations: [],
    });
  });

  it('returns initial for_each_task state for a for_each_task node', () => {
    const nodeDef: ForEachTaskNodeDef = {
      id: 'fet_1',
      kind: 'for_each_task',
      source_doc_ref: '$.nodes.plan.doc_path',
      tasks_field: 'tasks',
      body: [],
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'for_each_task',
      status: 'not_started',
      iterations: [],
    });
  });

  it('returns initial parallel state with scaffolded children for a parallel node with 2 step children', () => {
    const nodeDef: ParallelNodeDef = {
      id: 'par_1',
      kind: 'parallel',
      serialize: false,
      children: [
        {
          id: 'child1',
          kind: 'step',
          action: 'action_a',
          events: { started: 'a_started', completed: 'a_completed' },
        },
        {
          id: 'child2',
          kind: 'step',
          action: 'action_b',
          events: { started: 'b_started', completed: 'b_completed' },
        },
      ],
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'parallel',
      status: 'not_started',
      nodes: {
        child1: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        child2: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      },
    });
  });

  it('recursively scaffolds nested parallel children', () => {
    const nodeDef: ParallelNodeDef = {
      id: 'outer_par',
      kind: 'parallel',
      serialize: false,
      children: [
        {
          id: 'inner_par',
          kind: 'parallel',
          serialize: false,
          children: [
            {
              id: 'inner_step',
              kind: 'step',
              action: 'inner_action',
              events: { started: 'inner_started', completed: 'inner_completed' },
            },
          ],
        },
      ],
    };
    expect(scaffoldNodeState(nodeDef)).toEqual({
      kind: 'parallel',
      status: 'not_started',
      nodes: {
        inner_par: {
          kind: 'parallel',
          status: 'not_started',
          nodes: {
            inner_step: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
          },
        },
      },
    });
  });
});
