import { describe, it, expect } from 'vitest';
import { parseReposFlag } from '../../../src/commands/pipeline/signal.js';

describe('parseReposFlag — array signal grammar (AD-3)', () => {
  it('parses a JSON array of per-repo results', () => {
    const json = JSON.stringify([
      { name: 'fake-api', committed: true, commitHash: 'abc1234', pushed: true },
      { name: 'fake-ui', committed: false, commitHash: null, pushed: false },
    ]);
    expect(parseReposFlag(json)).toEqual([
      { name: 'fake-api', committed: true, commitHash: 'abc1234', pushed: true },
      { name: 'fake-ui', committed: false, commitHash: null, pushed: false },
    ]);
  });

  it('throws a descriptive error on non-array JSON', () => {
    expect(() => parseReposFlag('{"name":"x"}')).toThrow(/--repos must be a JSON array/);
  });
});
