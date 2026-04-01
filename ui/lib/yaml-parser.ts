import { parse, stringify } from 'yaml';

/**
 * Parse a YAML string into a typed object.
 *
 * @param content - Raw YAML string
 * @returns Parsed object cast to type T
 */
export function parseYaml<T>(content: string): T {
  return parse(content) as T;
}

/**
 * Serialize a JavaScript object to a YAML string.
 *
 * @param value - The value to serialize
 * @returns YAML string representation
 */
export function stringifyYaml(value: unknown): string {
  return stringify(value);
}
