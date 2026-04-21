import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import { validateFrontmatter } from '../../lib/frontmatter-validators.js';
import {
  createMockIOWithConfig,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  completePlanningSteps,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  seedExplosionStateFor,
  codeReviewDoc,
  phaseReviewDoc,
} from '../fixtures/parity-states.js';
import type { StepNodeState } from '../../lib/types.js';

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode auto-approves task gates) ──────────────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
});

// ── Drive helpers ─────────────────────────────────────────────────────────────
//
// Post-Iter 7: phase_planning + task_handoff are pre-seeded by
// driveToExecutionWithConfig (Iter 5 explosion-script behavior). Frontmatter
// validation tests for phase_plan_created are gone — that event no longer
// exists. The validator rule (`tasks` is non-empty array) is enforced at
// explosion time by the parser; covered by parseMasterPlan tests.

/** Returns MockIO positioned for code_review_completed (T1, P1). */
function driveToCodeReview() {
  const io = driveToExecutionWithConfig(config, 1);
  const ctx = { phase: 1, task: 1 };
  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);
  processEvent('code_review_started', PROJECT_DIR, ctx, io);
  return io;
}

/** Returns MockIO positioned for phase_review_completed. */
function driveToPhaseReview() {
  const io = driveToExecutionWithConfig(config, 1);
  driveTaskWith(io, 1, 1);
  driveTaskWith(io, 1, 2);
  processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
  return io;
}

// ── Group 0 (Iter 4): requirement_count (requirements_completed) ─────────────
// Direct validator tests — requirements_completed is not yet routable through
// processEvent (full.yml has no requirements node in its eventIndex). Iter 9
// completes default.yml. Until then, exercise validateFrontmatter directly.

describe('[CONTRACT] Frontmatter — requirement_count (requirements_completed)', () => {
  const docPath = '/tmp/REQ-TEST/REQ-TEST-REQUIREMENTS.md';

  it('valid positive integer passes', () => {
    const err = validateFrontmatter('requirements_completed', { requirement_count: 3 }, docPath);
    expect(err).toBeNull();
  });

  it('missing requirement_count → error', () => {
    const err = validateFrontmatter('requirements_completed', {}, docPath);
    expect(err).not.toBeNull();
    expect(err?.error).toBe('Missing required field');
    expect(err?.field).toBe('requirement_count');
    expect(err?.event).toBe('requirements_completed');
  });

  it('requirement_count: 0 → invalid (positive-integer means > 0)', () => {
    const err = validateFrontmatter('requirements_completed', { requirement_count: 0 }, docPath);
    expect(err).not.toBeNull();
    expect(err?.error).toBe('Invalid value: requirement_count must be a positive integer');
    expect(err?.field).toBe('requirement_count');
  });

  it("requirement_count: 'three' → invalid (not a number)", () => {
    const err = validateFrontmatter('requirements_completed', { requirement_count: 'three' }, docPath);
    expect(err).not.toBeNull();
    expect(err?.error).toBe('Invalid value: requirement_count must be a positive integer');
    expect(err?.field).toBe('requirement_count');
  });
});

// ── Group 2: verdict (code_review_completed) ──────────────────────────────────

