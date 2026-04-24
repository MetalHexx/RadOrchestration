import { describe, it, expect } from 'vitest';
import { enrichActionContext, resolveActivePhaseIndex, resolveActiveTaskIndex } from '../lib/context-enrichment.js';
import type { PipelineState, OrchestrationConfig, ForEachPhaseNodeState, ForEachTaskNodeState, StepNodeState } from '../lib/types.js';
import { createScaffoldedState } from './fixtures/parity-states.js';

// ── Minimal config ────────────────────────────────────────────────────────────

const config: OrchestrationConfig = {
  system: { orch_root: '.github' },
  projects: { base_path: '', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'never', auto_pr: 'never', provider: 'github' },
  default_template: 'full',
};

// ── State with source_control populated ───────────────────────────────────────

function stateWithSourceControl(
  branch: string,
  baseBranch: string,
  worktreePath: string,
): PipelineState {
  const state = createScaffoldedState();
  state.pipeline.source_control = {
    branch,
    base_branch: baseBranch,
    worktree_path: worktreePath,
    auto_commit: 'never',
    auto_pr: 'never',
    remote_url: null,
    compare_url: null,
    pr_url: null,
  };
  return state;
}

function stateWithNullSourceControl(): PipelineState {
  const state = createScaffoldedState();
  state.pipeline.source_control = null;
  return state;
}

// ── Planning spawn actions (Iter 4: spawn_requirements added) ────────────────

describe('enrichActionContext — planning spawn actions', () => {
  it('spawn_requirements returns { step: "requirements" }', () => {
    const state = createScaffoldedState();
    const result = enrichActionContext({
      action: 'spawn_requirements',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result).toEqual({ step: 'requirements' });
  });

  it('spawn_master_plan returns { step: "master_plan" }', () => {
    const state = createScaffoldedState();
    const result = enrichActionContext({
      action: 'spawn_master_plan',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result).toEqual({ step: 'master_plan' });
  });
});

// ── invoke_source_control_commit ──────────────────────────────────────────────

describe('enrichActionContext — invoke_source_control_commit', () => {
  it('reads branch and worktree_path from state.pipeline.source_control (not cliContext)', () => {
    const state = stateWithSourceControl('feature/my-branch', 'main', '/path/to/worktree');
    const result = enrichActionContext({
      action: 'invoke_source_control_commit',
      walkerContext: {},
      state,
      config,
      cliContext: { branch: 'cliContext-branch', worktree_path: 'cliContext-worktree' },
    });
    expect(result.branch).toBe('feature/my-branch');
    expect(result.worktree_path).toBe('/path/to/worktree');
  });

  it('returns empty strings when state.pipeline.source_control is null', () => {
    const state = stateWithNullSourceControl();
    const result = enrichActionContext({
      action: 'invoke_source_control_commit',
      walkerContext: {},
      state,
      config,
      cliContext: { branch: 'cliContext-branch', worktree_path: 'cliContext-worktree' },
    });
    expect(result.branch).toBe('');
    expect(result.worktree_path).toBe('');
  });
});

// ── invoke_source_control_pr ──────────────────────────────────────────────────

describe('enrichActionContext — invoke_source_control_pr', () => {
  it('reads branch, base_branch, and worktree_path from state.pipeline.source_control (not cliContext)', () => {
    const state = stateWithSourceControl('feature/pr-branch', 'main', '/worktree/path');
    const result = enrichActionContext({
      action: 'invoke_source_control_pr',
      walkerContext: {},
      state,
      config,
      cliContext: {
        branch: 'cliContext-branch',
        base_branch: 'cliContext-base',
        worktree_path: 'cliContext-worktree',
      },
    });
    expect(result.branch).toBe('feature/pr-branch');
    expect(result.base_branch).toBe('main');
    expect(result.worktree_path).toBe('/worktree/path');
  });

  it('returns empty strings when state.pipeline.source_control is null', () => {
    const state = stateWithNullSourceControl();
    const result = enrichActionContext({
      action: 'invoke_source_control_pr',
      walkerContext: {},
      state,
      config,
      cliContext: {
        branch: 'cliContext-branch',
        base_branch: 'cliContext-base',
        worktree_path: 'cliContext-worktree',
      },
    });
    expect(result.branch).toBe('');
    expect(result.base_branch).toBe('');
    expect(result.worktree_path).toBe('');
  });
});

// ── ask_gate_mode ─────────────────────────────────────────────────────────────

describe('enrichActionContext — ask_gate_mode', () => {
  it('passes through walkerContext unchanged', () => {
    const state = stateWithNullSourceControl();
    const walkerContext = { custom_key: 'custom_value', another: 42 };
    const result = enrichActionContext({
      action: 'ask_gate_mode',
      walkerContext,
      state,
      config,
      cliContext: {},
    });
    expect(result).toEqual(walkerContext);
  });
});

// ── display_halted ────────────────────────────────────────────────────────────

describe('enrichActionContext — display_halted', () => {
  it('includes details field from walkerContext', () => {
    const state = stateWithNullSourceControl();
    const walkerContext = { details: 'Pipeline is halted due to operator rejection' };
    const result = enrichActionContext({
      action: 'display_halted',
      walkerContext,
      state,
      config,
      cliContext: {},
    });
    expect(result.details).toBe('Pipeline is halted due to operator rejection');
  });
});

// ── resolveActivePhaseIndex ───────────────────────────────────────────────────

describe('resolveActivePhaseIndex', () => {
  it('returns 1 when no iterations exist', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [];
    expect(resolveActivePhaseIndex(state)).toBe(1);
  });

  it('returns the in_progress phase index (1-based)', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
      { index: 1, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
      { index: 2, status: 'not_started', nodes: {}, corrective_tasks: [], commit_hash: null },
    ];
    expect(resolveActivePhaseIndex(state)).toBe(2);
  });

  it('returns the first not_started phase when none in_progress', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
      { index: 1, status: 'not_started', nodes: {}, corrective_tasks: [], commit_hash: null },
      { index: 2, status: 'not_started', nodes: {}, corrective_tasks: [], commit_hash: null },
    ];
    expect(resolveActivePhaseIndex(state)).toBe(2);
  });

  it('throws when multiple phases are in_progress', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      { index: 0, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
      { index: 1, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
    ];
    expect(() => resolveActivePhaseIndex(state)).toThrow(/Ambiguous phase resolution/);
  });

  it('returns 1 when all iterations are completed', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
      { index: 1, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
    ];
    expect(resolveActivePhaseIndex(state)).toBe(1);
  });
});

