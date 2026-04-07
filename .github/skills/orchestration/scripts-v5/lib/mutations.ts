import type {
  PipelineState,
  NodeState,
  StepNodeState,
  GateNodeState,
  MutationFn,
  MutationResult,
} from './types.js';
import { EVENTS } from './constants.js';

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

  const phaseLoopNode = state.graph.nodes['phase_loop'];
  if (phaseLoopNode.kind !== 'for_each_phase') {
    throw new Error(`Expected phase_loop to be a for_each_phase node, got ${phaseLoopNode.kind}`);
  }
  const phaseIteration = phaseLoopNode.iterations[(phase ?? 1) - 1];

  if (scope === 'phase') {
    return phaseIteration.nodes[nodeId];
  }

  // scope === 'task'
  const taskLoopNode = phaseIteration.nodes['task_loop'];
  if (taskLoopNode.kind !== 'for_each_task') {
    throw new Error(`Expected task_loop to be a for_each_task node, got ${taskLoopNode.kind}`);
  }
  const taskIteration = taskLoopNode.iterations[(task ?? 1) - 1];
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

mutationRegistry.set(EVENTS.FINAL_REVIEW_APPROVED, (state, _context, _config, _template): MutationResult => {
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
  [EVENTS.PHASE_REPORT_COMPLETED, 'phase_report'],
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

mutationRegistry.set(EVENTS.PHASE_REVIEW_COMPLETED, (state, context, _config, _template): MutationResult => {
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

// ── execution_completed ───────────────────────────────────────────────────────

mutationRegistry.set(EVENTS.EXECUTION_COMPLETED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'task_executor', 'task', context.phase, context.task);
  node.status = 'completed';
  mutations_applied.push('set task_executor.status = completed');

  return { state: cloned, mutations_applied };
});

// ── code_review_completed (stores doc_path + verdict) ────────────────────────

mutationRegistry.set(EVENTS.CODE_REVIEW_COMPLETED, (state, context, _config, _template): MutationResult => {
  const cloned = structuredClone(state);
  const mutations_applied: string[] = [];

  const node = resolveNodeState(cloned, 'code_review', 'task', context.phase, context.task);
  node.status = 'completed';
  mutations_applied.push('set code_review.status = completed');

  const docPath = context.doc_path ?? null;
  (node as StepNodeState).doc_path = docPath;
  mutations_applied.push(`set code_review.doc_path = ${docPath ?? 'null'}`);

  const verdict = context.verdict ?? null;
  (node as StepNodeState).verdict = verdict;
  mutations_applied.push(`set code_review.verdict = ${verdict ?? 'null'}`);

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

  return { state: cloned, mutations_applied };
});

// ── Source control commit mutations (phase_commit as phase-scoped sibling) ────

const sourceControlCommitSteps: Array<[string, 'in_progress' | 'completed']> = [
  [EVENTS.SOURCE_CONTROL_COMMIT_STARTED, 'in_progress'],
  [EVENTS.SOURCE_CONTROL_COMMIT_COMPLETED, 'completed'],
];

for (const [eventName, newStatus] of sourceControlCommitSteps) {
  mutationRegistry.set(eventName, (state, context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    const node = resolveNodeState(cloned, 'phase_commit', 'phase', context.phase);
    node.status = newStatus;
    mutations_applied.push(`set phase_commit.status = ${newStatus}`);

    return { state: cloned, mutations_applied };
  });
}

// ── Source control PR mutations (final_pr as top-scoped sibling) ──────────────

const sourceControlPrSteps: Array<[string, 'in_progress' | 'completed']> = [
  [EVENTS.SOURCE_CONTROL_PR_STARTED, 'in_progress'],
  [EVENTS.SOURCE_CONTROL_PR_COMPLETED, 'completed'],
];

for (const [eventName, newStatus] of sourceControlPrSteps) {
  mutationRegistry.set(eventName, (state, _context, _config, _template): MutationResult => {
    const cloned = structuredClone(state);
    const mutations_applied: string[] = [];

    const node = resolveNodeState(cloned, 'final_pr', 'top');
    node.status = newStatus;
    mutations_applied.push(`set final_pr.status = ${newStatus}`);

    return { state: cloned, mutations_applied };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getMutation(event: string): MutationFn | undefined {
  return mutationRegistry.get(event);
}