describe('[CONTRACT] Frontmatter — verdict (code_review_completed)', () => {
  it('present value passes', () => {
    const io = driveToCodeReview();
    seedDoc(codeReviewDoc(1, 1), { verdict: 'approved' });
    const result = processEvent('code_review_completed', PROJECT_DIR, { phase: 1, task: 1, doc_path: codeReviewDoc(1, 1) }, io);
    expect(result.success).toBe(true);
  });

  it("string 'null' coerced → error", () => {
    const io = driveToCodeReview();
    seedDoc(codeReviewDoc(1, 1), { verdict: 'null' });
    const result = processEvent('code_review_completed', PROJECT_DIR, { phase: 1, task: 1, doc_path: codeReviewDoc(1, 1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
    expect(result.error?.event).toBe('code_review_completed');
  });

  it('missing verdict → error', () => {
    const io = driveToCodeReview();
    seedDoc(codeReviewDoc(1, 1), {});
    const result = processEvent('code_review_completed', PROJECT_DIR, { phase: 1, task: 1, doc_path: codeReviewDoc(1, 1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
  });
});

// ── Group 2b (Iter 10): conditional orchestrator-mediation contract ──────────
//
// Direct validateFrontmatter tests for the three verdict branches × valid /
// invalid orchestrator-field combinations. These exercise the `when` predicate
// the Iter-10 plan introduced — the same predicate is used by the consumer
// loop to skip rules that don't apply to the current frontmatter shape.

describe('[CONTRACT] Frontmatter — code_review_completed orchestrator mediation (Iter 10)', () => {
  const docPath = '/tmp/code-review.md';

  // verdict=approved — mediation fields must be absent
  describe('verdict=approved branch', () => {
    it('approved with no mediation fields → passes', () => {
      const err = validateFrontmatter('code_review_completed', { verdict: 'approved' }, docPath);
      expect(err).toBeNull();
    });

    it('approved with orchestrator_mediated=true → rejected (mediation fields forbidden on raw approved)', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'approved',
        orchestrator_mediated: true,
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('orchestrator_mediated');
      expect(err?.error).toContain('absent');
    });

    it('approved with effective_outcome set → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'approved',
        effective_outcome: 'approved',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('effective_outcome');
      expect(err?.error).toContain('absent');
    });

    it('approved with corrective_handoff_path set → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'approved',
        corrective_handoff_path: 'tasks/ghost-C1.md',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('corrective_handoff_path');
      expect(err?.error).toContain('absent');
    });
  });

  // verdict=rejected — mediation fields must be absent
  describe('verdict=rejected branch', () => {
    it('rejected with no mediation fields → passes', () => {
      const err = validateFrontmatter('code_review_completed', { verdict: 'rejected' }, docPath);
      expect(err).toBeNull();
    });

    it('rejected with orchestrator_mediated=true → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'rejected',
        orchestrator_mediated: true,
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('orchestrator_mediated');
    });
  });

  // verdict=changes_requested — the conditional contract applies
  describe('verdict=changes_requested branch', () => {
    it('fully valid: mediated + effective_outcome=changes_requested + corrective_handoff_path → passes', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
        corrective_handoff_path: 'tasks/X-C1.md',
      }, docPath);
      expect(err).toBeNull();
    });

    it('fully valid: mediated filter-down — effective_outcome=approved + NO handoff path → passes', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'approved',
      }, docPath);
      expect(err).toBeNull();
    });

    it('missing orchestrator_mediated → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        effective_outcome: 'changes_requested',
        corrective_handoff_path: 'tasks/X-C1.md',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('orchestrator_mediated');
      expect(err?.error).toBe('Missing required field');
    });

    it('orchestrator_mediated=false → rejected (must be true)', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: false,
        effective_outcome: 'changes_requested',
        corrective_handoff_path: 'tasks/X-C1.md',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('orchestrator_mediated');
      expect(err?.error).toContain('true');
    });

    it('missing effective_outcome → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('effective_outcome');
      expect(err?.error).toBe('Missing required field');
    });

    it('invalid effective_outcome value (e.g., "rejected") → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'rejected',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('effective_outcome');
    });

    it('effective_outcome=changes_requested with missing corrective_handoff_path → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('corrective_handoff_path');
      expect(err?.error).toBe('Missing required field');
    });

    it('effective_outcome=changes_requested with empty-string corrective_handoff_path → rejected', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'changes_requested',
        corrective_handoff_path: '',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('corrective_handoff_path');
    });

    it('effective_outcome=approved with corrective_handoff_path present → rejected (must be absent)', () => {
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'approved',
        corrective_handoff_path: 'tasks/ghost-C1.md',
      }, docPath);
      expect(err).not.toBeNull();
      expect(err?.field).toBe('corrective_handoff_path');
      expect(err?.error).toContain('absent');
    });
  });

  // `when` predicate — skip-case coverage
  describe('when-predicate skip behavior', () => {
    it('rules gated on verdict=changes_requested do not fire when verdict=approved', () => {
      // An approved review doc that omits every mediation field is valid even
      // though several rules reference those field names — their `when`
      // predicates return false for verdict=approved, so the rules are skipped.
      const err = validateFrontmatter('code_review_completed', { verdict: 'approved' }, docPath);
      expect(err).toBeNull();
    });

    it('rule gated on effective_outcome=changes_requested (handoff-path-required) does not fire on filter-down', () => {
      // verdict=changes_requested + effective_outcome=approved → the
      // "corrective_handoff_path required" rule is gated on
      // effective_outcome=changes_requested and skipped here; no error.
      const err = validateFrontmatter('code_review_completed', {
        verdict: 'changes_requested',
        orchestrator_mediated: true,
        effective_outcome: 'approved',
      }, docPath);
      expect(err).toBeNull();
    });
  });
});

