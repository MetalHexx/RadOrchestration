import type {
  OrchestrationConfig,
  ConfigValidationErrors,
} from '@/types/config';

const VALID_NAMING: readonly string[] = ['SCREAMING_CASE', 'lowercase', 'numbered'];
const VALID_EXECUTION_MODE: readonly string[] = ['ask', 'phase', 'task', 'autonomous'];
const VALID_SOURCE_CONTROL_ACTION: readonly string[] = ['always', 'ask', 'never'];

export function validateConfig(config: OrchestrationConfig): ConfigValidationErrors {
  const errors: ConfigValidationErrors = {};

  // 1. system.orch_root — non-empty string
  if (typeof config.system.orch_root !== 'string' || config.system.orch_root.trim().length === 0) {
    errors['system.orch_root'] = 'Orchestration root is required';
  }

  // 2. projects.base_path — non-empty string
  if (typeof config.projects.base_path !== 'string' || config.projects.base_path.trim().length === 0) {
    errors['projects.base_path'] = 'Base path is required';
  }

  // 3. projects.naming — must be valid enum
  if (!VALID_NAMING.includes(config.projects.naming)) {
    errors['projects.naming'] = 'Invalid naming convention';
  }

  // 4. limits.max_phases — integer >= 1
  if (!Number.isInteger(config.limits.max_phases) || config.limits.max_phases < 1) {
    errors['limits.max_phases'] = 'Must be a positive integer';
  }

  // 5. limits.max_tasks_per_phase — integer >= 1
  if (!Number.isInteger(config.limits.max_tasks_per_phase) || config.limits.max_tasks_per_phase < 1) {
    errors['limits.max_tasks_per_phase'] = 'Must be a positive integer';
  }

  // 6. limits.max_retries_per_task — integer >= 0
  if (!Number.isInteger(config.limits.max_retries_per_task) || config.limits.max_retries_per_task < 0) {
    errors['limits.max_retries_per_task'] = 'Must be 0 or a positive integer';
  }

  // 7. limits.max_consecutive_review_rejections — integer >= 1
  if (!Number.isInteger(config.limits.max_consecutive_review_rejections) || config.limits.max_consecutive_review_rejections < 1) {
    errors['limits.max_consecutive_review_rejections'] = 'Must be a positive integer';
  }

  // 8. human_gates.after_planning — boolean
  if (typeof config.human_gates.after_planning !== 'boolean') {
    errors['human_gates.after_planning'] = 'Must be true or false';
  }

  // 9. human_gates.execution_mode — valid enum
  if (!VALID_EXECUTION_MODE.includes(config.human_gates.execution_mode)) {
    errors['human_gates.execution_mode'] = 'Invalid execution mode';
  }

  // 10. human_gates.after_final_review — boolean
  if (typeof config.human_gates.after_final_review !== 'boolean') {
    errors['human_gates.after_final_review'] = 'Must be true or false';
  }

  // 11. source_control.auto_commit — valid enum
  if (!VALID_SOURCE_CONTROL_ACTION.includes(config.source_control.auto_commit)) {
    errors['source_control.auto_commit'] = 'Invalid auto commit setting';
  }

  // 12. source_control.auto_pr — valid enum
  if (!VALID_SOURCE_CONTROL_ACTION.includes(config.source_control.auto_pr)) {
    errors['source_control.auto_pr'] = 'Invalid auto PR setting';
  }

  // 13. source_control.provider — must be "github"
  if (config.source_control.provider !== 'github') {
    errors['source_control.provider'] = 'Unsupported provider';
  }

  return errors;
}
