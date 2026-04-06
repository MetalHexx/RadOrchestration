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
 * Zero-pad a number to two digits.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Compute topological order for body node definitions.
 * @param {Object[]} body - array of body template definitions
 * @returns {string[]} body node IDs in execution order
 */
function computeBodyOrder(body) {
  const tempNodes = {};
  for (const def of body) {
    tempNodes[def.id] = {
      id: def.id,
      type: def.type || DAG_NODE_TYPES.STEP,
      status: DAG_NODE_STATUSES.NOT_STARTED,
      depends_on: Array.isArray(def.depends_on) ? [...def.depends_on] : [],
      template_node_id: def.id,
    };
  }
  return computeExecutionOrder(tempNodes);
}

/**
 * Expand a for_each_phase container into per-phase nodes.
 *
 * @param {Object.<string, DagNode>} nodes - Mutated in place
 * @param {string} containerNodeId - ID of the for_each_phase node to expand
 * @param {number} phaseCount - Number of phases to create
 * @param {Object[]} phases - Phase metadata array, each with { name: string }
 * @returns {string[]} newNodeIds - IDs of all created nodes
 */
function expandPhases(nodes, containerNodeId, phaseCount, phases) {
  const container = nodes[containerNodeId];
  const body = container.body;
  const externalDeps = [...container.depends_on];
  const newIds = [];

  // Find downstream nodes that depend on the container
  const downstream = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.depends_on.includes(containerNodeId)) {
      downstream.push(id);
    }
  }

  // Compute body topology
  const bodyOrder = computeBodyOrder(body);
  const bodyExitId = bodyOrder[bodyOrder.length - 1];
  const bodyIdSet = new Set(body.map(b => b.id));

  for (let p = 1; p <= phaseCount; p++) {
    const prefix = `P${pad2(p)}`;

    for (const bodyDef of body) {
      const scopedId = `${prefix}.${bodyDef.id}`;
      const node = buildNode(bodyDef);
      node.id = scopedId;
      node.template_node_id = bodyDef.id;
      node.phase_number = p;

      if (phases && phases[p - 1] && phases[p - 1].name) {
        node.phase_name = phases[p - 1].name;
      }

      // Rewire depends_on
      const isEntryNode = !Array.isArray(bodyDef.depends_on) || bodyDef.depends_on.length === 0;
      if (isEntryNode) {
        if (p === 1) {
          node.depends_on = [...externalDeps];
        } else {
          node.depends_on = [`P${pad2(p - 1)}.${bodyExitId}`];
        }
      } else {
        node.depends_on = bodyDef.depends_on.map(dep =>
          bodyIdSet.has(dep) ? `${prefix}.${dep}` : dep
        );
      }

      nodes[scopedId] = node;
      newIds.push(scopedId);
    }
  }

  // Rewire downstream nodes
  const lastPhaseExitId = `P${pad2(phaseCount)}.${bodyExitId}`;
  for (const id of downstream) {
    nodes[id].depends_on = nodes[id].depends_on.map(d =>
      d === containerNodeId ? lastPhaseExitId : d
    );
  }

  // Delete container
  delete nodes[containerNodeId];

  // Recompute execution order
  computeExecutionOrder(nodes);

  return newIds;
}

/**
 * Expand a for_each_task container into per-task nodes.
 *
 * @param {Object.<string, DagNode>} nodes - Mutated in place
 * @param {string} containerNodeId - ID of the for_each_task node to expand
 * @param {number} phaseNumber - 1-based phase number for scoped IDs
 * @param {Object[]} tasks - Task metadata array, each with { name: string }
 * @returns {string[]} newNodeIds - IDs of all created nodes
 */
