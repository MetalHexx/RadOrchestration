import type {
  PipelineState,
  NodeState,
  StepNodeState,
  GateNodeState,
  MutationFn,
  MutationResult,
  IterationEntry,
  CorrectiveTaskEntry,
  NodeDef,
  StepNodeDef,
  ForEachPhaseNodeState,
  ForEachPhaseNodeDef,
  ForEachTaskNodeDef,
  ParseErrorDetail,
  PipelineTemplate,
} from './types.js';
import { EVENTS, VALID_VERDICTS, REVIEW_VERDICTS } from './constants.js';
import { scaffoldNodeState } from './scaffold.js';
import { resolveActivePhaseIndex, resolveActiveTaskIndex } from './context-enrichment.js';

// ── Resolution scope ──────────────────────────────────────────────────────────

type ResolveScope = 'top' | 'phase' | 'task';

// ── resolveNodeState ──────────────────────────────────────────────────────────

export function resolveNodeState(
  state: PipelineState,
  nodeId: string,
  scope: ResolveScope,
  phase?: number,
  task?: number
): NodeState {
  if (scope === 'top') {
    return state.graph.nodes[nodeId];
  }

  if (phase === undefined) {
    throw new Error(`resolveNodeState: scope is '${scope}' but phase is undefined`);
  }

  const phaseLoopNode = state.graph.nodes['phase_loop'];
  if (phaseLoopNode.kind !== 'for_each_phase') {
    throw new Error(`Expected phase_loop to be a for_each_phase node, got ${phaseLoopNode.kind}`);
  }
  const phaseIteration = phaseLoopNode.iterations[phase - 1];

  if (scope === 'phase') {
    return phaseIteration.nodes[nodeId];
  }

  // scope === 'task'
  // Phase-level corrective tasks (from phase_review_completed) have nodes: {} so this check
  // always falls through — correct behavior since mutations target the re-expanded task_loop.
  // Task-level corrective tasks (from code_review_completed) DO have populated nodes.
  if (phaseIteration.corrective_tasks.length > 0) {
    const latest = phaseIteration.corrective_tasks[phaseIteration.corrective_tasks.length - 1];
    if ((latest.status === 'in_progress' || latest.status === 'not_started') && nodeId in latest.nodes) {
      return latest.nodes[nodeId];
    }
  }

  const taskLoopNode = phaseIteration.nodes['task_loop'];
  if (taskLoopNode.kind !== 'for_each_task') {
    throw new Error(`Expected task_loop to be a for_each_task node, got ${taskLoopNode.kind}`);
  }
  const taskIteration = taskLoopNode.iterations[(task ?? 1) - 1];

  // Task-level corrective tasks: route mutations to the latest active corrective entry's nodes
  if (taskIteration.corrective_tasks.length > 0) {
    const latest = taskIteration.corrective_tasks[taskIteration.corrective_tasks.length - 1];
    if ((latest.status === 'in_progress' || latest.status === 'not_started') && nodeId in latest.nodes) {
      return latest.nodes[nodeId];
    }
  }

  return taskIteration.nodes[nodeId];
}

// ── Mutation registry ─────────────────────────────────────────────────────────

const mutationRegistry = new Map<string, MutationFn>();

// ── Planning _started mutations ───────────────────────────────────────────────

const planningStartedSteps: Array<[string, string]> = [
  [EVENTS.REQUIREMENTS_STARTED, 'requirements'],
  [EVENTS.MASTER_PLAN_STARTED, 'master_plan'],
];

for (const [eventName, nodeId] of planningStartedSteps) {
  mutationRegistry.set(eventName, (state, _context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    const node = resolveNodeState(cloned, nodeId, 'top');
    node.status = 'in_progress';
    mutations_applied.push(`set ${nodeId}.status = in_progress`);

    if (eventName === EVENTS.REQUIREMENTS_STARTED) {
      cloned.graph.status = 'in_progress';
      mutations_applied.push('set graph.status = in_progress');
    }

    return { state: cloned, mutations_applied };
  });
}

// ── Planning _completed mutations ─────────────────────────────────────────────

const planningCompletedSteps: Array<[string, string]> = [
  [EVENTS.REQUIREMENTS_COMPLETED, 'requirements'],
  [EVENTS.MASTER_PLAN_COMPLETED, 'master_plan'],
];

for (const [eventName, nodeId] of planningCompletedSteps) {
  mutationRegistry.set(eventName, (state, context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    const node = resolveNodeState(cloned, nodeId, 'top');
    node.status = 'completed';
    mutations_applied.push(`set ${nodeId}.status = completed`);

    const docPath = context.doc_path ?? null;
    (node as StepNodeState).doc_path = docPath;
    mutations_applied.push(`set ${nodeId}.doc_path = ${docPath ?? 'null'}`);

    return { state: cloned, mutations_applied };
  });
}

// ── explosion_started mutation ────────────────────────────────────────────────

