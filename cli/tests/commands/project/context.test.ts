import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { projectContext, projectContextCommand } from '../../../src/commands/project/context.js';
import { runCommand } from '../../../src/framework/command.js';

function execStub(map: Record<string, string>) {
  return vi.fn((file: string, args: string[]) => {
    const key = `${file} ${args.join(' ')}`;
    if (key in map) return map[key];
    throw new Error(`no stub for: ${key}`);
  });
}

describe('projectContext core', () => {
  it('returns the shared context block without project state when --project-name is omitted', () => {
    const exec = execStub({
      'git rev-parse --show-toplevel': '/repo\n',
      'git branch --show-current': 'feature/x\n',
      'git symbolic-ref refs/remotes/origin/HEAD': 'refs/remotes/origin/main\n',
      'git remote get-url origin': 'git@github.com:org/repo.git\n',
    });
    const r = projectContext({ exec });
    expect(r.repoRoot).toBe(path.resolve('/repo'));
    expect(r.repoName).toBe('repo');
    expect(r.currentBranch).toBe('feature/x');
    expect(r.defaultBranch).toBe('main');
    expect(r.remoteUrl).toBe('https://github.com/org/repo');
    expect(r.projectsBasePath).toBe(path.join(os.homedir(), '.radorch', 'projects'));
    expect(r.projectDir).toBeNull();
    expect(r.sourceControlInitialized).toBeNull();
  });

  it('returns the project-state block when --project-name is supplied and state.json is missing', () => {
    const exec = execStub({
      'git rev-parse --show-toplevel': '/repo\n',
      'git branch --show-current': 'main\n',
      'git symbolic-ref refs/remotes/origin/HEAD': 'refs/remotes/origin/main\n',
      'git remote get-url origin': 'https://github.com/org/repo.git\n',
    });
    const r = projectContext({ projectName: 'DOES-NOT-EXIST', exec });
    expect(r.projectDir).toBe(path.join(os.homedir(), '.radorch', 'projects', 'DOES-NOT-EXIST'));
    expect(r.sourceControlInitialized).toBe(false);
    expect(r.remoteUrl).toBe('https://github.com/org/repo');
  });

  it('strips trailing .git from HTTPS remotes and converts SSH to HTTPS', () => {
    const exec = execStub({
      'git rev-parse --show-toplevel': '/r\n',
      'git branch --show-current': 'main\n',
      'git symbolic-ref refs/remotes/origin/HEAD': 'refs/remotes/origin/main\n',
      'git remote get-url origin': 'git@github.com:a/b\n',
    });
    expect(projectContext({ exec }).remoteUrl).toBe('https://github.com/a/b');
  });
});

describe('projectContext CLI path (runCommand argv → handler args)', () => {
  // Locks the framework contract: the production command def's hyphenated arg
  // names (`project-name`) must round-trip through Commander's camelCase opts()
  // and arrive at the handler unchanged. The bug this guards against let
  // runCommand silently drop the kebab arg, which in interactive-disabled mode
  // also reproduced as "Missing required argument" envelopes on required args.
  it('passes --project-name through runCommand into args[\'project-name\'] verbatim', async () => {
    let receivedProjectName: string | undefined = 'sentinel-untouched';
    const probeDef = {
      ...projectContextCommand,
      handler: async ({ args }: { args: { 'project-name'?: string }; ctx: unknown }) => {
        receivedProjectName = args['project-name'];
        return { probed: true } as never;
      },
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: ['--project-name', 'MYPROJ'],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: false,
      stderr: process.stderr,
    });
    expect(receivedProjectName).toBe('MYPROJ');
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });

  it('treats --project-name as optional (no error when omitted)', async () => {
    let receivedProjectName: string | undefined = 'sentinel-untouched';
    const probeDef = {
      ...projectContextCommand,
      handler: async ({ args }: { args: { 'project-name'?: string }; ctx: unknown }) => {
        receivedProjectName = args['project-name'];
        return { probed: true } as never;
      },
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: [],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: false,
      stderr: process.stderr,
    });
    expect(receivedProjectName).toBeUndefined();
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });
});
