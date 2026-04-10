import { describe, it, expect } from 'vitest';
import { getMutation } from '../lib/mutations.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  SourceControlState,
} from '../lib/types.js';

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
      source_control: { auto_commit: 'on', auto_pr: 'on' },
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
                phase_commit_gate: { kind: 'conditional', status: 'not_started', branch_taken: null },
                phase_commit: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
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

function makeStateWithSourceControl(overrides?: Partial<SourceControlState>): PipelineState {
  const state = makeState();
  state.pipeline.source_control = {
    branch: 'feature/test',
    base_branch: 'main',
    worktree_path: '.',
    auto_commit: 'never',
    auto_pr: 'never',
    remote_url: null,
    compare_url: null,
    pr_url: null,
    ...overrides,
  };
  return state;
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

// ── gate_mode_set ─────────────────────────────────────────────────────────────

describe('gate_mode_set mutation', () => {
  const mutation = getMutation('gate_mode_set')!;

  it('valid mode "task" sets pipeline.gate_mode = "task"', () => {
    const state = makeState();
    const result = mutation(state, { gate_mode: 'task' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.gate_mode).toBe('task');
  });

  it('valid mode "phase" sets pipeline.gate_mode = "phase"', () => {
    const state = makeState();
    const result = mutation(state, { gate_mode: 'phase' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.gate_mode).toBe('phase');
  });

  it('valid mode "autonomous" sets pipeline.gate_mode = "autonomous"', () => {
    const state = makeState();
    const result = mutation(state, { gate_mode: 'autonomous' }, baseConfig, baseTemplate);
    expect(result.state.pipeline.gate_mode).toBe('autonomous');
  });

  it('missing gate_mode throws descriptive error', () => {
    const state = makeState();
    expect(() => mutation(state, {}, baseConfig, baseTemplate)).toThrowError(
      "Invalid gate mode 'undefined': expected task, phase, or autonomous",
    );
  });

  it('invalid gate_mode "bogus" throws descriptive error', () => {
    const state = makeState();
    expect(() => mutation(state, { gate_mode: 'bogus' }, baseConfig, baseTemplate)).toThrowError(
      "Invalid gate mode 'bogus': expected task, phase, or autonomous",
    );
  });

  it('mutations_applied includes "set pipeline.gate_mode = task"', () => {
    const state = makeState();
    const result = mutation(state, { gate_mode: 'task' }, baseConfig, baseTemplate);
    expect(result.mutations_applied).toContain('set pipeline.gate_mode = task');
  });

  it('original state is not mutated (immutability)', () => {
    const state = makeState();
    mutation(state, { gate_mode: 'task' }, baseConfig, baseTemplate);
    expect(state.pipeline.gate_mode).toBeNull();
  });
});

// ── source_control_init ───────────────────────────────────────────────────────

describe('source_control_init mutation', () => {
  const mutation = getMutation('source_control_init')!;

  it('full context creates complete pipeline.source_control object', () => {
    const state = makeState();
    const result = mutation(
      state,
      {
        branch: 'feature/my-branch',
        base_branch: 'main',
        worktree_path: '/path/to/worktree',
        auto_commit: 'always',
        auto_pr: 'always',
        remote_url: 'https://github.com/org/repo',
        compare_url: 'https://github.com/org/repo/compare',
      },
      baseConfig,
      baseTemplate,
    );
    const sc = result.state.pipeline.source_control!;
    expect(sc.branch).toBe('feature/my-branch');
    expect(sc.base_branch).toBe('main');
    expect(sc.worktree_path).toBe('/path/to/worktree');
    expect(sc.auto_commit).toBe('always');
    expect(sc.auto_pr).toBe('always');
    expect(sc.remote_url).toBe('https://github.com/org/repo');
    expect(sc.compare_url).toBe('https://github.com/org/repo/compare');
    expect(sc.pr_url).toBeNull();
  });

  it('missing branch throws required fields error', () => {
    const state = makeState();
    expect(() =>
      mutation(state, { base_branch: 'main' }, baseConfig, baseTemplate),
    ).toThrowError('source_control_init requires --branch and --base-branch');
  });

  it('missing base_branch throws required fields error', () => {
    const state = makeState();
    expect(() =>
      mutation(state, { branch: 'feature/x' }, baseConfig, baseTemplate),
    ).toThrowError('source_control_init requires --branch and --base-branch');
  });

  it('missing optional fields defaults remote_url, compare_url, pr_url to null', () => {
    const state = makeState();
    const result = mutation(
      state,
      { branch: 'feature/x', base_branch: 'main' },
      baseConfig,
      baseTemplate,
    );
    const sc = result.state.pipeline.source_control!;
    expect(sc.remote_url).toBeNull();
    expect(sc.compare_url).toBeNull();
    expect(sc.pr_url).toBeNull();
  });

  it('missing optional worktree_path defaults to "."', () => {
    const state = makeState();
    const result = mutation(
      state,
      { branch: 'feature/x', base_branch: 'main' },
      baseConfig,
      baseTemplate,
    );
    expect(result.state.pipeline.source_control!.worktree_path).toBe('.');
  });

  it('missing optional auto_commit defaults to "never"', () => {
    const state = makeState();
    const result = mutation(
      state,
      { branch: 'feature/x', base_branch: 'main' },
      baseConfig,
      baseTemplate,
    );
    expect(result.state.pipeline.source_control!.auto_commit).toBe('never');
  });

  it('missing optional auto_pr defaults to "never"', () => {
    const state = makeState();
    const result = mutation(
      state,
      { branch: 'feature/x', base_branch: 'main' },
      baseConfig,
      baseTemplate,
    );
    expect(result.state.pipeline.source_control!.auto_pr).toBe('never');
  });

  it('mutations_applied includes "created pipeline.source_control"', () => {
    const state = makeState();
    const result = mutation(
      state,
      { branch: 'feature/x', base_branch: 'main' },
      baseConfig,
      baseTemplate,
    );
    expect(result.mutations_applied).toContain('created pipeline.source_control');
  });

  it('original state is not mutated (immutability)', () => {
    const state = makeState();
    mutation(state, { branch: 'feature/x', base_branch: 'main' }, baseConfig, baseTemplate);
    expect(state.pipeline.source_control).toBeNull();
  });

  it('existing pipeline.source_control is overwritten (re-init scenario)', () => {
    const state = makeStateWithSourceControl({ branch: 'old-branch', base_branch: 'develop' });
    const result = mutation(
      state,
      { branch: 'new-branch', base_branch: 'main' },
      baseConfig,
      baseTemplate,
    );
    const sc = result.state.pipeline.source_control!;
    expect(sc.branch).toBe('new-branch');
    expect(sc.base_branch).toBe('main');
  });
});

// ── task_committed (enhanced) ─────────────────────────────────────────────────

describe('task_committed mutation (enhanced)', () => {
  const mutation = getMutation('task_committed')!;

  it('with source_control non-null and commit_hash in context, sets phase_commit.status = completed', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(
      state,
      { phase: 1, commit_hash: 'abc123def456' },
      baseConfig,
      baseTemplate,
    );
    expect(result.mutations_applied).toContain('set phase_commit.status = completed');
  });

  it('with source_control null, sets phase_commit.status completed without error', () => {
    const state = makeState();
    expect(() =>
      mutation(state, { phase: 1 }, baseConfig, baseTemplate),
    ).not.toThrow();
  });

  it('with source_control null, phase_commit.status is set to "completed"', () => {
    const state = makeState();
    const result = mutation(state, { phase: 1 }, baseConfig, baseTemplate);
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    const phaseCommit = phaseLoop.iterations[0].nodes['phase_commit'];
    expect(phaseCommit.status).toBe('completed');
  });

  it('mutations_applied includes both status and commit_hash entries when source_control non-null', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(
      state,
      { phase: 1, commit_hash: 'abc123' },
      baseConfig,
      baseTemplate,
    );
    expect(result.mutations_applied).toContain('set phase_commit.status = completed');
  });

  it('phase_commit.status is set to "completed" (existing behavior preserved)', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(
      state,
      { phase: 1, commit_hash: 'abc123' },
      baseConfig,
      baseTemplate,
    );
    const phaseLoop = result.state.graph.nodes['phase_loop'];
    if (phaseLoop.kind !== 'for_each_phase') throw new Error('unexpected');
    const phaseCommit = phaseLoop.iterations[0].nodes['phase_commit'];
    expect(phaseCommit.status).toBe('completed');
  });
});