mutationRegistry.set(EVENTS.EXPLOSION_STARTED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'explode_master_plan', 'top');
  node.status = 'in_progress';
  mutations_applied.push('set explode_master_plan.status = in_progress');

  // Defensive: explicitly clear any stale doc_path on the explode node, matching the
  // idempotency guard in explosion_completed, cap-exceeded, and invalid-dispatch branches.
  // A state.json produced by an older version may carry a lingering value. Clearing to null
  // guarantees the UI doesn't render a spurious "Doc" link WHILE the explode step is in progress.
  (node as StepNodeState).doc_path = null;
  mutations_applied.push('set explode_master_plan.doc_path = null');

  return { state: cloned, mutations_applied };
});

// ── explosion_completed mutation (clears parse-failure recovery state) ────────

mutationRegistry.set(EVENTS.EXPLOSION_COMPLETED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'explode_master_plan', 'top');
  node.status = 'completed';
  mutations_applied.push('set explode_master_plan.status = completed');

  // Defensive: explicitly clear any stale doc_path on the explode node. The script
  // itself never writes a doc_path here (its output is phases/ + tasks/ + seeded
  // iterations, not a single doc), but a state.json produced by an older version
  // of this handler may carry a lingering value. Setting to null guarantees the
  // UI doesn't render a spurious "Doc" link on a re-run or after upgrade.
  (node as StepNodeState).doc_path = null;
  mutations_applied.push('set explode_master_plan.doc_path = null');

  // Clear any recovery state on master_plan — success wipes the slate.
  const masterPlanNode = resolveNodeState(cloned, 'master_plan', 'top') as StepNodeState;
  if (masterPlanNode.last_parse_error !== null && masterPlanNode.last_parse_error !== undefined) {
    masterPlanNode.last_parse_error = null;
    mutations_applied.push('cleared master_plan.last_parse_error');
  }
  if (masterPlanNode.parse_retry_count !== null && masterPlanNode.parse_retry_count !== undefined && masterPlanNode.parse_retry_count !== 0) {
    masterPlanNode.parse_retry_count = 0;
    mutations_applied.push('reset master_plan.parse_retry_count = 0');
  }

  return { state: cloned, mutations_applied };
});

// ── explosion_failed mutation (parse-failure recovery loop; cap=3) ────────────

// Hardcoded for Iter 5; configurability is Iter 14.
const MAX_PARSE_RETRIES = 3;

mutationRegistry.set(EVENTS.EXPLOSION_FAILED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const masterPlanNode = resolveNodeState(cloned, 'master_plan', 'top') as StepNodeState;
  const explodeNode = resolveNodeState(cloned, 'explode_master_plan', 'top') as StepNodeState;

  // context.parse_error carries { line, expected, found, message } from the explosion CLI wrapper.
  // Hard-error on missing / malformed parse_error — a dispatch-layer bug, not a recoverable parse
  // failure. Silently tolerating a null here would let retry_count climb toward the cap with
  // last_parse_error = null, yielding an "unknown parse error" halt that gives the planner
  // nothing actionable to fix.
  const parseError = context.parse_error as ParseErrorDetail | undefined;
  if (!parseError || !Number.isInteger(parseError.line) || parseError.line < 1 ||
      typeof parseError.expected !== 'string' ||
      typeof parseError.found !== 'string' ||
      typeof parseError.message !== 'string') {
    explodeNode.status = 'failed';
    explodeNode.doc_path = null;
    cloned.graph.status = 'halted';
    cloned.pipeline.halt_reason =
      'Explosion dispatch error: explosion_failed received without a valid parse_error payload. ' +
      'This is a programmer error — the orchestrator or CLI wrapper must pass --parse-error with ' +
      '{ line, expected, found, message }. See main.ts argument handling.';
    mutations_applied.push('set explode_master_plan.status = failed (invalid dispatch)');
    mutations_applied.push('set explode_master_plan.doc_path = null (invalid dispatch)');
    mutations_applied.push('set graph.status = halted (dispatch error)');
    mutations_applied.push('set pipeline.halt_reason (dispatch error)');
    return { state: cloned, mutations_applied };
  }

  masterPlanNode.last_parse_error = parseError;
  mutations_applied.push(
    parseError
      ? `set master_plan.last_parse_error = { line: ${parseError.line}, ... }`
      : 'set master_plan.last_parse_error = null'
  );

  const previousCount = masterPlanNode.parse_retry_count ?? 0;
  const nextCount = previousCount + 1;
  masterPlanNode.parse_retry_count = nextCount;
  mutations_applied.push(`set master_plan.parse_retry_count = ${nextCount}`);

  if (nextCount > MAX_PARSE_RETRIES) {
    // Cap exceeded — halt. The orchestrator surfaces this via the log-error skill.
    explodeNode.status = 'failed';
    mutations_applied.push(`set explode_master_plan.status = failed (parse retry cap ${MAX_PARSE_RETRIES} exceeded)`);
    // Defensive: explicitly clear any stale doc_path on the explode node, mirroring the
    // idempotency fix in the explosion_completed path. An upgraded state.json may carry
    // a lingering value from an older handler; null guarantees the UI doesn't render
    // a spurious "Doc" link on the halted node.
    (explodeNode as StepNodeState).doc_path = null;
    mutations_applied.push('set explode_master_plan.doc_path = null');
    cloned.graph.status = 'halted';
    mutations_applied.push('set graph.status = halted');
    const reasonMsg = parseError?.message ?? 'unknown parse error';
    cloned.pipeline.halt_reason =
      `Explosion parser rejected planner output ${nextCount} times (cap=${MAX_PARSE_RETRIES}). ` +
      `Manual intervention required. Last error: ${reasonMsg}`;
    mutations_applied.push(`set pipeline.halt_reason (parse retry cap exceeded)`);
    return { state: cloned, mutations_applied };
  }

  // Recoverable — reset and re-spawn the planner.
  explodeNode.status = 'not_started';
  (explodeNode as StepNodeState).doc_path = null;
  mutations_applied.push('set explode_master_plan.status = not_started');
  masterPlanNode.status = 'in_progress';
  mutations_applied.push('set master_plan.status = in_progress (recovery re-spawn)');

  return { state: cloned, mutations_applied };
});

