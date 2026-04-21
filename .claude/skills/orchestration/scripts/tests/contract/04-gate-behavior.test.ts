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
  driveTaskWith,
  codeReviewDoc,
  phaseReviewDoc,
} from '../fixtures/parity-states.js';
import type {
  StepNodeState,
  GateNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
} from '../../lib/types.js';
import type { MockIO } from '../fixtures/parity-states.js';

// ── Global setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Shared config factories ───────────────────────────────────────────────────

const NO_SC = { auto_commit: 'never' as const, auto_pr: 'never' as const };

function autonomousConfig() {
  return createConfig({
    human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
    source_control: NO_SC,
  });
}

function phaseConfig() {
  return createConfig({
    human_gates: { after_planning: true, execution_mode: 'phase', after_final_review: true },
    source_control: NO_SC,
  });
}

function taskConfig() {
  return createConfig({
    human_gates: { after_planning: true, execution_mode: 'task', after_final_review: true },
    source_control: NO_SC,
  });
}

function askConfig() {
  return createConfig({
    human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
    source_control: NO_SC,
  });
}

// ── Drive helpers ─────────────────────────────────────────────────────────────
//
// Post-Iter 7: phase_planning + task_handoff are pre-seeded by
// driveToExecutionWithConfig (Iter 5 explosion-script behavior). No per-phase /
// per-task authoring events need to be driven by tests.

/** Drives a task through to code_review_completed with the given verdict. */
function driveTaskToCodeReview(io: MockIO, phase: number, task: number, verdict: string) {
  processEvent('execution_started', PROJECT_DIR, { phase, task }, io);
  processEvent('task_completed', PROJECT_DIR, { phase, task }, io);
  processEvent('code_review_started', PROJECT_DIR, { phase, task }, io);
  seedDoc(codeReviewDoc(phase, task));
  return processEvent('code_review_completed', PROJECT_DIR, {
    phase, task, doc_path: codeReviewDoc(phase, task), verdict,
  }, io);
}

/** Drives phase review through to phase_review_completed with the given verdict. */
function driveToPhaseReviewCompleted(io: MockIO, verdict: string) {
  processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
  seedDoc(phaseReviewDoc(1));
  return processEvent('phase_review_completed', PROJECT_DIR, {
    phase: 1, doc_path: phaseReviewDoc(1), verdict, exit_criteria_met: true,
  }, io);
}

/** Returns the task_gate state for the given (phase, task) iteration. */
function getTaskGateState(io: MockIO, phase: number, task: number): GateNodeState {
  const s = io.currentState!;
  const phaseLoop = s.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  const taskLoop = phaseLoop.iterations[phase - 1].nodes['task_loop'] as ForEachTaskNodeState;
  return taskLoop.iterations[task - 1].nodes['task_gate'] as GateNodeState;
}

/** Returns the phase_gate state for the given phase iteration. */
function getPhaseGateState(io: MockIO, phase: number): GateNodeState {
  const s = io.currentState!;
  const phaseLoop = s.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
  return phaseLoop.iterations[phase - 1].nodes['phase_gate'] as GateNodeState;
}

// ── [CONTRACT] Autonomous mode × task gate ────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Autonomous mode, task gate', () => {

  it('auto-approves when code_review verdict = "approved"', () => {
    // Single-task phase so task_gate auto-approval advances directly to spawn_phase_reviewer (post-Iter 8).
    const io = driveToExecutionWithConfig(autonomousConfig(), 1, 1);
    const result = driveTaskToCodeReview(io, 1, 1, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_task');
    expect(result.action).toBe('spawn_phase_reviewer');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });

  it('unrecognized verdict rejected at validator stage (code_review_completed with "approve")', () => {
    // Iter-10 Copilot R3 hardening: verdict rule now validates the enum
    // exactly. Typos like "approve" are caught as structured frontmatter
    // errors before reaching the mutation — earlier + more actionable than
    // the prior mutation-level unknown-verdict halt.
    const io = driveToExecutionWithConfig(autonomousConfig(), 1, 1);
    const result = driveTaskToCodeReview(io, 1, 1, 'approve');

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('verdict');
    expect(result.error?.event).toBe('code_review_completed');
    // Graph does not halt — validator rejection is recoverable.
    expect(io.currentState!.graph.status).not.toBe('halted');
  });
});

// ── [CONTRACT] Autonomous mode × phase gate ───────────────────────────────────

