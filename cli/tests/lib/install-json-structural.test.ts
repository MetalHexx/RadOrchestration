import { describe, it, expect } from 'vitest';
import * as cfg from '../../src/lib/config.js';
import * as ij from '../../src/lib/install-json.js';

describe('install.json — single structural shape, no version literal', () => {
  it('exports a single InstallJson type — no V5/V6 union members exported', () => {
    // Negative TS surface check via Object.keys on the module's runtime exports:
    // ConfigYml/readConfigYml/writeConfigYml are removed, isInstallJsonV6 and
    // migrateInstallJson and resolveActiveHarnessKey are removed.
    const cfgNames = Object.keys(cfg);
    expect(cfgNames).not.toContain('readConfigYml');
    expect(cfgNames).not.toContain('writeConfigYml');
    const ijNames = Object.keys(ij);
    expect(ijNames).not.toContain('isInstallJsonV6');
    expect(ijNames).not.toContain('migrateInstallJson');
    expect(ijNames).not.toContain('resolveActiveHarnessKey');
  });

  it('writeInstallJson strips any incoming state_schema_version field', async () => {
    const { writeInstallJson, readInstallJson } = cfg;
    const tmp = `${process.env.TEMP ?? '/tmp'}/install-shape-${process.pid}.json`;
    // @ts-expect-error — exercising legacy shape input
    await writeInstallJson(tmp, { state_schema_version: 'v6', harnesses: { claude: { version: '1.0.0', channel: 'plugin', installed_at: 't', last_writer_version: '1.0.0' } } });
    const read = await readInstallJson(tmp);
    expect((read as any).state_schema_version).toBeUndefined();
    expect(read.harnesses.claude?.version).toBe('1.0.0');
  });
});
