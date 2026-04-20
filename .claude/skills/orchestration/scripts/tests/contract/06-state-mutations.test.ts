import { describe, it, expect, beforeEach } from 'vitest';
import { processEvent } from '../../lib/engine.js';
import { getMutation } from '../../lib/mutations.js';
import {
  createMockIO,
  createMockIOWithConfig,
  createConfig,
  DEFAULT_CONFIG,
  DOC_STORE,
  PROJECT_DIR,
  completePlanningSteps,
  seedDoc,
  driveToExecutionWithConfig,
  driveTaskWith,
  codeReviewDoc,
  phaseReportDoc,
  phaseReviewDoc,
} from '../fixtures/parity-states.js';
import type {
  PipelineState,
  PipelineTemplate,
  StepNodeState,
  GateNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
} from '../../lib/types.js';

// ── Clear DOC_STORE between tests ─────────────────────────────────────────────

beforeEach(() => {
  for (const key of Object.keys(DOC_STORE)) {
    delete DOC_STORE[key];
  }
});

// ── Minimal template stub for direct-mutation tests ──────────────────────────
// Used only by Iter-4 requirements mutation tests that bypass processEvent;
// mutations accept the template as a parameter but only the planning-step
// handlers examined here ignore it.
const emptyTemplate: PipelineTemplate = {
  template: { id: 'test-stub', version: '1.0', description: 'direct-mutation stub' },
  nodes: [],
};

function makeStateWithRequirements(reqStatus: 'not_started' | 'in_progress'): PipelineState {
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'REQ-TEST', created: '2026-04-18T00:00:00Z', updated: '2026-04-18T00:00:00Z' },
    config: {
      gate_mode: 'autonomous',
      limits: {
        max_phases: 5,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    },
    pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
    graph: {
      template_id: 'default',
      status: 'in_progress',
      current_node_path: null,
      nodes: {
        requirements: { kind: 'step', status: reqStatus, doc_path: null, retries: 0 },
        master_plan: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
      },
    },
  };
}

// Iter 5 — state factory for explosion-script mutation tests.
// Mirrors the shape of `default.yml` after Iter 5: 4 planning nodes.
function makeStateWithExplosion(opts: {
  masterPlanStatus?: 'not_started' | 'in_progress' | 'completed';
  explodeStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  parseRetryCount?: number;
  lastParseError?: { line: number; expected: string; found: string; message: string } | null;
} = {}): PipelineState {
  const {
    masterPlanStatus = 'completed',
    explodeStatus = 'in_progress',
    parseRetryCount = 0,
    lastParseError = null,
  } = opts;
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'EXPLODE-TEST', created: '2026-04-18T00:00:00Z', updated: '2026-04-18T00:00:00Z' },
    config: {
      gate_mode: 'autonomous',
      limits: {
        max_phases: 5,
        max_tasks_per_phase: 10,
        max_retries_per_task: 3,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    },
    pipeline: { gate_mode: null, source_control: null, current_tier: 'planning', halt_reason: null },
    graph: {
      template_id: 'default',
      status: 'in_progress',
      current_node_path: null,
      nodes: {
        requirements: { kind: 'step', status: 'completed', doc_path: '/tmp/req.md', retries: 0 },
        master_plan: {
          kind: 'step',
          status: masterPlanStatus,
          doc_path: '/tmp/master-plan.md',
          retries: 0,
          last_parse_error: lastParseError,
          parse_retry_count: parseRetryCount,
        },
        explode_master_plan: { kind: 'step', status: explodeStatus, doc_path: null, retries: 0 },
        plan_approval_gate: { kind: 'gate', status: 'not_started', gate_active: false },
      },
    },
  };
}

// ── Shared autonomous config ──────────────────────────────────────────────────

const config = createConfig({
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: { auto_commit: 'never', auto_pr: 'never' },
});

// ── [CONTRACT] State Mutations — Planning step mutations ──────────────────────

