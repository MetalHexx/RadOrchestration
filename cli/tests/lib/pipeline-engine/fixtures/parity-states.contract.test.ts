import { describe, it, expect } from 'vitest';
import { driveToExecutionWithConfig, DEFAULT_CONFIG } from './parity-states.js';

describe('shared fixtures build the v6 repos[] shape (NFR-7, FR-20)', () => {
  it('initSourceControlForTests seeds repos[] and no compat fields', () => {
    const io = driveToExecutionWithConfig(DEFAULT_CONFIG, 1, 2);
    const sc = io.currentState!.pipeline.source_control!;
    expect(Array.isArray(sc.repos)).toBe(true);
    expect(sc.repos.length).toBeGreaterThanOrEqual(1);
    expect(sc).not.toHaveProperty('worktree_path');
    expect(sc).not.toHaveProperty('branch');
    expect(sc).not.toHaveProperty('base_branch');
    expect(sc.worktree_name).toBeTypeOf('string');
  });

  it('seedExplosionStateFor seeds task iterations carrying repos[] not a scalar commit_hash', () => {
    const io = driveToExecutionWithConfig(DEFAULT_CONFIG, 1, 2);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as {
      iterations: Array<{ nodes: Record<string, { iterations: Array<Record<string, unknown>> }> }>;
    };
    const ti = phaseLoop.iterations[0].nodes['task_loop'].iterations[0];
    expect(Array.isArray(ti.repos)).toBe(true);
    expect(ti).not.toHaveProperty('commit_hash');
  });
});
