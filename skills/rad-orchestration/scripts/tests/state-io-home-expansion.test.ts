import { describe, it, expect } from 'vitest';
import { resolveBasePath } from '../lib/state-io.js';
import os from 'node:os';
import path from 'node:path';

describe('base_path resolution', () => {
  it('expands ~/.radorch against RADORCH_HOME when set', () => {
    const env = { RADORCH_HOME: '/custom/radorch' };
    expect(resolveBasePath('~/.radorch/projects/', env)).toBe(path.join('/custom/radorch', 'projects'));
  });
  it('expands ~/.radorch against os.homedir() when RADORCH_HOME unset', () => {
    const env = {};
    expect(resolveBasePath('~/.radorch/projects/', env)).toBe(path.join(os.homedir(), '.radorch', 'projects'));
  });
});
