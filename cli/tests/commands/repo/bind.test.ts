import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoBind } from '../../../src/commands/repo/bind.js';
import { writeIdentity } from '../../../../lib/repo-registry/src/io.js';

let root: string;
let realDir: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-'));
  realDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-repo-'));
  // Seed identity with a known repo so bind has something to anchor to
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

describe('repo bind', () => {
  it('writes only the local path entry for a registered repo', () => {
    repoBind({ root, name: 'my-service', repoPath: realDir });
    const local = fs.readFileSync(path.join(root, 'repo-registry.local.yml'), 'utf8');
    expect(local).toContain('my-service');
    expect(local).toContain(realDir);
    // identity file must NOT have been changed
    const identity = fs.readFileSync(path.join(root, 'repo-registry.yml'), 'utf8');
    expect(identity).toContain('my-service');
    expect(identity).not.toContain(realDir);
  });
  it('fails when the name is not registered', () => {
    expect(() => repoBind({ root, name: 'unknown-repo', repoPath: realDir })).toThrow(/not registered/i);
  });
  it('fails when the path is not a directory', () => {
    const notADir = path.join(root, 'nonexistent');
    expect(() => repoBind({ root, name: 'my-service', repoPath: notADir })).toThrow(/not a directory/i);
  });
});
