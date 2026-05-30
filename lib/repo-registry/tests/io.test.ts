import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readRegistry, writeIdentity, writeLocal, ensureLocalGitignored } from '../src/index.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('repo-registry io', () => {
  it('returns empty result when neither file exists', () => {
    const reg = readRegistry({ root });
    expect(reg.repos).toEqual({});
    expect(reg.repoGroups).toEqual({});
    expect(reg.localPaths).toEqual({});
  });

  it('lazily creates repo-registry.yml on first identity write and is map-keyed', () => {
    expect(fs.existsSync(path.join(root, 'repo-registry.yml'))).toBe(false);
    writeIdentity({ root, repos: { 'my-repo': { remote: 'https://github.com/o/my-repo', default_branch: 'main', description: 'x' } }, repoGroups: {} });
    const text = fs.readFileSync(path.join(root, 'repo-registry.yml'), 'utf8');
    expect(text).toContain('my-repo:');
    expect(text).toContain('default_branch: main');
    expect(text).not.toMatch(/^\s*-\s/m);
  });

  it('lazily creates repo-registry.local.yml only when a path is written', () => {
    writeIdentity({ root, repos: { r: { remote: 'g', default_branch: 'main', description: '' } }, repoGroups: {} });
    expect(fs.existsSync(path.join(root, 'repo-registry.local.yml'))).toBe(false);
    writeLocal({ root, localPaths: { r: '/clones/r' } });
    expect(fs.existsSync(path.join(root, 'repo-registry.local.yml'))).toBe(true);
  });

  it('writes atomically leaving no .tmp residue', () => {
    writeIdentity({ root, repos: { r: { remote: 'g', default_branch: 'main', description: '' } }, repoGroups: {} });
    expect(fs.readdirSync(root).some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('idempotently appends the local file to ~/.radorc/.gitignore without duplicating', () => {
    ensureLocalGitignored({ root });
    ensureLocalGitignored({ root });
    const gi = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gi.match(/^repo-registry\.local\.yml$/gm)?.length).toBe(1);
  });

  it('readRegistry throws a meaningful error when repo-registry.yml contains malformed YAML', () => {
    fs.writeFileSync(path.join(root, 'repo-registry.yml'), ':\ninvalid: [yaml', 'utf8');
    expect(() => readRegistry({ root })).toThrow(/failed to parse/i);
  });

  it('writeIdentity succeeds and creates directory when root does not yet exist', () => {
    const nestedRoot = path.join(root, 'deep', 'nested', 'radorc');
    expect(fs.existsSync(nestedRoot)).toBe(false);
    writeIdentity({ root: nestedRoot, repos: { 'new-repo': { remote: 'https://github.com/o/r', default_branch: 'main', description: 'test' } }, repoGroups: {} });
    expect(fs.existsSync(nestedRoot)).toBe(true);
    expect(fs.existsSync(path.join(nestedRoot, 'repo-registry.yml'))).toBe(true);
  });
});
