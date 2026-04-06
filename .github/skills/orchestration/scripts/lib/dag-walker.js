'use strict';

const {
  DAG_NODE_TYPES,
  DAG_NODE_STATUSES,
  NEXT_ACTIONS,
  HUMAN_GATE_MODES,
} = require('./constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPhaseId(phaseNumber) {
  return 'P' + String(phaseNumber).padStart(2, '0');
}

function formatTaskId(phaseNumber, taskNumber) {
  return 'P' + String(phaseNumber).padStart(2, '0') + '-T' + String(taskNumber).padStart(2, '0');
}

// ─── Gate Mode Resolution ───────────────────────────────────────────────────

/**
 * Resolve effective gate mode for a project.
 * Reads from state first; falls back to config when state value is null/undefined.
 * @param {Object} state - post-mutation state
 * @param {Object} config - merged orchestration config
 * @returns {'task' | 'phase' | 'autonomous' | 'ask'}
 */
function resolveGateMode(state, config) {
  return state.pipeline.gate_mode
    ?? state.config?.human_gates?.execution_mode
    ?? config.human_gates?.execution_mode
    ?? 'ask';
}

// ─── Core Walker Functions ──────────────────────────────────────────────────

/**
 * Find the next ready node in the DAG. A node is "ready" when:
 * 1. Its status is 'not_started'
 * 2. All nodes in its depends_on list have status 'complete', 'skipped', or 'failed' (corrective successors)
 *
 * Returns the first ready node in execution_order (topological) sequence.
 * Returns null when no ready node exists.
 *
 * @param {Object.<string, DagNode>} nodes - node map from state.dag.nodes
 * @param {string[]} executionOrder - topological sort from state.dag.execution_order
 * @returns {DagNode | null}
 */
function findNextReadyNode(nodes, executionOrder) {
  for (const nodeId of executionOrder) {
    const node = nodes[nodeId];
    if (!node || (node.status !== DAG_NODE_STATUSES.NOT_STARTED && node.status !== DAG_NODE_STATUSES.IN_PROGRESS)) continue;

    const depsReady = node.depends_on.every(depId => {
      const dep = nodes[depId];
      return dep && (dep.status === DAG_NODE_STATUSES.COMPLETE || dep.status === DAG_NODE_STATUSES.SKIPPED || dep.status === DAG_NODE_STATUSES.FAILED);
    });

    if (depsReady) return node;
  }

  return null;
}

/**
 * Map a ready DagNode to { action, context } using the node's type,
 * action field, and contextual data.
 *
 * @param {DagNode} node - the ready node
 * @param {Object} state - full v5 state (for gate mode resolution, source control config)
 * @param {Object} config - merged orchestration config
 * @returns {{ action: string, context: Object }}
 */
function mapNodeToAction(node, state, config) {
  switch (node.type) {
    case DAG_NODE_TYPES.STEP:
      return mapStepNode(node, state);

    case DAG_NODE_TYPES.GATE:
      return mapGateNode(node, state, config);

    case DAG_NODE_TYPES.FOR_EACH_PHASE:
    case DAG_NODE_TYPES.FOR_EACH_TASK:
      return {
        action: node.action || NEXT_ACTIONS.DISPLAY_HALTED,
        context: { details: 'Container node awaiting expansion: ' + node.id },
      };

    default:
      return {
        action: NEXT_ACTIONS.DISPLAY_HALTED,
        context: { details: 'Unsupported node type: ' + node.type },
      };
  }
}

// ─── Step Node Mapping ──────────────────────────────────────────────────────

function mapStepNode(node, state) {
  // Start with node.context spread (or empty if nullish)
  const ctx = node.context ? { ...node.context } : {};

  // Add phase-scoped fields when present
  if (node.phase_number != null) {
    ctx.phase_number = node.phase_number;
    ctx.phase_id = formatPhaseId(node.phase_number);
  }

  // Add task-scoped fields when present
  if (node.task_number != null) {
    ctx.task_number = node.task_number;
    ctx.task_id = formatTaskId(node.phase_number, node.task_number);
  }

  // Add doc paths when present
  if (node.docs) {
    if (node.docs.handoff) ctx.handoff_doc = node.docs.handoff;
    if (node.docs.phase_report) ctx.phase_report_doc = node.docs.phase_report;
  }

  // Add source control fields for source control actions
  if (node.action === NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_COMMIT
      || node.action === NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_PR) {
    const sc = state.pipeline.source_control;
    if (sc) {
      if (sc.branch != null) ctx.branch = sc.branch;
      if (sc.worktree_path != null) ctx.worktree_path = sc.worktree_path;
      if (node.action === NEXT_ACTIONS.INVOKE_SOURCE_CONTROL_PR && sc.base_branch != null) {
        ctx.base_branch = sc.base_branch;
      }
    }
  }

  return { action: node.action, context: ctx };
}

// ─── Gate Node Mapping ──────────────────────────────────────────────────────

function mapGateNode(node, state, config) {
  // Planning and final gates are unconditional
  if (node.gate_type === 'planning' || node.gate_type === 'final') {
    return { action: node.action, context: {} };
  }

  // Execution gates — apply gate mode logic
  const mode = resolveGateMode(state, config);

  if (mode === HUMAN_GATE_MODES.AUTONOMOUS) {
    // Auto-advance: return null-action signal to mark complete and re-invoke
    return null;
  }

  if (mode === HUMAN_GATE_MODES.ASK && state.pipeline.gate_mode == null) {
    return { action: NEXT_ACTIONS.ASK_GATE_MODE, context: {} };
  }

  return { action: node.action, context: {} };
}

// ─── Top-Level Entry Point ──────────────────────────────────────────────────

/**
 * Pure state inspector. Given post-mutation v5 state and config, traverses
 * the expanded DAG to find the next ready node and returns the corresponding
 * action and context.
 *
 * Same contract as the current resolver: deterministic, side-effect-free,
 * state-in → action-out.
 *
 * @param {Object} state - post-mutation v5 state (must have state.dag)
 * @param {Object} config - merged orchestration config
 * @returns {{ action: string, context: Object }}
 */
function resolveNextAction(state, config) {
  const { nodes, execution_order: executionOrder } = state.dag;

  // Check halted
  if (state.pipeline.current_tier === 'halted') {
    return { action: NEXT_ACTIONS.DISPLAY_HALTED, context: { details: 'Pipeline is halted' } };
  }

  // Check pipeline complete — all nodes are 'complete' or 'skipped'
  const allDone = Object.values(nodes).every(
    n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED
  );
  if (allDone) {
    return { action: NEXT_ACTIONS.DISPLAY_COMPLETE, context: {} };
  }

  // Find next ready node
  const readyNode = findNextReadyNode(nodes, executionOrder);

  if (!readyNode) {
    return {
      action: NEXT_ACTIONS.DISPLAY_HALTED,
      context: { details: 'No ready nodes — pipeline is stuck' },
    };
  }

  return mapNodeToAction(readyNode, state, config);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { resolveNextAction, findNextReadyNode, mapNodeToAction };
