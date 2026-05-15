import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanUserLevelHarnesses } from '../../src/lib/cross-harness-scan.js';
import { INSTALL_KEYS } from '../../src/lib/install-json.js';

describe('scanUserLevelHarnesses (Section 6 — v6 registry reader)', () => {
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
      JSON.stringify({ state_schema_version: 'v6', harnesses: entries }, null, 2) + '\n',
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

  it('migrates v5-shape install.json in memory on read (does not write back)', () => {
    // Stage a v5 install.json and the .harness pointer so the migration finds
    // an active key.
    const dir = path.join(tmp, '.radorch');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.harness'),
      'copilot-cli\n',
    );
    const v5 = {
      package_version: '1.0.0-alpha.8',
      installed_at: '2026-04-01T00:00:00.000Z',
      last_writer_version: '1.0.0-alpha.8',
      state_schema_version: 'v5',
    };
    fs.writeFileSync(path.join(dir, 'install.json'), JSON.stringify(v5, null, 2) + '\n');

    const r = scanUserLevelHarnesses();
    const copilot = r.find((h) => h.installKey === 'copilot-cli');
    expect(copilot?.installed).toBe(true);
    expect(copilot?.packageVersion).toBe('1.0.0-alpha.8');

    // The on-disk file is NOT mutated by the scanner.
    const reread = JSON.parse(fs.readFileSync(path.join(dir, 'install.json'), 'utf8'));
    expect(reread.state_schema_version).toBe('v5');
    expect(reread.package_version).toBe('1.0.0-alpha.8');
  });

  it('falls back to all not-installed when install.json is unreadable JSON', () => {
    const dir = path.join(tmp, '.radorch');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'install.json'), 'not-valid-json{');
    const r = scanUserLevelHarnesses();
    for (const row of r) expect(row.installed).toBe(false);
  });

  it('migrates v5 using the channel heuristic — plugin folder present → plugin', () => {
    const dir = path.join(tmp, '.radorch');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.harness'), 'claude\n');
    // Plugin folder presence signals the plugin channel.
    fs.mkdirSync(path.join(tmp, '.claude', 'plugins', 'rad-orchestration'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'install.json'), JSON.stringify({
      package_version: '1.0.0-alpha.8',
      installed_at: '2026-04-01T00:00:00.000Z',
      last_writer_version: '1.0.0-alpha.8',
      state_schema_version: 'v5',
    }));
    const r = scanUserLevelHarnesses();
    const claude = r.find((h) => h.installKey === 'claude');
    expect(claude?.channel).toBe('plugin');
  });
});
