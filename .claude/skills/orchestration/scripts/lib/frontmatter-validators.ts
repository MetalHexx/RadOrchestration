export interface ValidationError {
  error: string;
  event: string;
  field: string;
}

export interface FrontmatterValidationRule {
  field: string;
  validate: (value: unknown) => boolean;
  expected: string;
}

/**
 * Converts string 'null' or 'undefined' to JavaScript null.
 * All other values pass through unchanged.
 */
export function coerceNull(value: unknown): unknown {
  if (value === 'null' || value === 'undefined') return null;
  return value;
}

const VALIDATION_RULES: Record<string, FrontmatterValidationRule[]> = {
  requirements_completed: [
    {
      field: 'requirement_count',
      validate: (v) => typeof v === 'number' && Number.isInteger(v) && v > 0,
      expected: 'a positive integer',
    },
  ],
  plan_approved: [
    {
      field: 'total_phases',
      validate: (v) => typeof v === 'number' && Number.isInteger(v) && v > 0,
      expected: 'a positive integer',
    },
    {
      field: 'total_tasks',
      validate: (v) => typeof v === 'number' && Number.isInteger(v) && v > 0,
      expected: 'a positive integer',
    },
  ],
  phase_plan_created: [
    {
      field: 'tasks',
      validate: (v) => Array.isArray(v) && (v as unknown[]).length > 0,
      expected: 'a non-empty array',
    },
  ],
  code_review_completed: [
    {
      field: 'verdict',
      validate: (v) => v != null,
      expected: 'a defined value',
    },
  ],
  phase_review_completed: [
    {
      field: 'verdict',
      validate: (v) => v != null,
      expected: 'a defined value',
    },
    {
      field: 'exit_criteria_met',
      validate: (v) => v !== undefined && v !== null,
      expected: 'a defined value',
    },
  ],
};

/**
 * Returns validation rules for a given event name.
 * Returns an empty array if the event has no frontmatter validation.
 */
export function getValidationRules(event: string): FrontmatterValidationRule[] {
  return VALIDATION_RULES[event] ?? [];
}

/**
 * Validates frontmatter fields for a specific event.
 * Returns null if valid, or a ValidationError for the first failing field.
 */
export function validateFrontmatter(
  event: string,
  frontmatter: Record<string, unknown>,
  _docPath: string,
): ValidationError | null {
  const rules = getValidationRules(event);

  for (const rule of rules) {
    let value = frontmatter[rule.field];

    // Apply coerceNull for verdict fields only
    if (rule.field === 'verdict') {
      value = coerceNull(value);
    }

    // Presence check — missing means undefined or null
    if (value === undefined || value === null) {
      return { error: 'Missing required field', event, field: rule.field };
    }

    // Special two-step validation for tasks to produce distinct error messages
    if (rule.field === 'tasks') {
      if (!Array.isArray(value)) {
        return { error: 'Invalid value: tasks must be an array', event, field: rule.field };
      }
      if ((value as unknown[]).length === 0) {
        return { error: 'Invalid value: tasks must be a non-empty array', event, field: rule.field };
      }
    } else if (!rule.validate(value)) {
      return {
        error: `Invalid value: ${rule.field} must be ${rule.expected}`,
        event,
        field: rule.field,
      };
    }
  }

  return null;
}
