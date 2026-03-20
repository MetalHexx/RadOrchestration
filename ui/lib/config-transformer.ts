import type { OrchestrationConfig, ParsedConfig } from '@/types/config';

/** Transform the raw orchestration config into the grouped display format. */
export function transformConfig(raw: OrchestrationConfig): ParsedConfig {
  return {
    projectStorage: {
      basePath: raw.projects.base_path,
      naming: raw.projects.naming,
    },
    pipelineLimits: {
      maxPhases: raw.limits.max_phases,
      maxTasksPerPhase: raw.limits.max_tasks_per_phase,
      maxRetriesPerTask: raw.limits.max_retries_per_task,
      maxConsecutiveReviewRejections: raw.limits.max_consecutive_review_rejections,
    },
    humanGates: {
      afterPlanning: { value: raw.human_gates.after_planning, locked: true as const },
      executionMode: raw.human_gates.execution_mode,
      afterFinalReview: { value: raw.human_gates.after_final_review, locked: true as const },
    },
  };
}
