import { describe, it, expect } from 'vitest';
import { INSTALL_KEYS, detectChannelOverlap } from '../../src/lib/install-json.js';
import type { InstallJson } from '../../src/lib/config.js';

describe('install-key taxonomy — copilot-cli-plugin joins the registry', () => {
  it('INSTALL_KEYS contains five entries including copilot-cli-plugin', () => {
    expect([...INSTALL_KEYS].sort()).toEqual(
      ['claude', 'claude-plugin', 'copilot-cli', 'copilot-cli-plugin', 'copilot-vscode'].sort(),
    );
  });

  it('detectChannelOverlap returns both copilot-cli and copilot-vscode partners when copilot-cli-plugin is installed alongside both', () => {
    const harnesses: InstallJson['harnesses'] = {
      'copilot-cli-plugin': { version: '1.0.0', channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
      'copilot-cli':        { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-vscode':     { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'copilot-cli-plugin');
    const arr = Array.isArray(overlap) ? overlap : (overlap ? [overlap] : []);
    expect(arr.sort()).toEqual(['copilot-cli', 'copilot-vscode']);
  });

  it('detectChannelOverlap returns claude-plugin as a single-partner array (or scalar) when claude is installed alongside claude-plugin', () => {
    const harnesses: InstallJson['harnesses'] = {
      'claude':        { version: '1.0.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '1.0.0' },
      'claude-plugin': { version: '1.0.0', channel: 'claude-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'claude-plugin');
    const arr = Array.isArray(overlap) ? overlap : (overlap ? [overlap] : []);
    expect(arr).toEqual(['claude']);
  });

  it('detectChannelOverlap returns copilot-cli-plugin from the reverse direction when copilot-cli is the active key', () => {
    const harnesses: InstallJson['harnesses'] = {
      'copilot-cli':        { version: '0.9.0', channel: 'legacy-installer', installed_at: 'x', last_writer_version: '0.9.0' },
      'copilot-cli-plugin': { version: '1.0.0', channel: 'copilot-cli-plugin', installed_at: 'x', last_writer_version: '1.0.0' },
    };
    const overlap = detectChannelOverlap(harnesses, 'copilot-cli');
    const arr = Array.isArray(overlap) ? overlap : (overlap ? [overlap] : []);
    expect(arr).toEqual(['copilot-cli-plugin']);
  });
});
