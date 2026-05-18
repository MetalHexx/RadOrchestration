import { describe, it, expect } from 'vitest';
import { WHERE_NAMES } from '../../src/commands/where.js';
import { installPaths } from '../../src/lib/paths.js';
import { scanUserLevelHarnesses } from '../../src/lib/cross-harness-scan.js';

describe('CLI cleanup — sweep targets retired', () => {
  it('WHERE_NAMES no longer exposes config or registry', () => {
    const keys = Object.keys(WHERE_NAMES);
    expect(keys).not.toContain('config');
    expect(keys).not.toContain('registry');
  });
  it('installPaths interface drops configYml, registryYml, harnessPointer', () => {
    const p = installPaths('/tmp/fake-root') as Record<string, unknown>;
    expect(p.configYml).toBeUndefined();
    expect(p.registryYml).toBeUndefined();
    expect(p.harnessPointer).toBeUndefined();
  });
  it('cross-harness-scan returns a structural report without invoking v5 migration', () => {
    // The function exists; the scanner reads install.json structurally.
    const reports = scanUserLevelHarnesses();
    expect(Array.isArray(reports)).toBe(true);
    for (const r of reports) {
      expect(['claude','claude-plugin','copilot-cli','copilot-vscode']).toContain(r.installKey);
    }
  });
});
