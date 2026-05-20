import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectCopilotVscodePlugin } from '../../src/lib/cross-harness-scan.js';

function makeFakeHome(platform: 'darwin' | 'linux' | 'win32', layout: 'present' | 'absent'): { home: string; expectedPath: string; cleanup: () => void } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-detect-'));
  const seg = path.join('agentPlugins', 'github.com', 'MetalHexx', 'RadOrchestration');
  let appData: string;
  if (platform === 'darwin') appData = path.join(home, 'Library', 'Application Support', 'Code');
  else if (platform === 'linux') appData = path.join(home, '.config', 'Code');
  else appData = path.join(home, 'AppData', 'Roaming', 'Code');
  const expectedPath = path.join(appData, seg);
  if (layout === 'present') fs.mkdirSync(expectedPath, { recursive: true });
  return { home, expectedPath, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

describe('detectCopilotVscodePlugin — OS-specific agentPlugins path probe (DD-15, FR-42)', () => {
  it('returns true when the plugin directory exists under the platform-matched path', () => {
    const { home, cleanup } = makeFakeHome(process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : 'win32', 'present');
    try {
      expect(detectCopilotVscodePlugin({ home })).toBe(true);
    } finally { cleanup(); }
  });

  it('returns false when no agentPlugins/github.com/.../ path exists', () => {
    const { home, cleanup } = makeFakeHome(process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : 'win32', 'absent');
    try {
      expect(detectCopilotVscodePlugin({ home })).toBe(false);
    } finally { cleanup(); }
  });

  it('honors the override parameters so tests can swap org/repo segments (DD-15)', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-detect-ovr-'));
    try {
      const platform = process.platform;
      let base: string;
      if (platform === 'darwin') base = path.join(home, 'Library', 'Application Support', 'Code');
      else if (platform === 'linux') base = path.join(home, '.config', 'Code');
      else base = path.join(home, 'AppData', 'Roaming', 'Code');
      fs.mkdirSync(path.join(base, 'agentPlugins', 'github.com', 'OtherOrg', 'OtherRepo'), { recursive: true });
      expect(detectCopilotVscodePlugin({ home, org: 'OtherOrg', repo: 'OtherRepo' })).toBe(true);
      expect(detectCopilotVscodePlugin({ home })).toBe(false);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