// ── Gate approved mutations ───────────────────────────────────────────────────

mutationRegistry.set(EVENTS.PLAN_APPROVED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];
  const node = resolveNodeState(cloned, 'plan_approval_gate', 'top');
  node.status = 'completed';
  (node as GateNodeState).gate_active = true;
  mutations_applied.push('set plan_approval_gate.status = completed');
  mutations_applied.push('set plan_approval_gate.gate_active = true');
  cloned.pipeline.current_tier = 'execution';
  mutations_applied.push('set pipeline.current_tier = execution');
  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.TASK_GATE_APPROVED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];
  const node = resolveNodeState(cloned, 'task_gate', 'task', context.phase, context.task);
  node.status = 'completed';
  (node as GateNodeState).gate_active = true;
  mutations_applied.push('set task_gate.status = completed');
  mutations_applied.push('set task_gate.gate_active = true');
  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.PHASE_GATE_APPROVED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];
  const node = resolveNodeState(cloned, 'phase_gate', 'phase', context.phase);
  node.status = 'completed';
  (node as GateNodeState).gate_active = true;
  mutations_applied.push('set phase_gate.status = completed');
  mutations_applied.push('set phase_gate.gate_active = true');
  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.FINAL_APPROVED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];
  const node = resolveNodeState(cloned, 'final_approval_gate', 'top');
  node.status = 'completed';
  (node as GateNodeState).gate_active = true;
  mutations_applied.push('set final_approval_gate.status = completed');
  mutations_applied.push('set final_approval_gate.gate_active = true');
  return { state: cloned, mutations_applied };
});

// ── Phase execution _started mutations ───────────────────────────────────────

const phaseExecStartedSteps: Array<[string, string]> = [
  [EVENTS.PHASE_PLANNING_STARTED, 'phase_planning'],
  [EVENTS.PHASE_REPORT_STARTED, 'phase_report'],
  [EVENTS.PHASE_REVIEW_STARTED, 'phase_review'],
];

