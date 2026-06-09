import { describe, it, expect } from 'vitest';
import { validateState } from '../../../src/lib/pipeline-engine/validator.js';
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
