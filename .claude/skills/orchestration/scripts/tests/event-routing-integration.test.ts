import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import { OUT_OF_BAND_EVENTS } from '../lib/constants.js';
import { loadTemplate } from '../lib/template-loader.js';
import {
  createMockIOWithConfig,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  driveToReviewTier,
  codeReviewDoc,
  phaseReviewDoc,
} from './fixtures/parity-states.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/full.yml');

// ── Clear DOC_STORE between tests ─────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config (autonomous mode, no source-control side effects) ───────────

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

// ── task_completed integration test ──────────────────────────────────────────

describe('task_completed routes through template event index', () => {
  it('task_completed with in-progress task state processes correctly → success: true, action not null', () => {
    // driveToExecutionWithConfig pre-seeds phase_planning + task_handoff per Iter 5 explosion behavior
    const io = driveToExecutionWithConfig(config, 1);

    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);

    // Call task_completed — the event under test
    const result = processEvent('task_completed', PROJECT_DIR, ctx, io);

    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── code_review_completed (Iter 10 mediation) wiring tests ───────────────────

describe('code_review_completed routes through template event index — Iter 10 mediation', () => {
  it('approved verdict wires through event index → no mediation fields, no corrective', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1), { verdict: 'approved' });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);

    expect(result.success).toBe(true);
    // No corrective birth on approved
    // (detailed corrective shape assertions live in corrective-integration.test.ts)
  });

  it('mediated changes_requested with handoff path wires through → corrective birthed, handoff_doc routes to C1', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);

    const handoffPath = 'tasks/CORRECTIVE-C1.md';
    seedDoc(codeReviewDoc(1, 1), {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: handoffPath,
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('execute_task');
    // Enrichment routes handoff_doc to the birthed corrective's synthesized task_handoff
    expect(result.context['handoff_doc']).toBe(handoffPath);
    // Iter 11: the CODE_REVIEW_COMPLETED mutation's mutations_applied log now
    // includes the derived scope (via `resolveHostingIteration`). On a
    // task-scope corrective birth the log string is
    // `injected corrective task N (changes_requested, scope=task)`.
    expect(result.mutations_applied).toContain('injected corrective task 1 (changes_requested, scope=task)');
  });

  it('mediated filter-down (raw changes_requested + effective approved) wires through → no corrective, state records approved', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);

    seedDoc(codeReviewDoc(1, 1), {
      verdict: 'changes_requested',
      orchestrator_mediated: true,
      effective_outcome: 'approved',
    });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
    }, io);

    expect(result.success).toBe(true);
    expect(result.mutations_applied).toContain('set code_review.verdict = approved');
    // No corrective birth when orchestrator filters down to approved
    expect(result.mutations_applied.some(m => m.startsWith('injected corrective'))).toBe(false);
  });

  it('validator rejects raw changes_requested with missing mediation fields → success: false', () => {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);

    seedDoc(codeReviewDoc(1, 1), { verdict: 'changes_requested' });

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
    }, io);

    expect(result.success).toBe(false);
  });
});

// ── phase_review_completed integration test ─────────────────────────────────
// Post-Iter 8: phase_review absorbed phase_report. The former
// `phase_report_created routes through template event index` smoke is replaced
// by the phase_review_completed event, which is now the sole post-task-loop
// doc-emission event.

describe('phase_review_completed routes through template event index', () => {
  it('phase_review_completed with appropriate state processes correctly → success: true', () => {
    // driveToExecutionWithConfig pre-seeds phase_planning + task_handoff and creates 2 task iterations
    const io = driveToExecutionWithConfig(config, 1, 2);

    // Drive both tasks through completion (task gate approved inside driveTaskWith)
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);

    // Drive phase review start
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));

    // Call phase_review_completed — the event under test
    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
  });
});

// ── phase_review_completed (Iter 11 mediation) wiring tests ─────────────────
//
// Parallel of the iter-10 code_review_completed wiring block above — pins
// the mediation contract flowing through the event index end-to-end.

describe('phase_review_completed routes through template event index — Iter 11 mediation', () => {
  it('approved verdict wires through event index → no mediation fields, no corrective', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1), { verdict: 'approved', exit_criteria_met: true });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
      verdict: 'approved',
      exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
  });

  it('mediated changes_requested with handoff path wires through → phase corrective birthed, handoff_doc routes to PHASE-C1', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);

    const handoffPath = 'tasks/X-TASK-P01-PHASE-C1.md';
    seedDoc(phaseReviewDoc(1), {
      verdict: 'changes_requested',
      exit_criteria_met: false,
      orchestrator_mediated: true,
      effective_outcome: 'changes_requested',
      corrective_handoff_path: handoffPath,
    });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
    }, io);

    expect(result.success).toBe(true);
    // Walker dispatches execute_task after mediation (corrective's synthesized
    // task_handoff is pre-completed).
    expect(result.action).toBe('execute_task');
    // Enrichment routes handoff_doc to the birthed phase corrective's
    // synthesized task_handoff.
    expect(result.context['handoff_doc']).toBe(handoffPath);
    // task_id sentinel is propagated through enrichment.
    expect(result.context['task_id']).toBe('P01-PHASE');
    expect(result.context['task_number']).toBeNull();
    // mutations_applied log shape — injected phase corrective task 1.
    expect(result.mutations_applied).toContain('injected phase corrective task 1 (changes_requested)');
  });

  it('mediated filter-down (raw changes_requested + effective approved) wires through → no phase corrective, state records approved', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);
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
    }, io);

    expect(result.success).toBe(true);
    expect(result.mutations_applied).toContain('set phase_review.verdict = approved');
    expect(result.mutations_applied.some(m => m.startsWith('injected phase corrective'))).toBe(false);
  });

  it('validator rejects raw changes_requested with missing mediation fields → success: false', () => {
    const io = driveToExecutionWithConfig(config, 1, 2);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);

    seedDoc(phaseReviewDoc(1), { verdict: 'changes_requested', exit_criteria_met: false });

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReviewDoc(1),
    }, io);

    expect(result.success).toBe(false);
  });
});