for (const [eventName, nodeId] of phaseExecStartedSteps) {
  mutationRegistry.set(eventName, (state, context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    const phase = context.phase ?? resolveActivePhaseIndex(cloned);
    try {
      const node = resolveNodeState(cloned, nodeId, 'phase', phase);
      node.status = 'in_progress';
      mutations_applied.push(`set ${nodeId}.status = in_progress`);
    } catch (err) {
      throw new Error(
        `Cannot apply mutation for "${eventName}": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }

    return { state: cloned, mutations_applied };
  });
}

// ── Phase execution _completed mutations (store doc_path) ─────────────────────

const phaseExecDocSteps: Array<[string, string]> = [
  [EVENTS.PHASE_PLAN_CREATED, 'phase_planning'],
  [EVENTS.PHASE_REPORT_CREATED, 'phase_report'],
];

for (const [eventName, nodeId] of phaseExecDocSteps) {
  mutationRegistry.set(eventName, (state, context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    let phase = context.phase;
    if (phase === undefined) {
      try {
        phase = resolveActivePhaseIndex(cloned);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Cannot apply mutation for "${eventName}": failed to resolve the active phase from state.\n` +
          `${detail}\n` +
          `Pass --phase <N> to specify the phase explicitly.`
        );
      }
    }

    let node: NodeState;
    try {
      node = resolveNodeState(cloned, nodeId, 'phase', phase);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Cannot apply mutation for "${eventName}": could not resolve node "${nodeId}" for phase ${phase}.\n` +
        `${detail}\n` +
        `Pass --phase <N> to specify an existing phase explicitly.`
      );
    }
    node.status = 'completed';
    mutations_applied.push(`set ${nodeId}.status = completed`);

    const docPath = context.doc_path ?? null;
    (node as StepNodeState).doc_path = docPath;
    mutations_applied.push(`set ${nodeId}.doc_path = ${docPath ?? 'null'}`);

    return { state: cloned, mutations_applied };
  });
}

// ── phase_review_completed (stores doc_path + verdict) ───────────────────────

mutationRegistry.set(EVENTS.PHASE_REVIEW_COMPLETED, (state, context, config, template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  let phase = context.phase;
  if (phase === undefined) {
    try {
      phase = resolveActivePhaseIndex(cloned);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Cannot apply mutation for "phase_review_completed": failed to resolve the active phase from state.\n` +
        `${detail}\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
  }

  let node: NodeState;
  try {
    node = resolveNodeState(cloned, 'phase_review', 'phase', phase);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot apply mutation for "phase_review_completed": could not resolve phase_review for phase ${phase}.\n` +
      `${detail}\n` +
      `Pass --phase <N> to specify an existing phase explicitly.`
    );
  }
  node.status = 'completed';
  mutations_applied.push('set phase_review.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set phase_review.doc_path = ${docPath ?? 'null'}`);

  const verdict = context.verdict ?? null;
  (node as StepNodeState).verdict = verdict;
  mutations_applied.push(`set phase_review.verdict = ${verdict ?? 'null'}`);

  if (verdict !== null && !VALID_VERDICTS.has(verdict as string)) {
    cloned.graph.status = 'halted';
    cloned.pipeline.halt_reason = `Unrecognized verdict '${verdict}' in phase_review_completed`;
    return {
      state: cloned,
      mutations_applied: [
        ...mutations_applied,
        `set graph.status = halted (unrecognized verdict '${verdict}')`,
      ],
    };
  }

  if (verdict === REVIEW_VERDICTS.CHANGES_REQUESTED) {
    const iteration = resolvePhaseIteration(cloned, phase);

    // Reset phase_planning to not_started so the walker returns create_phase_plan
    const phasePlanningNode = iteration.nodes['phase_planning'];
    phasePlanningNode.status = 'not_started';
    (phasePlanningNode as StepNodeState).doc_path = null;

    // Reset task_loop so new tasks can be created from the new phase plan
    const taskLoopNode = iteration.nodes['task_loop'];
    taskLoopNode.status = 'not_started';
    if (taskLoopNode.kind === 'for_each_task') {
      taskLoopNode.iterations = [];
    }

    // Reset downstream nodes
    for (const nodeId of ['phase_report', 'phase_review', 'phase_gate']) {
      const n = iteration.nodes[nodeId];
      n.status = 'not_started';
      if (n.kind === 'step') {
        // Preserve phase_review.doc_path even though we reset status to not_started.
        // context-enrichment reads it for the corrective `previous_review` context field.
        // This is the only node that intentionally has doc_path != null while status == not_started.
        if (nodeId !== 'phase_review') {
          (n as StepNodeState).doc_path = null;
        }
        (n as StepNodeState).verdict = null;
        if (nodeId === 'phase_review') {
          mutations_applied.push('reset phase_review.verdict = null (corrective cycle)');
        }
      }
      if (n.kind === 'gate') {
        (n as GateNodeState).gate_active = false;
      }
    }

    // Store corrective context — empty nodes (tasks created by phase planning)
    iteration.corrective_tasks.push({
      index: iteration.corrective_tasks.length + 1,
      reason: context.reason ?? 'Phase review requested changes',
      injected_after: 'phase_review',
      status: 'in_progress',
      nodes: {},
      commit_hash: null,
    });

    mutations_applied.push('reset phase for corrective re-planning');
  } else if (verdict === REVIEW_VERDICTS.REJECTED) {
    const iteration = resolvePhaseIteration(cloned, phase);
    iteration.status = 'halted';
    cloned.graph.status = 'halted';
    mutations_applied.push('set phase_iteration.status = halted (rejected verdict)');
    mutations_applied.push('set graph.status = halted');
  }

  return { state: cloned, mutations_applied };
});

// ── Task execution _started mutations ────────────────────────────────────────

const taskStartedSteps: Array<[string, string]> = [
  [EVENTS.TASK_HANDOFF_STARTED, 'task_handoff'],
  [EVENTS.EXECUTION_STARTED, 'task_executor'],
  [EVENTS.CODE_REVIEW_STARTED, 'code_review'],
];

