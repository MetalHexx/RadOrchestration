import type { ConditionExpression, OrchestrationConfig, PipelineState } from './types.js';

function resolveDotPath(obj: unknown, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === undefined || current === null) {
      throw new Error(
        `Cannot resolve path '${path}': segment '${segment}' is ${typeof current}`
      );
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function evaluateCondition(
  condition: ConditionExpression,
  config: OrchestrationConfig,
  state: PipelineState
): boolean {
  const hasConfigRef = condition.config_ref !== undefined;
  const hasStateRef = condition.state_ref !== undefined;

  if (hasConfigRef && hasStateRef) {
    throw new Error(
      'ConditionExpression must have exactly one of config_ref or state_ref, but both were present'
    );
  }
  if (!hasConfigRef && !hasStateRef) {
    throw new Error(
      'ConditionExpression must have exactly one of config_ref or state_ref, but neither was present'
    );
  }

  const resolved = hasConfigRef
    ? resolveDotPath(config, condition.config_ref!)
    : resolveDotPath(state, condition.state_ref!);

  switch (condition.operator) {
    case 'eq':
      return resolved === condition.value;
    case 'neq':
      return resolved !== condition.value;
    case 'in': {
      if (!Array.isArray(condition.value)) {
        throw new Error("Operator 'in' requires value to be an array");
      }
      return (condition.value as unknown[]).includes(resolved);
    }
    case 'not_in': {
      if (!Array.isArray(condition.value)) {
        throw new Error("Operator 'not_in' requires value to be an array");
      }
      return !(condition.value as unknown[]).includes(resolved);
    }
    case 'truthy':
      return Boolean(resolved);
    case 'falsy':
      return !resolved;
    default: {
      const _exhaustive: never = condition.operator;
      throw new Error(`Unknown operator: '${String(_exhaustive)}'`);
    }
  }
}
