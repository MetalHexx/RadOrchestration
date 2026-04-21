import type {
  PipelineState,
  OrchestrationConfig,
  EventContext,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  StepNodeState,
} from './types.js';

export interface EnrichmentInput {
  action: string;
  walkerContext: Record<string, unknown>;
  state: PipelineState;
  config: OrchestrationConfig;
  cliContext: Partial<EventContext>;
}

export function formatPhaseId(phaseNumber: number): string {
  return `P${String(phaseNumber).padStart(2, '0')}`;
}

export function formatTaskId(phaseNumber: number, taskNumber: number): string {
  return `${formatPhaseId(phaseNumber)}-T${String(taskNumber).padStart(2, '0')}`;
}

export function resolveActivePhaseIndex(state: PipelineState): number {
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
  if (!phaseLoop?.iterations?.length) return 1;

  const matches = phaseLoop.iterations.filter(it => it.status === 'in_progress');
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous phase resolution: ${matches.length} phases are in_progress simultaneously. Pass --phase <N> to specify explicitly.`
    );
  }
  if (matches.length === 1) return matches[0].index + 1;

  const notStarted = phaseLoop.iterations.find(it => it.status === 'not_started');
  if (notStarted) return notStarted.index + 1;

  return 1;
}

export function resolveActiveTaskIndex(state: PipelineState, phaseIndex: number): number {
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
  if (!phaseLoop?.iterations?.length) return 1;

  const phaseIteration = phaseLoop.iterations[phaseIndex - 1];
  if (!phaseIteration?.nodes) return 1;

  const taskLoop = phaseIteration.nodes['task_loop'] as ForEachTaskNodeState | undefined;
  if (!taskLoop?.iterations?.length) return 1;

  const matches = taskLoop.iterations.filter(it => it.status === 'in_progress');
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous task resolution: ${matches.length} tasks are in_progress simultaneously in phase ${phaseIndex}. Pass --task <N> to specify explicitly.`
    );
  }
  if (matches.length === 1) return matches[0].index + 1;

  const notStarted = taskLoop.iterations.find(it => it.status === 'not_started');
  if (notStarted) return notStarted.index + 1;

  return 1;
}

const PLANNING_SPAWN_STEPS: Record<string, string> = {
  spawn_requirements: 'requirements',
  spawn_master_plan: 'master_plan',
};

const PHASE_LEVEL_ACTIONS = new Set([
  'spawn_phase_reviewer',
  'gate_phase',
]);

const TASK_LEVEL_ACTIONS = new Set([
  'execute_task',
  'spawn_code_reviewer',
  'gate_task',
]);

const EMPTY_CONTEXT_ACTIONS = new Set([
  'request_plan_approval',
  'ask_gate_mode',
  'spawn_final_reviewer',
  'display_complete',
]);

/**
 * Enriches a raw walker result with action-specific context fields.
 * Returns the enriched context object matching v4's exact shapes.
 */
