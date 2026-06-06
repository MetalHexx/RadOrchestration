import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureGitignored } from '../src/io.js';
import * as barrel from '../src/index.js';

const dirs: string[] = [];
afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true }); });
function tmp(): string { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gi-')); dirs.push(d); return d; }

describe('ensureGitignored', () => {
  it('is re-exported from the package barrel (src/index.ts)', () => {
    expect(typeof barrel.ensureGitignored).toBe('function');
  });
  it('appends an arbitrary entry when absent', () => {
    const root = tmp();
    ensureGitignored({ root, entry: 'side-projects/' });
    expect(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/)).toContain('side-projects/');
  });
  it('is idempotent — does not duplicate an existing entry', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, '.gitignore'), 'side-projects/\n');
    ensureGitignored({ root, entry: 'side-projects/' });
    const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).filter(Boolean);
    expect(lines.filter(l => l === 'side-projects/').length).toBe(1);
  });
  it('preserves the existing repo-registry.local.yml behavior', () => {
    const root = tmp();
    ensureGitignored({ root, entry: 'repo-registry.local.yml' });
    expect(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain('repo-registry.local.yml');
  });
});
