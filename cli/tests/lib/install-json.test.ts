import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readInstallJson, writeInstallJson } from '../../src/lib/config.js';
import { stampLastWriter, checkVersionSkew, cmpSemver } from '../../src/lib/install-json.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-ij-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('install-json schema', () => {
  it('round-trips the harnesses registry', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '1.1.0',
          channel: 'legacy-installer',
          installed_at: '2026-05-08T00:00:00.000Z',
          last_writer_version: '1.1.0',
        },
      },
    });
    const round = await readInstallJson(file);
    expect(round.harnesses.claude?.version).toBe('1.1.0');
    expect(round.harnesses.claude?.last_writer_version).toBe('1.1.0');
  });
});

describe('stampLastWriter', () => {
  it('updates last_writer_version when newer', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '1.1.0',
          channel: 'legacy-installer',
          installed_at: '2026-05-08T00:00:00.000Z',
          last_writer_version: '1.0.0',
        },
      },
    });
    await stampLastWriter(file, '1.2.0');
    const ij = await readInstallJson(file);
    expect(ij.harnesses.claude?.last_writer_version).toBe('1.2.0');
  });

  it('does not rewrite the file when the version is equal (no churn)', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '1.2.0',
          channel: 'standard',
          installed_at: '2026-05-08T00:00:00.000Z',
          last_writer_version: '1.2.0',
        },
      },
    });
    const before = (await fs.stat(file)).mtimeMs;
    await new Promise((r) => setTimeout(r, 15));
    await stampLastWriter(file, '1.2.0');
    const ij = await readInstallJson(file);
    expect(ij.harnesses.claude?.last_writer_version).toBe('1.2.0');
    // A no-op stamp must not rewrite install.json — every rewrite is a chance to
    // orphan a temp under concurrent access (the install.json.tmp litter).
    expect((await fs.stat(file)).mtimeMs).toBe(before);
  });
});

describe('checkVersionSkew', () => {
  it('rejects when local CLI is older than last_writer_version', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '1.0.0',
          channel: 'legacy-installer',
          installed_at: '2026-05-08T00:00:00.000Z',
          last_writer_version: '1.3.0',
        },
      },
    });
    const result = await checkVersionSkew({ installJsonPath: file, localVersion: '1.2.0' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/last written by radorch 1\.3\.0/);
      expect(result.message).toMatch(/this plugin has 1\.2\.0/);
    }
  });

  it('passes when local CLI is newer or equal', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '1.2.0',
          channel: 'legacy-installer',
          installed_at: '2026-05-08T00:00:00.000Z',
          last_writer_version: '1.2.0',
        },
      },
    });
    const result = await checkVersionSkew({ installJsonPath: file, localVersion: '1.2.0' });
    expect(result.ok).toBe(true);
  });

  it('returns ok=true when install.json is absent (fresh state)', async () => {
    const result = await checkVersionSkew({ installJsonPath: path.join(tmp, 'missing.json'), localVersion: '1.2.0' });
    expect(result.ok).toBe(true);
  });

  it('does not block stable release upgrade from a pre-release (1.0.0 > 1.0.0-alpha.8)', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      harnesses: {
        claude: {
          version: '1.0.0',
          channel: 'legacy-installer',
          installed_at: '2026-05-08T00:00:00.000Z',
          last_writer_version: '1.0.0-alpha.8',
        },
      },
    });
    const result = await checkVersionSkew({ installJsonPath: file, localVersion: '1.0.0' });
    expect(result.ok).toBe(true);
  });
});

describe('cmpSemver', () => {
  it('orders pre-release below release of same main version', () => {
    expect(cmpSemver('1.0.0', '1.0.0-alpha.8')).toBeGreaterThan(0);
    expect(cmpSemver('1.0.0-alpha.8', '1.0.0')).toBeLessThan(0);
    expect(cmpSemver('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
  });
  it('orders pre-release identifiers correctly', () => {
    expect(cmpSemver('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(cmpSemver('1.0.0-alpha.8', '1.0.0-alpha.10')).toBeLessThan(0);
    expect(cmpSemver('1.0.0-alpha.10', '1.0.0-alpha.9')).toBeGreaterThan(0);
  });
  it('orders by major/minor/patch when no pre-release tags involved', () => {
    expect(cmpSemver('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(cmpSemver('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(cmpSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(cmpSemver('1.2.3', '1.2.3')).toBe(0);
  });
});
