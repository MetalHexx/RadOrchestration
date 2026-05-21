import { describe, it, expect } from 'vitest';
import { INSTALL_KEYS, detectChannelOverlap } from '../../src/lib/install-json.js';
import type { InstallJson } from '../../src/lib/config.js';

describe('install-key taxonomy — copilot-vscode-plugin joins the registry', () => {
  it('INSTALL_KEYS contains six entries including copilot-vscode-plugin', () => {
    expect([...INSTALL_KEYS].sort()).toEqual(
      ['claude', 'claude-plugin', 'copilot-cli', 'copilot-cli-plugin', 'copilot-vscode', 'copilot-vscode-plugin'].sort(),
    );
  });

  it('detectChannelOverlap returns all three partners when copilot-vscode-plugin is installed alongside the full set', () => {
    const harnesses: InstallJson['harnesses'] = {
      'copilot-vscode-plugin': { version: '1.0.0', channel: 'copilot-vscode-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
      'copilot-vscode':        { version: '0.9.0', channel: 'legacy-installer',      installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-cli':           { version: '0.9.0', channel: 'legacy-installer',      installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-cli-plugin':    { version: '0.9.0', channel: 'copilot-cli-plugin',    installed_at: 'x', last_writer_version: '0.9.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'copilot-vscode-plugin');
    expect(overlap?.sort()).toEqual(['copilot-cli', 'copilot-cli-plugin', 'copilot-vscode']);
  });

  it('reverse direction: copilot-vscode now reports copilot-vscode-plugin as an overlap partner (FR-22)', () => {
    const harnesses: InstallJson['harnesses'] = {
      'copilot-vscode':        { version: '0.9.0', channel: 'legacy-installer',      installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-vscode-plugin': { version: '1.0.0', channel: 'copilot-vscode-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'copilot-vscode');
    expect(overlap?.sort()).toEqual(['copilot-vscode-plugin']);
  });

  it('reverse direction: copilot-cli reports both copilot-cli-plugin and copilot-vscode-plugin when present (FR-22)', () => {
    const harnesses: InstallJson['harnesses'] = {
      'copilot-cli':           { version: '0.9.0', channel: 'legacy-installer',      installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-cli-plugin':    { version: '1.0.0', channel: 'copilot-cli-plugin',    installed_at: 'x', last_writer_version: '1.0.0' },
      'copilot-vscode-plugin': { version: '1.0.0', channel: 'copilot-vscode-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'copilot-cli');
    expect(overlap?.sort()).toEqual(['copilot-cli-plugin', 'copilot-vscode-plugin']);
  });

  it('reverse direction: copilot-cli-plugin reports copilot-vscode-plugin as a third overlap partner (FR-22)', () => {
    const harnesses: InstallJson['harnesses'] = {
      'copilot-cli':           { version: '0.9.0', channel: 'legacy-installer',      installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-vscode':        { version: '0.9.0', channel: 'legacy-installer',      installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-cli-plugin':    { version: '1.0.0', channel: 'copilot-cli-plugin',    installed_at: 'x', last_writer_version: '1.0.0' },
      'copilot-vscode-plugin': { version: '1.0.0', channel: 'copilot-vscode-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'copilot-cli-plugin');
    expect(overlap?.sort()).toEqual(['copilot-cli', 'copilot-vscode', 'copilot-vscode-plugin']);
  });
});
