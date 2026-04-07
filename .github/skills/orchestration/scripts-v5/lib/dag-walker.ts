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
  ForEachPhaseNodeDef,
  ForEachPhaseNodeState,
  ForEachTaskNodeDef,
  ForEachTaskNodeState,
  GraphState,
} from './types.js';
import { NODE_STATUSES, NEXT_ACTIONS, GRAPH_STATUSES } from './constants.js';
import { evaluateCondition } from './condition-evaluator.js';
import { scaffoldNodeState } from './scaffold.js';

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
 * Resolves a JSON-path reference (e.g., "$.nodes.master_plan.doc_path") against
 * the graph state. Strips leading "$." prefix, splits by ".", and navigates
 * the state.graph object segment by segment.
 */
function resolveStateRef(ref: string, graphState: GraphState): unknown {
  const path = ref.startsWith('$.') ? ref.slice(2) : ref;
  const segments = path.split('.');
  let current: unknown = graphState;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Resolves a source_doc_ref within a scope's node map. Handles
 * "$.current_phase.{field}" by reading from the sibling "phase_planning" node
 * in scopeNodes; falls back to resolveStateRef for all other patterns.
 */
function resolveDocRefInScope(
  ref: string,
  scopeNodes: Record<string, NodeState>,
  graphState: GraphState,
): unknown {
  if (ref.startsWith('$.current_phase.')) {
    const field = ref.slice('$.current_phase.'.length);
    const phaseNode = scopeNodes['phase_planning'];
    if (!phaseNode) return undefined;
    return (phaseNode as unknown as Record<string, unknown>)[field];
  }
  return resolveStateRef(ref, graphState);
}

/**
 * Walks the iterations of a for_each_phase or for_each_task node sequentially,
 * advancing statuses and returning the first actionable result. Returns
 * 'all_completed' when every iteration has been completed or skipped.
 */
function walkForEachIterations(
  fepDef: ForEachPhaseNodeDef | ForEachTaskNodeDef,
  fepState: ForEachPhaseNodeState | ForEachTaskNodeState,
  config: OrchestrationConfig,
  state: PipelineState,
  readDocument?: (docPath: string) => { frontmatter: Record<string, unknown> } | null,
): WalkerResult | null | 'all_completed' {
  for (const iteration of fepState.iterations) {
    if (iteration.status === NODE_STATUSES.COMPLETED || iteration.status === NODE_STATUSES.SKIPPED) {
      continue;
    }
    if (iteration.status === NODE_STATUSES.HALTED) {
      return { action: NEXT_ACTIONS.DISPLAY_HALTED, context: {} };
    }
    if (iteration.status === NODE_STATUSES.NOT_STARTED) {
      iteration.status = NODE_STATUSES.IN_PROGRESS;
    }

    // Corrective path routing: walk corrective task nodes instead of body nodes
    if (iteration.corrective_tasks.length > 0) {
      const latestCorrective = iteration.corrective_tasks[iteration.corrective_tasks.length - 1];

      if (latestCorrective.status === NODE_STATUSES.HALTED) {
        return { action: NEXT_ACTIONS.DISPLAY_HALTED, context: {} };
      }

      if (latestCorrective.status === NODE_STATUSES.COMPLETED) {
        iteration.status = NODE_STATUSES.COMPLETED;
        continue;
      }

      if (latestCorrective.status === NODE_STATUSES.NOT_STARTED) {
        latestCorrective.status = NODE_STATUSES.IN_PROGRESS;
      }

      // Derive correct body defs for corrective walking
      let correctiveBodyDefs: NodeDef[];
      if (fepDef.kind === 'for_each_phase') {
        const fetDef = fepDef.body.find((n) => n.kind === 'for_each_task') as ForEachTaskNodeDef | undefined;
        correctiveBodyDefs = fetDef ? fetDef.body : fepDef.body;
      } else {
        correctiveBodyDefs = fepDef.body;
      }

      const correctiveResult = walkNodes(correctiveBodyDefs, latestCorrective.nodes, config, state, readDocument);
      if (correctiveResult !== null) {
        return correctiveResult;
      }
      const allCorrectiveDone = correctiveBodyDefs.every((bn) => {
        const bnState = latestCorrective.nodes[bn.id];
        return (
          bnState !== undefined &&
          (bnState.status === NODE_STATUSES.COMPLETED ||
            bnState.status === NODE_STATUSES.SKIPPED)
        );
      });
      if (allCorrectiveDone) {
        latestCorrective.status = NODE_STATUSES.COMPLETED;
        iteration.status = NODE_STATUSES.COMPLETED;
        continue;
      }
      return null;
    }

    const bodyResult = walkNodes(fepDef.body, iteration.nodes, config, state, readDocument);
    if (bodyResult !== null) {
      return bodyResult;
    }
    const allBodyDone = fepDef.body.every((bn) => {
      const bnState = iteration.nodes[bn.id];
      return (
        bnState !== undefined &&
        (bnState.status === NODE_STATUSES.COMPLETED ||
          bnState.status === NODE_STATUSES.SKIPPED)
      );
    });
    if (allBodyDone) {
      iteration.status = NODE_STATUSES.COMPLETED;
      continue;
    }
    return null;
  }
  return 'all_completed';
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
  readDocument?: (docPath: string) => { frontmatter: Record<string, unknown> } | null,
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
        return walkNodes(branchNodes, nodes, config, state, readDocument);
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
        return walkNodes(parallelDef.children, parallelState.nodes, config, state, readDocument);
      }

      // for_each_phase in_progress: walk iterations sequentially
      if (nodeDef.kind === 'for_each_phase') {
        const fepDef = nodeDef as ForEachPhaseNodeDef;
        const fepState = nodeState as ForEachPhaseNodeState;

        const iterResult = walkForEachIterations(fepDef, fepState, config, state, readDocument);
        if (iterResult === 'all_completed') {
          fepState.status = NODE_STATUSES.COMPLETED;
          continue;
        }
        return iterResult;
      }

      // for_each_task in_progress: walk iterations sequentially
      if (nodeDef.kind === 'for_each_task') {
        const fetDef = nodeDef as ForEachTaskNodeDef;
        const fetState = nodeState as ForEachTaskNodeState;

        const iterResult = walkForEachIterations(fetDef, fetState, config, state, readDocument);
        if (iterResult === 'all_completed') {
          fetState.status = NODE_STATUSES.COMPLETED;
          continue;
        }
        return iterResult;
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
        return walkNodes(branchNodes, nodes, config, state, readDocument);
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
        return walkNodes(parallelDef.children, parallelState.nodes, config, state, readDocument);
      }

      // for_each_phase node
      if (nodeDef.kind === 'for_each_phase') {
        const fepDef = nodeDef as ForEachPhaseNodeDef;
        const fepState = nodeState as ForEachPhaseNodeState;

        if (fepState.iterations.length === 0) {
          // Needs expansion — requires readDocument callback
          if (!readDocument) {
            return null;
          }

          // Resolve source_doc_ref to get the document path
          const docPath = resolveStateRef(fepDef.source_doc_ref, state.graph);
          if (typeof docPath !== 'string') {
            return null;
          }

          // Read the document to get total_field from frontmatter
          const doc = readDocument(docPath);
          if (!doc) {
            return null;
          }

          const totalValue = doc.frontmatter[fepDef.total_field];
          if (typeof totalValue !== 'number' || !Number.isInteger(totalValue) || totalValue <= 0) {
            return null;
          }

          // Create iterations with scaffolded body nodes
          for (let i = 0; i < totalValue; i++) {
            const iterationNodes: Record<string, NodeState> = {};
            for (const bodyDef of fepDef.body) {
              iterationNodes[bodyDef.id] = scaffoldNodeState(bodyDef);
            }
            fepState.iterations.push({
              index: i,
              status: NODE_STATUSES.NOT_STARTED,
              nodes: iterationNodes,
              corrective_tasks: [],
            });
          }

          fepState.status = NODE_STATUSES.IN_PROGRESS;
        }

        // Walk into first iteration (fall through to in_progress logic)
        const iterResult = walkForEachIterations(fepDef, fepState, config, state, readDocument);
        if (iterResult === 'all_completed') {
          fepState.status = NODE_STATUSES.COMPLETED;
          continue;
        }
        return iterResult;
      }

      // for_each_task node
      if (nodeDef.kind === 'for_each_task') {
        const fetDef = nodeDef as ForEachTaskNodeDef;
        const fetState = nodeState as ForEachTaskNodeState;

        if (fetState.iterations.length === 0) {
          // Needs expansion — requires readDocument callback
          if (!readDocument) {
            return null;
          }

          // Resolve source_doc_ref within the current scope
          const docPath = resolveDocRefInScope(fetDef.source_doc_ref, nodes, state.graph);
          if (typeof docPath !== 'string') {
            return null;
          }

          // Read the document to get the tasks array from frontmatter
          const doc = readDocument(docPath);
          if (!doc) {
            return null;
          }

          const tasksValue = doc.frontmatter[fetDef.tasks_field];
          if (!Array.isArray(tasksValue)) {
            return null;
          }

          if (tasksValue.length === 0) {
            // Zero tasks — complete immediately (v4 parity: resolvePhaseExecuting → generate_phase_report)
            fetState.status = NODE_STATUSES.COMPLETED;
            continue;
          }

          // Create one iteration per array element
          for (let i = 0; i < tasksValue.length; i++) {
            const iterationNodes: Record<string, NodeState> = {};
            for (const bodyDef of fetDef.body) {
              iterationNodes[bodyDef.id] = scaffoldNodeState(bodyDef);
            }
            fetState.iterations.push({
              index: i,
              status: NODE_STATUSES.NOT_STARTED,
              nodes: iterationNodes,
              corrective_tasks: [],
            });
          }

          fetState.status = NODE_STATUSES.IN_PROGRESS;
        }

        // Walk into iterations
        const iterResult = walkForEachIterations(fetDef, fetState, config, state, readDocument);
        if (iterResult === 'all_completed') {
          fetState.status = NODE_STATUSES.COMPLETED;
          continue;
        }
        return iterResult;
      }

      return null;
    }
  }

  return null;
}

/**
 * Core DAG traversal function. Walks template nodes in order using a recursive
 * helper, checking dependencies and node status to determine the next action.
 *
 * Handles `step`, `gate`, `conditional`, `parallel`, `for_each_phase`, and
 * `for_each_task` node kinds.
 */
export function walkDAG(
  state: PipelineState,
  template: PipelineTemplate,
  config: OrchestrationConfig,
  readDocument?: (docPath: string) => { frontmatter: Record<string, unknown> } | null,
): WalkerResult | null {
  const result = walkNodes(template.nodes, state.graph.nodes, config, state, readDocument);
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
    state.graph.status = GRAPH_STATUSES.COMPLETED;
    return { action: NEXT_ACTIONS.DISPLAY_COMPLETE, context: {} };
  }

  return null;
}
