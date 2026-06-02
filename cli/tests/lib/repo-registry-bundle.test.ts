import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('repo-registry packaging', () => {
  it('is importable from the cli package via relative path', async () => {
    const mod = await import('../../../lib/repo-registry/src/index.js');
    expect(typeof mod.readRegistry).toBe('function');
  });
  it('introduces no new runtime dependency in cli/package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toContain('js-yaml');
    expect(deps.filter((d) => d.startsWith('repo-registry'))).toEqual([]);
  });
});
