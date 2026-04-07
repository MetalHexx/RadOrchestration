import type {
  PipelineState,
  PipelineTemplate,
  OrchestrationConfig,
  NodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  ParallelNodeState,
  CorrectiveTaskEntry,
  IterationEntry,
} from './types.js';
import { NODE_STATUSES, GRAPH_STATUSES } from './constants.js';

const validNodeStatuses = new Set<string>(Object.values(NODE_STATUSES));
const validGraphStatuses = new Set<string>(Object.values(GRAPH_STATUSES));

// ── Public API ────────────────────────────────────────────────────────────────

export function validateState(
  _previousState: PipelineState | null,
  proposedState: PipelineState,
  config: OrchestrationConfig,
  template: PipelineTemplate,
): string[] {
  return [
    ...checkGraphStatus(proposedState),
    ...checkNodeStatuses(proposedState.graph.nodes, 'graph.nodes'),
    ...checkIterationIndices(proposedState.graph.nodes, 'graph.nodes'),
    ...checkCompletedParentChildren(proposedState.graph.nodes, 'graph.nodes'),
    ...checkCorrectiveTaskStructure(proposedState.graph.nodes, 'graph.nodes'),
    ...checkIterationLimits(proposedState, config),
    ...checkNodeKindMatchesTemplate(proposedState, template),
  ];
}

// ── Check: valid graph status ─────────────────────────────────────────────────

function checkGraphStatus(state: PipelineState): string[] {
  if (!validGraphStatuses.has(state.graph.status)) {
    return [`Invalid graph status: '${state.graph.status}'`];
  }
  return [];
}

// ── Check: valid node statuses (recursive) ────────────────────────────────────

function checkNodeStatuses(nodes: Record<string, NodeState>, path: string): string[] {
  const errors: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const nodePath = `${path}.${id}`;
    if (!validNodeStatuses.has(node.status)) {
      errors.push(`Invalid node status '${node.status}' at ${nodePath}`);
    }
    if (node.kind === 'for_each_phase' || node.kind === 'for_each_task') {
      for (const iter of node.iterations) {
        if (!validNodeStatuses.has(iter.status)) {
          errors.push(`Invalid iteration status '${iter.status}' at ${nodePath}.iterations[${iter.index}]`);
        }
        errors.push(...checkNodeStatuses(iter.nodes, `${nodePath}.iterations[${iter.index}].nodes`));
        for (const ct of iter.corrective_tasks) {
          if (!validNodeStatuses.has(ct.status)) {
            errors.push(`Invalid corrective task status '${ct.status}' at ${nodePath}.iterations[${iter.index}].corrective_tasks[${ct.index}]`);
          }
          errors.push(...checkNodeStatuses(ct.nodes, `${nodePath}.iterations[${iter.index}].corrective_tasks[${ct.index}].nodes`));
        }
      }
    }
    if (node.kind === 'parallel') {
      errors.push(...checkNodeStatuses(node.nodes, `${nodePath}.nodes`));
    }
  }
  return errors;
}

// ── Check: sequential iteration indices ───────────────────────────────────────

function checkIterationIndices(nodes: Record<string, NodeState>, path: string): string[] {
  const errors: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const nodePath = `${path}.${id}`;
    if (node.kind === 'for_each_phase' || node.kind === 'for_each_task') {
      for (let i = 0; i < node.iterations.length; i++) {
        const iter = node.iterations[i];
        if (iter.index !== i) {
          errors.push(`Iteration index mismatch at ${nodePath}.iterations[${i}]: expected ${i}, got ${iter.index}`);
        }
        for (let j = 0; j < iter.corrective_tasks.length; j++) {
          const ct = iter.corrective_tasks[j];
          if (ct.index !== j + 1) {
            errors.push(`Corrective task index mismatch at ${nodePath}.iterations[${i}].corrective_tasks[${j}]: expected ${j + 1}, got ${ct.index}`);
          }
        }
        // Recurse into iteration nodes
        errors.push(...checkIterationIndices(iter.nodes, `${nodePath}.iterations[${i}].nodes`));
      }
    }
    if (node.kind === 'parallel') {
      errors.push(...checkIterationIndices(node.nodes, `${nodePath}.nodes`));
    }
  }
  return errors;
}

// ── Check: no in_progress children under completed parent ─────────────────────

function checkCompletedParentChildren(nodes: Record<string, NodeState>, path: string): string[] {
  const errors: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const nodePath = `${path}.${id}`;
    if (node.kind === 'for_each_phase' || node.kind === 'for_each_task') {
      if (node.status === 'completed') {
        for (const iter of node.iterations) {
          errors.push(...findInProgressNodes(iter.nodes, `${nodePath}.iterations[${iter.index}].nodes`, nodePath));
        }
      }
      // Recurse even when not completed to check nested for_each / parallel nodes
      for (const iter of node.iterations) {
        errors.push(...checkCompletedParentChildren(iter.nodes, `${nodePath}.iterations[${iter.index}].nodes`));
      }
    }
    if (node.kind === 'parallel') {
      if (node.status === 'completed') {
        errors.push(...findInProgressNodes(node.nodes, `${nodePath}.nodes`, nodePath));
      }
      // Recurse
      errors.push(...checkCompletedParentChildren(node.nodes, `${nodePath}.nodes`));
    }
  }
  return errors;
}

