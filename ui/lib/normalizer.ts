import type {
  RawStateJson,
  NormalizedProjectState,
  RawPhase,
  NormalizedPhase,
  RawTask,
  NormalizedTask,
} from '@/types/state';

/** Detect schema version from the $schema field. Returns 1 or 2. */
export function detectSchemaVersion(raw: RawStateJson): 1 | 2 {
  return raw.$schema ? 2 : 1;
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

/** Normalize a raw phase object, mapping v1 field names to v2. */
export function normalizePhase(raw: RawPhase, index: number): NormalizedPhase {
  return {
    phase_number: raw.phase_number ?? parseIdNumber((raw as unknown as Record<string, unknown>).id) ?? (index + 1),
    title: raw.title ?? raw.name ?? 'Unnamed Phase',
    status: raw.status,
    phase_doc: raw.phase_doc ?? raw.plan_doc ?? null,
    current_task: raw.current_task,
    total_tasks: raw.total_tasks ?? raw.tasks?.length ?? 0,
    tasks: raw.tasks.map((t, i) => normalizeTask(t, i)),
    phase_report: raw.phase_report,
    human_approved: raw.human_approved,
    phase_review: raw.phase_review ?? null,
    phase_review_verdict: raw.phase_review_verdict ?? null,
    phase_review_action: raw.phase_review_action ?? null,
  };
}

/** Normalize a raw state.json (v1 or v2) into the canonical normalized form. */
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
    pipeline: raw.pipeline,
    planning: raw.planning,
    execution: {
      status: raw.execution.status,
      current_phase: raw.execution.current_phase,
      total_phases: raw.execution.total_phases,
      phases: raw.execution.phases.map(normalizePhase),
    },
    final_review: raw.final_review,
    errors: raw.errors,
    limits: raw.limits,
  };
}
