import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { resolveInstallRoot, installPaths } from '../../src/lib/paths.js';

describe('resolveInstallRoot', () => {
  it('returns $RADORCH_HOME when set', () => {
    const root = resolveInstallRoot({ RADORCH_HOME: '/tmp/rad-x' });
    expect(root).toBe('/tmp/rad-x');
  });
  it('falls back to ~/.radorch when unset', () => {
    const root = resolveInstallRoot({});
    expect(root).toBe(path.join(os.homedir(), '.radorch'));
  });
});

describe('installPaths', () => {
  it('exposes the canonical layout under a given root', () => {
    const p = installPaths('/tmp/rad-x');
    expect(p.installJson).toBe('/tmp/rad-x/install.json');
    expect(p.configYml).toBe('/tmp/rad-x/config.yml');
    expect(p.registryYml).toBe('/tmp/rad-x/registry.yml');
    expect(p.harnessPointer).toBe('/tmp/rad-x/.harness');
    expect(p.gitignore).toBe('/tmp/rad-x/.gitignore');
    expect(p.projectsDir).toBe('/tmp/rad-x/projects');
    expect(p.worktreesDir).toBe('/tmp/rad-x/worktrees');
    expect(p.logsDir).toBe('/tmp/rad-x/logs');
    expect(p.cliLog).toBe('/tmp/rad-x/logs/cli.log');
    expect(p.harnessesDir).toBe('/tmp/rad-x/runtime/harnesses');
  });
});
