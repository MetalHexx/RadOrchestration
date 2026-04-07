import type {
  PipelineState,
  PipelineTemplate,
  OrchestrationConfig,
  WalkerResult,
  EventContext,
  NodeState,
  GateNodeDef,
  StepNodeDef,
  GateNodeState,
} from './types.js';
import { NODE_STATUSES, NEXT_ACTIONS } from './constants.js';

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
 * Core DAG traversal function. Walks top-level template nodes in order,
 * checking dependencies and node status to determine the next action.
 *
 * Handles `step` and `gate` node kinds. Returns null for unsupported kinds
 * (conditional, parallel, for_each_*) — those are added in later tasks.
 *
 * Pure function except for mutating gate node state on auto-approval.
 */
export function walkDAG(
  state: PipelineState,
  template: PipelineTemplate,
  config: OrchestrationConfig,
): WalkerResult | null {
  const nodes = state.graph.nodes;
  const templateNodes = template.nodes;

  for (const nodeDef of templateNodes) {
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

    // Status: in_progress → return null (waiting for completed event)
    if (nodeState.status === NODE_STATUSES.IN_PROGRESS) {
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
          // Auto-approve the gate
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

      // Unsupported kinds (conditional, parallel, for_each_*)
      return null;
    }
  }

  // After iterating all nodes: check if all completed/skipped
  const allDone = templateNodes.every((nodeDef) => {
    const ns = nodes[nodeDef.id];
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
