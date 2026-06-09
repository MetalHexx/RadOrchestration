import { describe, it, expect } from 'vitest';
import { buildProgram } from '../../../src/cli.js';

describe('config noun registration', () => {
  it('registers a top-level `config` command', () => {
    const program = buildProgram('0.0.0-test');
    const config = program.commands.find((c) => c.name() === 'config');
    expect(config).toBeDefined();
    expect(config!.description()).toMatch(/auto_commit/);
  });
});
