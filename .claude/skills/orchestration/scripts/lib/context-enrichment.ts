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
  spawn_research: 'research',
  spawn_prd: 'prd',
  spawn_design: 'design',
  spawn_architecture: 'architecture',
  spawn_master_plan: 'master_plan',
};

const PHASE_LEVEL_ACTIONS = new Set([
  'create_phase_plan',
  'generate_phase_report',
  'spawn_phase_reviewer',
  'gate_phase',
]);

const TASK_LEVEL_ACTIONS = new Set([
  'create_task_handoff',
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

    if (action === 'create_phase_plan') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const phaseReview = phaseIter?.nodes['phase_review'] as StepNodeState | undefined;

      if (phaseIter && phaseIter.corrective_tasks.length > 0) {
        return {
          ...base,
          is_correction: true,
          corrective_index: phaseIter.corrective_tasks.length,
          previous_review: phaseReview?.doc_path ?? '',
        };
      }

      return base;  // Normal path — no is_correction field
    }

    if (action === 'spawn_phase_reviewer') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const phaseReport = phaseIter?.nodes['phase_report'] as StepNodeState | undefined;
      const phase_report_doc = phaseReport?.doc_path ?? '';

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

      return { ...base, phase_report_doc, phase_first_sha, phase_head_sha };
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

    if (action === 'create_task_handoff') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const taskLoop = phaseIter?.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIter = taskLoop?.iterations[taskNumber - 1];
      const correctives = taskIter?.corrective_tasks ?? [];

      if (correctives.length === 0) {
        return { ...base, is_correction: false };
      }

      // Corrective path — find the last code review
      const lastCompleted = [...correctives].reverse().find(ct => ct.status === 'completed');
      let reviewNode: StepNodeState | undefined;
      if (lastCompleted) {
        reviewNode = lastCompleted.nodes['code_review'] as StepNodeState | undefined;
      } else {
        reviewNode = taskIter?.nodes['code_review'] as StepNodeState | undefined;
      }

      return {
        ...base,
        is_correction: true,
        previous_review: reviewNode?.doc_path ?? '',
        reason: correctives[correctives.length - 1]?.reason ?? '',
      };
    }

    if (action === 'execute_task') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const taskLoop = phaseIter?.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIter = taskLoop?.iterations[taskNumber - 1];
      const taskHandoff = taskIter?.nodes['task_handoff'] as StepNodeState | undefined;
      const handoff_doc = taskHandoff?.doc_path ?? '';
      return { ...base, handoff_doc };
    }

    if (action === 'spawn_code_reviewer') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];
      const taskLoop = phaseIter?.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIter = taskLoop?.iterations[taskNumber - 1];
      const activeCorrective = taskIter?.corrective_tasks.slice().reverse().find(
        ct => ct.status === 'in_progress' || ct.status === 'not_started'
      );
      const head_sha = activeCorrective
        ? (activeCorrective.commit_hash ?? null)
        : (taskIter?.commit_hash ?? null);
      return { ...base, head_sha };
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
