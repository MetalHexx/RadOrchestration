import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import {
  createMockIOWithConfig,
  createConfig,
  DOC_STORE,
  PROJECT_DIR,
  completePlanningSteps,
  seedDoc,
  driveToExecutionWithConfig,
  phasePlanDoc,
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

// ── Drive helper: positioned for plan_approved with no real state.json ────────

function driveToApprovalReadiness() {
  const io = createMockIOWithConfig(null, config);
  processEvent('start', PROJECT_DIR, {}, io);
  const state = io.currentState!;
  completePlanningSteps(state, 'master_plan');
  const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
  seedDoc(mpDoc, { total_phases: 1 });
  return io;
}

/** Returns MockIO positioned for phase_plan_created. */
function driveToPhaseCreated() {
  const io = driveToExecutionWithConfig(config, 1);
  processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
  return io;
}

// ── Group 1 — doc_path derivation: state is null (no state.json) ─────────────

describe('[CONTRACT] Error shape — doc_path derivation: state is null', () => {
  it('returns structured error when state is null for non-start event', () => {
    const io = createMockIOWithConfig(null, config);
    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.action).toBe(null);
    expect(result.error?.message).toBe(
      'No state.json found; use --event start',
    );
    expect(result.error?.event).toBe('plan_approved');
    expect(result.mutations_applied).toEqual([]);
  });
});

// ── Group 2 — (removed: invalid-JSON error path was eliminated by passing state from engine) ──

// ── Group 3 — doc_path derivation: doc_path not set in state ─────────────────

describe('[CONTRACT] Error shape — doc_path derivation: doc_path not set in state', () => {
  it('returns structured error when graph.nodes.master_plan.doc_path is missing', () => {
    const io = driveToApprovalReadiness();
    // Clear the master_plan doc_path in the mock state to simulate missing derivation
    (io.currentState!.graph.nodes['master_plan'] as StepNodeState).doc_path = null;
    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(
      'Cannot derive master plan path: graph.nodes.master_plan.doc_path is not set',
    );
    expect(result.error?.field).toBe('doc_path');
  });
});

// ── Group 4 — Full error output shape on validation failure ──────────────────

describe('[CONTRACT] Error shape — validation error structure', () => {
  it('returns all PipelineResult fields on a validation failure', () => {
    const io = driveToPhaseCreated();
    seedDoc(phasePlanDoc(1), { tasks: 'not-an-array' });
    const result = processEvent(
      'phase_plan_created',
      PROJECT_DIR,
      { phase: 1, doc_path: phasePlanDoc(1) },
      io,
    );
    expect(result.success).toBe(false);
    expect(result.action).toBe(null);
    expect(result.error?.message).toBe('Invalid value: tasks must be an array');
    expect(result.error?.event).toBe('phase_plan_created');
    expect(result.error?.field).toBe('tasks');
    expect(typeof result.context.error).toBe('string');
    expect(result.mutations_applied).toEqual([]);
  });
});

// ── Group 5 — Missing doc_path for a _completed event ────────────────────────

describe('[CONTRACT] Error shape — missing doc_path for completed event', () => {
  it('returns structured error when doc_path is omitted for phase_plan_created', () => {
    const io = driveToPhaseCreated();
    const result = processEvent('phase_plan_created', PROJECT_DIR, { phase: 1 }, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(
      "Pre-read failed: missing required field 'doc_path' in event context",
    );
    expect(result.error?.field).toBe('doc_path');
  });
});

// ── Group 6 — Document not found at provided doc_path ────────────────────────

describe('[CONTRACT] Error shape — document not found', () => {
  it('returns structured error when doc at doc_path cannot be read', () => {
    const io = driveToPhaseCreated();
    const result = processEvent(
      'phase_plan_created',
      PROJECT_DIR,
      { phase: 1, doc_path: '/nonexistent/doc.md' },
      io,
    );
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('document not found or unreadable');
    expect(result.error?.field).toBe('doc_path');
  });
});