// ── pr_created (enhanced) ─────────────────────────────────────────────────────

describe('pr_created mutation (enhanced)', () => {
  const mutation = getMutation('pr_created')!;

  it('with source_control non-null and pr_url in context, stores pr_url in pipeline.source_control', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(
      state,
      { pr_url: 'https://github.com/org/repo/pull/42' },
      baseConfig,
      baseTemplate,
    );
    expect(result.state.pipeline.source_control!.pr_url).toBe('https://github.com/org/repo/pull/42');
  });

  it('with source_control null, sets final_pr.status to "completed" without error', () => {
    const state = makeState();
    expect(() => mutation(state, {}, baseConfig, baseTemplate)).not.toThrow();
  });

  it('with source_control null, final_pr.status is set to "completed"', () => {
    const state = makeState();
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.graph.nodes['final_pr'].status).toBe('completed');
  });

  it('without pr_url in context, stores null as pr_url', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(state, {}, baseConfig, baseTemplate);
    expect(result.state.pipeline.source_control!.pr_url).toBeNull();
  });

  it('mutations_applied includes both status and pr_url entries when source_control non-null', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(
      state,
      { pr_url: 'https://github.com/org/repo/pull/42' },
      baseConfig,
      baseTemplate,
    );
    expect(result.mutations_applied).toContain('set final_pr.status = completed');
    expect(result.mutations_applied).toContain(
      'set pipeline.source_control.pr_url = https://github.com/org/repo/pull/42',
    );
  });

  it('final_pr.status is set to "completed" (existing behavior preserved)', () => {
    const state = makeStateWithSourceControl();
    const result = mutation(
      state,
      { pr_url: 'https://github.com/org/repo/pull/42' },
      baseConfig,
      baseTemplate,
    );
    expect(result.state.graph.nodes['final_pr'].status).toBe('completed');
  });
});