// ── resolveActiveTaskIndex ────────────────────────────────────────────────────

describe('resolveActiveTaskIndex', () => {
  it('returns 1 when no task iterations exist', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      { index: 0, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
    ];
    expect(resolveActiveTaskIndex(state, 1)).toBe(1);
  });

  it('returns the in_progress task index (1-based)', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop: ForEachTaskNodeState = {
      kind: 'for_each_task',
      status: 'in_progress',
      iterations: [
        { index: 0, status: 'completed', nodes: {}, corrective_tasks: [], commit_hash: null },
        { index: 1, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
        { index: 2, status: 'not_started', nodes: {}, corrective_tasks: [], commit_hash: null },
      ],
    };
    phaseLoop.iterations = [
      { index: 0, status: 'in_progress', nodes: { task_loop: taskLoop }, corrective_tasks: [], commit_hash: null },
    ];
    expect(resolveActiveTaskIndex(state, 1)).toBe(2);
  });

  it('throws when multiple tasks are in_progress', () => {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop: ForEachTaskNodeState = {
      kind: 'for_each_task',
      status: 'in_progress',
      iterations: [
        { index: 0, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
        { index: 1, status: 'in_progress', nodes: {}, corrective_tasks: [], commit_hash: null },
      ],
    };
    phaseLoop.iterations = [
      { index: 0, status: 'in_progress', nodes: { task_loop: taskLoop }, corrective_tasks: [], commit_hash: null },
    ];
    expect(() => resolveActiveTaskIndex(state, 1)).toThrow(/Ambiguous task resolution/);
  });
});

// ── request_final_approval ────────────────────────────────────────────────────

