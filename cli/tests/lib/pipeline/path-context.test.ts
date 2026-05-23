import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { resolvePathContext, resolveDiscoveredConfigPath } from '../../../src/lib/pipeline/path-context.js';

describe('path-context resolves from the bundle location', () => {
  it('templatesDir resolves to ~/.radorch/templates/', () => {
    const ctx = resolvePathContext();
    expect(ctx.templatesDir).toBe(path.join(os.homedir(), '.radorch', 'templates'));
  });
  it('PathContext carries scriptsDir and templatesDir and nothing else', () => {
    const ctx = resolvePathContext();
    expect(Object.keys(ctx).sort()).toEqual(['scriptsDir', 'templatesDir']);
  });
  it('default discovered config path is ~/.radorch/orchestration.yml', () => {
    expect(resolveDiscoveredConfigPath()).toBe(path.join(os.homedir(), '.radorch', 'orchestration.yml'));
  });
});
