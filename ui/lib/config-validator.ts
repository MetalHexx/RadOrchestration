import type {
  OrchestrationConfig,
  ConfigValidationErrors,
} from '@/types/config';

const VALID_NAMING: readonly string[] = ['SCREAMING_CASE', 'lowercase', 'numbered'];
const VALID_EXECUTION_MODE: readonly string[] = ['ask', 'phase', 'task', 'autonomous'];
const VALID_SOURCE_CONTROL_ACTION: readonly string[] = ['always', 'ask', 'never'];

function isSection(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateConfig(config: OrchestrationConfig): ConfigValidationErrors {
  const errors: ConfigValidationErrors = {};

  // 1. system.orch_root — non-empty string
  if (!isSection(config.system)) {
    errors['system'] = 'Missing system section';
  } else if (typeof config.system.orch_root !== 'string' || config.system.orch_root.trim().length === 0) {
    errors['system.orch_root'] = 'Orchestration root is required';
  }

  // 2. projects.base_path — non-empty string
  // 3. projects.naming — must be valid enum
  if (!isSection(config.projects)) {
    errors['projects'] = 'Missing projects section';
  } else {
    if (typeof config.projects.base_path !== 'string' || config.projects.base_path.trim().length === 0) {
      errors['projects.base_path'] = 'Base path is required';
    }
    if (!VALID_NAMING.includes(config.projects.naming as string)) {
      errors['projects.naming'] = 'Invalid naming convention';
    }
  }

  // 4–7. limits — all integer constraints
  if (!isSection(config.limits)) {
    errors['limits'] = 'Missing limits section';
  } else {
    if (!Number.isInteger(config.limits.max_phases) || (config.limits.max_phases as number) < 1) {
      errors['limits.max_phases'] = 'Must be a positive integer';
    }
    if (!Number.isInteger(config.limits.max_tasks_per_phase) || (config.limits.max_tasks_per_phase as number) < 1) {
      errors['limits.max_tasks_per_phase'] = 'Must be a positive integer';
    }
    if (!Number.isInteger(config.limits.max_retries_per_task) || (config.limits.max_retries_per_task as number) < 0) {
      errors['limits.max_retries_per_task'] = 'Must be 0 or a positive integer';
    }
    if (
      !Number.isInteger(config.limits.max_consecutive_review_rejections) ||
      (config.limits.max_consecutive_review_rejections as number) < 1
    ) {
      errors['limits.max_consecutive_review_rejections'] = 'Must be a positive integer';
    }
  }

  // 8–10. human_gates
  if (!isSection(config.human_gates)) {
    errors['human_gates'] = 'Missing human_gates section';
  } else {
    if (typeof config.human_gates.after_planning !== 'boolean') {
      errors['human_gates.after_planning'] = 'Must be true or false';
    }
    if (!VALID_EXECUTION_MODE.includes(config.human_gates.execution_mode as string)) {
      errors['human_gates.execution_mode'] = 'Invalid execution mode';
    }
    if (typeof config.human_gates.after_final_review !== 'boolean') {
      errors['human_gates.after_final_review'] = 'Must be true or false';
    }
  }

  // 11–13. source_control
  if (!isSection(config.source_control)) {
    errors['source_control'] = 'Missing source_control section';
  } else {
    if (!VALID_SOURCE_CONTROL_ACTION.includes(config.source_control.auto_commit as string)) {
      errors['source_control.auto_commit'] = 'Invalid auto commit setting';
    }
    if (!VALID_SOURCE_CONTROL_ACTION.includes(config.source_control.auto_pr as string)) {
      errors['source_control.auto_pr'] = 'Invalid auto PR setting';
    }
    if (config.source_control.provider !== 'github') {
      errors['source_control.provider'] = 'Unsupported provider';
    }
  }

  return errors;
}
