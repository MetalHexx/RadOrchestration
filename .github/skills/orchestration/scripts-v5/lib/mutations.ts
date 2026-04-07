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

// ── Public API ────────────────────────────────────────────────────────────────

export function getMutation(event: string): MutationFn | undefined {
  return mutationRegistry.get(event);
}
