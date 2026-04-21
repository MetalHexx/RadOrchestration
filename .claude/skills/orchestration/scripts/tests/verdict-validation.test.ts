import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import {
  createMockIOWithConfig,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  seedDoc,
  driveToExecutionWithConfig,
  driveToReviewTier,
  codeReviewDoc,
  phaseReviewDoc,
} from './fixtures/parity-states.js';

// ── Clear DOC_STORE between tests ─────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode, no source control) ────────────────────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'never',
    auto_pr: 'never',
  },
});

// ── Helper: drive state to code_review_started ────────────────────────────────
//
// Post-Iter 7: phase_planning + task_handoff are pre-seeded by
// driveToExecutionWithConfig (Iter 5 explosion-script behavior). This helper
// assumes the io is already positioned at execute_task.

function driveToCodeReview(io: ReturnType<typeof createMockIOWithConfig>): void {
  const ctx = { phase: 1, task: 1 };
  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);
  processEvent('code_review_started', PROJECT_DIR, ctx, io);
  seedDoc(codeReviewDoc(1, 1));
}

// ── Helper: drive state to phase_review_started ───────────────────────────────

function driveToPhaseReview(io: ReturnType<typeof createMockIOWithConfig>): void {
  driveToCodeReview(io);
  const ctx = { phase: 1, task: 1 };
  processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: codeReviewDoc(1, 1),
    verdict: 'approved',
  }, io);

  processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
  seedDoc(phaseReviewDoc(1), { exit_criteria_met: true });
}

// ── Helper: drive state to final_review_started ────────────────────────────────

function driveToFinalReview(): ReturnType<typeof createMockIOWithConfig> {
  const reviewConfig = createConfig({
    human_gates: {
      after_planning: true,
      execution_mode: 'autonomous',
      after_final_review: true,
    },
    source_control: {
      auto_commit: 'never',
      auto_pr: 'never',
    },
  });
  const io = driveToReviewTier(reviewConfig);
  processEvent('final_review_started', PROJECT_DIR, {}, io);
  return io;
}

// ── code_review_completed verdict validation ───────────────────────────────────

describe('code_review_completed — verdict validation', () => {
  // Iter-10 Copilot R3 hardening: the verdict rule now validates the exact
  // enum (approved / changes_requested / rejected) rather than just "defined."
  // Typos no longer slip through to the mutation's unknown-verdict halt —
  // they are caught as structured frontmatter errors at the pre-read boundary.
  it('typo verdict returns a structured frontmatter error (validator-stage rejection)', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToCodeReview(io);

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approvd',
    }, io);

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('verdict');
    expect(result.error?.event).toBe('code_review_completed');
    // Graph does NOT halt — validator rejection is recoverable by the
    // operator (fix the frontmatter typo, re-signal the event).
    expect(io.currentState!.graph.status).not.toBe('halted');
  });

  it('typo verdict does not reach the mutation halt branch', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToCodeReview(io);

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approvd',
    }, io);

    // Old contract: action would be `display_halted` (mutation halted with
    // unknown-verdict reason). New contract: validator rejects upfront so the
    // action is null and halt_reason stays null.
    expect(result.action).not.toBe('display_halted');
    expect(io.currentState!.pipeline.halt_reason).toBeNull();
  });

  it('valid approved verdict does not halt', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToCodeReview(io);

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).not.toBe('halted');
    expect(result.action).not.toBe('display_halted');
  });

  it('valid changes_requested verdict injects corrective task, not halted', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToCodeReview(io);
    // Iter 10 — re-seed the review doc with the mediation contract fields so
    // the pre-read frontmatter validator accepts the changes_requested verdict.
    const correctiveHandoffPath = 'tasks/corrective-P01-T01-C1.md';
    seedDoc(codeReviewDoc(1, 1), {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: correctiveHandoffPath,
    } as Record<string, unknown>, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).not.toBe('halted');
    expect(result.action).not.toBe('display_halted');
  });

  it('valid rejected verdict halts via existing routing, not the guard', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToCodeReview(io);

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'rejected',
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('halted');
    // Iter-10 correction: the rejected-verdict routing branch now sets a
    // descriptive halt_reason for operator consistency with other halt sites.
    expect(io.currentState!.pipeline.halt_reason).toMatch(/rejected verdict|Code review rejected/);
  });

  it('null verdict is rejected at the pre-read boundary', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToCodeReview(io);

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      phase: 1,
      task: 1,
      doc_path: codeReviewDoc(1, 1),
      verdict: null as unknown as string,
    }, io);

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('verdict');
  });
});

