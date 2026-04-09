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
  ForEachPhaseNodeDef,
  ForEachTaskNodeDef,
  PipelineTemplate,
} from './types.js';
import { EVENTS } from './constants.js';
import { scaffoldNodeState } from './scaffold.js';

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
  // Phase-level corrective tasks contain task body nodes; check before task loop resolution
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
  [EVENTS.RESEARCH_STARTED, 'research'],
  [EVENTS.PRD_STARTED, 'prd'],
  [EVENTS.DESIGN_STARTED, 'design'],
  [EVENTS.ARCHITECTURE_STARTED, 'architecture'],
  [EVENTS.MASTER_PLAN_STARTED, 'master_plan'],
];

for (const [eventName, nodeId] of planningStartedSteps) {
  mutationRegistry.set(eventName, (state, _context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    const node = resolveNodeState(cloned, nodeId, 'top');
    node.status = 'in_progress';
    mutations_applied.push(`set ${nodeId}.status = in_progress`);

    if (eventName === EVENTS.RESEARCH_STARTED) {
      cloned.graph.status = 'in_progress';
      mutations_applied.push('set graph.status = in_progress');
    }

    return { state: cloned, mutations_applied };
  });
}

// ── Planning _completed mutations ─────────────────────────────────────────────

const planningCompletedSteps: Array<[string, string]> = [
  [EVENTS.RESEARCH_COMPLETED, 'research'],
  [EVENTS.PRD_COMPLETED, 'prd'],
  [EVENTS.DESIGN_COMPLETED, 'design'],
  [EVENTS.ARCHITECTURE_COMPLETED, 'architecture'],
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

    const node = resolveNodeState(cloned, nodeId, 'phase', context.phase);
    node.status = 'in_progress';
    mutations_applied.push(`set ${nodeId}.status = in_progress`);

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

    const node = resolveNodeState(cloned, nodeId, 'phase', context.phase);
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

  const node = resolveNodeState(cloned, 'phase_review', 'phase', context.phase);
  node.status = 'completed';
  mutations_applied.push('set phase_review.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set phase_review.doc_path = ${docPath ?? 'null'}`);

  const verdict = context.verdict ?? null;
  (node as StepNodeState).verdict = verdict;
  mutations_applied.push(`set phase_review.verdict = ${verdict ?? 'null'}`);

  if (verdict === 'changes_requested') {
    const iteration = resolvePhaseIteration(cloned, context.phase ?? 1);

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
        // Preserve phase_review.doc_path — context-enrichment reads it for previous_review
        if (nodeId !== 'phase_review') {
          (n as StepNodeState).doc_path = null;
        }
        (n as StepNodeState).verdict = null;
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
    });

    mutations_applied.push('reset phase for corrective re-planning');
  } else if (verdict === 'rejected') {
    const iteration = resolvePhaseIteration(cloned, context.phase ?? 1);
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

    const node = resolveNodeState(cloned, nodeId, 'task', context.phase, context.task);
    node.status = 'in_progress';
    mutations_applied.push(`set ${nodeId}.status = in_progress`);

    return { state: cloned, mutations_applied };
  });
}

// ── task_handoff_created (stores doc_path) ────────────────────────────────────

mutationRegistry.set(EVENTS.TASK_HANDOFF_CREATED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'task_handoff', 'task', context.phase, context.task);
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

  const node = resolveNodeState(cloned, 'task_executor', 'task', context.phase, context.task);
  node.status = 'completed';
  mutations_applied.push('set task_executor.status = completed');

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

  // Base behavior: always mark code_review completed with doc_path and verdict
  const node = resolveNodeState(cloned, 'code_review', 'task', context.phase, context.task);
  node.status = 'completed';
  mutations_applied.push('set code_review.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set code_review.doc_path = ${docPath ?? 'null'}`);

  const verdict = context.verdict ?? null;
  (node as StepNodeState).verdict = verdict;
  mutations_applied.push(`set code_review.verdict = ${verdict ?? 'null'}`);

  // Verdict routing
  if (verdict === 'changes_requested') {
    const iteration = resolveTaskIteration(cloned, context.phase ?? 1, context.task ?? 1);
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
        reason: 'Code review requested changes',
        injected_after: 'code_review',
        status: 'not_started',
        nodes,
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
  } else if (verdict === 'rejected') {
    const iteration = resolveTaskIteration(cloned, context.phase ?? 1, context.task ?? 1);
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

  if (verdict === 'approved') {
    cloned.pipeline.current_tier = 'review';
    mutations_applied.push('set pipeline.current_tier = review');
  }

  return { state: cloned, mutations_applied };
});

// ── Source control commit mutations (phase_commit as phase-scoped sibling) ────

mutationRegistry.set(EVENTS.TASK_COMMIT_REQUESTED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'phase_commit', 'phase', context.phase);
  node.status = 'in_progress';
  mutations_applied.push('set phase_commit.status = in_progress');

  return { state: cloned, mutations_applied };
});

mutationRegistry.set(EVENTS.TASK_COMMITTED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'phase_commit', 'phase', context.phase);
  node.status = 'completed';
  mutations_applied.push('set phase_commit.status = completed');

  if (cloned.pipeline.source_control) {
    cloned.pipeline.source_control.commit_hash = (context.commit_hash as string) ?? null;
    mutations_applied.push(`set pipeline.source_control.commit_hash = ${context.commit_hash ?? 'null'}`);
  }

  return { state: cloned, mutations_applied };
});

// ── Source control PR mutations (final_pr as top-scoped sibling) ──────────────

mutationRegistry.set(EVENTS.PR_REQUESTED, (state, _context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

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

  if (cloned.pipeline.source_control) {
    cloned.pipeline.source_control.pr_url = (context.pr_url as string) ?? null;
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

  const phaseLoopNode = cloned.graph.nodes['phase_loop'];
  if (phaseLoopNode.kind !== 'for_each_phase') {
    throw new Error(`Expected phase_loop to be a for_each_phase node, got ${phaseLoopNode.kind}`);
  }
  phaseLoopNode.iterations = [];
  mutations_applied.push('set phase_loop.iterations = []');

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
    commit_hash: null,
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
