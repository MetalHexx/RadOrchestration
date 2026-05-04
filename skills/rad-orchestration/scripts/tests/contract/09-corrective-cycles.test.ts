import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  codeReviewDoc,
  phaseReviewDoc,
} from '../fixtures/parity-states.js';
import type { StepNodeState, ForEachPhaseNodeState, ForEachTaskNodeState } from '../../lib/types.js';

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
  // Iter 11 — un-skipped. The old reset-and-re-plan branch is gone; the new
  // mediation contract births a phase-scope corrective in
  // `phaseIter.corrective_tasks[]` when `effective_outcome=changes_requested`
  // is supplied with a `corrective_handoff_path`. Auto-resolution of `phase`
  // from state still works — the mutation looks up the active iteration.
  it('injects phase-level corrective entry into the active iteration when phase is omitted', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);

    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const correctiveHandoffPath = 'tasks/PHASE-CORRECTIVE-C1.md';
    seedDoc(phaseReviewDoc(1), {
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    });

    // Fire phase_review_completed with NO phase in context.
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      doc_path: phaseReviewDoc(1),
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    const state = io.currentState!;
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    // Iter 11 — phase-scope corrective appended to phaseIter.corrective_tasks.
    expect(phaseIter.corrective_tasks).toHaveLength(1);
    expect(phaseIter.corrective_tasks[0].index).toBe(1);
    expect(phaseIter.corrective_tasks[0].injected_after).toBe('phase_review');
    // Walker promotes not_started → in_progress on entry (corrective-walking
    // logic in dag-walker.ts). The mutation birthed the entry as not_started;
    // the walker sees it and flips status.
    expect(phaseIter.corrective_tasks[0].status).toBe('in_progress');
    // Corrective handoff path stored directly on the entry.
    expect(phaseIter.corrective_tasks[0].doc_path).toBe(correctiveHandoffPath);

    // Iter 11 single-pass clause — phase iteration's doc_path is NOT reset
    // for re-planning (the corrective injects alongside, not in place).
    expect(phaseIter.doc_path).not.toBeNull();
    expect(phaseIter.doc_path).toBeDefined();
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

// ── [ITER 10] Orchestrator mediation — effective_outcome overrides raw verdict ─

