import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { userDataPaths } from '../../src/lib/paths.js';

describe('userDataPaths — sideProjects', () => {
  it('resolves sideProjects under ~/.radorc/side-projects', () => {
    const p = userDataPaths();
    expect(p.sideProjects).toBe(path.join(os.homedir(), '.radorc', 'side-projects'));
  });
});
