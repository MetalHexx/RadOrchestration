import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  phaseReviewDoc,
} from '../fixtures/parity-states.js';
import type { StepNodeState, ForEachPhaseNodeState } from '../../lib/types.js';

// ── Clear DOC_STORE between tests ─────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode auto-approves task and phase gates) ─────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
});

// ── Local helpers ──────────────────────────────────────────────────────────────
//
// Post-Iter 7: phase_planning + task_handoff are pre-seeded by
// driveToExecutionWithConfig. Action-context tests for create_task_handoff /
// create_phase_plan are gone — those actions no longer exist. Mutation-side
// corrective coverage remains in mutations-phase-corrective.test.ts.
//
// Post-Iter 8: the Iter-0 `phase_report_created` auto-resolution regression test was deleted alongside the generate_phase_report handler — intentional removal documented in the progression log.

describe('[REGRESSION] Auto-resolution — phase_review_completed changes_requested without phase context', () => {
  // Skipped in Iter 7; Iter 11 rewires corrective cycles via corrective-task-append. See docs/internals/cheaper-execution/iter-11-phase-corrective-cycles.md.
  // Mutation-side auto-resolution is still exercised by mutations-phase-corrective.test.ts; this integration
  // test goes through the full engine and the post-mutation walker now throws (dag-walker.ts:171-179).
  it.skip('injects phase-level corrective entry into the active iteration when phase is omitted', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));

    // Fire phase_review_completed with NO phase in context.
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      doc_path: phaseReviewDoc(1),
      verdict: 'changes_requested',
      exit_criteria_met: false,
    }, io);

    expect(result.success).toBe(true);
    const state = io.currentState!;
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.corrective_tasks).toHaveLength(1);
    expect(phaseIter.corrective_tasks[0].index).toBe(1);
    expect(phaseIter.corrective_tasks[0].injected_after).toBe('phase_review');
    expect(phaseIter.corrective_tasks[0].status).toBe('in_progress');

    // phase_planning was reset for re-planning.
    const phasePlanning = phaseIter.nodes['phase_planning'] as StepNodeState;
    expect(phasePlanning.status).toBe('not_started');
    expect(phasePlanning.doc_path).toBeNull();
  });
});

describe('[REGRESSION] Auto-resolution — phase_review_completed approved without phase context', () => {
  it('marks phase_review completed in the active iteration when phase is omitted', () => {
    const io = driveToExecutionWithConfig(config, 1);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));

    // Fire phase_review_completed with NO phase in context, approved.
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    const state = io.currentState!;
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseReview = phaseLoop.iterations[0].nodes['phase_review'] as StepNodeState;
    expect(phaseReview.status).toBe('completed');
    expect(phaseReview.verdict).toBe('approved');
    expect(phaseReview.doc_path).toBe(phaseReviewDoc(1));
  });
});

// ── [REGRESSION] Actionable error when phase cannot be resolved (PR #50 follow-up) ─

describe('[REGRESSION] phase_review_completed with nonexistent phase throws actionable error', () => {
  it('wraps resolveNodeState failure in a clear "Cannot apply mutation" error naming phase_review and phase', () => {
    const io = driveToExecutionWithConfig(config, 1);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 99,
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/Cannot apply mutation for "phase_review_completed"/);
    expect(result.error?.message).toMatch(/phase_review/);
    expect(result.error?.message).toMatch(/phase 99/);
  });
});