for (const [eventName, nodeId] of taskStartedSteps) {
  mutationRegistry.set(eventName, (state, context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    let phase = context.phase;
    if (phase === undefined) {
      try {
        phase = resolveActivePhaseIndex(cloned);
      } catch {
        throw new Error(
          `Cannot apply mutation for "${eventName}": no active phase could be resolved from state.\n` +
          `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
          `Pass --phase <N> to specify the phase explicitly.`
        );
      }
    }

    let task = context.task;
    if (task === undefined) {
      try {
        task = resolveActiveTaskIndex(cloned, phase);
      } catch {
        throw new Error(
          `Cannot apply mutation for "${eventName}": no active task could be resolved from state for phase ${phase}.\n` +
          `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
          `Pass --task <N> to specify the task explicitly.`
        );
      }
    }

    try {
      const node = resolveNodeState(cloned, nodeId, 'task', phase, task);
      node.status = 'in_progress';
      mutations_applied.push(`set ${nodeId}.status = in_progress`);
    } catch {
      if (context.phase === undefined) {
        const phaseLoopNode = cloned.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
        const hasInProgressPhase = phaseLoopNode?.iterations?.some(it => it.status === 'in_progress');
        if (hasInProgressPhase) {
          throw new Error(
            `Cannot apply mutation for "${eventName}": no active task could be resolved from state for phase ${phase}.\n` +
            `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
            `Pass --task <N> to specify the task explicitly.`
          );
        }
        throw new Error(
          `Cannot apply mutation for "${eventName}": no active phase could be resolved from state.\n` +
          `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
          `Pass --phase <N> to specify the phase explicitly.`
        );
      }
      throw new Error(
        `Cannot apply mutation for "${eventName}": no active task could be resolved from state for phase ${phase}.\n` +
        `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
        `Pass --task <N> to specify the task explicitly.`
      );
    }

    return { state: cloned, mutations_applied };
  });
}

// ── task_handoff_created (stores doc_path) ────────────────────────────────────

mutationRegistry.set(EVENTS.TASK_HANDOFF_CREATED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  let phase = context.phase;
  if (phase === undefined) {
    try {
      phase = resolveActivePhaseIndex(cloned);
    } catch {
      throw new Error(
        `Cannot apply mutation for "task_handoff_created": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
  }

  let task = context.task;
  if (task === undefined) {
    try {
      task = resolveActiveTaskIndex(cloned, phase);
    } catch {
      throw new Error(
        `Cannot apply mutation for "task_handoff_created": no active task could be resolved from state for phase ${phase}.\n` +
        `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
        `Pass --task <N> to specify the task explicitly.`
      );
    }
  }

  let node: NodeState;
  try {
    node = resolveNodeState(cloned, 'task_handoff', 'task', phase, task);
  } catch {
    throw new Error(
      `Cannot apply mutation for "task_handoff_created": failed to resolve task_handoff node for phase ${phase}, task ${task}.\n` +
      `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
      `Pass --phase <N> and/or --task <N> to specify explicitly.`
    );
  }
  node.status = 'completed';
  mutations_applied.push('set task_handoff.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set task_handoff.doc_path = ${docPath ?? 'null'}`);

  return { state: cloned, mutations_applied };
});

// ── task_completed ───────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.TASK_COMPLETED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  let phase = context.phase;
  if (phase === undefined) {
    try {
      phase = resolveActivePhaseIndex(cloned);
    } catch {
      throw new Error(
        `Cannot apply mutation for "task_completed": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
  }

  let task = context.task;
  if (task === undefined) {
    try {
      task = resolveActiveTaskIndex(cloned, phase);
    } catch {
      throw new Error(
        `Cannot apply mutation for "task_completed": no active task could be resolved from state for phase ${phase}.\n` +
        `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
        `Pass --task <N> to specify the task explicitly.`
      );
    }
  }

  try {
    const node = resolveNodeState(cloned, 'task_executor', 'task', phase, task);
    node.status = 'completed';
    mutations_applied.push('set task_executor.status = completed');
  } catch {
    if (context.phase === undefined) {
      const phaseLoopNode = cloned.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const hasInProgressPhase = phaseLoopNode?.iterations?.some(it => it.status === 'in_progress');
      if (hasInProgressPhase) {
        throw new Error(
          `Cannot apply mutation for "task_completed": no active task could be resolved from state for phase ${phase}.\n` +
          `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
          `Pass --task <N> to specify the task explicitly.`
        );
      }
      throw new Error(
        `Cannot apply mutation for "task_completed": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
    throw new Error(
      `Cannot apply mutation for "task_completed": no active task could be resolved from state for phase ${phase}.\n` +
      `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
      `Pass --task <N> to specify the task explicitly.`
    );
  }

  return { state: cloned, mutations_applied };
});

// ── Private helpers for corrective injection ─────────────────────────────────

function resolvePhaseIteration(state: PipelineState, phase: number): IterationEntry {
  const phaseLoopNode = state.graph.nodes['phase_loop'];
  if (phaseLoopNode.kind !== 'for_each_phase') {
    throw new Error(`Expected phase_loop to be a for_each_phase node, got ${phaseLoopNode.kind}`);
  }
  return phaseLoopNode.iterations[phase - 1];
}

function resolveTaskIteration(state: PipelineState, phase: number, task: number): IterationEntry {
  const phaseLoopNode = state.graph.nodes['phase_loop'];
  if (phaseLoopNode.kind !== 'for_each_phase') {
    throw new Error(`Expected phase_loop to be a for_each_phase node, got ${phaseLoopNode.kind}`);
  }
  const phaseIteration = phaseLoopNode.iterations[phase - 1];
  const taskLoopNode = phaseIteration.nodes['task_loop'];
  if (taskLoopNode.kind !== 'for_each_task') {
    throw new Error(`Expected task_loop to be a for_each_task node, got ${taskLoopNode.kind}`);
  }
  return taskLoopNode.iterations[task - 1];
}

function findTaskLoopBodyDefs(template: PipelineTemplate): NodeDef[] {
  for (const nodeDef of template.nodes) {
    if (nodeDef.kind === 'for_each_phase') {
      for (const bodyNode of (nodeDef as ForEachPhaseNodeDef).body) {
        if (bodyNode.kind === 'for_each_task') {
          return (bodyNode as ForEachTaskNodeDef).body;
        }
      }
    }
  }
  return [];
}

// ── code_review_completed (stores doc_path + verdict, routes on verdict) ──────

mutationRegistry.set(EVENTS.CODE_REVIEW_COMPLETED, (state, context, config, template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  let phase = context.phase;
  if (phase === undefined) {
    try {
      phase = resolveActivePhaseIndex(cloned);
    } catch {
      throw new Error(
        `Cannot apply mutation for "code_review_completed": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
  }

  let task = context.task;
  if (task === undefined) {
    try {
      task = resolveActiveTaskIndex(cloned, phase);
    } catch {
      throw new Error(
        `Cannot apply mutation for "code_review_completed": no active task could be resolved from state for phase ${phase}.\n` +
        `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
        `Pass --task <N> to specify the task explicitly.`
      );
    }
  }

  // Base behavior: always mark code_review completed with doc_path and verdict
  let node: NodeState;
  try {
    node = resolveNodeState(cloned, 'code_review', 'task', phase, task);
  } catch {
    throw new Error(
      `Cannot apply mutation for "code_review_completed": failed to resolve code_review node for phase ${phase}, task ${task}.\n` +
      `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
      `Pass --phase <N> and/or --task <N> to specify explicitly.`
    );
  }
  node.status = 'completed';
  mutations_applied.push('set code_review.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set code_review.doc_path = ${docPath ?? 'null'}`);

  const verdict = context.verdict ?? null;
  (node as StepNodeState).verdict = verdict;
  mutations_applied.push(`set code_review.verdict = ${verdict ?? 'null'}`);

  if (verdict !== null && !VALID_VERDICTS.has(verdict as string)) {
    cloned.graph.status = 'halted';
    cloned.pipeline.halt_reason = `Unrecognized verdict '${verdict}' in code_review_completed`;
    return {
      state: cloned,
      mutations_applied: [
        ...mutations_applied,
        `set graph.status = halted (unrecognized verdict '${verdict}')`,
      ],
    };
  }

  // Verdict routing
  if (verdict === REVIEW_VERDICTS.CHANGES_REQUESTED) {
    const iteration = resolveTaskIteration(cloned, phase, task);
    const correctiveCount = iteration.corrective_tasks.length;
    const maxRetries = config.limits.max_retries_per_task;

    if (correctiveCount < maxRetries) {
      const bodyDefs = findTaskLoopBodyDefs(template);
      if (bodyDefs.length === 0) {
        throw new Error('findTaskLoopBodyDefs: no for_each_task body found in template');
      }
      const nodes: Record<string, NodeState> = {};
      for (const bodyDef of bodyDefs) {
        nodes[bodyDef.id] = scaffoldNodeState(bodyDef);
      }
      const entry: CorrectiveTaskEntry = {
        index: correctiveCount + 1,
        reason: context.reason ?? 'Code review requested changes',
        injected_after: 'code_review',
        status: 'not_started',
        nodes,
        commit_hash: null,
      };
      iteration.corrective_tasks.push(entry);
      mutations_applied.push(`injected corrective task ${entry.index} (changes_requested)`);
      mutations_applied.push(`corrective_tasks.length = ${iteration.corrective_tasks.length}`);
    } else {
      iteration.status = 'halted';
      cloned.graph.status = 'halted';
      mutations_applied.push('set task_iteration.status = halted (retry budget exhausted)');
      mutations_applied.push('set graph.status = halted');
    }
  } else if (verdict === REVIEW_VERDICTS.REJECTED) {
    const iteration = resolveTaskIteration(cloned, phase, task);
    iteration.status = 'halted';
    cloned.graph.status = 'halted';
    mutations_applied.push('set task_iteration.status = halted (rejected verdict)');
    mutations_applied.push('set graph.status = halted');
  }

  return { state: cloned, mutations_applied };
});

// ── Final review mutations ────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.FINAL_REVIEW_STARTED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'final_review', 'top');
  node.status = 'in_progress';
  mutations_applied.push('set final_review.status = in_progress');

  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.FINAL_REVIEW_COMPLETED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'final_review', 'top');
  node.status = 'completed';
  mutations_applied.push('set final_review.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set final_review.doc_path = ${docPath ?? 'null'}`);

  const verdict = context.verdict ?? null;
  (node as StepNodeState).verdict = verdict;
  mutations_applied.push(`set final_review.verdict = ${verdict ?? 'null'}`);

  if (verdict !== null && !VALID_VERDICTS.has(verdict as string)) {
    cloned.graph.status = 'halted';
    cloned.pipeline.halt_reason = `Unrecognized verdict '${verdict}' in final_review_completed`;
    return {
      state: cloned,
      mutations_applied: [
        ...mutations_applied,
        `set graph.status = halted (unrecognized verdict '${verdict}')`,
      ],
    };
  }

  if (verdict === REVIEW_VERDICTS.APPROVED) {
    cloned.pipeline.current_tier = 'review';
    mutations_applied.push('set pipeline.current_tier = review');
  }

  return { state: cloned, mutations_applied };
});

// ── Source control commit mutations ───────────────────────────────────────────

mutationRegistry.set(EVENTS.COMMIT_STARTED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  let phase = context.phase;
  if (phase === undefined) {
    try {
      phase = resolveActivePhaseIndex(cloned);
    } catch {
      throw new Error(
        `Cannot apply mutation for "commit_started": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
  }

  let task = context.task;
  if (task === undefined) {
    try {
      task = resolveActiveTaskIndex(cloned, phase);
    } catch {
      throw new Error(
        `Cannot apply mutation for "commit_started": no active task could be resolved from state for phase ${phase}.\n` +
        `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
        `Pass --task <N> to specify the task explicitly.`
      );
    }
  }

  try {
    const node = resolveNodeState(cloned, 'commit', 'task', phase, task);
    node.status = 'in_progress';
    mutations_applied.push('set commit.status = in_progress');
  } catch {
    if (context.phase === undefined) {
      const phaseLoopNode = cloned.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const hasInProgressPhase = phaseLoopNode?.iterations?.some(it => it.status === 'in_progress');
      if (hasInProgressPhase) {
        throw new Error(
          `Cannot apply mutation for "commit_started": no active task could be resolved from state for phase ${phase}.\n` +
          `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
          `Pass --task <N> to specify the task explicitly.`
        );
      }
      throw new Error(
        `Cannot apply mutation for "commit_started": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
    throw new Error(
      `Cannot apply mutation for "commit_started": no active task could be resolved from state for phase ${phase}.\n` +
      `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
      `Pass --task <N> to specify the task explicitly.`
    );
  }

  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.COMMIT_COMPLETED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  let phase = context.phase;
  if (phase === undefined) {
    try {
      phase = resolveActivePhaseIndex(cloned);
    } catch {
      throw new Error(
        `Cannot apply mutation for "commit_completed": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
  }

  let task = context.task;
  if (task === undefined) {
    try {
      task = resolveActiveTaskIndex(cloned, phase);
    } catch {
      throw new Error(
        `Cannot apply mutation for "commit_completed": no active task could be resolved from state for phase ${phase}.\n` +
        `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
        `Pass --task <N> to specify the task explicitly.`
      );
    }
  }

  try {
    const node = resolveNodeState(cloned, 'commit', 'task', phase, task);
    node.status = 'completed';
    mutations_applied.push('set commit.status = completed');

    // Write commit_hash to per-task IterationEntry or active CorrectiveTaskEntry
    const taskIteration = resolveTaskIteration(cloned, phase, task);
    const activeCorrective = taskIteration.corrective_tasks.slice().reverse().find(
      (ct: CorrectiveTaskEntry) => ct.status === 'in_progress' || ct.status === 'not_started'
    );

    const commitHash = (context.commit_hash as string) ?? null;

    if (activeCorrective) {
      activeCorrective.commit_hash = commitHash;
      mutations_applied.push(`set corrective_task[${activeCorrective.index}].commit_hash = ${commitHash ?? 'null'}`);
    } else {
      taskIteration.commit_hash = commitHash;
      mutations_applied.push(`set task_iteration[${taskIteration.index}].commit_hash = ${commitHash ?? 'null'}`);
    }

    return { state: cloned, mutations_applied };
  } catch {
    if (context.phase === undefined) {
      const phaseLoopNode = cloned.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const hasInProgressPhase = phaseLoopNode?.iterations?.some(it => it.status === 'in_progress');
      if (hasInProgressPhase) {
        throw new Error(
          `Cannot apply mutation for "commit_completed": no active task could be resolved from state for phase ${phase}.\n` +
          `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
          `Pass --task <N> to specify the task explicitly.`
        );
      }
      throw new Error(
        `Cannot apply mutation for "commit_completed": no active phase could be resolved from state.\n` +
        `Either no phase is currently in_progress, or multiple phases are in_progress simultaneously.\n` +
        `Pass --phase <N> to specify the phase explicitly.`
      );
    }
    throw new Error(
      `Cannot apply mutation for "commit_completed": no active task could be resolved from state for phase ${phase}.\n` +
      `Either no task is currently in_progress, or multiple tasks are in_progress simultaneously.\n` +
      `Pass --task <N> to specify the task explicitly.`
    );
  }
});

// ── Source control PR mutations (final_pr as top-scoped sibling) ──────────────

mutationRegistry.set(EVENTS.PR_REQUESTED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  if (!cloned.graph.nodes['final_pr']) {
    cloned.graph.nodes['final_pr'] = scaffoldNodeState({
      id: 'final_pr',
      kind: 'step',
      action: 'invoke_source_control_pr',
      events: { started: 'pr_requested', completed: 'pr_created' },
    } as StepNodeDef);
    mutations_applied.push('scaffold final_pr (was not yet initialized)');
  }

  const node = resolveNodeState(cloned, 'final_pr', 'top');
  node.status = 'in_progress';
  mutations_applied.push('set final_pr.status = in_progress');

  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.PR_CREATED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'final_pr', 'top');
  node.status = 'completed';
  mutations_applied.push('set final_pr.status = completed');

  if (context.pr_url !== undefined) {
    if (!cloned.pipeline.source_control) {
      throw new Error(
        'pr_created: pipeline.source_control is null — cannot store pr_url. ' +
        'Source control must be initialized via source_control_init before PR creation.'
      );
    }
    cloned.pipeline.source_control.pr_url = (context.pr_url ?? null) as string | null;
    mutations_applied.push(`set pipeline.source_control.pr_url = ${context.pr_url ?? 'null'}`);
  }

  return { state: cloned, mutations_applied };
});

// ── plan_rejected mutation ────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.PLAN_REJECTED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const masterPlanNode = resolveNodeState(cloned, 'master_plan', 'top');
  masterPlanNode.status = 'not_started';
  mutations_applied.push('set master_plan.status = not_started');
  (masterPlanNode as StepNodeState).doc_path = null;
  mutations_applied.push('set master_plan.doc_path = null');

  const planGateNode = resolveNodeState(cloned, 'plan_approval_gate', 'top');
  planGateNode.status = 'not_started';
  mutations_applied.push('set plan_approval_gate.status = not_started');
  (planGateNode as GateNodeState).gate_active = false;
  mutations_applied.push('set plan_approval_gate.gate_active = false');

  // phase_loop is only present on templates that declare it (full.yml, quick.yml).
  // default.yml (Iter 4) is a partial planning-only template with no phase_loop;
  // plan_rejected is a legitimate exit path there, so skip the reset silently.
  const phaseLoopNode = cloned.graph.nodes['phase_loop'];
  if (phaseLoopNode !== undefined) {
    if (phaseLoopNode.kind !== 'for_each_phase') {
      throw new Error(`Expected phase_loop to be a for_each_phase node, got ${phaseLoopNode.kind}`);
    }
    phaseLoopNode.iterations = [];
    mutations_applied.push('set phase_loop.iterations = []');
  }

  return { state: cloned, mutations_applied };
});

// ── gate_rejected mutation ────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.GATE_REJECTED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  cloned.pipeline.current_tier = 'halted';
  mutations_applied.push('set pipeline.current_tier = halted');

  cloned.graph.status = 'halted';
  mutations_applied.push('set graph.status = halted');

  const gateType = context.gate_type ?? 'unknown';
  // Intentional: use || (not ??) so that an empty-string reason also falls back to the default.
  // The halt mutation uses ?? because an explicit empty string is a valid operator-supplied reason.
  const reason = context.reason || 'No reason provided';
  cloned.pipeline.halt_reason = `Gate rejected (${gateType}): ${reason}`;
  mutations_applied.push(`set pipeline.halt_reason = Gate rejected (${gateType}): ${reason}`);

  return { state: cloned, mutations_applied };
});

// ── final_rejected mutation ───────────────────────────────────────────────────

mutationRegistry.set(EVENTS.FINAL_REJECTED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const finalReviewNode = resolveNodeState(cloned, 'final_review', 'top');
  finalReviewNode.status = 'not_started';
  mutations_applied.push('set final_review.status = not_started');
  (finalReviewNode as StepNodeState).doc_path = null;
  mutations_applied.push('set final_review.doc_path = null');

  const finalGateNode = resolveNodeState(cloned, 'final_approval_gate', 'top');
  finalGateNode.status = 'not_started';
  mutations_applied.push('set final_approval_gate.status = not_started');
  (finalGateNode as GateNodeState).gate_active = false;
  mutations_applied.push('set final_approval_gate.gate_active = false');

  return { state: cloned, mutations_applied };
});

// ── halt mutation ─────────────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.HALT, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  cloned.pipeline.current_tier = 'halted';
  mutations_applied.push('set pipeline.current_tier = halted');

  cloned.graph.status = 'halted';
  mutations_applied.push('set graph.status = halted');

  const haltReason = context.reason ?? 'Pipeline halted by operator';
  cloned.pipeline.halt_reason = haltReason;
  mutations_applied.push(`set pipeline.halt_reason = ${haltReason}`);

  return { state: cloned, mutations_applied };
});

