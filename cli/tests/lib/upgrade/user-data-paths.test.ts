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
    // p.bin retired — the CLI now ships inside the rad-orchestration skill,
    // not at ~/.radorch/bin/. UserDataPaths no longer exposes a `bin` field.
    expect(p.ui).toBe(path.join('/fake/home', '.radorch', 'ui'));
    expect(p.templates).toBe(path.join('/fake/home', '.radorch', 'templates'));
    expect(p.projects).toBe(path.join('/fake/home', '.radorch', 'projects'));
    expect(p.logs).toBe(path.join('/fake/home', '.radorch', 'logs'));
    expect(p.runtime).toBe(path.join('/fake/home', '.radorch', 'runtime'));
    expect(p.bootstrapLock).toBe(path.join('/fake/home', '.radorch', 'runtime', 'bootstrap.lock'));
    homedir.mockRestore();
  });
});
