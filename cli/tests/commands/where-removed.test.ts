import { describe, it, expect } from 'vitest';
import { buildProgram } from '../../src/cli.js';

describe('radorch where removal', () => {
  it('no longer registers a top-level `where` command', () => {
    const program = buildProgram('0.0.0-test');
    expect(program.commands.find((c) => c.name() === 'where')).toBeUndefined();
  });
  it('drops the stale `radorch where` help tip', () => {
    const program = buildProgram('0.0.0-test');
    expect(program.helpInformation()).not.toMatch(/radorch where/);
  });
});