describe('enrichActionContext — request_final_approval', () => {
  it('returns pr_url from state.pipeline.source_control.pr_url when it contains a URL string', () => {
    const state = stateWithSourceControl('feature/my-branch', 'main', '/path/to/worktree');
    state.pipeline.source_control!.pr_url = 'https://github.com/org/repo/pull/123';
    const result = enrichActionContext({
      action: 'request_final_approval',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.pr_url).toBe('https://github.com/org/repo/pull/123');
  });

  it('returns pr_url: null when state.pipeline.source_control.pr_url is null', () => {
    const state = stateWithSourceControl('feature/my-branch', 'main', '/path/to/worktree');
    state.pipeline.source_control!.pr_url = null;
    const result = enrichActionContext({
      action: 'request_final_approval',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.pr_url).toBeNull();
  });

  it('returns pr_url: null when state.pipeline.source_control is null', () => {
    const state = stateWithNullSourceControl();
    const result = enrichActionContext({
      action: 'request_final_approval',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.pr_url).toBeNull();
  });

  it('preserves walker context properties in the enriched result', () => {
    const state = stateWithSourceControl('feature/my-branch', 'main', '/path/to/worktree');
    state.pipeline.source_control!.pr_url = 'https://github.com/org/repo/pull/123';
    const walkerContext = { custom_key: 'custom_value', another: 42 };
    const result = enrichActionContext({
      action: 'request_final_approval',
      walkerContext,
      state,
      config,
      cliContext: {},
    });
    expect(result.custom_key).toBe('custom_value');
    expect(result.another).toBe(42);
    expect(result.pr_url).toBe('https://github.com/org/repo/pull/123');
  });
});

// ── spawn_code_reviewer ───────────────────────────────────────────────────────

describe('enrichActionContext — spawn_code_reviewer', () => {
  function stateWithTaskIteration(
    taskCommitHash: string | null,
    correctives: Array<{ index: number; status: 'not_started' | 'in_progress' | 'completed'; commit_hash: string | null }> = [],
  ): PipelineState {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      {
        index: 0,
        status: 'in_progress',
        nodes: {
          task_loop: {
            kind: 'for_each_task',
            status: 'in_progress',
            iterations: [
              {
                index: 0,
                status: 'in_progress',
                nodes: {},
                corrective_tasks: correctives.map(c => ({
                  index: c.index,
                  reason: 'changes_requested',
                  injected_after: 'code_review',
                  status: c.status,
                  nodes: {},
                  commit_hash: c.commit_hash,
                })),
                commit_hash: taskCommitHash,
              },
            ],
          } as ForEachTaskNodeState,
        },
        corrective_tasks: [],
        commit_hash: null,
      },
    ];
    return state;
  }

  it('returns head_sha from taskIteration.commit_hash when no active corrective', () => {
    const state = stateWithTaskIteration('abc123def456');
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.head_sha).toBe('abc123def456');
    expect(result.phase_number).toBe(1);
    expect(result.task_number).toBe(1);
    expect(result.phase_id).toBe('P01');
    expect(result.task_id).toBe('P01-T01');
  });

  it('returns head_sha from active corrective (in_progress) when one exists, overriding taskIteration.commit_hash', () => {
    const state = stateWithTaskIteration('original_hash', [
      { index: 1, status: 'in_progress', commit_hash: 'corrective_hash' },
    ]);
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.head_sha).toBe('corrective_hash');
  });

  it('returns head_sha: null when active corrective exists but has no commit yet (does NOT fall back to stale task commit)', () => {
    const state = stateWithTaskIteration('original_hash', [
      { index: 1, status: 'not_started', commit_hash: null },
    ]);
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    // Once a corrective cycle is active, its commit_hash is authoritative.
    // The original task's commit is stale — do not return it.
    expect(result.head_sha).toBeNull();
  });

  it('falls through completed correctives to the latest active one', () => {
    const state = stateWithTaskIteration('task_hash', [
      { index: 1, status: 'completed', commit_hash: 'first_corrective' },
      { index: 2, status: 'in_progress', commit_hash: 'second_corrective' },
    ]);
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.head_sha).toBe('second_corrective');
  });

  it('returns head_sha: null when no commit has been made (auto_commit never)', () => {
    const state = stateWithTaskIteration(null);
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.head_sha).toBeNull();
  });

  it('preserves walker context properties', () => {
    const state = stateWithTaskIteration('abc123');
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: { custom_key: 'custom_value' },
      state,
      config,
      cliContext: {},
    });
    expect(result.custom_key).toBe('custom_value');
    expect(result.head_sha).toBe('abc123');
  });
});