// ── phase_review_completed verdict validation ──────────────────────────────────

describe('phase_review_completed — verdict validation', () => {
  // Iter-11 hardening: the phase_review verdict rule now validates the exact
  // enum (approved / changes_requested / rejected) rather than just "defined."
  // Typos no longer slip through to the mutation's unknown-verdict halt —
  // they are caught as structured frontmatter errors at the pre-read boundary.
  // Parallels the iter-10 change for code_review_completed above.
  it('typo verdict returns a structured frontmatter error (validator-stage rejection)', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToPhaseReview(io);
    // Re-seed the review doc with the typo so pre-reads sees it during the
    // frontmatter validation pass.
    seedDoc(phaseReviewDoc(1), { verdict: 'approvd', exit_criteria_met: true });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approvd',
    }, io);

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('verdict');
    expect(result.error?.event).toBe('phase_review_completed');
    // Graph does NOT halt — validator rejection is recoverable by the
    // operator (fix the frontmatter typo, re-signal the event).
    expect(io.currentState!.graph.status).not.toBe('halted');
  });

  it('typo verdict does not reach the mutation halt branch', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToPhaseReview(io);
    seedDoc(phaseReviewDoc(1), { verdict: 'approvd', exit_criteria_met: true });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approvd',
    }, io);

    // Old contract: action would be `display_halted` (mutation halted with
    // unknown-verdict reason). Iter-11 contract: validator rejects upfront so
    // the action is null and halt_reason stays null.
    expect(result.action).not.toBe('display_halted');
    expect(io.currentState!.pipeline.halt_reason).toBeNull();
  });

  it('valid approved verdict does not halt', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToPhaseReview(io);
    seedDoc(phaseReviewDoc(1));

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).not.toBe('halted');
  });

  it('valid rejected verdict halts via existing routing, not the guard', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToPhaseReview(io);
    seedDoc(phaseReviewDoc(1), { verdict: 'rejected', exit_criteria_met: false });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'rejected',
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('halted');
    // Iter-11 correction: the rejected-verdict routing branch now sets a
    // descriptive halt_reason for operator consistency with other halt sites.
    expect(io.currentState!.pipeline.halt_reason).toMatch(/rejected verdict|Phase review rejected/);
  });

  it('null verdict is rejected at the pre-read boundary', () => {
    const io = driveToExecutionWithConfig(config, 1);
    driveToPhaseReview(io);
    // Re-seed with null verdict to ensure frontmatter propagation finds it.
    seedDoc(phaseReviewDoc(1), { exit_criteria_met: true });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: null as unknown as string,
    }, io);

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('verdict');
  });
});

// ── final_review_completed verdict validation ──────────────────────────────────

describe('final_review_completed — verdict validation', () => {
  it('typo verdict halts the pipeline', () => {
    const io = driveToFinalReview();
    const finalReviewDoc = path.posix.join(PROJECT_DIR, 'final-review.md');
    seedDoc(finalReviewDoc);

    const result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: finalReviewDoc,
      verdict: 'approvd',
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('halted');
    expect(io.currentState!.pipeline.halt_reason).toContain('approvd');
    expect(io.currentState!.pipeline.halt_reason).toContain('final_review_completed');
  });

  it('typo verdict returns display_halted action', () => {
    const io = driveToFinalReview();
    const finalReviewDoc = path.posix.join(PROJECT_DIR, 'final-review.md');
    seedDoc(finalReviewDoc);

    const result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: finalReviewDoc,
      verdict: 'approvd',
    }, io);

    expect(result.action).toBe('display_halted');
  });

  it('valid approved verdict does not halt', () => {
    const io = driveToFinalReview();
    const finalReviewDoc = path.posix.join(PROJECT_DIR, 'final-review.md');
    seedDoc(finalReviewDoc);

    const result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: finalReviewDoc,
      verdict: 'approved',
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).not.toBe('halted');
    expect(io.currentState!.pipeline.current_tier).toBe('review');
  });

  it('null verdict does not trigger the guard', () => {
    const io = driveToFinalReview();
    const finalReviewDoc = path.posix.join(PROJECT_DIR, 'final-review.md');
    seedDoc(finalReviewDoc);

    const result = processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: finalReviewDoc,
      verdict: null as unknown as string,
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).not.toBe('halted');
  });
});
