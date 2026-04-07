import type { NodeDef, NodeState, ParallelNodeDef } from './types.js';
import { NODE_STATUSES } from './constants.js';

export function scaffoldNodeState(nodeDef: NodeDef): NodeState {
  switch (nodeDef.kind) {
    case 'step':
      return { kind: 'step', status: NODE_STATUSES.NOT_STARTED, doc_path: null, retries: 0 };
    case 'gate':
      return { kind: 'gate', status: NODE_STATUSES.NOT_STARTED, gate_active: false };
    case 'conditional':
      return { kind: 'conditional', status: NODE_STATUSES.NOT_STARTED, branch_taken: null };
    case 'parallel': {
      const pDef = nodeDef as ParallelNodeDef;
      const nodes: Record<string, NodeState> = {};
      for (const child of pDef.children) {
        nodes[child.id] = scaffoldNodeState(child);
      }
      return { kind: 'parallel', status: NODE_STATUSES.NOT_STARTED, nodes };
    }
    case 'for_each_phase':
      return { kind: 'for_each_phase', status: NODE_STATUSES.NOT_STARTED, iterations: [] };
    case 'for_each_task':
      return { kind: 'for_each_task', status: NODE_STATUSES.NOT_STARTED, iterations: [] };
  }
}
