/**
 * Config-level validator surface. Distinct from the pipeline-state
 * validator in lib/validator.ts (which validates state.json invariants).
 * This module validates orchestration.yml fields at config-edit time
 * (e.g., when the dashboard config form or the radorch CLI writes a
 * new value).
 */

export const ALLOWED_DEFAULT_TEMPLATE_VALUES: readonly string[] = [
  'extra-high',
  'high',
  'medium',
  'low',
  'ask',
  '',
];

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateDefaultTemplate(value: string): ValidationResult {
  if (ALLOWED_DEFAULT_TEMPLATE_VALUES.includes(value)) {
    return { ok: true };
  }
  // Verbatim user-authored custom template names ARE valid as values
  // — but the retired legacy literals "default", "quick", "full" are
  // rejected outright so the user sees the new vocabulary.
  if (value === 'default' || value === 'quick' || value === 'full') {
    return {
      ok: false,
      error: `default_template "${value}" is a retired legacy value. Use one of: extra-high, high, medium, low (or "ask" to be prompted at planning time, or your own custom template name).`,
    };
  }
  // Any other string is assumed to be a user-authored custom template name.
  return { ok: true };
}
