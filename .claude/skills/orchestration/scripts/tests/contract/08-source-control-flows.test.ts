import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createConfig,
  driveToExecutionWithConfig,
  driveToReviewTier,
  seedDoc,
  DOC_STORE,
  PROJECT_DIR,
  codeReviewDoc,
} from '../fixtures/parity-states.js';

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared configs ────────────────────────────────────────────────────────────

const commitConfig = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'always' },
});

const prConfig = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'always', auto_pr: 'always' },
});

// ── [CONTRACT] Source Control Flows — invoke_source_control_commit ────────────

describe('[CONTRACT] Source Control Flows — invoke_source_control_commit', () => {
  it('context contains phase/task identifiers and reads branch+worktree_path from state.pipeline.source_control', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    // Initialize source control state via OOB event before driving to commit step
    processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
      auto_commit: 'always',
      auto_pr: 'always',
    }, io);
    // Drive task manually to reach commit_gate at task scope
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
      task_number: 1,
      task_id: 'P01-T01',
      branch: 'feature/my-branch',
      worktree_path: '/tmp/worktree',
    }));
  });

  it('commit_gate surfaces a clear resolution error when state.pipeline.source_control is null (no prior source_control_init)', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    // The drive helper auto-inits source_control for the common path; null it
    // to exercise the negative case where init was skipped.
    io.currentState!.pipeline.source_control = null;
    // Gate now reads state_ref: pipeline.source_control.auto_commit. When
    // commit_gate is first reached (after task_completed advances task_executor
    // to completed), the walker must throw rather than silently defaulting.
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    const result = processEvent('task_completed', PROJECT_DIR, ctx, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/Cannot resolve path 'pipeline\.source_control\.auto_commit'/);
    expect(result.error?.message).toMatch(/segment 'source_control'/);
  });

  it('multi-task phase: resolves correct phase identifiers and task ref on first task commit', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    // Initialize source control state so commit_gate can evaluate (state_ref)
    processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
      auto_commit: 'always',
      auto_pr: 'always',
    }, io);
    // Drive Task 1 manually to capture commit action
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
    expect(result.context.task_number).toBe(1);
    expect(result.context.task_id).toBe('P01-T01');
  });

  it('commit_gate honors state.auto_commit = "never": no invoke_source_control_commit action', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
      auto_commit: 'never',
      auto_pr: 'never',
    }, io);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBe('invoke_source_control_commit');
  });
});

// ── [CONTRACT] Source Control Flows — invoke_source_control_pr ───────────────

describe('[CONTRACT] Source Control Flows — invoke_source_control_pr', () => {
  it('context contains branch, base_branch, worktree_path read from state.pipeline.source_control', () => {
    const io = driveToReviewTier(prConfig);
    // Initialize source control state via OOB event before driving to PR step
    processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
      auto_commit: 'always',
      auto_pr: 'always',
    }, io);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath, { verdict: 'approved' });
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath, verdict: 'approved' }, io);
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');
    expect(result.context).toEqual(expect.objectContaining({
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
    }));
  });

  it('pr_gate surfaces a clear resolution error when state.pipeline.source_control is null (no prior source_control_init)', () => {
    const io = driveToReviewTier(prConfig);
    // The drive helper auto-inits source_control for the common path; null it
    // to exercise the negative case where init was skipped.
    io.currentState!.pipeline.source_control = null;
    // pr_gate reads state_ref: pipeline.source_control.auto_pr. When pr_gate
    // is first reached (after final_review_completed advances the walker past
    // final_review), the walker must throw rather than silently defaulting.
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath, { verdict: 'approved' });
    const result = processEvent(
      'final_review_completed',
      PROJECT_DIR,
      { doc_path: frDocPath, verdict: 'approved' },
      io,
    );
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/Cannot resolve path 'pipeline\.source_control\.auto_pr'/);
    expect(result.error?.message).toMatch(/segment 'source_control'/);
  });

  it('pr_gate honors state.auto_pr = "never": no invoke_source_control_pr action', () => {
    const io = driveToReviewTier(prConfig);
    processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
      auto_commit: 'never',
      auto_pr: 'never',
    }, io);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath, { verdict: 'approved' });
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath, verdict: 'approved' }, io);
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).not.toBe('invoke_source_control_pr');
  });
});
