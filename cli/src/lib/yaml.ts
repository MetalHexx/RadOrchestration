import * as yaml from 'js-yaml';

export function parseYaml<T = unknown>(text: string): T | undefined {
  const result = yaml.load(text);
  return result as T | undefined;
}

export function stringifyYaml(value: unknown): string {
  return yaml.dump(value, { indent: 2, lineWidth: 100, noRefs: true });
}
