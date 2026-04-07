import type {
  PipelineState,
  PipelineTemplate,
  OrchestrationConfig,
  WalkerResult,
  EventContext,
  NodeState,
  NodeDef,
  GateNodeDef,
  StepNodeDef,
  GateNodeState,
  ConditionalNodeDef,
  ParallelNodeDef,
  ConditionalNodeState,
  ParallelNodeState,
} from './types.js';
import { NODE_STATUSES, NEXT_ACTIONS } from './constants.js';
import { evaluateCondition } from './condition-evaluator.js';

/**
 * Resolves a template path to a state path by substituting iteration indices.
 * For this task, returns the templatePath unchanged (pass-through).
 * Iteration indexing is added in a later task.
 */
export function resolveNodeStatePath(
  templatePath: string,
  _context: Partial<EventContext>,
): string {
  return templatePath;
}

/**
 * Navigates a dot-path (e.g., "human_gates.after_planning") into a config
 * object and returns the resolved value. Returns undefined if the path
 * does not resolve.
 */
function resolveConfigValue(
  dotPath: string,
  config: OrchestrationConfig,
): unknown {
  const segments = dotPath.split('.');
  let current: unknown = config;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Checks whether all dependencies in a node's depends_on array are satisfied.
 * A dependency is satisfied if its status is 'completed' or 'skipped'.
 * Returns true if depends_on is empty or undefined.
 */
function checkDependencies(
  dependsOn: string[] | undefined,
  nodes: Record<string, NodeState>,
): boolean {
  if (!dependsOn || dependsOn.length === 0) {
    return true;
  }
  return dependsOn.every((depId) => {
    const depState = nodes[depId];
    return (
      depState !== undefined &&
      (depState.status === NODE_STATUSES.COMPLETED ||
        depState.status === NODE_STATUSES.SKIPPED)
    );
  });
}

/**
 * Creates an initial NodeState for a given NodeDef based on its kind.
 */
function scaffoldNodeState(nodeDef: NodeDef): NodeState {
  switch (nodeDef.kind) {
    case 'step':
      return { kind: 'step', status: NODE_STATUSES.NOT_STARTED, doc_path: null, retries: 0 };
    case 'gate':
      return { kind: 'gate', status: NODE_STATUSES.NOT_STARTED, gate_active: false };
    case 'conditional':
      return { kind: 'conditional', status: NODE_STATUSES.NOT_STARTED, branch_taken: null };
    case 'parallel': {
      const pState: ParallelNodeState = { kind: 'parallel', status: NODE_STATUSES.NOT_STARTED, nodes: {} };
      const pDef = nodeDef as ParallelNodeDef;
      for (const child of pDef.children) {
        pState.nodes[child.id] = scaffoldNodeState(child);
      }
      return pState;
    }
    case 'for_each_phase':
      return { kind: 'for_each_phase', status: NODE_STATUSES.NOT_STARTED, iterations: [] };
    case 'for_each_task':
      return { kind: 'for_each_task', status: NODE_STATUSES.NOT_STARTED, iterations: [] };
  }
}

/**
 * Recursive helper that walks an array of node definitions against their
 * corresponding state entries. Returns the first actionable WalkerResult,
 * or null if no action is available at this level.
 */
function walkNodes(
  nodeDefs: NodeDef[],
  nodes: Record<string, NodeState>,
  config: OrchestrationConfig,
  state: PipelineState,
): WalkerResult | null {
  for (const nodeDef of nodeDefs) {
    const nodeState = nodes[nodeDef.id];
    if (!nodeState) {
      continue;
    }

    // Dependencies not met → skip to next sibling
    if (!checkDependencies(nodeDef.depends_on, nodes)) {
      continue;
    }

    // Status: halted → return display_halted
    if (nodeState.status === NODE_STATUSES.HALTED) {
      return { action: NEXT_ACTIONS.DISPLAY_HALTED, context: {} };
    }

    // Status: completed or skipped → continue to next sibling
    if (
      nodeState.status === NODE_STATUSES.COMPLETED ||
      nodeState.status === NODE_STATUSES.SKIPPED
    ) {
      continue;
    }

    // Status: in_progress
    if (nodeState.status === NODE_STATUSES.IN_PROGRESS) {
      // Conditional in_progress: walk taken branch
      if (nodeDef.kind === 'conditional') {
        const condDef = nodeDef as ConditionalNodeDef;
        const condState = nodeState as ConditionalNodeState;
        const branchKey = condState.branch_taken;
        if (branchKey === null) {
          return null;
        }
        const branchNodes = condDef.branches[branchKey];
        const allBranchDone = branchNodes.every((bn) => {
          const bnState = nodes[bn.id];
          return (
            bnState !== undefined &&
            (bnState.status === NODE_STATUSES.COMPLETED ||
              bnState.status === NODE_STATUSES.SKIPPED)
          );
        });
        if (allBranchDone) {
          condState.status = NODE_STATUSES.COMPLETED;
          continue;
        }
        return walkNodes(branchNodes, nodes, config, state);
      }

      // Parallel in_progress: walk children sequentially
      if (nodeDef.kind === 'parallel') {
        const parallelDef = nodeDef as ParallelNodeDef;
        const parallelState = nodeState as ParallelNodeState;
        const allChildrenDone = parallelDef.children.every((child) => {
          const childState = parallelState.nodes[child.id];
          return (
            childState !== undefined &&
            (childState.status === NODE_STATUSES.COMPLETED ||
              childState.status === NODE_STATUSES.SKIPPED)
          );
        });
        if (allChildrenDone) {
          parallelState.status = NODE_STATUSES.COMPLETED;
          continue;
        }
        return walkNodes(parallelDef.children, parallelState.nodes, config, state);
      }

      // Step/gate in_progress → return null (waiting for completed event)
      return null;
    }

    // Status: not_started
    if (nodeState.status === NODE_STATUSES.NOT_STARTED) {
      // Step node
      if (nodeDef.kind === 'step') {
        const stepDef = nodeDef as StepNodeDef;
        return {
          action: stepDef.action,
          context: stepDef.context ?? {},
        };
      }

      // Gate node
      if (nodeDef.kind === 'gate') {
        const gateDef = nodeDef as GateNodeDef;
        const gateState = nodeState as GateNodeState;
        const configValue = resolveConfigValue(gateDef.mode_ref, config);

        // Check auto-approve: string mode
        if (
          typeof configValue === 'string' &&
          gateDef.auto_approve_modes &&
          gateDef.auto_approve_modes.includes(configValue)
        ) {
          gateState.status = NODE_STATUSES.COMPLETED;
          gateState.gate_active = false;
          continue;
        }

        // Check auto-approve: boolean mode (falsy = auto-approve)
        if (typeof configValue === 'boolean' && !configValue) {
          gateState.status = NODE_STATUSES.COMPLETED;
          gateState.gate_active = false;
          continue;
        }

        // Gate is active
        gateState.gate_active = true;
        return {
          action: gateDef.action_if_needed,
          context: {},
        };
      }

      // Conditional node
      if (nodeDef.kind === 'conditional') {
        const condDef = nodeDef as ConditionalNodeDef;
        const condState = nodeState as ConditionalNodeState;
        const condResult = evaluateCondition(condDef.condition, config, state);
        condState.branch_taken = condResult ? 'true' : 'false';
        const branchNodes = condDef.branches[condState.branch_taken];

        if (branchNodes.length === 0) {
          condState.status = NODE_STATUSES.COMPLETED;
          continue;
        }

        condState.status = NODE_STATUSES.IN_PROGRESS;
        for (const branchNode of branchNodes) {
          if (!(branchNode.id in nodes)) {
            nodes[branchNode.id] = scaffoldNodeState(branchNode);
          }
        }
        return walkNodes(branchNodes, nodes, config, state);
      }

      // Parallel node
      if (nodeDef.kind === 'parallel') {
        const parallelDef = nodeDef as ParallelNodeDef;
        const parallelState = nodeState as ParallelNodeState;
        parallelState.status = NODE_STATUSES.IN_PROGRESS;
        for (const child of parallelDef.children) {
          if (!(child.id in parallelState.nodes)) {
            parallelState.nodes[child.id] = scaffoldNodeState(child);
          }
        }
        return walkNodes(parallelDef.children, parallelState.nodes, config, state);
      }

      // Unsupported kinds (for_each_phase, for_each_task)
      return null;
    }
  }

  return null;
}

/**
 * Core DAG traversal function. Walks template nodes in order using a recursive
 * helper, checking dependencies and node status to determine the next action.
 *
 * Handles `step`, `gate`, `conditional`, and `parallel` node kinds.
 * Returns null for unsupported kinds (for_each_*) — those are added in later tasks.
 */
export function walkDAG(
  state: PipelineState,
  template: PipelineTemplate,
  config: OrchestrationConfig,
): WalkerResult | null {
  const result = walkNodes(template.nodes, state.graph.nodes, config, state);
  if (result !== null) {
    return result;
  }

  // After iterating all nodes: check if all completed/skipped
  const allDone = template.nodes.every((nodeDef) => {
    const ns = state.graph.nodes[nodeDef.id];
    return (
      ns !== undefined &&
      (ns.status === NODE_STATUSES.COMPLETED ||
        ns.status === NODE_STATUSES.SKIPPED)
    );
  });

  if (allDone) {
    return { action: NEXT_ACTIONS.DISPLAY_COMPLETE, context: {} };
  }

  return null;
}
