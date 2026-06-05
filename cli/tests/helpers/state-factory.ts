/**
 * state-factory.ts
 *
 * Shared test helper that constructs a complete v6 PipelineState fixture.
 * Reused by P02 schema tests and future P03 tests.
 */

export interface RepoEntry {
  name: string;
  commit_hash: string | null;
}

export interface MakeV6StateOptions {
  taskRepos: RepoEntry[];
}

/**
 * Returns a complete v6 PipelineState with one phase iteration (whose own
 * repos is the union of taskRepos with hashes null) containing a task_loop
 * with one task iteration whose repos is the passed taskRepos.
 */
export function makeV6State(opts: MakeV6StateOptions): Record<string, unknown> {
  const { taskRepos } = opts;

  // Phase-level repos: same names as task repos but hashes null (union placeholder)
  const phaseRepos: RepoEntry[] = taskRepos.map((r) => ({
    name: r.name,
    commit_hash: null,
  }));

  const taskIteration = {
    index: 0,
    status: 'not_started',
    nodes: {},
    corrective_tasks: [],
    doc_path: null,
    repos: taskRepos,
  };

  const taskLoopNode = {
    kind: 'for_each_task',
    status: 'not_started',
    iterations: [taskIteration],
  };

  const phaseIteration = {
    index: 0,
    status: 'not_started',
    nodes: {
      task_loop: taskLoopNode,
    },
    corrective_tasks: [],
    doc_path: null,
    repos: phaseRepos,
  };

  const phaseLoopNode = {
    kind: 'for_each_phase',
    status: 'not_started',
    iterations: [phaseIteration],
  };

  return {
    $schema: 'orchestration-state-v6',
    project: {
      name: 'test-project',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    },
    config: {
      gate_mode: 'ask',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 20,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: {
        auto_commit: 'ask',
        auto_pr: 'ask',
      },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    },
    graph: {
      template_id: 'standard',
      status: 'not_started',
      current_node_path: null,
      nodes: {
        phase_loop: phaseLoopNode,
      },
    },
  };
}
