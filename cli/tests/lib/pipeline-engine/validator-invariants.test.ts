import { describe, it, expect } from 'vitest';
import { validateState } from '../../../src/lib/pipeline-engine/validator.js';
import { deriveCurrentNodePathFromMarkers } from '../../../src/lib/pipeline-engine/dag-walker.js';
import { makeV6State } from '../../helpers/state-factory.js';
import type { OrchestrationConfig, PipelineTemplate, PipelineState } from '../../../src/lib/pipeline-engine/types.js';

const cfg = { limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 3, max_consecutive_review_rejections: 3 } } as unknown as OrchestrationConfig;
const tmpl = { id: '', version: '', description: '', nodes: [] } as unknown as PipelineTemplate;

function withTaskHash(hash: string | null): PipelineState {
  const s = makeV6State({ taskRepos: [{ name: 'backend', commit_hash: hash }] });
  // mark statuses completed so the node is a finalized record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phase = (s as any).graph.nodes.phase_loop.iterations[0];
  phase.status = 'completed';
  phase.nodes.task_loop.status = 'completed';
  phase.nodes.task_loop.iterations[0].status = 'completed';
  return s as unknown as PipelineState;
}

describe('checkImmutableCommitHash (AD-2, AD-3)', () => {
  it('rejects a finalized commit_hash changing to a different non-null value (AD-2)', () => {
    const prev = withTaskHash('64f9c236');
    const next = withTaskHash('1436cd63');
    const errors = validateState(prev, next, cfg, tmpl);
    expect(errors.some(e => /commit_hash|immutable/i.test(e))).toBe(true);
  });

  it('allows an unchanged (idempotent) commit_hash (NFR-1)', () => {
    const prev = withTaskHash('64f9c236');
    const next = withTaskHash('64f9c236');
    const errors = validateState(prev, next, cfg, tmpl);
    expect(errors.some(e => /commit_hash|immutable/i.test(e))).toBe(false);
  });
});

function stateWithMarkerAndPath(currentNodePath: string): PipelineState {
  const taskLoop = { kind: 'for_each_task', status: 'completed', iterations: [ { index: 0, status: 'completed', doc_path: null, repos: [], corrective_tasks: [], nodes: {} } ] };
  return {
    graph: {
      status: 'in_progress',
      current_node_path: currentNodePath,
      nodes: {
        phase_loop: {
          kind: 'for_each_phase',
          status: 'in_progress',
          iterations: [
            { index: 0, status: 'in_progress', doc_path: null, repos: [], corrective_tasks: [
              { index: 1, status: 'in_progress', reason: 'r', injected_after: 'phase_review', nodes: { commit: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } }, repos: [] },
            ], nodes: { task_loop: structuredClone(taskLoop) } },
          ],
        },
      },
    },
  } as unknown as PipelineState;
}

describe('current_node_path tripwire (FR-8, FR-9)', () => {
  it('derives the active corrective node path from in_progress markers (FR-8)', () => {
    const derived = deriveCurrentNodePathFromMarkers(stateWithMarkerAndPath('ignored'));
    expect(derived).toMatch(/corrective_tasks\[1\]/);
  });

  it('flags a current_node_path that disagrees with the markers (FR-9)', () => {
    const prev = withTaskHash('64f9c236');
    const next = stateWithMarkerAndPath('phase_loop[0].task_loop[0].commit');
    const errors = validateState(prev, next, cfg, tmpl);
    expect(errors.some(e => /current_node_path|tripwire|disagree/i.test(e))).toBe(true);
  });

  it('tolerates a terminal state with no active node (FR-9)', () => {
    const terminal = withTaskHash('64f9c236');
    // all completed, current_node_path may be a completed node — no in_progress marker exists
    const errors = validateState(terminal, terminal, cfg, tmpl);
    expect(errors.some(e => /current_node_path|tripwire/i.test(e))).toBe(false);
  });
});