function findInProgressNodes(nodes: Record<string, NodeState>, path: string, parentPath: string): string[] {
  const errors: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.status === 'in_progress') {
      errors.push(`Node '${path}.${id}' is in_progress but parent '${parentPath}' is completed`);
    }
    // Check deeper nesting
    if (node.kind === 'for_each_phase' || node.kind === 'for_each_task') {
      for (const iter of node.iterations) {
        errors.push(...findInProgressNodes(iter.nodes, `${path}.${id}.iterations[${iter.index}].nodes`, parentPath));
      }
    }
    if (node.kind === 'parallel') {
      errors.push(...findInProgressNodes(node.nodes, `${path}.${id}.nodes`, parentPath));
    }
  }
  return errors;
}

// ── Check: corrective task structure ──────────────────────────────────────────

function checkCorrectiveTaskStructure(nodes: Record<string, NodeState>, path: string): string[] {
  const errors: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const nodePath = `${path}.${id}`;
    if (node.kind === 'for_each_phase' || node.kind === 'for_each_task') {
      for (const iter of node.iterations) {
        for (const ct of iter.corrective_tasks) {
          errors.push(...validateCorrectiveEntry(ct, `${nodePath}.iterations[${iter.index}].corrective_tasks[${ct.index}]`));
        }
        errors.push(...checkCorrectiveTaskStructure(iter.nodes, `${nodePath}.iterations[${iter.index}].nodes`));
      }
    }
    if (node.kind === 'parallel') {
      errors.push(...checkCorrectiveTaskStructure(node.nodes, `${nodePath}.nodes`));
    }
  }
  return errors;
}

function validateCorrectiveEntry(ct: CorrectiveTaskEntry, path: string): string[] {
  const errors: string[] = [];
  if (typeof ct.index !== 'number' || ct.index < 1) {
    errors.push(`Corrective task at ${path} has invalid index: ${ct.index} (must be >= 1)`);
  }
  if (typeof ct.reason !== 'string' || ct.reason.length === 0) {
    errors.push(`Corrective task at ${path} has empty or missing reason`);
  }
  if (typeof ct.injected_after !== 'string' || ct.injected_after.length === 0) {
    errors.push(`Corrective task at ${path} has empty or missing injected_after`);
  }
  if (!validNodeStatuses.has(ct.status)) {
    errors.push(`Corrective task at ${path} has invalid status: '${ct.status}'`);
  }
  if (!ct.nodes || typeof ct.nodes !== 'object' || Object.keys(ct.nodes).length === 0) {
    errors.push(`Corrective task at ${path} has empty or missing nodes`);
  }
  return errors;
}

// ── Check: iteration count limits ─────────────────────────────────────────────

function checkIterationLimits(state: PipelineState, config: OrchestrationConfig): string[] {
  const errors: string[] = [];
  const limits = state.config.limits;

  function walk(nodes: Record<string, NodeState>, path: string): void {
    for (const [id, node] of Object.entries(nodes)) {
      const nodePath = `${path}.${id}`;
      if (node.kind === 'for_each_phase') {
        if (node.iterations.length > limits.max_phases) {
          errors.push(`${nodePath} has ${node.iterations.length} iterations, exceeding max_phases limit of ${limits.max_phases}`);
        }
        for (const iter of node.iterations) {
          walk(iter.nodes, `${nodePath}.iterations[${iter.index}].nodes`);
        }
      }
      if (node.kind === 'for_each_task') {
        if (node.iterations.length > limits.max_tasks_per_phase) {
          errors.push(`${nodePath} has ${node.iterations.length} iterations, exceeding max_tasks_per_phase limit of ${limits.max_tasks_per_phase}`);
        }
        for (const iter of node.iterations) {
          walk(iter.nodes, `${nodePath}.iterations[${iter.index}].nodes`);
        }
      }
      if (node.kind === 'parallel') {
        walk(node.nodes, `${nodePath}.nodes`);
      }
    }
  }

  walk(state.graph.nodes, 'graph.nodes');
  return errors;
}

// ── Check: node kind matches template ─────────────────────────────────────────

function checkNodeKindMatchesTemplate(state: PipelineState, template: PipelineTemplate): string[] {
  const errors: string[] = [];
  const templateKindMap = new Map<string, string>();
  for (const nodeDef of template.nodes) {
    templateKindMap.set(nodeDef.id, nodeDef.kind);
  }

  for (const [id, node] of Object.entries(state.graph.nodes)) {
    const templateKind = templateKindMap.get(id);
    if (templateKind !== undefined && node.kind !== templateKind) {
      errors.push(`Node '${id}' has kind '${node.kind}' but template defines kind '${templateKind}'`);
    }
  }
  return errors;
}
