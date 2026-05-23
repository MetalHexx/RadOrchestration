import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skillList, skillListCommand } from '../../../src/commands/skill/list.js';
import { runCommand } from '../../../src/framework/command.js';

function writeSkill(dir: string, body: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf8');
}

describe('skillList core', () => {
  it('returns the sorted catalog under data.skills', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-'));
    writeSkill(path.join(root, 's/bbb'), '---\nname: bbb\ndescription: b\n---\n');
    writeSkill(path.join(root, 's/aaa'), '---\nname: aaa\ndescription: a\n---\n');
    const result = skillList({ repoRoot: root });
    expect(result.skills.map(s => s.name)).toEqual(['aaa', 'bbb']);
  });
});

describe('skillList CLI path (runCommand argv → handler args)', () => {
  it('--repo-root is required; missing in non-interactive mode emits user_error', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit:${code}`); }) as never);
    try {
      await runCommand(skillListCommand, {
        argv: ['--non-interactive', '--json'],
        env: { ...process.env, RADORCH_NO_LOG: '1' },
        isTTY: false, stderr: process.stderr,
      });
    } catch (e) {
      expect((e as Error).message).toBe('exit:1');
    }
    const stdout = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(stdout).toMatch(/"ok"\s*:\s*false/);
    expect(stdout).toMatch(/repo-root/);
    log.mockRestore();
    exitSpy.mockRestore();
  });

  it('warn channel routes through ctx.logger.warn, not process.stderr.write', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-warn-'));
    // Create a SKILL.md with malformed frontmatter (missing closing ---)
    writeSkill(path.join(root, 's/malformed'), '---\nname: test\ndescription: test\n');

    const loggerWarnSpy = vi.fn(async () => undefined);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const mockCtx = {
        env: process.env,
        stderr: process.stderr,
        logger: {
          error: vi.fn(async () => undefined),
          warn: loggerWarnSpy,
          info: vi.fn(async () => undefined),
          debug: vi.fn(async () => undefined),
          flush: vi.fn(async () => undefined),
        },
        prompter: {},
        theme: {},
        ux: { isTTY: false, nonInteractive: true, noColor: false, json: false },
      };

      const handler = skillListCommand.handler as unknown as (opts: { args: { 'repo-root': string }; ctx: typeof mockCtx }) => Promise<unknown>;
      await handler({ args: { 'repo-root': root }, ctx: mockCtx });

      expect(loggerWarnSpy).toHaveBeenCalled();
      const call = loggerWarnSpy.mock.calls[0];
      expect(call[0]).toBe('skill_list_skip');
      expect(typeof call[1]?.message).toBe('string');
      expect(call[1]?.message).toMatch(/malformed|frontmatter not terminated/);

      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
