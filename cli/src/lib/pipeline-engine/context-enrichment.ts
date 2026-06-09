import { buildSkillManifest } from '../skill-manifest.js';
import type {
  PipelineState,
  OrchestrationConfig,
  EventContext,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  StepNodeState,
} from './types.js';

/**
 * Call buildSkillManifest directly to discover and render the spawn-prompt
 * suffix the orchestrator inlines into planner spawns. On any failure,
 * emit a single warn line and return '' — manifest failure must NEVER break
 * the planner spawn.
 *
 * The repo root is taken from `state.pipeline.source_control.worktree_path`
 * (set by source_control_init) and falls back to `process.cwd()` only when
 * source control hasn't been initialized yet. AD-6 forbids consulting cwd
 * for path resolution; the state-first lookup honors that contract while
 * preserving the cwd fallback for the bootstrap window before init runs.
 *
 * Returns:
 *   - empty string '' when the manifest is `[]` OR when the invocation failed
 *   - the heading + JSON + orientation sentence block when at least one
 *     eligible skill is present
 */
function buildRepositorySkillsBlock(state: PipelineState): string {
  const repoRoot = state.pipeline.source_control?.worktree_path ?? process.cwd();
  let arr;
  try {
    arr = buildSkillManifest({ repoRoot });
  } catch (err) {
    console.warn(
      `context-enrichment: buildSkillManifest failed (${(err as Error).message}); emitting empty repository_skills_block`
    );
    return '';
  }
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const json = JSON.stringify(arr, null, 2);
  return (
    `\n\n## Repository Skills Available\n\n${json}\n\n` +
    `Entries above are a catalog. Read a listed path **only when** its description matches the work you are about to plan — skip the rest to avoid token waste. Any \`SKILL.md\` you encounter outside this catalog (e.g., via Grep/Glob) was filtered on purpose; do not Read it.\n`
  );
}

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

  // Corrective-aware: a phase whose last corrective entry is active is the
  // active phase even when its regular iteration already flipped completed.
  const correctivePhase = phaseLoop.iterations.find(it => {
    const cts = it.corrective_tasks ?? [];
    if (cts.length === 0) return false;
    const last = cts[cts.length - 1];
    return last.status === 'in_progress' || last.status === 'not_started';
  });
  if (correctivePhase) return correctivePhase.index + 1;

  const notStarted = phaseLoop.iterations.find(it => it.status === 'not_started');
  if (notStarted) return notStarted.index + 1;

  throw new Error(
    `Cannot resolve active phase: no phase is in_progress, no phase carries an active corrective, ` +
    `and no phase is not_started. State is unresolved — refusing to default to phase 1. ` +
    `Pass --phase <N> to specify explicitly.`
  );
}

