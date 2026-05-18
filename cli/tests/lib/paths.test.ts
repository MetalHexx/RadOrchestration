import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { resolveInstallRoot, installPaths } from '../../src/lib/paths.js';

describe('resolveInstallRoot', () => {
  it('returns ~/.radorch', () => {
    const root = resolveInstallRoot();
    expect(root).toBe(path.join(os.homedir(), '.radorch'));
  });
});

describe('installPaths', () => {
  it('exposes the canonical layout under a given root', () => {
    const root = '/tmp/rad-x';
    const p = installPaths(root);
    expect(p.installJson).toBe(path.join(root, 'install.json'));
    expect(p.gitignore).toBe(path.join(root, '.gitignore'));
    expect(p.projectsDir).toBe(path.join(root, 'projects'));
    expect(p.worktreesDir).toBe(path.join(root, 'worktrees'));
    expect(p.logsDir).toBe(path.join(root, 'logs'));
    expect(p.cliLog).toBe(path.join(root, 'logs', 'cli.log'));
    expect(p.harnessesDir).toBe(path.join(root, 'runtime', 'harnesses'));
  });
  it('produces native paths when given a Windows-style root', () => {
    const winRoot = 'C:\\Users\\example\\.radorch';
    const paths = installPaths(winRoot);
    // The cliLog must be a contiguous descendant of the root, not a corrupted prefix.
    expect(paths.cliLog.startsWith(winRoot)).toBe(true);
    expect(paths.cliLog).not.toContain('Users\\example.radorch');
    expect(paths.logsDir.startsWith(winRoot)).toBe(true);
  });
});