export function enrichActionContext(input: EnrichmentInput): Record<string, unknown> {
  const { action, walkerContext, state } = input;

  // Planning spawn enrichment
  if (action in PLANNING_SPAWN_STEPS) {
    return { ...walkerContext, step: PLANNING_SPAWN_STEPS[action] };
  }

  // Phase-level enrichment
  if (PHASE_LEVEL_ACTIONS.has(action)) {
    const phaseNumber = resolveActivePhaseIndex(state);
    const phase_id = formatPhaseId(phaseNumber);
    const base: Record<string, unknown> = { ...walkerContext, phase_number: phaseNumber, phase_id };

    if (action === 'spawn_phase_reviewer') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];

      const taskLoop = phaseIter?.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIters = taskLoop?.iterations ?? [];
      const firstTask = taskIters[0];
      const lastTask = taskIters[taskIters.length - 1];
      const phase_first_sha = firstTask?.commit_hash ?? null;
      const lastTaskFinalCorrective = lastTask?.corrective_tasks
        .slice()
        .reverse()
        .find(ct => ct.commit_hash != null);
      const phase_head_sha = lastTaskFinalCorrective?.commit_hash ?? lastTask?.commit_hash ?? null;

      const correctiveFields = phaseIter && phaseIter.corrective_tasks.length > 0
        ? { is_correction: true, corrective_index: phaseIter.corrective_tasks.length }
        : {};

      return { ...base, phase_first_sha, phase_head_sha, ...correctiveFields };
    }

    return base;
  }

  // Task-level enrichment
  if (TASK_LEVEL_ACTIONS.has(action)) {
    const phaseNumber = resolveActivePhaseIndex(state);
    const taskNumber = resolveActiveTaskIndex(state, phaseNumber);
    const phase_id = formatPhaseId(phaseNumber);
    const task_id = formatTaskId(phaseNumber, taskNumber);
    const base: Record<string, unknown> = {
      ...walkerContext,
      phase_number: phaseNumber,
      phase_id,
      task_number: taskNumber,
      task_id,
    };

    if (action === 'execute_task') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const taskLoop = phaseIter?.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIter = taskLoop?.iterations[taskNumber - 1];

      // Iter 10 — when a task-scope corrective is active (last entry with
      // status `not_started` or `in_progress`), route handoff_doc to the
      // corrective's pre-completed `task_handoff` sub-node instead of the
      // original iteration's. Completed correctives fall through to the
      // original handoff — they don't route subsequent execution.
      const correctives = taskIter?.corrective_tasks ?? [];
      const activeCorrective = correctives.length > 0
        ? correctives[correctives.length - 1]
        : undefined;
      if (
        activeCorrective &&
        (activeCorrective.status === 'not_started' || activeCorrective.status === 'in_progress')
      ) {
        const correctiveHandoff = activeCorrective.nodes['task_handoff'] as StepNodeState | undefined;
        if (correctiveHandoff && typeof correctiveHandoff.doc_path === 'string' && correctiveHandoff.doc_path.length > 0) {
          return { ...base, handoff_doc: correctiveHandoff.doc_path };
        }
      }

      const taskHandoff = taskIter?.nodes['task_handoff'] as StepNodeState | undefined;
      const handoff_doc = taskHandoff?.doc_path ?? '';
      return { ...base, handoff_doc };
    }

    if (action === 'spawn_code_reviewer') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const taskLoop = phaseIter?.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIter = taskLoop?.iterations[taskNumber - 1];
      const correctives = taskIter?.corrective_tasks ?? [];
      const activeCorrective = correctives.slice().reverse().find(
        ct => ct.status === 'in_progress' || ct.status === 'not_started'
      );
      const head_sha = activeCorrective
        ? (activeCorrective.commit_hash ?? null)
        : (taskIter?.commit_hash ?? null);
      const correctiveFields = activeCorrective
        ? { is_correction: true, corrective_index: correctives.length }
        : {};
      return { ...base, head_sha, ...correctiveFields };
    }

    return base;
  }

  // Source control enrichment
  if (action === 'invoke_source_control_commit') {
    const phaseNumber = resolveActivePhaseIndex(state);
    const taskNumber = resolveActiveTaskIndex(state, phaseNumber);
    return {
      ...walkerContext,
      phase_number: phaseNumber,
      phase_id: formatPhaseId(phaseNumber),
      task_number: taskNumber,
      task_id: formatTaskId(phaseNumber, taskNumber),
      branch: state.pipeline.source_control?.branch ?? '',
      worktree_path: state.pipeline.source_control?.worktree_path ?? '',
    };
  }

  if (action === 'invoke_source_control_pr') {
    return {
      ...walkerContext,
      branch: state.pipeline.source_control?.branch ?? '',
      base_branch: state.pipeline.source_control?.base_branch ?? '',
      worktree_path: state.pipeline.source_control?.worktree_path ?? '',
    };
  }

  if (action === 'request_final_approval') {
    return {
      ...walkerContext,
      pr_url: state.pipeline.source_control?.pr_url ?? null,
    };
  }

  // Empty-context actions — passthrough walkerContext unchanged
  if (EMPTY_CONTEXT_ACTIONS.has(action)) {
    return { ...walkerContext };
  }

  if (action === 'display_halted') {
    return {
      ...walkerContext,
      details: walkerContext.details ?? `Pipeline halted at node: ${state.graph.current_node_path ?? 'unknown'}`,
    };
  }

  // Unknown action — passthrough unchanged
  return { ...walkerContext };
}
