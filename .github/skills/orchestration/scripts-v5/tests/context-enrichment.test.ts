import { describe, it, expect } from 'vitest';
import { enrichActionContext } from '../lib/context-enrichment.js';
import type { PipelineState, OrchestrationConfig } from '../lib/types.js';
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
    commit_hash: null,
  };
  return state;
}

function stateWithNullSourceControl(): PipelineState {
  const state = createScaffoldedState();
  state.pipeline.source_control = null;
  return state;
}

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
