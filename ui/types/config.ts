export interface OrchestrationConfig {
  version: string;
  system?: {
    orch_root?: string;
  };
  projects: {
    base_path: string;
    naming: string;
  };
  limits: {
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
    max_consecutive_review_rejections: number;
  };
  human_gates: {
    after_planning: boolean;
    execution_mode: string;
    after_final_review: boolean;
  };
}

/** Grouped config for the Config Drawer display */
export interface ParsedConfig {
  projectStorage: {
    basePath: string;
    naming: string;
  };
  pipelineLimits: {
    maxPhases: number;
    maxTasksPerPhase: number;
    maxRetriesPerTask: number;
    maxConsecutiveReviewRejections: number;
  };
  humanGates: {
    afterPlanning: { value: boolean; locked: true };
    executionMode: string;
    afterFinalReview: { value: boolean; locked: true };
  };
}