describe('[CONTRACT] State Mutations — Planning step mutations', () => {
  it('master_plan_started: master_plan.status=in_progress and graph.status NOT re-flipped', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io); // scaffold
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io); // standard route applies mutation

    expect(result.success).toBe(true);
    const mpNode = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.status).toBe('in_progress');
    expect(io.currentState!.graph.status).toBe('in_progress');
    expect(result.mutations_applied.some((m) => m.includes('master_plan') && m.includes('in_progress'))).toBe(true);
    // Iter 4 relocated the graph.status hook from master_plan_started → requirements_started
    expect(result.mutations_applied.some((m) => m.includes('graph.status'))).toBe(false);
  });

  // Requirements events are not yet routable through processEvent (full.yml has
  // no requirements node in its eventIndex); Iter 9 completes default.yml. Until
  // then, exercise the mutation registry directly — the mutation registration is
  // what this contract covers.
  it('requirements_started: requirements.status=in_progress, graph.status flipped to in_progress', () => {
    const state = makeStateWithRequirements('not_started');
    state.graph.status = 'not_started';

    const mutation = getMutation('requirements_started')!;
    expect(mutation).toBeTypeOf('function');
    const result = mutation(state, {}, DEFAULT_CONFIG, emptyTemplate);

    const reqNode = result.state.graph.nodes['requirements'] as StepNodeState;
    expect(reqNode.status).toBe('in_progress');
    expect(result.state.graph.status).toBe('in_progress');
    expect(result.mutations_applied.some((m) => m.includes('requirements') && m.includes('in_progress'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('graph.status'))).toBe(true);
  });

  it('master_plan_started after requirements_started: no graph.status mutation entry (relocated)', () => {
    const state = makeStateWithRequirements('in_progress');
    state.graph.status = 'in_progress';

    const mutation = getMutation('master_plan_started')!;
    const result = mutation(state, {}, DEFAULT_CONFIG, emptyTemplate);

    // master_plan_started no longer logs a graph.status mutation — the hook relocated to requirements_started
    expect(result.mutations_applied.some((m) => m.includes('graph.status'))).toBe(false);
    // And graph.status stays in_progress (no regression)
    expect(result.state.graph.status).toBe('in_progress');
  });

  it('requirements_completed: requirements.status=completed and doc_path set', () => {
    const state = makeStateWithRequirements('in_progress');
    const docPath = '/tmp/requirements-doc.md';

    const mutation = getMutation('requirements_completed')!;
    const result = mutation(state, { doc_path: docPath }, DEFAULT_CONFIG, emptyTemplate);

    const reqNode = result.state.graph.nodes['requirements'] as StepNodeState;
    expect(reqNode.status).toBe('completed');
    expect(reqNode.doc_path).toBe(docPath);
    expect(result.mutations_applied.some((m) => m.includes('requirements') && m.includes('completed'))).toBe(true);
  });

  it('master_plan_completed: master_plan.status=completed and doc_path set', () => {
    const io = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, io); // scaffold
    processEvent('master_plan_started', PROJECT_DIR, {}, io); // master_plan in_progress
    const docPath = '/tmp/master-plan-doc.md';
    seedDoc(docPath, { total_phases: 1 });
    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    const mpNode = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.status).toBe('completed');
    expect(mpNode.doc_path).toBe(docPath);
    expect(result.mutations_applied.some((m) => m.includes('master_plan') && m.includes('completed'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Plan approved mutations ──────────────────────

describe('[CONTRACT] State Mutations — Plan approved mutations', () => {
  it('plan_approved: gate.status=completed, gate_active=true, phase iterations created', () => {
    const io = createMockIOWithConfig(null, config);
    processEvent('start', PROJECT_DIR, {}, io); // scaffold
    const state = io.currentState!;
    completePlanningSteps(state, 'master_plan');
    const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
    seedDoc(mpDoc, { total_phases: 2, total_tasks: 4 });

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

    expect(result.success).toBe(true);
    const gateNode = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(gateNode.status).toBe('completed');
    expect(gateNode.gate_active).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    expect(phaseLoop.iterations.length).toBe(2);
    expect(result.mutations_applied.some((m) => m.includes('plan_approval_gate'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Code review completed mutations ──────────────
//
// Post-Iter 7: phase_plan_created / task_handoff_created mutations are removed —
// the explosion script (Iter 5) pre-seeds those nodes with status=completed +
// doc_path. driveToExecutionWithConfig mirrors that seeding so downstream
// mutations target the seeded nodes directly.

describe('[CONTRACT] State Mutations — Code review completed mutations', () => {
  /** Sets up io positioned at code_review_started, ready for code_review_completed. */
  function driveToCodeReviewPosition() {
    const io = driveToExecutionWithConfig(config, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    return io;
  }

  it('code_review_completed (approved): code_review.status=completed, verdict=approved, doc_path set', () => {
    const io = driveToCodeReviewPosition();
    const ctx = { phase: 1, task: 1 };

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    expect(codeReviewNode.status).toBe('completed');
    expect(codeReviewNode.verdict).toBe('approved');
    expect(codeReviewNode.doc_path).toBe(codeReviewDoc(1, 1));
    expect(result.mutations_applied.some((m) => m.includes('code_review') && m.includes('completed'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('verdict'))).toBe(true);
  });

  it('code_review_completed (changes_requested): verdict=changes_requested, corrective task injected', () => {
    const io = driveToCodeReviewPosition();
    const ctx = { phase: 1, task: 1 };

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'changes_requested',
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    const taskIterCorrectives = taskLoop.iterations[0].corrective_tasks;
    expect(codeReviewNode.verdict).toBe('changes_requested');
    expect(taskIterCorrectives.length).toBeGreaterThanOrEqual(1);
    expect(result.mutations_applied.some((m) => m.includes('corrective') || m.includes('changes_requested'))).toBe(true);
  });

  it('code_review_completed (rejected): verdict=rejected, graph.status=halted', () => {
    const io = driveToCodeReviewPosition();
    const ctx = { phase: 1, task: 1 };

    const result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'rejected',
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const codeReviewNode = taskLoop.iterations[0].nodes['code_review'] as StepNodeState;
    expect(codeReviewNode.verdict).toBe('rejected');
    expect(io.currentState!.graph.status).toBe('halted');
    expect(result.mutations_applied.some((m) => m.includes('halted') || m.includes('rejected'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Phase review completed mutations ─────────────

describe('[CONTRACT] State Mutations — Phase review completed mutations', () => {
  /** Sets up io positioned at phase_review_started, ready for phase_review_completed. */
  function driveToPhaseReviewPosition() {
    const io = driveToExecutionWithConfig(config, 1, 2);
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    return io;
  }

  it('phase_review_completed (approved): phase_review.status=completed, verdict=approved, doc_path set', () => {
    const io = driveToPhaseReviewPosition();

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseReviewNode = phaseLoop.iterations[0].nodes['phase_review'] as StepNodeState;
    expect(phaseReviewNode.status).toBe('completed');
    expect(phaseReviewNode.verdict).toBe('approved');
    expect(phaseReviewNode.doc_path).toBe(phaseReviewDoc(1));
    expect(result.mutations_applied.some((m) => m.includes('phase_review') && m.includes('completed'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('verdict'))).toBe(true);
  });

  // Skipped in Iter 7; Iter 12 rewires corrective cycles via corrective-task-append. See docs/internals/cheaper-execution/iter-12-corrective-cycles.md.
  // The mutation-side behavior is still exercised by tests/mutations-phase-corrective.test.ts; this contract
  // test goes through the full engine and the post-mutation walker now throws (dag-walker.ts:171-179).
  it.skip('phase_review_completed (changes_requested): corrective task injected at phase level', () => {
    const io = driveToPhaseReviewPosition();

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'changes_requested', exit_criteria_met: false,
    }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseIter = phaseLoop.iterations[0];
    expect(phaseIter.corrective_tasks.length).toBeGreaterThanOrEqual(1);
    expect(result.mutations_applied.some((m) => m.includes('corrective'))).toBe(true);
  });

  it('phase_review_completed (rejected): graph.status=halted', () => {
    const io = driveToPhaseReviewPosition();

    const result = processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'rejected', exit_criteria_met: false,
    }, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('halted');
    expect(result.mutations_applied.some((m) => m.includes('halted'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Gate approved mutations ──────────────────────

describe('[CONTRACT] State Mutations — Gate approved mutations', () => {
  it('task_gate_approved: task_gate.status=completed, gate_active=true', () => {
    const taskConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'task',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToExecutionWithConfig(taskConfig, 1);
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    // In task mode, code_review_completed fires gate_task
    processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);

    const result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const taskGateNode = taskLoop.iterations[0].nodes['task_gate'] as GateNodeState;
    expect(taskGateNode.status).toBe('completed');
    expect(taskGateNode.gate_active).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('task_gate'))).toBe(true);
  });

  it('phase_gate_approved: phase_gate.status=completed, gate_active=true', () => {
    const taskConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'task',
        after_final_review: true,
      },
      source_control: { auto_commit: 'never', auto_pr: 'never' },
    });
    const io = driveToExecutionWithConfig(taskConfig, 1);
    // driveTaskWith approves task gate if it fires (task mode fires task gate)
    driveTaskWith(io, 1, 1);
    driveTaskWith(io, 1, 2);
    processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReportDoc(1));
    processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: phaseReportDoc(1) }, io);
    processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
    seedDoc(phaseReviewDoc(1));
    // In task mode, phase_review_completed fires gate_phase
    processEvent('phase_review_completed', PROJECT_DIR, {
      phase: 1, doc_path: phaseReviewDoc(1), verdict: 'approved', exit_criteria_met: true,
    }, io);

    const result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const phaseGateNode = phaseLoop.iterations[0].nodes['phase_gate'] as GateNodeState;
    expect(phaseGateNode.status).toBe('completed');
    expect(phaseGateNode.gate_active).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('phase_gate'))).toBe(true);
  });

  it('commit_completed: commit.status=completed', () => {
    const commitConfig = createConfig({
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
      source_control: { auto_commit: 'always', auto_pr: 'never' },
    });
    const io = driveToExecutionWithConfig(commitConfig, 1);
    // Drive task manually to reach commit_gate at task scope
    const ctx = { phase: 1, task: 1 };
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    seedDoc(codeReviewDoc(1, 1));
    const r = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: codeReviewDoc(1, 1), verdict: 'approved',
    }, io);
    expect(r.action).toBe('invoke_source_control_commit');

    processEvent('commit_started', PROJECT_DIR, ctx, io);
    const result = processEvent('commit_completed', PROJECT_DIR, ctx, io);

    expect(result.success).toBe(true);
    const phaseLoop = io.currentState!.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    const taskLoop = phaseLoop.iterations[0].nodes['task_loop'] as ForEachTaskNodeState;
    const commitNode = taskLoop.iterations[0].nodes['commit'] as StepNodeState;
    expect(commitNode.status).toBe('completed');
    expect(result.mutations_applied.some((m) => m.includes('commit'))).toBe(true);
  });
});

// ── [CONTRACT] State Mutations — Explosion script mutations (Iter 5) ──────────

describe('[CONTRACT] State Mutations — Explosion script mutations (Iter 5)', () => {
  it('explosion_completed: explode_master_plan.status=completed, doc_path remains null, clears master_plan.last_parse_error + resets parse_retry_count', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 2,
      lastParseError: { line: 42, expected: 'phase heading', found: 'task heading', message: 'boom' },
    });
    const mutation = getMutation('explosion_completed')!;
    expect(mutation).toBeTypeOf('function');
    const result = mutation(state, { doc_path: '/tmp/master-plan.md' }, DEFAULT_CONFIG, emptyTemplate);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('completed');
    // The explode step does not produce a doc; master_plan.doc_path already points at the master plan.
    // Assigning context.doc_path here would duplicate the link, so the mutation leaves doc_path untouched (null).
    expect(explodeNode.doc_path).toBeNull();

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.last_parse_error).toBeNull();
    expect(mpNode.parse_retry_count).toBe(0);
    expect(result.mutations_applied.some((m) => m.includes('cleared master_plan.last_parse_error'))).toBe(true);
    expect(result.mutations_applied.some((m) => m.includes('reset master_plan.parse_retry_count'))).toBe(true);
  });

  it('explosion_completed (idempotency regression): if a legacy state had explode_master_plan.doc_path set to a stale value, the mutation explicitly clears it to null', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 0,
      lastParseError: null,
    });
    // Simulate upgrade path: prior version of the handler stored doc_path here.
    (state.graph.nodes['explode_master_plan'] as StepNodeState).doc_path = '/tmp/stale-master-plan.md';

    const mutation = getMutation('explosion_completed')!;
    const result = mutation(state, {}, DEFAULT_CONFIG, emptyTemplate);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.doc_path).toBeNull();
    expect(result.mutations_applied.some((m) => m.includes('explode_master_plan.doc_path = null'))).toBe(true);
  });

  it('explosion_failed (1st attempt): increments parse_retry_count to 1, stores parse_error, resets explode_master_plan to not_started, flips master_plan back to in_progress', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 0,
      lastParseError: null,
    });
    const parseError = { line: 10, expected: '## P01:', found: '## Some Phase', message: 'missing phase id prefix' };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: parseError }, DEFAULT_CONFIG, emptyTemplate);

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.status).toBe('in_progress');
    expect(mpNode.parse_retry_count).toBe(1);
    expect(mpNode.last_parse_error).toEqual(parseError);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('not_started');
    expect(explodeNode.doc_path).toBeNull();

    expect(result.state.graph.status).not.toBe('halted');
  });

  it('explosion_failed (4th consecutive — cap=3 exceeded): explode_master_plan.status=failed, graph.status=halted, halt_reason populated, parse_retry_count=4', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 3, // 4th attempt would be the failure
      lastParseError: null,
    });
    const parseError = { line: 99, expected: 'task heading', found: 'garbage', message: 'irrecoverable' };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: parseError }, DEFAULT_CONFIG, emptyTemplate);

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.parse_retry_count).toBe(4);
    expect(mpNode.last_parse_error).toEqual(parseError);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('failed');

    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toBeTruthy();
    expect(result.state.pipeline.halt_reason).toContain('cap=3');
    expect(result.mutations_applied.some((m) => m.includes('halted'))).toBe(true);
  });

  it('explosion_failed (cap-exceeded idempotency regression): if a legacy state had explode_master_plan.doc_path set to a stale value, the cap-exceeded branch explicitly clears it to null', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 3, // 4th attempt trips the cap
      lastParseError: null,
    });
    // Simulate upgrade path: prior version of the handler stored doc_path here.
    (state.graph.nodes['explode_master_plan'] as StepNodeState).doc_path = '/tmp/stale.md';

    const parseError = { line: 99, expected: 'task heading', found: 'garbage', message: 'irrecoverable' };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: parseError }, DEFAULT_CONFIG, emptyTemplate);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('failed');
    expect(explodeNode.doc_path).toBeNull();
    expect(result.mutations_applied.some((m) => m.includes('explode_master_plan.doc_path = null'))).toBe(true);
  });

  it('explosion_failed (missing parse_error): halts with dispatch-error halt_reason, does NOT increment parse_retry_count', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 1,
      lastParseError: null,
    });
    // Simulate stale doc_path from legacy state
    (state.graph.nodes['explode_master_plan'] as StepNodeState).doc_path = '/tmp/stale.md';

    const mutation = getMutation('explosion_failed')!;
    // No parse_error in context at all
    const result = mutation(state, {}, DEFAULT_CONFIG, emptyTemplate);

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    // Counter NOT incremented — still 1 (prior value), not 2.
    expect(mpNode.parse_retry_count).toBe(1);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('failed');
    expect(explodeNode.doc_path).toBeNull();

    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toBeTruthy();
    expect(result.state.pipeline.halt_reason).toContain('dispatch');
    expect(result.mutations_applied.some((m) => m.includes('invalid dispatch'))).toBe(true);
  });

  it('explosion_failed (malformed parse_error — missing line): halts with dispatch-error, does NOT increment parse_retry_count', () => {
    const state = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 2,
      lastParseError: null,
    });
    // Simulate stale doc_path from legacy state
    (state.graph.nodes['explode_master_plan'] as StepNodeState).doc_path = '/tmp/stale.md';

    // Missing `line` field — shape validation must reject this.
    const malformed = { expected: 'x', found: 'y', message: 'm' } as unknown as { line: number; expected: string; found: string; message: string };
    const mutation = getMutation('explosion_failed')!;
    const result = mutation(state, { parse_error: malformed }, DEFAULT_CONFIG, emptyTemplate);

    const mpNode = result.state.graph.nodes['master_plan'] as StepNodeState;
    // Counter NOT incremented — still 2 (prior value), not 3.
    expect(mpNode.parse_retry_count).toBe(2);

    const explodeNode = result.state.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.doc_path).toBeNull();

    expect(result.state.graph.status).toBe('halted');
    expect(result.state.pipeline.halt_reason).toContain('dispatch');
  });

  it('explosion_failed: processEvent routes it out-of-band and the recovery mutation fires end-to-end (integration)', () => {
    // Regression for PR #56 Copilot finding: `explosion_failed` was returning
    // "Unknown event" because step-level `failed` events aren't registered by
    // buildEventIndex. The fix adds it to OUT_OF_BAND_EVENTS; this test confirms
    // the full processEvent path (not just the mutation handler in isolation).
    const seedState = makeStateWithExplosion({
      masterPlanStatus: 'completed',
      explodeStatus: 'in_progress',
      parseRetryCount: 1,
      lastParseError: null,
    });
    const io = createMockIO(seedState);
    const parseError = {
      line: 7,
      expected: '## P01:',
      found: '## Some Phase',
      message: 'missing phase id prefix',
    };

    const result = processEvent('explosion_failed', PROJECT_DIR, { parse_error: parseError }, io);

    // The path that was broken — must no longer return "Unknown event".
    expect(result.success).toBe(true);
    expect(String(result.context.error ?? '')).not.toContain('Unknown event');

    // Mutation fired end-to-end through the out-of-band dispatch path.
    const mpNode = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(mpNode.status).toBe('in_progress');
    expect(mpNode.last_parse_error).toEqual(parseError);
    expect(mpNode.parse_retry_count).toBe(2);

    const explodeNode = io.currentState!.graph.nodes['explode_master_plan'] as StepNodeState;
    expect(explodeNode.status).toBe('not_started');
    expect(explodeNode.doc_path).toBeNull();

    expect(result.mutations_applied.some((m) => m.includes('recovery re-spawn'))).toBe(true);
  });
});