// ── spawn_phase_reviewer ──────────────────────────────────────────────────────

describe('enrichActionContext — spawn_phase_reviewer', () => {
  function stateWithPhaseTasks(
    taskCommitHashes: Array<string | null>,
    lastTaskCorrectives: Array<{ index: number; status: 'not_started' | 'in_progress' | 'completed'; commit_hash: string | null }> = [],
  ): PipelineState {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      {
        index: 0,
        status: 'in_progress',
        nodes: {
          task_loop: {
            kind: 'for_each_task',
            status: 'in_progress',
            iterations: taskCommitHashes.map((commit_hash, index) => ({
              index,
              status: 'completed',
              nodes: {},
              corrective_tasks: index === taskCommitHashes.length - 1
                ? lastTaskCorrectives.map(c => ({
                    index: c.index,
                    reason: 'changes_requested',
                    injected_after: 'code_review',
                    status: c.status,
                    nodes: {},
                    commit_hash: c.commit_hash,
                  }))
                : [],
              commit_hash,
            })),
          } as ForEachTaskNodeState,
        },
        corrective_tasks: [],
        commit_hash: null,
      },
    ];
    return state;
  }

  it('returns phase_first_sha and phase_head_sha from first and last task commits when no correctives', () => {
    const state = stateWithPhaseTasks(['abc', 'def', 'ghi']);
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.phase_first_sha).toBe('abc');
    expect(result.phase_head_sha).toBe('ghi');
    expect(result.phase_number).toBe(1);
    expect(result.phase_id).toBe('P01');
  });

  it('returns phase_head_sha from the last task final corrective commit when one has committed', () => {
    const state = stateWithPhaseTasks(['abc', 'def', 'ghi'], [
      { index: 1, status: 'completed', commit_hash: 'jkl' },
    ]);
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.phase_first_sha).toBe('abc');
    expect(result.phase_head_sha).toBe('jkl');
  });

  it('falls back to last task base commit when the latest corrective has no commit yet', () => {
    const state = stateWithPhaseTasks(['abc', 'def', 'ghi'], [
      { index: 1, status: 'in_progress', commit_hash: null },
    ]);
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.phase_first_sha).toBe('abc');
    expect(result.phase_head_sha).toBe('ghi');
  });

  it('picks the most recent corrective with a commit when multiple correctives exist', () => {
    const state = stateWithPhaseTasks(['abc', 'def', 'ghi'], [
      { index: 1, status: 'completed', commit_hash: 'first_corr' },
      { index: 2, status: 'completed', commit_hash: 'second_corr' },
      { index: 3, status: 'in_progress', commit_hash: null },
    ]);
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.phase_head_sha).toBe('second_corr');
  });

  it('returns both SHAs as null when auto-commit is off (no commits made)', () => {
    const state = stateWithPhaseTasks([null, null, null]);
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.phase_first_sha).toBeNull();
    expect(result.phase_head_sha).toBeNull();
  });

  it('returns phase_first_sha === phase_head_sha for a single-task phase', () => {
    const state = stateWithPhaseTasks(['only']);
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.phase_first_sha).toBe('only');
    expect(result.phase_head_sha).toBe('only');
  });
});

// ── spawn_final_reviewer (Iter 12) ────────────────────────────────────────────
//
// Iter 12 removes `spawn_final_reviewer` from `EMPTY_CONTEXT_ACTIONS` and adds
// a dedicated enrichment branch that derives `project_base_sha` +
// `project_head_sha` from iteration commit_hash values across the whole
// pipeline (all phases, all tasks, all corrective tasks at either scope).
// When no commits exist (auto_commit=off, nothing committed), both fields are
// null and the reviewer falls back to `git diff HEAD` + untracked files.