function expandTasks(nodes, containerNodeId, phaseNumber, tasks) {
  const container = nodes[containerNodeId];
  const body = container.body;
  const externalDeps = [...container.depends_on];
  const newIds = [];

  // Find downstream nodes
  const downstream = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.depends_on.includes(containerNodeId)) {
      downstream.push(id);
    }
  }

  // Compute body topology
  const bodyOrder = computeBodyOrder(body);
  const bodyExitId = bodyOrder[bodyOrder.length - 1];
  const bodyIdSet = new Set(body.map(b => b.id));

  const phasePrefix = `P${pad2(phaseNumber)}`;

  for (let t = 1; t <= tasks.length; t++) {
    const taskPrefix = `${phasePrefix}.T${pad2(t)}`;

    for (const bodyDef of body) {
      const scopedId = `${taskPrefix}.${bodyDef.id}`;
      const node = buildNode(bodyDef);
      node.id = scopedId;
      node.template_node_id = bodyDef.id;
      node.phase_number = phaseNumber;
      node.task_number = t;

      if (tasks[t - 1] && tasks[t - 1].name) {
        node.task_name = tasks[t - 1].name;
      }

      // Rewire depends_on
      const isEntryNode = !Array.isArray(bodyDef.depends_on) || bodyDef.depends_on.length === 0;
      if (isEntryNode) {
        if (t === 1) {
          node.depends_on = [...externalDeps];
        } else {
          node.depends_on = [`${phasePrefix}.T${pad2(t - 1)}.${bodyExitId}`];
        }
      } else {
        node.depends_on = bodyDef.depends_on.map(dep =>
          bodyIdSet.has(dep) ? `${taskPrefix}.${dep}` : dep
        );
      }

      nodes[scopedId] = node;
      newIds.push(scopedId);
    }
  }

  // Rewire downstream nodes
  const lastTaskExitId = `${phasePrefix}.T${pad2(tasks.length)}.${bodyExitId}`;
  for (const id of downstream) {
    nodes[id].depends_on = nodes[id].depends_on.map(d =>
      d === containerNodeId ? lastTaskExitId : d
    );
  }

  // Delete container
  delete nodes[containerNodeId];

  // Recompute execution order
  computeExecutionOrder(nodes);

  return newIds;
}

/**
 * Inject a corrective task after a failed review.
 *
 * @param {Object.<string, DagNode>} nodes - Mutated in place
 * @param {string} failedReviewNodeId - ID of the review node that failed
 * @param {number} phaseNumber - 1-based phase number
 * @param {number} taskNumber - 1-based task number
 * @param {number} retryNumber - Current retry count (1, 2, ...)
 * @returns {string[]} newNodeIds - IDs of the 3 injected nodes
 */
function injectCorrectiveTask(nodes, failedReviewNodeId, phaseNumber, taskNumber, retryNumber) {
  const prefix = `P${pad2(phaseNumber)}.T${pad2(taskNumber)}`;

  const handoffId = `${prefix}.create_task_handoff_r${retryNumber}`;
  const codeId = `${prefix}.execute_coding_task_r${retryNumber}`;
  const reviewId = `${prefix}.code_review_r${retryNumber}`;

  // Rewire downstream nodes that depended on failedReviewNodeId
  for (const node of Object.values(nodes)) {
    node.depends_on = node.depends_on.map(d =>
      d === failedReviewNodeId ? reviewId : d
    );
  }

  // Create the three corrective nodes
  nodes[handoffId] = {
    id: handoffId,
    type: DAG_NODE_TYPES.STEP,
    action: 'create_task_handoff',
    events: { started: 'task_handoff_started', completed: 'task_handoff_created' },
    template_node_id: 'create_task_handoff',
    status: DAG_NODE_STATUSES.NOT_STARTED,
    depends_on: [failedReviewNodeId],
    phase_number: phaseNumber,
    task_number: taskNumber,
    retries: retryNumber,
  };

  nodes[codeId] = {
    id: codeId,
    type: DAG_NODE_TYPES.STEP,
    action: 'execute_task',
    events: { completed: 'task_completed' },
    template_node_id: 'execute_coding_task',
    status: DAG_NODE_STATUSES.NOT_STARTED,
    depends_on: [handoffId],
    phase_number: phaseNumber,
    task_number: taskNumber,
    retries: retryNumber,
  };

  nodes[reviewId] = {
    id: reviewId,
    type: DAG_NODE_TYPES.STEP,
    action: 'spawn_code_reviewer',
    events: { completed: 'code_review_completed' },
    template_node_id: 'code_review',
    status: DAG_NODE_STATUSES.NOT_STARTED,
    depends_on: [codeId],
    phase_number: phaseNumber,
    task_number: taskNumber,
    retries: retryNumber,
  };

  // Recompute execution order
  computeExecutionOrder(nodes);

  return [handoffId, codeId, reviewId];
}

module.exports = {
  expandTemplate,
  computeExecutionOrder,
  expandPhases,
  expandTasks,
  injectCorrectiveTask,
};
