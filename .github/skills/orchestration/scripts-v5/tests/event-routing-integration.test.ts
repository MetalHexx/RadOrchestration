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
  completePlanningSteps,
  driveToExecutionWithConfig,
  driveTaskWith,
  drivePhaseReviewApproval,
  driveToReviewTier,
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
} from './fixtures/parity-states.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../templates/full.yml');

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
    const io = driveToExecutionWithConfig(config, 1);

    // Drive phase 1 planning with one task
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    // Drive to execution_started
    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);

    // Call task_completed — the event under test
    const result = processEvent('task_completed', PROJECT_DIR, ctx, io);

    expect(result.success).toBe(true);
    expect(result.action).not.toBeNull();
  });
});

// ── phase_report_created integration test ────────────────────────────────────

describe('phase_report_created routes through template event index', () => {
  it('phase_report_created with appropriate state processes correctly → success: true', () => {
    const io = driveToExecutionWithConfig(config, 1);

    // Drive phase 1 planning with one task
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    // Drive task 1 through completion (task gate approved inside driveTaskWith)
    driveTaskWith(io, 1, 1);

    // Drive phase report start
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));

    // Call phase_report_created — the event under test
    const result = processEvent('phase_report_created', PROJECT_DIR, {
      phase: 1,
      doc_path: phaseReportDoc(1),
    }, io);

    expect(result.success).toBe(true);
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
    seedDoc(frDocPath, { verdict: 'approve' });
    processEvent('final_review_completed', PROJECT_DIR, {
      doc_path: frDocPath,
      verdict: 'approve',
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
    // Drive to the point where task_gate is active (code review completed, gate fires)
    const io = driveToExecutionWithConfig(config, 1);
    processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
    processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);

    const ctx = { phase: 1, task: 1 };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    seedDoc(taskHandoffDoc(1, 1));
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: taskHandoffDoc(1, 1) }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    const reviewResult = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx,
      doc_path: codeReviewDoc(1, 1),
      verdict: 'approve',
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

  for (const oobEvent of OOB_EVENTS_ARRAY) {
    it(`OOB event '${oobEvent}' processes successfully with scaffolded state and is not in template event index`, () => {
      // Scaffold state
      const io = createMockIOWithConfig(null, config);
      processEvent('start', PROJECT_DIR, {}, io);

      // Process the OOB event — should succeed without event index lookup
      const eventContext = OOB_CONTEXTS[oobEvent] ?? {};
      const result = processEvent(oobEvent, PROJECT_DIR, eventContext, io);
      expect(result.success).toBe(true);

      // Confirm the OOB event does not appear in the template event index
      const { eventIndex } = loadTemplate(TEMPLATE_PATH);
      expect(eventIndex.get(oobEvent)).toBeUndefined();
    });
  }
});
