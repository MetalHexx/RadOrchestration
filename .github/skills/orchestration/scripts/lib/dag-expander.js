'use strict';

const { DAG_NODE_TYPES, DAG_NODE_STATUSES } = require('./constants');

/**
 * Build a DagNode from a template node definition.
 * Only top-level nodes become entries in the node map.
 */
function buildNode(templateNode) {
  const node = {
    id: templateNode.id,
    type: templateNode.type,
    status: DAG_NODE_STATUSES.NOT_STARTED,
    depends_on: Array.isArray(templateNode.depends_on) ? templateNode.depends_on : [],
    template_node_id: templateNode.id,
  };

  switch (templateNode.type) {
    case DAG_NODE_TYPES.STEP:
      if (templateNode.action != null) node.action = templateNode.action;
      if (templateNode.events != null) node.events = templateNode.events;
      if (templateNode.planning_step != null) node.planning_step = templateNode.planning_step;
      break;

    case DAG_NODE_TYPES.GATE:
      if (templateNode.gate_type != null) node.gate_type = templateNode.gate_type;
      if (templateNode.gate_action != null) node.action = templateNode.gate_action;
      break;

    case DAG_NODE_TYPES.FOR_EACH_PHASE:
    case DAG_NODE_TYPES.FOR_EACH_TASK:
      if (templateNode.body != null) node.body = templateNode.body;
      break;

    case DAG_NODE_TYPES.CONDITIONAL:
      if (templateNode.body != null) node.body = templateNode.body;
      if (templateNode.condition != null) node.condition = templateNode.condition;
      if (templateNode.branches != null) node.branches = templateNode.branches;
      break;

    case DAG_NODE_TYPES.PARALLEL:
      if (templateNode.body != null) node.body = templateNode.body;
      if (templateNode.branches != null) node.branches = templateNode.branches;
      break;
  }

  return node;
}

/**
 * Expand a validated pipeline template into the initial DAG node map
 * and compute topological execution order.
 *
 * @param {Object} template - validated template object with { name, description?, nodes[] }
 * @returns {{ nodes: Object.<string, DagNode>, execution_order: string[] }}
 */
function expandTemplate(template) {
  const nodes = {};

  for (const templateNode of template.nodes) {
    const node = buildNode(templateNode);
    nodes[node.id] = node;
  }

  const execution_order = computeExecutionOrder(nodes);

  return { nodes, execution_order };
}

/**
 * Compute topological execution order using Kahn's algorithm.
 *
 * @param {Object.<string, DagNode>} nodes - node map keyed by node ID
 * @returns {string[]} topologically sorted array of node IDs
 * @throws {Error} if a cycle is detected ('Cycle detected in DAG')
 */
function computeExecutionOrder(nodes) {
  const nodeIds = Object.keys(nodes);
  const inDegree = {};
  const adjacency = {};

  // Initialize
  for (const id of nodeIds) {
    inDegree[id] = 0;
    adjacency[id] = [];
  }

  // Build in-degree and adjacency (dependency → dependent)
  for (const id of nodeIds) {
    const deps = nodes[id].depends_on;
    for (const dep of deps) {
      if (adjacency[dep] != null) {
        adjacency[dep].push(id);
        inDegree[id]++;
      }
    }
  }

  // Initialize queue with zero in-degree nodes
  const queue = [];
  for (const id of nodeIds) {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  }

  const result = [];

  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);

    for (const neighbor of adjacency[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length < nodeIds.length) {
    throw new Error('Cycle detected in DAG');
  }

  return result;
}

/**
 * Expand a for_each_phase container into per-phase nodes.
 * Stub — deferred to Phase 3.
 *
 * @param {Object.<string, DagNode>} nodes
 * @param {string} containerNodeId
 * @param {number} phaseCount
 * @param {Object[]} phases
 * @returns {string[]}
 */
function expandPhases(nodes, containerNodeId, phaseCount, phases) {
  throw new Error('expandPhases is not implemented — deferred to Phase 3');
}

/**
 * Expand a for_each_task container into per-task nodes.
 * Stub — deferred to Phase 3.
 *
 * @param {Object.<string, DagNode>} nodes
 * @param {string} containerNodeId
 * @param {number} phaseNumber
 * @param {Object[]} tasks
 * @returns {string[]}
 */
function expandTasks(nodes, containerNodeId, phaseNumber, tasks) {
  throw new Error('expandTasks is not implemented — deferred to Phase 3');
}

/**
 * Inject a corrective task after a failed review.
 * Stub — deferred to Phase 3.
 *
 * @param {Object.<string, DagNode>} nodes
 * @param {string} failedReviewNodeId
 * @param {number} phaseNumber
 * @param {number} taskNumber
 * @param {number} retryNumber
 * @returns {string[]}
 */
function injectCorrectiveTask(nodes, failedReviewNodeId, phaseNumber, taskNumber, retryNumber) {
  throw new Error('injectCorrectiveTask is not implemented — deferred to Phase 3');
}

module.exports = {
  expandTemplate,
  computeExecutionOrder,
  expandPhases,
  expandTasks,
  injectCorrectiveTask,
};
