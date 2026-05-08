import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readInstallJson, writeInstallJson, readConfigYml, writeConfigYml } from '../../src/lib/config.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-cfg-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('install.json', () => {
  it('round-trips package_version + installed_at', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, { package_version: '0.0.0', installed_at: '2026-05-08T00:00:00Z' });
    expect(await readInstallJson(file)).toEqual({
      package_version: '0.0.0',
      installed_at: '2026-05-08T00:00:00Z',
    });
  });
});

describe('config.yml', () => {
  it('round-trips default_active_harness', async () => {
    const file = path.join(tmp, 'config.yml');
    await writeConfigYml(file, { default_active_harness: 'claude' });
    expect(await readConfigYml(file)).toEqual({ default_active_harness: 'claude' });
  });
});
