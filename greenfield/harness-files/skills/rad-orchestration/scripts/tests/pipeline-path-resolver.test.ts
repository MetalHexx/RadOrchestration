import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { resolvePathContext, resolveDiscoveredConfigPath } from '../pipeline.js';

describe('pipeline path resolver — orchestration.yml lives at ~/.radorch/', () => {
  it('templatesDir resolves to ~/.radorch/templates/', () => {
    const ctx = resolvePathContext();
    expect(ctx.templatesDir).toBe(path.join(os.homedir(), '.radorch', 'templates'));
  });

  it('default discovered config path is ~/.radorch/orchestration.yml, not skill-folder-relative', () => {
    const discovered = resolveDiscoveredConfigPath();
    expect(discovered).toBe(path.join(os.homedir(), '.radorch', 'orchestration.yml'));
  });
});
