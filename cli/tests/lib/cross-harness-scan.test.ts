import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanUserLevelHarnesses } from '../../src/lib/cross-harness-scan.js';

describe('scanUserLevelHarnesses', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-chs-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmp);
  });

  it('returns absent for harnesses with no folder', () => {
    const r = scanUserLevelHarnesses();
    expect(r.find(h => h.harness === 'claude')!.installed).toBe(false);
    expect(r.find(h => h.harness === 'copilot-vscode')!.installed).toBe(false);
    expect(r.find(h => h.harness === 'copilot-cli')!.installed).toBe(false);
  });

  it('returns version when ~/.claude/install.json exists', () => {
    fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.claude', 'install.json'),
      JSON.stringify({ package_version: '1.1.0' }));
    const r = scanUserLevelHarnesses();
    const claude = r.find(h => h.harness === 'claude')!;
    expect(claude.installed).toBe(true);
    expect(claude.packageVersion).toBe('1.1.0');
  });

  it('copilot-vscode and copilot-cli share ~/.copilot/', () => {
    fs.mkdirSync(path.join(tmp, '.copilot'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.copilot', 'install.json'),
      JSON.stringify({ package_version: '1.1.0' }));
    const r = scanUserLevelHarnesses();
    expect(r.find(h => h.harness === 'copilot-vscode')!.installed).toBe(true);
    expect(r.find(h => h.harness === 'copilot-cli')!.installed).toBe(true);
  });
});
