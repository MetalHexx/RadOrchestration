import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createConfig,
  driveToExecutionWithConfig,
  driveTaskWith,
  driveToReviewTier,
  seedDoc,
  DOC_STORE,
  PROJECT_DIR,
  phasePlanDoc,
  phaseReportDoc,
  phaseReviewDoc,
  TASKS_2,
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
  it('context contains phase/task identifiers and forwards branch+worktree_path from CLI context', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approve',
      exit_criteria_met: true,
      branch: 'feature/my-branch',
      worktree_path: '/tmp/worktree',
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

  it('defaults branch and worktree_path to empty string when not in CLI context', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approve',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');
    expect(result.context).toEqual(expect.objectContaining({
      branch: '',
      worktree_path: '',
    }));
  });

  it('multi-task phase: resolves correct phase identifiers and task ref after both tasks complete', () => {
    const io = driveToExecutionWithConfig(commitConfig, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: TASKS_2 });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approve',
      exit_criteria_met: true,
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_commit');
    expect(result.context).toEqual(expect.objectContaining({
      phase_number: 1,
      phase_id: 'P01',
    }));
    expect(typeof result.context.task_number).toBe('number');
    expect(typeof result.context.task_id).toBe('string');
    expect((result.context.task_id as string).length).toBeGreaterThan(0);
  });
});

// ── [CONTRACT] Source Control Flows — invoke_source_control_pr ───────────────

describe('[CONTRACT] Source Control Flows — invoke_source_control_pr', () => {
  it('context contains branch, base_branch, worktree_path forwarded from CLI context', () => {
    const io = driveToReviewTier(prConfig);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    const result = processEvent('final_review_approved', PROJECT_DIR, {
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
    }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');
    expect(result.context).toEqual(expect.objectContaining({
      branch: 'feature/my-branch',
      base_branch: 'main',
      worktree_path: '/tmp/worktree',
    }));
  });

  it('defaults branch, base_branch, and worktree_path to empty string when not in CLI context', () => {
    const io = driveToReviewTier(prConfig);
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/final-review.md';
    seedDoc(frDocPath);
    processEvent('final_review_completed', PROJECT_DIR, { doc_path: frDocPath }, io);
    const result = processEvent('final_review_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('invoke_source_control_pr');
    expect(result.context).toEqual(expect.objectContaining({
      branch: '',
      base_branch: '',
      worktree_path: '',
    }));
  });
});
