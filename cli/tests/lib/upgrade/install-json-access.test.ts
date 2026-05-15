import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  readInstallJson,
  writeInstallJson,
  stampLastWriter,
} from '../../../src/lib/upgrade/install-json-access.js';
import type { InstallJsonV5 } from '../../../src/lib/config.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-ijaccess-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('readInstallJson / writeInstallJson round-trip', () => {
  it('reads back what was written with all four fields', async () => {
    const file = path.join(tmp, 'install.json');
    const sample = {
      package_version: '1.2.3',
      installed_at: '2026-05-11T00:00:00.000Z',
      last_writer_version: '1.2.3',
      state_schema_version: 'v5',
    };
    await writeInstallJson(file, sample);
    const result = await readInstallJson(file) as InstallJsonV5;
    expect(result.package_version).toBe(sample.package_version);
    expect(result.installed_at).toBe(sample.installed_at);
    expect(result.last_writer_version).toBe(sample.last_writer_version);
    expect(result.state_schema_version).toBe(sample.state_schema_version);
  });
});

describe('stampLastWriter', () => {
  it('updates last_writer_version to the supplied value', async () => {
    const file = path.join(tmp, 'install.json');
    await writeInstallJson(file, {
      package_version: '1.0.0',
      installed_at: '2026-05-11T00:00:00.000Z',
      last_writer_version: '1.0.0',
      state_schema_version: 'v5',
    });
    await stampLastWriter(file, '1.2.0');
    const ij = await readInstallJson(file) as InstallJsonV5;
    expect(ij.last_writer_version).toBe('1.2.0');
  });

  it('sets installed_at on first call when absent, and does not mutate it on second call', async () => {
    const file = path.join(tmp, 'install.json');
    // Write without installed_at (simulate absent field)
    await writeInstallJson(file, {
      package_version: '1.0.0',
      installed_at: '',
      last_writer_version: '1.0.0',
      state_schema_version: 'v5',
    });
    // Patch the raw JSON to remove installed_at entirely
    const raw = JSON.parse(await fs.readFile(file, 'utf8'));
    delete raw.installed_at;
    await fs.writeFile(file, JSON.stringify(raw, null, 2) + '\n', 'utf8');

    // First call: should set installed_at
    await stampLastWriter(file, '1.1.0');
    const afterFirst = await readInstallJson(file) as InstallJsonV5;
    expect(afterFirst.installed_at).toBeTruthy();
    const firstTimestamp = afterFirst.installed_at;

    // Second call: installed_at must not change
    await stampLastWriter(file, '1.2.0');
    const afterSecond = await readInstallJson(file) as InstallJsonV5;
    expect(afterSecond.last_writer_version).toBe('1.2.0');
    expect(afterSecond.installed_at).toBe(firstTimestamp);
  });
});