describe('[CONTRACT] Gate Behavior — Autonomous mode, phase gate', () => {

  it('auto-approves when phase_review verdict = "approved"', () => {
    const io = driveToExecutionWithConfig(autonomousConfig(), 1, 1);
    // driveTaskWith uses verdict='approved' → task gate auto-approves (autonomous)
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_phase');

    const gate = getPhaseGateState(io, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });

  it('unrecognized verdict rejected at pre-read boundary (phase_review_completed with "approve")', () => {
    // Iter 11: the phase_review verdict rule now validates the exact enum at
    // the pre-read boundary (parallels iter-10 code_review change). A typo
    // no longer slips through to the mutation's unknown-verdict halt — it
    // surfaces as a structured frontmatter error instead.
    const io = driveToExecutionWithConfig(autonomousConfig(), 1, 1);
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approve');

    expect(result.success).toBe(false);
    expect(result.error?.field).toBe('verdict');
    expect(result.error?.event).toBe('phase_review_completed');
    // Graph does not halt — validator rejection is recoverable.
    expect(io.currentState!.graph.status).not.toBe('halted');
  });
});

// ── [CONTRACT] Phase mode gates ───────────────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Phase mode', () => {

  it('task gate auto-approves unconditionally ("phase" in auto_approve_modes: [phase])', () => {
    const io = driveToExecutionWithConfig(phaseConfig(), 1);
    // verdict is irrelevant — phase mode unconditionally auto-approves task gate
    const result = driveTaskToCodeReview(io, 1, 1, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });

  it('phase gate fires ("phase" not in auto_approve_modes: [])', () => {
    const io = driveToExecutionWithConfig(phaseConfig(), 1, 1);
    // In phase mode task gate auto-approves — driveTaskWith handles either case
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');

    const gate = getPhaseGateState(io, 1);
    expect(gate.gate_active).toBe(true);
  });
});

// ── [CONTRACT] Task mode gates ────────────────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Task mode', () => {

  it('task gate fires ("task" not in auto_approve_modes: [phase])', () => {
    const io = driveToExecutionWithConfig(taskConfig(), 1);
    const result = driveTaskToCodeReview(io, 1, 1, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(true);
  });

  it('phase gate fires ("task" not in auto_approve_modes: [])', () => {
    const io = driveToExecutionWithConfig(taskConfig(), 1, 1);
    // In task mode, task gate fires — driveTaskWith approves it
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');
  });
});

// ── [CONTRACT] Ask mode gates ─────────────────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Ask mode', () => {

  it('returns ask_gate_mode when execution_mode is ask and pipeline.gate_mode is null', () => {
    // ask mode + pipeline.gate_mode=null → walker returns ask_gate_mode before activating gate
    const io = driveToExecutionWithConfig(askConfig(), 1);
    const result = driveTaskToCodeReview(io, 1, 1, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).toBe('ask_gate_mode');

    // Gate was NOT activated — ask_gate_mode fires before gate evaluation
    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('not_started');
  });
});

// ── [CONTRACT] Human gate — request_plan_approval fires regardless of execution_mode ─────

describe('[CONTRACT] Gate Behavior — Human gate (plan_approval_gate)', () => {

  /** Drives to just past master_plan_completed so the plan_approval_gate is reached. */
  function driveToPlanGate(executionMode: string) {
    const cfg = createConfig({
      human_gates: { after_planning: true, execution_mode: executionMode, after_final_review: true },
      source_control: NO_SC,
    });
    const io = createMockIOWithConfig(null, cfg);
    processEvent('start', PROJECT_DIR, {}, io);
    // Directly complete all planning nodes on the live state reference
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc);
    // master_plan_completed fires the walker which reaches plan_approval_gate
    return processEvent('master_plan_completed', PROJECT_DIR, { doc_path: mpDoc }, io);
  }

  for (const mode of ['autonomous', 'phase', 'task', 'ask']) {
    it(`request_plan_approval fires regardless of execution_mode = "${mode}"`, () => {
      const result = driveToPlanGate(mode);
      expect(result.success).toBe(true);
      expect(result.action).toBe('request_plan_approval');
    });
  }
});

// ── [CONTRACT] Gate mode precedence ──────────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Gate mode precedence', () => {

  it('pipeline.gate_mode="phase" overrides config execution_mode="task" → task gate auto-approves', () => {
    // pipeline.gate_mode is the runtime persisted choice (set by gate_mode_set mutation)
    // when pipeline.gate_mode = 'phase', effectiveMode = 'phase' regardless of config
    // task_gate.auto_approve_modes = ['phase'] → includes 'phase' → unconditional auto-approve
    const io = driveToExecutionWithConfig(taskConfig(), 1);

    // Override pipeline.gate_mode to simulate operator having chosen 'phase' mode
    io.currentState!.pipeline.gate_mode = 'phase';

    const result = driveTaskToCodeReview(io, 1, 1, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });
});
