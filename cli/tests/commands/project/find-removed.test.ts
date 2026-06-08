import { describe, it, expect } from 'vitest';
import { buildProgram } from '../../../src/cli.js';

describe('project find retirement', () => {
  it('no longer registers a `find` subcommand under `project`', () => {
    const program = buildProgram('0.0.0-test');
    const project = program.commands.find((c) => c.name() === 'project')!;
    const names = project.commands.map((c) => c.name());
    expect(names).not.toContain('find');
    expect(names).toEqual(expect.arrayContaining(['list', 'show', 'worktrees']));
  });
});
