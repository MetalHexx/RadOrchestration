import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoBind } from '../../../src/commands/repo/bind.js';
import { writeIdentity } from '../../../../lib/repo-registry/src/index.js';

let root: string;
let realDir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-'));
  realDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-repo-'));
  // Seed identity with a known repo so bind has something to anchor to.
  writeIdentity({
    root,
    repos: { 'my-service': { remote: 'https://github.com/o/my-service', default_branch: 'main', description: '' } },
    repoGroups: {},
  });
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(realDir, { recursive: true, force: true });
});

// Stub: the path is not inside a git working tree.
const nonGit = vi.fn((_f: string, _a: string[]): string => { throw new Error('not a git repository'); });

describe('repo bind', () => {
  it('writes only the local path entry for a registered repo', () => {
    const r = repoBind({ root, name: 'my-service', repoPath: realDir, exec: nonGit });
    const local = fs.readFileSync(path.join(root, 'repo-registry.local.yml'), 'utf8');
    expect(local).toContain('my-service');
    expect(local).toContain(realDir);
    // identity file must NOT have been changed
    const identity = fs.readFileSync(path.join(root, 'repo-registry.yml'), 'utf8');
    expect(identity).toContain('my-service');
    expect(identity).not.toContain(realDir);
    expect(r.warnings).toContain('path is not a git working tree');
  });

  it('fails when the name is not registered', () => {
    expect(() => repoBind({ root, name: 'unknown-repo', repoPath: realDir, exec: nonGit })).toThrow(/not registered/i);
  });

  it('fails when the path is not a directory', () => {
    const notADir = path.join(root, 'nonexistent');
    expect(() => repoBind({ root, name: 'my-service', repoPath: notADir, exec: nonGit })).toThrow(/not a directory/i);
  });

  it('resolves a worktree path to its main clone', () => {
    const exec = vi.fn((_f: string, a: string[]) => {
      if (a[0] === 'rev-parse' && a[1] === '--is-inside-work-tree') return 'true';
      if (a[0] === 'worktree' && a[1] === 'list') return 'worktree /src/my-service\n';
      if (a.includes('remote') && a.includes('-v')) return 'origin\thttps://github.com/o/my-service.git (fetch)';
      return '';
    });
    const r = repoBind({ root, name: 'my-service', repoPath: realDir, exec });
    expect(r.repoPath).toBe('/src/my-service');
    expect(r.resolvedFrom).toBe(realDir);
    const local = fs.readFileSync(path.join(root, 'repo-registry.local.yml'), 'utf8');
    expect(local).toContain('/src/my-service');
  });

  it('warns when the path remote does not match the registered identity', () => {
    const exec = vi.fn((_f: string, a: string[]) => {
      if (a[0] === 'rev-parse' && a[1] === '--is-inside-work-tree') return 'true';
      if (a[0] === 'worktree' && a[1] === 'list') return `worktree ${realDir}\n`;
      if (a.includes('remote') && a.includes('-v')) return 'origin\thttps://github.com/o/something-else.git (fetch)';
      return '';
    });
    const r = repoBind({ root, name: 'my-service', repoPath: realDir, exec });
    expect(r.warnings.some(w => /does not match/.test(w))).toBe(true);
  });
});
