import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { userDataPaths } from '../../../src/lib/upgrade/user-data-paths.js';

describe('userDataPaths', () => {
  it('joins os.homedir() with .radorch verbatim — no env override', () => {
    const homedir = vi.spyOn(os, 'homedir').mockReturnValue('/fake/home');
    const p = userDataPaths();
    expect(p.root).toBe(path.join('/fake/home', '.radorch'));
    expect(p.installJson).toBe(path.join('/fake/home', '.radorch', 'install.json'));
    expect(p.orchestrationYml).toBe(path.join('/fake/home', '.radorch', 'orchestration.yml'));
    expect(p.bin).toBe(path.join('/fake/home', '.radorch', 'bin'));
    expect(p.ui).toBe(path.join('/fake/home', '.radorch', 'ui'));
    expect(p.templates).toBe(path.join('/fake/home', '.radorch', 'templates'));
    expect(p.projects).toBe(path.join('/fake/home', '.radorch', 'projects'));
    expect(p.logs).toBe(path.join('/fake/home', '.radorch', 'logs'));
    expect(p.runtime).toBe(path.join('/fake/home', '.radorch', 'runtime'));
    expect(p.bootstrapLock).toBe(path.join('/fake/home', '.radorch', 'runtime', 'bootstrap.lock'));
    homedir.mockRestore();
  });

  it('ignores RADORCH_HOME entirely', () => {
    const homedir = vi.spyOn(os, 'homedir').mockReturnValue('/fake/home');
    const prior = process.env.RADORCH_HOME;
    process.env.RADORCH_HOME = '/should/be/ignored';
    try {
      expect(userDataPaths().root).toBe(path.join('/fake/home', '.radorch'));
    } finally {
      if (prior === undefined) delete process.env.RADORCH_HOME;
      else process.env.RADORCH_HOME = prior;
    }
    homedir.mockRestore();
  });
});
