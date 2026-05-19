import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanUserLevelHarnesses } from '../../src/lib/cross-harness-scan.js';
import { INSTALL_KEYS } from '../../src/lib/install-json.js';

describe('scanUserLevelHarnesses (single-shape registry reader)', () => {
  let tmp: string;
  let homedirSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-chs-'));
    homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmp);
  });
  afterEach(() => {
    homedirSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function writeRegistry(harnesses: Record<string, { version: string; channel: string }>): void {
    const dir = path.join(tmp, '.radorch');
    fs.mkdirSync(dir, { recursive: true });
    const entries: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(harnesses)) {
      entries[k] = {
        version: v.version,
        channel: v.channel,
        installed_at: '2026-01-01T00:00:00.000Z',
        last_writer_version: v.version,
      };
    }
    fs.writeFileSync(
      path.join(dir, 'install.json'),
      JSON.stringify({ harnesses: entries }, null, 2) + '\n',
    );
  }

  it('returns absent for every install-key when ~/.radorch/install.json is missing', () => {
    const r = scanUserLevelHarnesses();
    expect(r.length).toBe(INSTALL_KEYS.length);
    for (const key of INSTALL_KEYS) {
      const row = r.find((h) => h.installKey === key);
      expect(row?.installed).toBe(false);
    }
  });

  it('emits one row per registered install-key with channel and version', () => {
    writeRegistry({
      'claude': { version: '1.0.0-alpha.9', channel: 'legacy-installer' },
      'copilot-cli': { version: '1.0.0-alpha.8', channel: 'legacy-installer' },
    });
    const r = scanUserLevelHarnesses();
    const claude = r.find((h) => h.installKey === 'claude');
    expect(claude?.installed).toBe(true);
    expect(claude?.packageVersion).toBe('1.0.0-alpha.9');
    expect(claude?.channel).toBe('legacy-installer');
    const copilotCli = r.find((h) => h.installKey === 'copilot-cli');
    expect(copilotCli?.installed).toBe(true);
    expect(copilotCli?.packageVersion).toBe('1.0.0-alpha.8');
    const copilotVscode = r.find((h) => h.installKey === 'copilot-vscode');
    expect(copilotVscode?.installed).toBe(false);
  });

  it('emits separate rows for claude and claude-plugin when both are registered', () => {
    writeRegistry({
      'claude': { version: '1.0.0-alpha.9', channel: 'legacy-installer' },
      'claude-plugin': { version: '1.0.0-alpha.9', channel: 'plugin' },
    });
    const r = scanUserLevelHarnesses();
    const claude = r.find((h) => h.installKey === 'claude');
    expect(claude?.installed).toBe(true);
    expect(claude?.channel).toBe('legacy-installer');
    const plugin = r.find((h) => h.installKey === 'claude-plugin');
    expect(plugin?.installed).toBe(true);
    expect(plugin?.channel).toBe('plugin');
  });

  it('falls back to all not-installed when install.json is unreadable JSON', () => {
    const dir = path.join(tmp, '.radorch');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'install.json'), 'not-valid-json{');
    const r = scanUserLevelHarnesses();
    for (const row of r) expect(row.installed).toBe(false);
  });
});
