import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  taskHandoffDoc,
  codeReviewDoc,
} from '../fixtures/parity-states.js';
import { StepNodeState } from '../../lib/types.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  processEvent('research_started', PROJECT_DIR, {}, io);
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

// ── Group 1 — doc_path derivation: state unreadable ──────────────────────────

describe('[CONTRACT] Error shape — doc_path derivation: state unreadable', () => {
  it('returns structured error when state.json does not exist at projectDir', () => {
    const io = driveToApprovalReadiness();
    const result = processEvent('plan_approved', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.action).toBe(null);
    expect(result.error?.message).toBe(
      `Cannot derive master plan path: state.json unreadable at '${PROJECT_DIR}'`,
    );
    expect(result.error?.event).toBe('plan_approved');
    expect(result.error?.field).toBe('doc_path');
    expect(result.mutations_applied).toEqual([]);
  });
});

// ── Group 2 — doc_path derivation: state not valid JSON ──────────────────────

describe('[CONTRACT] Error shape — doc_path derivation: state not valid JSON', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `v5-error-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns structured error when state.json contains invalid JSON', () => {
    writeFileSync(join(tempDir, 'state.json'), 'not-valid-json{');
    const io = driveToApprovalReadiness();
    const result = processEvent('plan_approved', tempDir, {}, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(
      'Cannot derive master plan path: state.json is not valid JSON',
    );
    expect(result.error?.field).toBe('doc_path');
  });
});

// ── Group 3 — doc_path derivation: doc_path not set in state ─────────────────

describe('[CONTRACT] Error shape — doc_path derivation: doc_path not set in state', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `v5-error-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns structured error when state.planning.steps[4].doc_path is missing', () => {
    writeFileSync(
      join(tempDir, 'state.json'),
      JSON.stringify({ planning: { steps: [{}, {}, {}, {}, {}] } }),
    );
    const io = driveToApprovalReadiness();
    const result = processEvent('plan_approved', tempDir, {}, io);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(
      'Cannot derive master plan path: state.planning.steps[4].doc_path is not set',
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
    expect(result.context).toEqual({});
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
