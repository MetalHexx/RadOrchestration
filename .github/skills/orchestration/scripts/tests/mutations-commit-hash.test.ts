import { describe, it, expect } from 'vitest';
import { getMutation } from '../lib/mutations.js';
import { validateStateSchema } from '../lib/schema-validator.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  CorrectiveTaskEntry,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeState(): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z' },
    config: {
      gate_mode: 'ask',
      limits: {
        max_phases: 5,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'ask', auto_pr: 'ask' },
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

function makeTwoTaskState(): PipelineState {
  const state = makeState();
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
  taskLoop.iterations.push({
    index: 1,
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
  });
  return state;
}

function makeCorrectiveTask(index: number, status: 'in_progress' | 'not_started' | 'completed'): CorrectiveTaskEntry {
  return {
    index,
    reason: 'Code review requested changes',
    injected_after: 'code_review',
    status,
    nodes: {
      task_handoff: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      task_executor: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      code_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
      task_gate: { kind: 'gate', status: 'not_started', gate_active: false },
    },
    commit_hash: null,
  };
}

function addCorrectiveTask(state: PipelineState, phase: number, task: number, ct: CorrectiveTaskEntry): void {
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  const taskLoop = phaseLoop.iterations[phase - 1].nodes['task_loop'] as ForEachTaskNodeState;
  taskLoop.iterations[task - 1].corrective_tasks.push(ct);
}

function getTaskIteration(state: PipelineState, phase: number, task: number) {
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  const taskLoop = phaseLoop.iterations[phase - 1].nodes['task_loop'] as ForEachTaskNodeState;
  return taskLoop.iterations[task - 1];
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('commit_completed commit_hash', () => {
  const mutation = getMutation('commit_completed')!;

  it('primary task commit: writes commit_hash to IterationEntry when no corrective tasks', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'abc123' }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state, 1, 1);
    expect(iteration.commit_hash).toBe('abc123');
  });

  it('corrective task commit: writes commit_hash to active CorrectiveTaskEntry, not IterationEntry', () => {
    const state = makeState();
    addCorrectiveTask(state, 1, 1, makeCorrectiveTask(1, 'in_progress'));
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'fix456' }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state, 1, 1);
    expect(iteration.corrective_tasks[0].commit_hash).toBe('fix456');
    expect(iteration.commit_hash).toBeNull();
  });

  it('multiple corrective tasks: writes commit_hash only to last active corrective task', () => {
    const state = makeState();
    addCorrectiveTask(state, 1, 1, makeCorrectiveTask(1, 'completed'));
    addCorrectiveTask(state, 1, 1, makeCorrectiveTask(2, 'in_progress'));
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'rev789' }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state, 1, 1);
    expect(iteration.corrective_tasks[0].commit_hash).toBeNull();
    expect(iteration.corrective_tasks[1].commit_hash).toBe('rev789');
  });

  it('missing commit_hash in context: resolves to null on IterationEntry', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, task: 1 }, baseConfig, baseTemplate);
    const iteration = getTaskIteration(result.state, 1, 1);
    expect(iteration.commit_hash).toBeNull();
  });

  it('multi-task independence: commit to task 2 does not affect task 1', () => {
    const state = makeTwoTaskState();
    const result = mutation(state, { phase: 1, task: 2, commit_hash: 'task2hash' }, baseConfig, baseTemplate);
    const task1 = getTaskIteration(result.state, 1, 1);
    const task2 = getTaskIteration(result.state, 1, 2);
    expect(task1.commit_hash).toBeNull();
    expect(task2.commit_hash).toBe('task2hash');
  });

  it('schema validation after commit: resulting state passes validateStateSchema with zero errors', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'abc123' }, baseConfig, baseTemplate);
    const errors = validateStateSchema(result.state);
    expect(errors).toEqual([]);
  });

  it('mutations_applied: includes descriptive entry for primary task commit', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'abc123' }, baseConfig, baseTemplate);
    expect(result.mutations_applied).toContain('set task_iteration[0].commit_hash = abc123');
  });

  it('mutations_applied: includes descriptive entry for corrective task commit', () => {
    const state = makeState();
    addCorrectiveTask(state, 1, 1, makeCorrectiveTask(1, 'in_progress'));
    const result = mutation(state, { phase: 1, task: 1, commit_hash: 'fix456' }, baseConfig, baseTemplate);
    expect(result.mutations_applied).toContain('set corrective_task[1].commit_hash = fix456');
  });
});
