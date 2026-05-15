import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  migrateInstallJson,
  isInstallJsonV6,
  detectChannelHeuristic,
  resolveActiveHarnessKey,
  resolveFolderConflict,
  detectChannelOverlap,
} from '../../src/lib/install-json.js';
import type { InstallJsonV5, InstallJsonV6, InstallEntry } from '../../src/lib/config.js';

describe('migrateInstallJson — v5 → v6 lazy migration', () => {
  it('returns input unchanged when already v6', () => {
    const v6: InstallJsonV6 = {
      state_schema_version: 'v6',
      harnesses: {
        claude: {
          version: '1.0.0',
          channel: 'legacy-installer',
          installed_at: '2026-01-01T00:00:00.000Z',
          last_writer_version: '1.0.0',
        },
      },
    };
    const result = migrateInstallJson(v6, 'copilot-cli', 'unknown');
    // Should return the SAME structure (same object identity is fine, but at
    // minimum identical content).
    expect(result).toBe(v6);
    expect(isInstallJsonV6(result)).toBe(true);
  });

  it('builds a single v6 entry under activeKey from v5 fields', () => {
    const v5: InstallJsonV5 = {
      package_version: '1.0.0-alpha.8',
      installed_at: '2026-04-01T00:00:00.000Z',
      last_writer_version: '1.0.0-alpha.8',
      state_schema_version: 'v5',
    };
    const v6 = migrateInstallJson(v5, 'claude', 'legacy-installer');
    expect(v6.state_schema_version).toBe('v6');
    const entry = v6.harnesses.claude as InstallEntry;
    expect(entry.version).toBe('1.0.0-alpha.8');
    expect(entry.channel).toBe('legacy-installer');
    expect(entry.installed_at).toBe('2026-04-01T00:00:00.000Z');
    expect(entry.last_writer_version).toBe('1.0.0-alpha.8');
    // No other entries.
    expect(Object.keys(v6.harnesses)).toEqual(['claude']);
  });

  it('preserves missing optional v5 fields with defaults', () => {
    // v5 with only package_version — older fixtures lack installed_at and
    // last_writer_version.
    const v5 = {
      package_version: '1.0.0-alpha.7',
    } as InstallJsonV5;
    const v6 = migrateInstallJson(v5, 'copilot-cli', 'unknown');
    const entry = v6.harnesses['copilot-cli'] as InstallEntry;
    expect(entry.version).toBe('1.0.0-alpha.7');
    expect(entry.channel).toBe('unknown');
    expect(entry.installed_at).toBeTruthy(); // defaulted to now
    expect(entry.last_writer_version).toBe('1.0.0-alpha.7');
  });

  it('honors the supplied channel verbatim', () => {
    const v5: InstallJsonV5 = {
      package_version: '1.0.0',
      installed_at: '2026-01-01T00:00:00.000Z',
      last_writer_version: '1.0.0',
      state_schema_version: 'v5',
    };
    const asPlugin = migrateInstallJson(v5, 'claude', 'plugin');
    expect((asPlugin.harnesses.claude as InstallEntry).channel).toBe('plugin');
    const asLegacy = migrateInstallJson(v5, 'claude', 'legacy-installer');
    expect((asLegacy.harnesses.claude as InstallEntry).channel).toBe('legacy-installer');
    const asUnknown = migrateInstallJson(v5, 'claude', 'unknown');
    expect((asUnknown.harnesses.claude as InstallEntry).channel).toBe('unknown');
  });
});

describe('detectChannelHeuristic', () => {
  let tmp: string;
  let homedirSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-chan-'));
    homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmp);
  });
  afterEach(() => {
    homedirSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns "plugin" when ~/.claude/plugins/rad-orchestration/ exists', () => {
    fs.mkdirSync(path.join(tmp, '.claude', 'plugins', 'rad-orchestration'), { recursive: true });
    expect(detectChannelHeuristic()).toBe('plugin');
  });

  it('returns "legacy-installer" when only ~/.radorch/ exists', () => {
    fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
    expect(detectChannelHeuristic()).toBe('legacy-installer');
  });

  it('returns "unknown" when neither signal is present', () => {
    expect(detectChannelHeuristic()).toBe('unknown');
  });

  it('prefers plugin over legacy-installer when both signals are present', () => {
    fs.mkdirSync(path.join(tmp, '.claude', 'plugins', 'rad-orchestration'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
    expect(detectChannelHeuristic()).toBe('plugin');
  });

  it('accepts an explicit home override', () => {
    fs.mkdirSync(path.join(tmp, '.claude', 'plugins', 'rad-orchestration'), { recursive: true });
    expect(detectChannelHeuristic({ home: tmp })).toBe('plugin');
  });
});

describe('resolveActiveHarnessKey', () => {
  let tmp: string;
  let homedirSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-ahk-'));
    homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmp);
  });
  afterEach(() => {
    homedirSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reads ~/.radorch/.harness pointer when present', () => {
    fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.radorch', '.harness'), 'copilot-cli\n');
    expect(resolveActiveHarnessKey()).toBe('copilot-cli');
  });

  it('falls back to config.yml default_active_harness', () => {
    fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.radorch', 'config.yml'),
      'default_active_harness: claude\n');
    expect(resolveActiveHarnessKey()).toBe('claude');
  });

  it('prefers .harness pointer over config.yml when both exist', () => {
    fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.radorch', '.harness'), 'copilot-vscode\n');
    fs.writeFileSync(path.join(tmp, '.radorch', 'config.yml'),
      'default_active_harness: claude\n');
    expect(resolveActiveHarnessKey()).toBe('copilot-vscode');
  });

  it('returns undefined when neither signal is present', () => {
    expect(resolveActiveHarnessKey()).toBeUndefined();
  });

  it('rejects invalid install-keys from .harness', () => {
    fs.mkdirSync(path.join(tmp, '.radorch'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.radorch', '.harness'), 'totally-made-up-harness\n');
    expect(resolveActiveHarnessKey()).toBeUndefined();
  });
});

describe('resolveFolderConflict + detectChannelOverlap (cli side mirror of installer helpers)', () => {
  // These TypeScript-side helpers must match the JS port in installer/lib —
  // covered exhaustively in installer/lib/install/folder-conflict.test.js.
  // Here we sanity-check the cli-side exports against the same semantics.
  function entry(version: string, channel: 'plugin' | 'legacy-installer' = 'legacy-installer'): InstallEntry {
    return {
      version,
      channel,
      installed_at: '2026-01-01T00:00:00.000Z',
      last_writer_version: version,
    };
  }

  it('resolveFolderConflict removes copilot-vscode when writing copilot-cli', () => {
    const harnesses: InstallJsonV6['harnesses'] = { 'copilot-vscode': entry('1.0.0') };
    const result = resolveFolderConflict(harnesses, 'copilot-cli');
    expect(result.removed?.key).toBe('copilot-vscode');
    expect(harnesses['copilot-vscode']).toBeUndefined();
  });

  it('detectChannelOverlap returns claude-plugin when writing claude with claude-plugin registered', () => {
    const harnesses: InstallJsonV6['harnesses'] = { 'claude-plugin': entry('1.0.0', 'plugin') };
    expect(detectChannelOverlap(harnesses, 'claude')).toBe('claude-plugin');
    // Non-mutating.
    expect(harnesses['claude-plugin']).toBeDefined();
  });
});
