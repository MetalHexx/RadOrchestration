import { describe, expect, it } from 'vitest';
import { parseParseErrorFlag } from '../../../src/commands/pipeline/parse-error.js';

describe('parseParseErrorFlag', () => {
  it('returns ok for a well-formed JSON object', () => {
    const r = parseParseErrorFlag('{"line":7,"expected":"## P","found":"# ","message":"bad heading"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.line).toBe(7);
  });
  it('returns user_error on invalid JSON, naming --parse-error as the offending field', () => {
    const r = parseParseErrorFlag('not-json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('parse-error');
      expect(r.error.message).toMatch(/Invalid JSON/);
    }
  });
  it('returns user_error when line is missing or non-positive', () => {
    const r = parseParseErrorFlag('{"line":0,"expected":"x","found":"y","message":"z"}');
    expect(r.ok).toBe(false);
  });
  it('returns user_error when any required string field is missing', () => {
    const r = parseParseErrorFlag('{"line":1,"expected":"x","found":"y"}');
    expect(r.ok).toBe(false);
  });
});