// ── gate_mode_set mutation ────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.GATE_MODE_SET, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mode = context.gate_mode;

  if (!mode || !['task', 'phase', 'autonomous'].includes(mode as string)) {
    throw new Error(`Invalid gate mode '${mode}': expected task, phase, or autonomous`);
  }

  cloned.pipeline.gate_mode = mode as string;
  return {
    state: cloned,
    mutations_applied: [`set pipeline.gate_mode = ${mode}`],
  };
});

// ── source_control_init mutation ──────────────────────────────────────────────

mutationRegistry.set(EVENTS.SOURCE_CONTROL_INIT, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);

  const branch = context.branch;
  const baseBranch = context.base_branch;
  if (!branch || !baseBranch) {
    throw new Error('source_control_init requires --branch and --base-branch');
  }

  cloned.pipeline.source_control = {
    branch: branch as string,
    base_branch: baseBranch as string,
    worktree_path: (context.worktree_path as string) ?? '.',
    auto_commit: (context.auto_commit as string) ?? 'never',
    auto_pr: (context.auto_pr as string) ?? 'never',
    remote_url: (context.remote_url as string) ?? null,
    compare_url: (context.compare_url as string) ?? null,
    pr_url: null,
  };

  return {
    state: cloned,
    mutations_applied: ['created pipeline.source_control'],
  };
});

// ── Public API ────────────────────────────────────────────────────────────────

export function getMutation(event: string): MutationFn | undefined {
  return mutationRegistry.get(event);
}
