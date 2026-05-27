import { describe, it, expect } from 'vitest';
import { walkDAG } from '../../../src/lib/pipeline-engine/dag-walker.js';
import { NODE_STATUSES } from '../../../src/lib/pipeline-engine/constants.js';
import type { PipelineState, PipelineTemplate, OrchestrationConfig, StepNodeDef, StepNodeState } from '../../../src/lib/pipeline-engine/types.js';

const CFG: OrchestrationConfig = {
  limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
  human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true },
  source_control: { auto_commit: 'never', auto_pr: 'never' },
  default_template: 't',
};

function makeFlatTwoStepTemplate(): PipelineTemplate {
  return {
    template: { id: 't', version: '1.0.0', description: 'd' },
    nodes: [
      { id: 'a', kind: 'step', label: 'A', action: 'do_a', events: { completed: 'a_done' }, depends_on: [] } as StepNodeDef,
      { id: 'b', kind: 'step', label: 'B', action: 'do_b', events: { completed: 'b_done' }, depends_on: ['a'] } as StepNodeDef,
    ],
  } as PipelineTemplate;
}

function makeStateWithStatuses(a: string, b: string): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'p', created: 'x', updated: 'x' },
    config: { gate_mode: 'task', limits: CFG.limits, source_control: { auto_commit: 'never', auto_pr: 'never' } },
    pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
    graph: {
      template_id: 't',
      status: 'in_progress',
      current_node_path: null,
      nodes: {
        a: { kind: 'step', status: a, doc_path: null, retries: 0 } as StepNodeState,
        b: { kind: 'step', status: b, doc_path: null, retries: 0 } as StepNodeState,
      },
    },
  } as PipelineState;
}

describe('walkNodes step in_progress mutation', () => {
  it('flips a not_started step node to in_progress on the same walk that returns its action', () => {
    const tpl = makeFlatTwoStepTemplate();
    const st = makeStateWithStatuses('not_started', 'not_started');
    const r = walkDAG(st, tpl, CFG);
    expect(r?.action).toBe('do_a');
    expect(st.graph.nodes['a']!.status).toBe(NODE_STATUSES.IN_PROGRESS);
    expect(st.graph.nodes['b']!.status).toBe(NODE_STATUSES.NOT_STARTED);
  });

  it('is idempotent on the in_progress re-emit arm', () => {
    const tpl = makeFlatTwoStepTemplate();
    const st = makeStateWithStatuses('in_progress', 'not_started');
    const r = walkDAG(st, tpl, CFG);
    expect(r?.action).toBe('do_a');
    expect(st.graph.nodes['a']!.status).toBe(NODE_STATUSES.IN_PROGRESS);
  });

  it('does not mutate gate, conditional, or for_each container statuses on the step path', () => {
    const tpl = makeFlatTwoStepTemplate();
    const st = makeStateWithStatuses('not_started', 'not_started');
    walkDAG(st, tpl, CFG);
    // b is still not_started; only the resolved step (a) was flipped.
    expect(st.graph.nodes['b']!.status).toBe(NODE_STATUSES.NOT_STARTED);
  });
});
