import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('repo-registry by-name consumption', () => {
  it('is importable from the cli package by name', async () => {
    const mod = await import('@rad-orchestration/repo-registry');
    expect(typeof mod.readRegistry).toBe('function');
  });
  it('declares the library dependency in cli/package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toContain('@rad-orchestration/repo-registry');
    expect(deps).toContain('js-yaml');
  });
});