// ── final_approved integration test ──────────────────────────────────────────

describe('final_approved routes through template event index', () => {
  it('final_approved with review-tier state processes correctly → success: true', () => {
    // Position pipeline at the review tier (past all phases + phase gate approval)
    const io = driveToReviewTier(config);

    // Drive final review
    processEvent('final_review_started', PROJECT_DIR, {}, io);
    const frDocPath = '/tmp/test-final-review.md';
    seedDoc(frDocPath, { verdict: 'approved' });
    processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: frDocPath,
      verdict: 'approved',
    }, io);

    // Call final_approved — the event under test
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
  });
});

// ── Routing priority tests ────────────────────────────────────────────────────

describe('routing priority', () => {
  it('start with null state is handled before any other routing category → scaffolds state, success: true, mutations include scaffold_initial_state', () => {
    const io = createMockIOWithConfig(null, config);

    const result = processEvent('start', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(result.mutations_applied).toContain('scaffold_initial_state');
  });

  it('gate_mode_set (OOB event) with scaffolded state is handled via OOB routing before template index → success: true', () => {
    // Scaffold state first
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);

    // OOB event should be handled before template index lookup
    const result = processEvent('gate_mode_set', PROJECT_DIR, { gate_mode: 'task' }, io);

    expect(result.success).toBe(true);
    // Real implementation emits a non-empty mutations_applied array
    expect(result.mutations_applied.length).toBeGreaterThan(0);
  });

  it('gate_approved --gate-type task resolves alias before template index lookup → success: true', () => {
    // Drive to the point where task_gate is active (code review completed, gate fires).
    // driveToExecutionWithConfig pre-seeds phase_planning + task_handoff per Iter 5.
    const io = driveToExecutionWithConfig(config, 1);

    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    const reviewResult = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approved',
    }, io);

    // In autonomous mode the task gate fires after code_review_completed
    if (reviewResult.action === 'gate_task') {
      // Use gate_approved alias instead of task_gate_approved to confirm alias resolution
      const result = processEvent('gate_approved', PROJECT_DIR, { gate_type: 'task', ...ctx }, io);
      expect(result.success).toBe(true);
    } else {
      // Gate did not fire in this config — verify we at least reached the correct tier
      expect(reviewResult.success).toBe(true);
    }
  });

  it('unknown event name that is not start, OOB, or gate_approved returns success: false with context.error containing "Unknown event"', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);  // scaffold state

    const result = processEvent('nonexistent_event', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(String(result.context.error)).toContain('Unknown event');
  });
});

// ── Unknown event error test ──────────────────────────────────────────────────

describe('unknown event error', () => {
  it('totally_fake_event returns success: false with null action and structured error', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io);  // scaffold state

    const result = processEvent('totally_fake_event', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(result.action).toBeNull();
    expect(String(result.context.error)).toContain('Unknown event');
    expect(result.error?.event).toBe('totally_fake_event');
  });
});

// ── OOB events bypass the template event index ────────────────────────────────

describe('OOB events bypass template event index', () => {
  const OOB_EVENTS_ARRAY = Array.from(OUT_OF_BAND_EVENTS);

  // Context required for events that need specific fields to succeed
  const OOB_CONTEXTS: Record<string, Record<string, string>> = {
    gate_mode_set: { gate_mode: 'task' },
    source_control_init: { branch: 'main', base_branch: 'main' },
  };

  // explosion_failed requires the default.yml template (has explode_master_plan node).
  // The smoke-test scaffold uses full.yml (default_template), which does not include
  // that node, so the smoke assertion is handled separately via a dedicated integration
  // test in 06-state-mutations.test.ts (Iter 5 explosion-script mutations suite).
  const SMOKE_SKIP = new Set<string>(['explosion_failed']);
  const OOB_SMOKE_EVENTS = OOB_EVENTS_ARRAY.filter((e) => !SMOKE_SKIP.has(e));

  for (const oobEvent of OOB_SMOKE_EVENTS) {
    it(`OOB event '${oobEvent}' processes successfully with scaffolded state`, () => {
      // Scaffold state
      const io = createMockIOWithConfig(null, config);
      processEvent('start', PROJECT_DIR, {}, io);

      // Process the OOB event — should succeed without event index lookup
      const eventContext = OOB_CONTEXTS[oobEvent] ?? {};
      const result = processEvent(oobEvent, PROJECT_DIR, eventContext, io);
      expect(result.success).toBe(true);
    });
  }

  // gate_mode_set is in OUT_OF_BAND_EVENTS but also appears in the template event index
  // as the approved_event for gate_mode_selection. Both routes work — OOB intercepts first.
  const OOB_NOT_IN_TEMPLATE = OOB_EVENTS_ARRAY.filter(e => e !== 'gate_mode_set');
  for (const oobEvent of OOB_NOT_IN_TEMPLATE) {
    it(`OOB event '${oobEvent}' does not appear in the template event index`, () => {
      const { eventIndex } = loadTemplate(TEMPLATE_PATH);
      expect(eventIndex.get(oobEvent)).toBeUndefined();
    });
  }
});
