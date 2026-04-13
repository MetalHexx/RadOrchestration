/**
 * Shared test fixtures for dag-timeline component tests.
 */
import type {
  StepNodeState,
  GateNodeState,
  ConditionalNodeState,
  ParallelNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  CorrectiveTaskEntry,
} from '@/types/state';

export const stepNode: StepNodeState = {
  kind: 'step',
  status: 'not_started',
  doc_path: null,
  retries: 0,
};

export const gateNode: GateNodeState = {
  kind: 'gate',
  status: 'not_started',
  gate_active: false,
};

export const conditionalNode: ConditionalNodeState = {
  kind: 'conditional',
  status: 'not_started',
  branch_taken: null,
};

export const parallelNode: ParallelNodeState = {
  kind: 'parallel',
  status: 'not_started',
  nodes: {},
};

export const forEachPhaseNode: ForEachPhaseNodeState = {
  kind: 'for_each_phase',
  status: 'not_started',
  iterations: [],
};

export const forEachTaskNode: ForEachTaskNodeState = {
  kind: 'for_each_task',
  status: 'not_started',
  iterations: [],
};

export const baseCorrectiveTask: CorrectiveTaskEntry = {
  index: 1,
  reason: 'Test reason',
  injected_after: 'task_executor',
  status: 'not_started',
  nodes: { task_handoff: stepNode },
  commit_hash: null,
};
