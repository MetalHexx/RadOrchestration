import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendInstallLogEntry } from '../../../src/lib/upgrade/install-log.js';

describe('appendInstallLogEntry (FR-11, AD-7, DD-3)', () => {
  let home: string;
  afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

  it('writes a single JSONL line with the canonical five-field schema', () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'log-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    appendInstallLogEntry({
      channel: 'legacy-installer',
      action: 'fresh-install',
      deliveringVersion: '1.3.1',
      installedVersionBefore: null,
    });
    const logPath = path.join(home, '.radorch', 'logs', 'install.log');
    const raw = fs.readFileSync(logPath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(raw.trim());
    expect(Object.keys(parsed)).toEqual(['at', 'channel', 'action', 'delivering_version', 'installed_version_before']);
    expect(parsed.channel).toBe('legacy-installer');
    expect(parsed.action).toBe('fresh-install');
    expect(parsed.delivering_version).toBe('1.3.1');
    expect(parsed.installed_version_before).toBeNull();
    expect(parsed.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('appends additional entries without overwriting (DD-3)', () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'log-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    appendInstallLogEntry({ channel: 'legacy-installer', action: 'fresh-install', deliveringVersion: '1.3.0', installedVersionBefore: null });
    appendInstallLogEntry({ channel: 'legacy-installer', action: 'upgrade-complete', deliveringVersion: '1.3.1', installedVersionBefore: '1.3.0' });
    const lines = fs.readFileSync(path.join(home, '.radorch', 'logs', 'install.log'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    for (const l of lines) JSON.parse(l);
  });

  it('swallows write errors silently (NFR-7)', () => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'log-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    // Make logs/ a file so mkdir+append fails.
    fs.mkdirSync(path.join(home, '.radorch'), { recursive: true });
    fs.writeFileSync(path.join(home, '.radorch', 'logs'), 'not a dir');
    expect(() => appendInstallLogEntry({
      channel: 'claude-plugin', action: 'error', deliveringVersion: '1.3.1', installedVersionBefore: '1.3.0',
    })).not.toThrow();
  });
});