describe('enrichActionContext — spawn_final_reviewer (Iter 12)', () => {
  interface TaskSpec {
    commit_hash: string | null;
    correctives?: Array<{ index: number; commit_hash: string | null }>;
  }
  interface PhaseSpec {
    tasks: TaskSpec[];
    correctives?: Array<{ index: number; commit_hash: string | null }>;
  }

  function multiPhaseState(phases: PhaseSpec[]): PipelineState {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = phases.map((phase, phaseIdx) => ({
      index: phaseIdx,
      status: 'completed',
      nodes: {
        task_loop: {
          kind: 'for_each_task',
          status: 'completed',
          iterations: phase.tasks.map((task, taskIdx) => ({
            index: taskIdx,
            status: 'completed',
            nodes: {},
            corrective_tasks: (task.correctives ?? []).map(c => ({
              index: c.index,
              reason: 'changes_requested',
              injected_after: 'code_review',
              status: 'completed',
              nodes: {},
              commit_hash: c.commit_hash,
            })),
            commit_hash: task.commit_hash,
          })),
        } as ForEachTaskNodeState,
      },
      corrective_tasks: (phase.correctives ?? []).map(c => ({
        index: c.index,
        reason: 'changes_requested',
        injected_after: 'phase_review',
        status: 'completed',
        nodes: {},
        commit_hash: c.commit_hash,
      })),
      commit_hash: null,
    }));
    return state;
  }

  it('derives project_base_sha from first task commit and project_head_sha from last task commit', () => {
    const state = multiPhaseState([
      { tasks: [{ commit_hash: 'sha1' }, { commit_hash: 'sha2' }] },
      { tasks: [{ commit_hash: 'sha3' }, { commit_hash: 'sha4' }] },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBe('sha1');
    expect(result.project_head_sha).toBe('sha4');
  });

  it('includes task-scope corrective commits when deriving head_sha', () => {
    const state = multiPhaseState([
      {
        tasks: [
          { commit_hash: 'sha1' },
          {
            commit_hash: 'sha2',
            correctives: [
              { index: 1, commit_hash: 'sha2_c1' },
            ],
          },
        ],
      },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBe('sha1');
    expect(result.project_head_sha).toBe('sha2_c1');
  });

  it('includes phase-scope corrective commits when deriving head_sha', () => {
    const state = multiPhaseState([
      {
        tasks: [{ commit_hash: 'sha1' }, { commit_hash: 'sha2' }],
        correctives: [{ index: 1, commit_hash: 'phase_c1' }],
      },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBe('sha1');
    expect(result.project_head_sha).toBe('phase_c1');
  });

  it('returns both SHAs null when no task commits exist (auto-commit=off)', () => {
    const state = multiPhaseState([
      { tasks: [{ commit_hash: null }, { commit_hash: null }] },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBeNull();
    expect(result.project_head_sha).toBeNull();
  });

  it('returns both SHAs null when phase_loop has no iterations', () => {
    const state = createScaffoldedState();
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBeNull();
    expect(result.project_head_sha).toBeNull();
  });

  it('single-commit project yields project_base_sha === project_head_sha', () => {
    const state = multiPhaseState([
      { tasks: [{ commit_hash: 'only' }] },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBe('only');
    expect(result.project_head_sha).toBe('only');
  });

  it('skips tasks with null commit_hash while preserving committed ones', () => {
    const state = multiPhaseState([
      {
        tasks: [
          { commit_hash: null }, // task never committed
          { commit_hash: 'sha_only' },
          { commit_hash: null },
        ],
      },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBe('sha_only');
    expect(result.project_head_sha).toBe('sha_only');
  });

  it('skips phase 1 when all its commits are null and picks up phase 2 commits', () => {
    // Phase 1 had no successful task commits (auto-commit=off or all tasks
    // failed before committing). Phase 2 has real commits. base_sha must be
    // phase 2's first commit; head_sha must be phase 2's last commit.
    const state = multiPhaseState([
      { tasks: [{ commit_hash: null }, { commit_hash: null }] },
      { tasks: [{ commit_hash: 'p2_sha1' }, { commit_hash: 'p2_sha2' }] },
    ]);
    const result = enrichActionContext({
      action: 'spawn_final_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.project_base_sha).toBe('p2_sha1');
    expect(result.project_head_sha).toBe('p2_sha2');
  });
});

// ── corrective_index exposure (PR #50 follow-up) ──────────────────────────────
//
// Regression coverage: skill docs for task-review and phase-review instruct the
// agent to read `corrective_index` from the event context. Context-enrichment
// must actually provide it for the corresponding spawn actions.

describe('enrichActionContext — corrective_index exposure', () => {
  function phaseIterWith(overrides: {
    correctivePhaseCount?: number;
    taskCorrectives?: Array<{ index: number; status: 'not_started' | 'in_progress' | 'completed' }>;
  }): PipelineState {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskCorrectives = overrides.taskCorrectives ?? [];
    phaseLoop.iterations = [
      {
        index: 0,
        status: 'in_progress',
        nodes: {
          task_loop: {
            kind: 'for_each_task',
            status: 'in_progress',
            iterations: [
              {
                index: 0,
                status: 'in_progress',
                nodes: {
                  code_review: {
                    kind: 'step',
                    status: 'completed',
                    doc_path: 'reports/PROJ-CODE-REVIEW-P01-T01.md',
                    retries: 0,
                  } as StepNodeState,
                },
                corrective_tasks: taskCorrectives.map(c => ({
                  index: c.index,
                  reason: 'changes_requested',
                  injected_after: 'code_review',
                  status: c.status,
                  nodes: {},
                  commit_hash: null,
                })),
                commit_hash: 'task_hash',
              },
            ],
          } as ForEachTaskNodeState,
        },
        corrective_tasks: Array.from({ length: overrides.correctivePhaseCount ?? 0 }, (_, i) => ({
          index: i + 1,
          reason: 'changes_requested',
          injected_after: 'phase_review',
          status: i === (overrides.correctivePhaseCount ?? 0) - 1 ? 'in_progress' : 'completed',
          nodes: {},
          commit_hash: null,
        })),
        commit_hash: null,
      },
    ];
    return state;
  }

  it('spawn_code_reviewer: omits corrective fields on first-time review', () => {
    const state = phaseIterWith({ taskCorrectives: [] });
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result).not.toHaveProperty('is_correction');
    expect(result).not.toHaveProperty('corrective_index');
  });

  it('spawn_code_reviewer: exposes corrective_index matching corrective_tasks.length', () => {
    const state = phaseIterWith({
      taskCorrectives: [
        { index: 1, status: 'completed' },
        { index: 2, status: 'in_progress' },
      ],
    });
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.is_correction).toBe(true);
    expect(result.corrective_index).toBe(2);
  });

  it('spawn_phase_reviewer: exposes corrective_index during a phase-level corrective cycle', () => {
    const state = phaseIterWith({ correctivePhaseCount: 2 });
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.is_correction).toBe(true);
    expect(result.corrective_index).toBe(2);
  });

  it('spawn_phase_reviewer: omits corrective fields on first-time phase review', () => {
    const state = phaseIterWith({ correctivePhaseCount: 0 });
    const result = enrichActionContext({
      action: 'spawn_phase_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result).not.toHaveProperty('is_correction');
    expect(result).not.toHaveProperty('corrective_index');
  });
});

// ── [Iter 10] execute_task handoff routing to active task-scope corrective ────
//
// The mutation births a corrective entry with a pre-completed `task_handoff`
// sub-node at the orchestrator-supplied path. Context-enrichment's
// `execute_task` branch must prefer this over the original iteration's
// `task_handoff` when the last corrective is active (not_started or
// in_progress). Completed correctives fall through to the original handoff.

describe('enrichActionContext — execute_task: active corrective handoff routing', () => {
  const ORIG_HANDOFF = 'tasks/original-P01-T01.md';
  const C1_HANDOFF = 'tasks/corrective-P01-T01-C1.md';
  const C2_HANDOFF = 'tasks/corrective-P01-T01-C2.md';

  function stateWithCorrectives(correctives: Array<{
    index: number;
    status: 'not_started' | 'in_progress' | 'completed';
    doc_path: string;
  }>): PipelineState {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      {
        index: 0,
        status: 'in_progress',
        nodes: {
          task_loop: {
            kind: 'for_each_task',
            status: 'in_progress',
            iterations: [
              {
                index: 0,
                status: 'in_progress',
                nodes: {},
                corrective_tasks: correctives.map(c => ({
                  index: c.index,
                  reason: 'changes_requested',
                  injected_after: 'code_review',
                  status: c.status,
                  nodes: {},
                  doc_path: c.doc_path,
                  commit_hash: null,
                })),
                doc_path: ORIG_HANDOFF,
                commit_hash: null,
              },
            ],
          } as ForEachTaskNodeState,
        },
        corrective_tasks: [],
        commit_hash: null,
      },
    ];
    return state;
  }

  it('no correctives → handoff_doc reads from original task_handoff', () => {
    const state = stateWithCorrectives([]);
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(ORIG_HANDOFF);
  });

  it('active corrective (not_started) → handoff_doc routes to corrective task_handoff.doc_path', () => {
    const state = stateWithCorrectives([
      { index: 1, status: 'not_started', doc_path: C1_HANDOFF },
    ]);
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(C1_HANDOFF);
  });

  it('active corrective (in_progress) → handoff_doc routes to corrective task_handoff.doc_path', () => {
    const state = stateWithCorrectives([
      { index: 1, status: 'in_progress', doc_path: C1_HANDOFF },
    ]);
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(C1_HANDOFF);
  });

  it('multiple correctives, last is active → handoff_doc routes to the last entry', () => {
    const state = stateWithCorrectives([
      { index: 1, status: 'completed', doc_path: C1_HANDOFF },
      { index: 2, status: 'in_progress', doc_path: C2_HANDOFF },
    ]);
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(C2_HANDOFF);
  });

  it('all correctives completed → handoff_doc falls back to original task_handoff', () => {
    const state = stateWithCorrectives([
      { index: 1, status: 'completed', doc_path: C1_HANDOFF },
      { index: 2, status: 'completed', doc_path: C2_HANDOFF },
    ]);
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(ORIG_HANDOFF);
  });
});

// ── [Iter 11] phase-scope corrective enrichment routing ─────────────────────
//
// Phase-scope-first detection: when an active phase-scope corrective exists
// on `phaseIter.corrective_tasks`, enrichment routes `handoff_doc` /
// `head_sha` / `is_correction` / `corrective_index` to that entry BEFORE
// checking task-scope correctives. Also overrides `task_number` to null and
// `task_id` to `${phase_id}-PHASE` on TASK_LEVEL_ACTIONS base context.

describe('enrichActionContext — Iter 11 phase-scope corrective routing', () => {
  const PHASE_C1_HANDOFF = 'tasks/X-P01-PHASE-C1.md';
  const PHASE_C2_HANDOFF = 'tasks/X-P01-PHASE-C2.md';
  const ORIG_TASK_HANDOFF = 'tasks/original-P01-T01.md';

  /**
   * Build a state where phaseIter has a phase-scope corrective whose status +
   * doc path + commit_hash are controllable. The underlying taskIter is
   * present (with its own original task_handoff) so fall-through behaviour
   * is observable.
   */
  function statePhaseCorrective(opts: {
    phaseCorrectives: Array<{
      index: number;
      status: 'not_started' | 'in_progress' | 'completed';
      doc_path: string;
      commit_hash?: string | null;
    }>;
    taskCorrectives?: Array<{
      index: number;
      status: 'not_started' | 'in_progress' | 'completed';
      doc_path: string;
    }>;
  }): PipelineState {
    const state = createScaffoldedState();
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations = [
      {
        index: 0,
        status: 'in_progress',
        nodes: {
          task_loop: {
            kind: 'for_each_task',
            status: 'in_progress',
            iterations: [
              {
                index: 0,
                status: 'in_progress',
                nodes: {},
                corrective_tasks: (opts.taskCorrectives ?? []).map(c => ({
                  index: c.index,
                  reason: 'changes_requested',
                  injected_after: 'code_review',
                  status: c.status,
                  nodes: {},
                  doc_path: c.doc_path,
                  commit_hash: null,
                })),
                doc_path: ORIG_TASK_HANDOFF,
                commit_hash: 'task_base_commit',
              },
            ],
          } as ForEachTaskNodeState,
        },
        corrective_tasks: opts.phaseCorrectives.map(c => ({
          index: c.index,
          reason: 'Phase review requested changes',
          injected_after: 'phase_review',
          status: c.status,
          nodes: {},
          doc_path: c.doc_path,
          commit_hash: c.commit_hash ?? null,
        })),
        commit_hash: null,
      },
    ];
    return state;
  }

  it('execute_task: active phase-scope corrective → handoff_doc routes to phase corrective task_handoff.doc_path', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'not_started', doc_path: PHASE_C1_HANDOFF }],
    });
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(PHASE_C1_HANDOFF);
  });

  it('execute_task: active phase-scope corrective wins over active task-scope corrective (phase-scope-first)', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'in_progress', doc_path: PHASE_C1_HANDOFF }],
      taskCorrectives: [{ index: 1, status: 'in_progress', doc_path: 'tasks/task-scope-C1.md' }],
    });
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(PHASE_C1_HANDOFF);
  });

  it('execute_task: multiple phase correctives, last is active → routes to last', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [
        { index: 1, status: 'completed', doc_path: PHASE_C1_HANDOFF },
        { index: 2, status: 'in_progress', doc_path: PHASE_C2_HANDOFF },
      ],
    });
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.handoff_doc).toBe(PHASE_C2_HANDOFF);
  });

  it('execute_task: all phase correctives completed → falls through to task-scope routing', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [
        { index: 1, status: 'completed', doc_path: PHASE_C1_HANDOFF },
        { index: 2, status: 'completed', doc_path: PHASE_C2_HANDOFF },
      ],
    });
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    // Falls through to task-scope → original task_handoff (no active task
    // corrective).
    expect(result.handoff_doc).toBe(ORIG_TASK_HANDOFF);
  });

  it('spawn_code_reviewer: active phase-scope corrective → head_sha from phase corrective commit_hash + is_correction + corrective_index', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'in_progress', doc_path: PHASE_C1_HANDOFF, commit_hash: 'phase_c1_sha' }],
    });
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.head_sha).toBe('phase_c1_sha');
    expect(result.is_correction).toBe(true);
    expect(result.corrective_index).toBe(1);
  });

  it('spawn_code_reviewer: phase-scope corrective wins over task-scope corrective', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'in_progress', doc_path: PHASE_C1_HANDOFF, commit_hash: 'phase_c1_sha' }],
      taskCorrectives: [{ index: 1, status: 'in_progress', doc_path: 'tasks/task-scope-C1.md' }],
    });
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.head_sha).toBe('phase_c1_sha');
    expect(result.corrective_index).toBe(1);
  });

  it('spawn_code_reviewer: corrective_index tracks phase corrective count', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [
        { index: 1, status: 'completed', doc_path: PHASE_C1_HANDOFF, commit_hash: 'sha1' },
        { index: 2, status: 'in_progress', doc_path: PHASE_C2_HANDOFF, commit_hash: 'sha2' },
      ],
    });
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.corrective_index).toBe(2);
    expect(result.head_sha).toBe('sha2');
  });

  it('TASK_LEVEL_ACTIONS base context: task_number → null and task_id → ${phase_id}-PHASE when phase-scope corrective is active', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'in_progress', doc_path: PHASE_C1_HANDOFF }],
    });
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.task_number).toBeNull();
    expect(result.task_id).toBe('P01-PHASE');
  });

  it('TASK_LEVEL_ACTIONS base context: sentinel applies to spawn_code_reviewer too', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'in_progress', doc_path: PHASE_C1_HANDOFF, commit_hash: 'sha' }],
    });
    const result = enrichActionContext({
      action: 'spawn_code_reviewer',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    expect(result.task_number).toBeNull();
    expect(result.task_id).toBe('P01-PHASE');
  });

  it('TASK_LEVEL_ACTIONS base context: sentinel does NOT apply when phase corrective is completed (falls through to regular task-scope)', () => {
    const state = statePhaseCorrective({
      phaseCorrectives: [{ index: 1, status: 'completed', doc_path: PHASE_C1_HANDOFF }],
    });
    const result = enrichActionContext({
      action: 'execute_task',
      walkerContext: {},
      state,
      config,
      cliContext: {},
    });
    // No active phase corrective → regular task_id.
    expect(result.task_id).toBe('P01-T01');
    expect(result.task_number).toBe(1);
  });
});
