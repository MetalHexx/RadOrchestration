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

    // Iter 11 — phase-scope corrective sentinel. When a phase-scope corrective
    // is active (last entry on phaseIter.corrective_tasks with status
    // `not_started` or `in_progress`), override `task_number` to null and
    // `task_id` to `${phase_id}-PHASE`. This propagates through to the
    // coder/reviewer spawn contexts so the correct filename sentinel
    // (`-PHASE-C{N}.md`) is derivable and the value is self-describing in logs.
    const phaseLoopForSentinel = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
    const phaseIterForSentinel = phaseLoopForSentinel?.iterations[phaseNumber - 1];
    const phaseCorrectives = phaseIterForSentinel?.corrective_tasks ?? [];
    const phaseCorrectiveActive = phaseCorrectives.length > 0 &&
      (phaseCorrectives[phaseCorrectives.length - 1].status === 'not_started' ||
       phaseCorrectives[phaseCorrectives.length - 1].status === 'in_progress');
    if (phaseCorrectiveActive) {
      base.task_number = null;
      base.task_id = `${phase_id}-PHASE`;
    }

    if (action === 'execute_task') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];

      // Iter 11 — phase-scope-first. When a phase-scope corrective is active
      // (last entry on phaseIter.corrective_tasks with status `not_started` or
      // `in_progress`), route handoff_doc to that corrective's pre-completed
      // `task_handoff` sub-node. Checked BEFORE the task-scope corrective path
      // so a phase-scope corrective's handoff takes precedence even when the
      // underlying task iteration itself has correctives.
      const phaseCTs = phaseIter?.corrective_tasks ?? [];
      const activePhaseCorrective = phaseCTs.length > 0 ? phaseCTs[phaseCTs.length - 1] : undefined;
      if (
        activePhaseCorrective &&
        (activePhaseCorrective.status === 'not_started' || activePhaseCorrective.status === 'in_progress')
      ) {
        const phaseCorrectiveHandoff = activePhaseCorrective.nodes['task_handoff'] as StepNodeState | undefined;
        const phaseCorrectiveDocPath =
          typeof phaseCorrectiveHandoff?.doc_path === 'string'
            ? phaseCorrectiveHandoff.doc_path.trim()
            : '';
        if (phaseCorrectiveDocPath.length > 0) {
          // Return the stored path unchanged (not the trimmed copy) so downstream
          // consumers see the value exactly as the mutation wrote it.
          return { ...base, handoff_doc: phaseCorrectiveHandoff!.doc_path };
        }
      }

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
        const correctiveDocPath =
          typeof correctiveHandoff?.doc_path === 'string' ? correctiveHandoff.doc_path.trim() : '';
        if (correctiveDocPath.length > 0) {
          // Return the stored path unchanged (not the trimmed copy) so downstream
          // consumers see the value exactly as the mutation wrote it.
          return { ...base, handoff_doc: correctiveHandoff!.doc_path };
        }
      }

      const taskHandoff = taskIter?.nodes['task_handoff'] as StepNodeState | undefined;
      const handoff_doc = taskHandoff?.doc_path ?? '';
      return { ...base, handoff_doc };
    }

    if (action === 'spawn_code_reviewer') {
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
      const phaseIter = phaseLoop?.iterations[phaseNumber - 1];

      // Iter 11 — phase-scope-first. When a phase-scope corrective is active,
      // route head_sha to the phase-scope corrective's commit_hash and flag
      // is_correction + corrective_index from phaseIter. Checked BEFORE the
      // task-scope corrective path.
      const phaseCTs = phaseIter?.corrective_tasks ?? [];
      const activePhaseCorrective = phaseCTs.slice().reverse().find(
        ct => ct.status === 'in_progress' || ct.status === 'not_started'
      );
      if (activePhaseCorrective) {
        const head_sha = activePhaseCorrective.commit_hash ?? null;
        return {
          ...base,
          head_sha,
          is_correction: true,
          corrective_index: activePhaseCorrective.index,
        };
      }

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
        ? { is_correction: true, corrective_index: activeCorrective.index }
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

  // Iter 12 — spawn_final_reviewer enrichment. Derive project-wide diff SHAs
  // from iteration commit hashes across the whole pipeline. Traversal order:
  // phases in index order → tasks in index order → task-correctives in index
  // order → then phase-correctives (per phase). `project_base_sha` is commits[0]
  // (first in traversal order); `project_head_sha` is commits[last]. The
  // pipeline invariant ensures phase correctives always land after all task
  // commits within a phase. Both null when no commits exist (auto-commit=off).
  if (action === 'spawn_final_reviewer') {
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
    const commits: string[] = [];
    const phaseIterations = phaseLoop?.iterations ?? [];
    for (const phaseIter of phaseIterations) {
      const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState | undefined;
      const taskIterations = taskLoop?.iterations ?? [];
      for (const taskIter of taskIterations) {
        if (taskIter.commit_hash != null) commits.push(taskIter.commit_hash);
        for (const ct of taskIter.corrective_tasks ?? []) {
          if (ct.commit_hash != null) commits.push(ct.commit_hash);
        }
      }
      // Phase correctives are appended after task commits because phase_review fires only after all task iterations complete, making phase correctives chronologically last within a phase.
      for (const ct of phaseIter.corrective_tasks ?? []) {
        if (ct.commit_hash != null) commits.push(ct.commit_hash);
      }
    }

    const project_base_sha = commits.length > 0 ? commits[0] : null;
    const project_head_sha = commits.length > 0 ? commits[commits.length - 1] : null;

    return {
      ...walkerContext,
      project_base_sha,
      project_head_sha,
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