// ── Group 3: verdict (phase_review_completed) ─────────────────────────────────

describe('[CONTRACT] Frontmatter — verdict (phase_review_completed)', () => {
  it('present value passes', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(true);
  });

  it("string 'null' coerced → error", () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'null', exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
  });

  it('missing verdict → error', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('verdict');
  });
});

// ── Group 4: exit_criteria_met (phase_review_completed) ───────────────────────

describe('[CONTRACT] Frontmatter — exit_criteria_met (phase_review_completed)', () => {
  it('present value passes', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: true });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(true);
  });

  it('missing exit_criteria_met → error', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved' });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('exit_criteria_met');
    expect(result.error?.event).toBe('phase_review_completed');
  });

  it('explicit null → error', () => {
    const io = driveToPhaseReview();
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: null });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { phase: 1, doc_path: phaseReviewDoc(1) }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('exit_criteria_met');
  });
});

// ── Group 5: total_phases (plan_approved) ─────────────────────────────────────

describe('[CONTRACT] Frontmatter — total_phases (plan_approved)', () => {
  function scaffoldForPlanApproved() {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    return { io, mpDoc };
  }

  it('valid positive integer passes', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 2, total_tasks: 4 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
    // Post-Iter 7: phase_loop is expanded by the walker on plan_approved, but
    // task_loop resolution requires phase_planning.doc_path (pre-seeded by the
    // explosion script). Seed + re-walk so the walker can advance.
    seedExplosionStateFor(io, 2);
    const afterSeed = processEvent('start', PROJECT_DIR, {}, io);
    expect(afterSeed.action).not.toBeNull();
  });

  it('zero → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 0 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('negative → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: -1 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('string → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 'three' });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('float → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, { total_phases: 3.5 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });

  it('missing → no phases expanded', () => {
    const { io, mpDoc } = scaffoldForPlanApproved();
    seedDoc(mpDoc, {});
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.action).toBeNull();
  });
});

// ── Group 6: total_phases validation error shape (plan_approved) ──────────────

describe('[CONTRACT] Frontmatter — total_phases validation error shape (plan_approved)', () => {
  function scaffoldForPlanApprovedValidation() {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    return { io, mpDoc };
  }

  it('valid total_phases: 1 → success: true', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 3 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
  });

  it('missing total_phases → success: false, structured error', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, {});
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('total_phases');
    expect(result.error?.event).toBe('plan_approved');
  });

  it('total_phases: 0 → success: false, invalid value error', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 0 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Invalid value: total_phases must be a positive integer');
    expect(result.error?.field).toBe('total_phases');
  });

  it('total_phases: "three" → success: false, validation error', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 'three' });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('total_phases');
  });
});

// ── Group 7: total_tasks validation (plan_approved) ───────────────────────────

describe('[CONTRACT] Frontmatter — total_tasks (plan_approved)', () => {
  function scaffoldForPlanApprovedValidation() {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    return { io, mpDoc };
  }

  it('missing total_tasks (only total_phases present) → success: false, missing field error for total_tasks', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 1 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Missing required field');
    expect(result.error?.field).toBe('total_tasks');
    expect(result.error?.event).toBe('plan_approved');
  });

  it('valid total_phases + total_tasks → success: true', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 3 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
  });

  it('total_tasks: 0 → success: false, invalid value error', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 0 });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Invalid value: total_tasks must be a positive integer');
    expect(result.error?.field).toBe('total_tasks');
  });

  it('total_tasks: "three" → success: false, validation error', () => {
    const { io, mpDoc } = scaffoldForPlanApprovedValidation();
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 'three' });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('total_tasks');
  });
});