describe('[ITER 10] code_review_completed — orchestrator filter-down: approved effective_outcome births no corrective', () => {
  it('raw verdict=changes_requested + effective_outcome=approved → no corrective entry birthed, state records approved', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    // The orchestrator judged all findings as decline — filter-down to approved.
    // Validator contract: verdict=changes_requested + effective_outcome=approved,
    // NO corrective_handoff_path (forbidden when effective_outcome=approved).
    seedDoc(codeReviewDoc(1, 1), {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'approved',
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'approved',
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    // No corrective birthed.
    expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(0);
    // Routing-authoritative state: code_review.verdict records the effective outcome.
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    expect(codeReviewNode.verdict).toBe('approved');
    expect(io.currentState!.graph.status).not.toBe('halted');
  });
});

describe('[ITER 10] code_review_completed — effective_outcome overrides raw verdict in state write', () => {
  it('state.code_review.verdict mirrors effective_outcome, not the reviewer raw verdict', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const correctiveHandoffPath = 'tasks/corrective-P01-T01-C1.md';
    seedDoc(codeReviewDoc(1, 1), {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    // effective_outcome is what hits state — routing-authoritative.
    expect(codeReviewNode.verdict).toBe('changes_requested');
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

// ── [ITER 11] phase_review_completed — orchestrator filter-down: no corrective birthed ─

describe('[ITER 11] phase_review_completed — filter-down: approved effective_outcome births no corrective', () => {
  it('raw verdict=changes_requested + effective_outcome=approved → no corrective entry, state records approved', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1), {
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'approved',
    });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'approved',
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    // No corrective birthed at phase scope.
    expect(phaseIter.corrective_tasks).toHaveLength(0);
    // Routing-authoritative state: phase_review.verdict records the effective
    // outcome, not the reviewer's raw verdict.
    const phaseReviewNode = phaseIter.nodes['phase_review'] as StepNodeState;
    expect(phaseReviewNode.verdict).toBe('approved');
    expect(io.currentState!.graph.status).not.toBe('halted');
  });
});

describe('[ITER 11] phase_review_completed — effective_outcome overrides raw verdict in state write', () => {
  it('state.phase_review.verdict mirrors effective_outcome, not the reviewer raw verdict', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    const correctiveHandoffPath = 'tasks/PHASE-CORRECTIVE-C1.md';
    seedDoc(phaseReviewDoc(1), {
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseReviewNode = phaseLoop.iterations[0].nodes['phase_review'] as StepNodeState;
    // effective_outcome is what hits state — routing-authoritative.
    expect(phaseReviewNode.verdict).toBe('changes_requested');
  });
});

// ── [ITER 11] Ancestor-derivation for corrective-of-corrective routing ───────

describe('[ITER 11] code_review_completed — ancestor-derivation across scope combinations', () => {
  // Task-scope is covered by iter-10 tests elsewhere; these tests pin the
  // NEW phase-scope branches via direct state assembly + engine dispatch.

  it('phase-scope hosting: new corrective appends to phaseIter.corrective_tasks when completed code_review lives under a phase-scope corrective', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveTaskWith(io, 1, 1);

    // Seed: phase_review returned changes_requested → phase-scope corrective
    // birthed at phaseIter.corrective_tasks[0]. The corrective's task-body
    // walk has produced a completed code_review node.
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    phaseIter.corrective_tasks.push({
      index: 1,
      reason: 'Phase review requested changes',
      injected_after: 'phase_review',
      status: 'in_progress',
      nodes: {
        task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/X-P01-PHASE-C1.md', retries: 0 },
        task_executor: { kind: 'step', status: 'completed', doc_path: null, retries: 0 },
        code_review: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 },
        task_gate: { kind: 'gate', status: 'not_started', gate_active: false },
      },
      commit_hash: null,
    });

    // The corrective's task-level code review returns changes_requested →
    // mediation fires → new corrective must append to phaseIter (hosting=phase),
    // NOT to taskIter.
    const reviewDoc = '/reports/CODE-REVIEW-P01-PHASE-C1.md';
    const nextHandoff = 'tasks/X-P01-PHASE-C2.md';
    seedDoc(reviewDoc, {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: nextHandoff,
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: reviewDoc,
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: nextHandoff,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);

    const resultPhaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const resultPhaseIter = resultPhaseLoop.iterations[0];
    const resultTaskLoop = resultPhaseIter.nodes['task_loop'] as ForEachTaskNodeState;
    const resultTaskIter = resultTaskLoop.iterations[0];

    // phaseIter receives the new corrective (hosting=phase → append to phaseIter).
    expect(resultPhaseIter.corrective_tasks).toHaveLength(2);
    expect(resultPhaseIter.corrective_tasks[1].index).toBe(2);
    expect(resultPhaseIter.corrective_tasks[1].doc_path).toBe(nextHandoff);

    // taskIter unchanged — no leakage into task-scope correctives.
    expect(resultTaskIter.corrective_tasks).toHaveLength(0);

    // mutations_applied log carries scope=phase.
    expect(result.mutations_applied?.some(m => /scope=phase/.test(m))).toBe(true);
  });

  it('task-scope hosting: new corrective appends to taskIter.corrective_tasks when no phase-scope corrective is active (iter-10 preserved)', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);

    const handoffPath = 'tasks/task-scope-C1.md';
    seedDoc(codeReviewDoc(1, 1), {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: handoffPath,
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: handoffPath,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);

    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState;

    // taskIter receives the corrective (hosting=task — iter-10 behaviour).
    expect(taskLoop.iterations[0].corrective_tasks).toHaveLength(1);
    // phaseIter untouched.
    expect(phaseIter.corrective_tasks).toHaveLength(0);

    // mutations_applied log carries scope=task.
    expect(result.mutations_applied?.some(m => /scope=task/.test(m))).toBe(true);
  });
});
