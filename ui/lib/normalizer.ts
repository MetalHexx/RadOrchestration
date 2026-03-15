import { PLANNING_STEP_ORDER } from '@/types/state';
import type {
  RawStateJson,
  NormalizedProjectState,
  NormalizedPlanning,
  RawPhase,
  NormalizedPhase,
  RawTask,
  NormalizedTask,
  PlanningStepName,
  HumanGateMode,
  FinalReviewStatus,
} from '@/types/state';

/** Detect schema version from the $schema field. Returns 1, 2, or 3. */
export function detectSchemaVersion(raw: RawStateJson): 1 | 2 | 3 {
  if (!raw.$schema) return 1;
  if (raw.$schema.includes('v3')) return 3;
  return 2;
}

/** Convert v3 array-format planning steps to the canonical Record format; returns v1/v2 Records as-is. */
function normalizePlanningSteps(
  steps: RawStateJson['planning']['steps']
): NormalizedPlanning['steps'] {
  if (!Array.isArray(steps)) {
    return steps as NormalizedPlanning['steps'];
  }
  const record = {} as NormalizedPlanning['steps'];
  for (const step of steps) {
    record[step.name as PlanningStepName] = { status: step.status, output: step.doc_path };
  }
  // Ensure all canonical step names are present
  for (const name of PLANNING_STEP_ORDER) {
    if (!record[name]) {
      record[name] = { status: 'not_started', output: null };
    }
  }
  return record;
}

/** Parse a numeric suffix from an id string (e.g. "P01" → 1, "T03" → 3). */
function parseIdNumber(id: unknown): number | undefined {
  if (typeof id !== 'string' || id === '') return undefined;
  const remainder = id.replace(/^\D+/, '');
  const num = parseInt(remainder, 10);
  return Number.isNaN(num) ? undefined : num;
}

/** Normalize a raw task object, mapping v1 field names to v2. */
export function normalizeTask(raw: RawTask, index: number): NormalizedTask {
  return {
    task_number: raw.task_number ?? parseIdNumber((raw as unknown as Record<string, unknown>).id) ?? (index + 1),
    title: raw.title ?? raw.name ?? 'Unnamed Task',
    status: raw.status,
    handoff_doc: raw.handoff_doc,
    report_doc: raw.report_doc,
    retries: raw.retries,
    last_error: raw.last_error,
    severity: raw.severity,
    review_doc: raw.review_doc ?? null,
    review_verdict: raw.review_verdict ?? null,
    review_action: raw.review_action ?? null,
  };
}

/** Normalize a raw phase object, mapping v1/v2/v3 field names to canonical form. */
export function normalizePhase(raw: RawPhase, index: number): NormalizedPhase {
  return {
    phase_number: raw.phase_number ?? parseIdNumber((raw as unknown as Record<string, unknown>).id) ?? (index + 1),
    title: raw.title ?? raw.name ?? 'Unnamed Phase',
    status: raw.status,
    phase_doc: raw.phase_doc ?? raw.plan_doc ?? raw.phase_plan_doc ?? null,
    current_task: raw.current_task,
    total_tasks: raw.total_tasks ?? raw.tasks?.length ?? 0,
    tasks: raw.tasks.map((t, i) => normalizeTask(t, i)),
    phase_report: raw.phase_report ?? raw.phase_report_doc ?? null,
    human_approved: raw.human_approved ?? false,
    phase_review: raw.phase_review ?? raw.phase_review_doc ?? null,
    phase_review_verdict: raw.phase_review_verdict ?? null,
    phase_review_action: raw.phase_review_action ?? null,
  };
}

/** Normalize a raw state.json (v1, v2, or v3) into the canonical normalized form. */
export function normalizeState(raw: RawStateJson): NormalizedProjectState {
  return {
    schema: raw.$schema ?? 'orchestration-state-v1',
    project: {
      name: raw.project.name,
      description: raw.project.description ?? null,
      created: raw.project.created,
      updated: raw.project.updated,
      brainstorming_doc: raw.project.brainstorming_doc ?? null,
    },
    pipeline: raw.pipeline ?? {
      current_tier: raw.execution.current_tier ?? 'planning',
      human_gate_mode: 'ask' as HumanGateMode,
    },
    planning: {
      status: raw.planning.status,
      steps: normalizePlanningSteps(raw.planning.steps),
      human_approved: raw.planning.human_approved,
    },
    execution: {
      status: raw.execution.status,
      current_phase: raw.execution.current_phase,
      total_phases: raw.execution.total_phases,
      phases: raw.execution.phases.map((p, i) => normalizePhase(p, i)),
    },
    final_review: raw.final_review ?? {
      status: 'not_started' as FinalReviewStatus,
      report_doc: null,
      human_approved: false,
    },
    errors: raw.errors ?? {
      total_retries: 0,
      total_halts: 0,
      active_blockers: [],
    },
    limits: raw.limits ?? {
      max_phases: 10,
      max_tasks_per_phase: 20,
      max_retries_per_task: 3,
    },
  };
}
