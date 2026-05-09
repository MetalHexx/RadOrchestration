import { describe, expect, it } from 'vitest';
import { parseYaml, stringifyYaml } from '../../src/lib/yaml.js';

describe('yaml wrapper', () => {
  it('round-trips a simple object', () => {
    const text = stringifyYaml({ a: 1, b: 'two', c: [true, false] });
    expect(parseYaml(text)).toEqual({ a: 1, b: 'two', c: [true, false] });
  });
  it('parses an empty document to undefined', () => {
    expect(parseYaml('')).toBeUndefined();
  });
});