export function resolveActiveTaskIndex(state: PipelineState, phaseIndex: number): number {
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
  if (!phaseLoop?.iterations?.length) return 1;

  const phaseIteration = phaseLoop.iterations[phaseIndex - 1];
  if (!phaseIteration?.nodes) return 1;

  // Corrective-aware: when a phase-scope corrective is active on this phase,
  // task identity is the phase-scope sentinel — represented to callers as
  // task index 1 (the sentinel task_id/task_number override is applied by the
  // enrichment sentinel block, not here). Do NOT fall through to the task
  // loop, whose iterations are all completed during a phase corrective.
  const phaseCts = phaseIteration.corrective_tasks ?? [];
  if (phaseCts.length > 0) {
    const last = phaseCts[phaseCts.length - 1];
    if (last.status === 'in_progress' || last.status === 'not_started') return 1;
  }

  const taskLoop = phaseIteration.nodes['task_loop'] as ForEachTaskNodeState | undefined;
  if (!taskLoop?.iterations?.length) return 1;

  const matches = taskLoop.iterations.filter(it => it.status === 'in_progress');
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous task resolution: ${matches.length} tasks are in_progress simultaneously in phase ${phaseIndex}. Pass --task <N> to specify explicitly.`
    );
  }
  if (matches.length === 1) return matches[0].index + 1;

  const correctiveTask = taskLoop.iterations.find(it => {
    const cts = it.corrective_tasks ?? [];
    if (cts.length === 0) return false;
    const last = cts[cts.length - 1];
    return last.status === 'in_progress' || last.status === 'not_started';
  });
  if (correctiveTask) return correctiveTask.index + 1;

  const notStarted = taskLoop.iterations.find(it => it.status === 'not_started');
  if (notStarted) return notStarted.index + 1;

  throw new Error(
    `Cannot resolve active task in phase ${phaseIndex}: no task is in_progress, no task carries an ` +
    `active corrective, and no task is not_started. State is unresolved — refusing to default to task 1. ` +
    `Pass --task <N> to specify explicitly.`
  );
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

  // Planning spawn enrichment — invoke buildSkillManifest once per planner
  // spawn and surface the rendered block under `repository_skills_block` so
  // the orchestrator can inline it verbatim into the spawn prompt. Manifest
  // failure never breaks the spawn — buildRepositorySkillsBlock returns ''
  // on any error path. For spawn_master_plan only, also surface the
  // phase/task limits so the orchestrator can inline a `## Plan Size Limits`
  // block into the planner prompt without reading state.json or the YAML.
  if (action in PLANNING_SPAWN_STEPS) {
    const repository_skills_block = buildRepositorySkillsBlock(state);
    const base = {
      ...walkerContext,
      step: PLANNING_SPAWN_STEPS[action],
      repository_skills_block,
    };
    if (action === 'spawn_master_plan') {
      return {
        ...base,
        limits: {
          max_phases: input.config.limits.max_phases,
          max_tasks_per_phase: input.config.limits.max_tasks_per_phase,
        },
      };
    }
    return base;
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
      // repos[] is the per-task commit tracker; first entry's commit_hash (if any) is the base sha.
      const phase_first_sha = firstTask?.repos[0]?.commit_hash ?? null;
      const lastTaskFinalCorrective = lastTask?.corrective_tasks
        .slice()
        .reverse()
        .find(ct => ct.repos.some(r => r.commit_hash != null));
      const phase_head_sha = lastTaskFinalCorrective?.repos.slice().reverse().find(r => r.commit_hash != null)?.commit_hash
        ?? lastTask?.repos.slice().reverse().find(r => r.commit_hash != null)?.commit_hash
        ?? null;

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
        const phaseCorrectiveDoc = activePhaseCorrective.doc_path;
        if (typeof phaseCorrectiveDoc === 'string' && phaseCorrectiveDoc.trim().length > 0) {
          // Return the stored path unchanged (not the trimmed copy) so downstream
          // consumers see the value exactly as the mutation wrote it.
          return { ...base, handoff_doc: phaseCorrectiveDoc };
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
        const correctiveDoc = activeCorrective.doc_path;
        if (typeof correctiveDoc === 'string' && correctiveDoc.trim().length > 0) {
          // Return the stored path unchanged (not the trimmed copy) so downstream
          // consumers see the value exactly as the mutation wrote it.
          return { ...base, handoff_doc: correctiveDoc };
        }
      }

      const handoff_doc = taskIter?.doc_path ?? '';
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
        const head_sha = activePhaseCorrective.repos.slice().reverse().find(r => r.commit_hash != null)?.commit_hash ?? null;
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
        ? (activeCorrective.repos.slice().reverse().find(r => r.commit_hash != null)?.commit_hash ?? null)
        : (taskIter?.repos.slice().reverse().find(r => r.commit_hash != null)?.commit_hash ?? null);
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
    const phase_id = formatPhaseId(phaseNumber);

    let task_number: number | null = taskNumber;
    let task_id = formatTaskId(phaseNumber, taskNumber);

    const phaseLoopForSentinel = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
    const phaseIterForSentinel = phaseLoopForSentinel?.iterations[phaseNumber - 1];
    const phaseCorrectives = phaseIterForSentinel?.corrective_tasks ?? [];
    const phaseCorrectiveActive = phaseCorrectives.length > 0 &&
      (phaseCorrectives[phaseCorrectives.length - 1].status === 'not_started' ||
       phaseCorrectives[phaseCorrectives.length - 1].status === 'in_progress');
    if (phaseCorrectiveActive) {
      task_number = null;
      task_id = `${phase_id}-PHASE`;
    }

    return {
      ...walkerContext,
      phase_number: phaseNumber,
      phase_id,
      task_number,
      task_id,
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
        for (const r of taskIter.repos ?? []) {
          if (r.commit_hash != null) commits.push(r.commit_hash);
        }
        for (const ct of taskIter.corrective_tasks ?? []) {
          for (const r of ct.repos ?? []) {
            if (r.commit_hash != null) commits.push(r.commit_hash);
          }
        }
      }
      // Phase correctives are appended after task commits because phase_review fires only after all task iterations complete, making phase correctives chronologically last within a phase.
      for (const ct of phaseIter.corrective_tasks ?? []) {
        for (const r of ct.repos ?? []) {
          if (r.commit_hash != null) commits.push(r.commit_hash);
        }
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
