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
  phasePlanDoc,
  taskHandoffDoc,
  codeReviewDoc,
  phaseReportDoc,
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

/** Drives phase 1 planning with one task. */
function drivePhasePlanning(io: MockIO): void {
  processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
  seedDoc(phasePlanDoc(1), { tasks: [{ id: 'T01', title: 'Task 1' }] });
  processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: phasePlanDoc(1) }, io);
}

/** Drives a task through to code_review_completed with the given verdict. */
function driveTaskToCodeReview(io: MockIO, phase: number, task: number, verdict: string) {
  processEvent('task_handoff_started', PROJECT_DIR, { phase, task }, io);
  seedDoc(taskHandoffDoc(phase, task));
  processEvent('task_handoff_created', PROJECT_DIR, { phase, task, doc_path: taskHandoffDoc(phase, task) }, io);
  processEvent('execution_started', PROJECT_DIR, { phase, task }, io);
  processEvent('task_completed', PROJECT_DIR, { phase, task }, io);
  processEvent('code_review_started', PROJECT_DIR, { phase, task }, io);
  seedDoc(codeReviewDoc(phase, task));
  return processEvent('code_review_completed', PROJECT_DIR, {
    phase, task, doc_path: codeReviewDoc(phase, task), verdict,
  }, io);
}

/** Drives phase report and review through to phase_review_completed with the given verdict. */
function driveToPhaseReviewCompleted(io: MockIO, verdict: string) {
  processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
  seedDoc(phaseReportDoc(1));
  processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
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
    const io = driveToExecutionWithConfig(autonomousConfig(), 1);
    drivePhasePlanning(io);
    const result = driveTaskToCodeReview(io, 1, 1, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_task');
    expect(result.action).toBe('generate_phase_report');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });

  it('gate fires when code_review verdict = "approve" (non-"approved" string)', () => {
    const io = driveToExecutionWithConfig(autonomousConfig(), 1);
    drivePhasePlanning(io);
    const result = driveTaskToCodeReview(io, 1, 1, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(true);
  });
});

// ── [CONTRACT] Autonomous mode × phase gate ───────────────────────────────────

describe('[CONTRACT] Gate Behavior — Autonomous mode, phase gate', () => {

  it('auto-approves when phase_review verdict = "approved"', () => {
    const io = driveToExecutionWithConfig(autonomousConfig(), 1);
    drivePhasePlanning(io);
    // driveTaskWith uses verdict='approve' → task gate fires (autonomous, non-approved) → approves it
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approved');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_phase');

    const gate = getPhaseGateState(io, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });

  it('gate fires when phase_review verdict = "approve" (non-"approved" string)', () => {
    const io = driveToExecutionWithConfig(autonomousConfig(), 1);
    drivePhasePlanning(io);
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');

    const gate = getPhaseGateState(io, 1);
    expect(gate.gate_active).toBe(true);
  });
});

// ── [CONTRACT] Phase mode gates ───────────────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Phase mode', () => {

  it('task gate auto-approves unconditionally ("phase" in auto_approve_modes: [phase])', () => {
    const io = driveToExecutionWithConfig(phaseConfig(), 1);
    drivePhasePlanning(io);
    // verdict is irrelevant — phase mode unconditionally auto-approves task gate
    const result = driveTaskToCodeReview(io, 1, 1, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });

  it('phase gate fires ("phase" not in auto_approve_modes: [])', () => {
    const io = driveToExecutionWithConfig(phaseConfig(), 1);
    drivePhasePlanning(io);
    // In phase mode task gate auto-approves — driveTaskWith handles either case
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approve');

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
    drivePhasePlanning(io);
    const result = driveTaskToCodeReview(io, 1, 1, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(true);
  });

  it('phase gate fires ("task" not in auto_approve_modes: [])', () => {
    const io = driveToExecutionWithConfig(taskConfig(), 1);
    drivePhasePlanning(io);
    // In task mode, task gate fires — driveTaskWith approves it
    driveTaskWith(io, 1, 1);
    const result = driveToPhaseReviewCompleted(io, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_phase');
  });
});

// ── [CONTRACT] Ask mode gates ─────────────────────────────────────────────────

describe('[CONTRACT] Gate Behavior — Ask mode', () => {

  it('task gate fires with gate_task action (v5 divergence: v4 would return ask_gate_mode)', () => {
    // V5 DIVERGENCE: v4 emits 'ask_gate_mode' for ask mode.
    // v5 has no ask_gate_mode emission — ask falls through to the default "show gate" path,
    // returning gate_task (same behavior as task mode).
    const io = driveToExecutionWithConfig(askConfig(), 1);
    drivePhasePlanning(io);
    const result = driveTaskToCodeReview(io, 1, 1, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).toBe('gate_task'); // v5: gate_task (v4: ask_gate_mode)

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(true);
  });

  it.todo('v4 parity: ask mode should emit ask_gate_mode instead of gate_task (v5 divergence, not implemented)');
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
    processEvent('research_started', PROJECT_DIR, {}, io);
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

  it('state.config.gate_mode="phase" overrides config execution_mode="task" → task gate auto-approves', () => {
    // config.execution_mode = 'task' → state.config.gate_mode = 'task' at scaffold time
    // After scaffold, override state.config.gate_mode → 'phase'
    // effectiveMode = state.config.gate_mode = 'phase' (state override takes priority)
    // task_gate.auto_approve_modes = ['phase'] → includes 'phase' → unconditional auto-approve
    const io = driveToExecutionWithConfig(taskConfig(), 1);

    // Override gate_mode directly on the live state — persists via io.writeState mechanism
    io.currentState!.config.gate_mode = 'phase';

    drivePhasePlanning(io);
    const result = driveTaskToCodeReview(io, 1, 1, 'approve');

    expect(result.success).toBe(true);
    expect(result.action).not.toBe('gate_task');

    const gate = getTaskGateState(io, 1, 1);
    expect(gate.gate_active).toBe(false);
    expect(gate.status).toBe('completed');
  });
});
