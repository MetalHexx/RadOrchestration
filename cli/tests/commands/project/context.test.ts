import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { projectContext } from '../../../src/commands/project/context.js';

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
