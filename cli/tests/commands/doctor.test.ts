import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runDoctor, doctorCommand } from '../../src/commands/doctor/index.js';
import { writeInstallSkeleton } from '../../src/commands/install/skeleton.js';
import { validateEnvelope } from '../../src/framework/output.js';
import { runPluginChecks } from '../../src/commands/doctor/checks.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doc-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('radorch doctor', () => {
  it('reports Install failure when ~/.radorch is absent', async () => {
    const home = path.join(tmp, 'absent');
    const result = await runDoctor({ env: { RADORCH_HOME: home } });
    expect(result.all_passed).toBe(false);
    const installCategory = result.checks.filter((c) => c.category === 'Install');
    expect(installCategory.some((c) => c.status === 'fail')).toBe(true);
  });

  it('reports all_passed=true with a Registry warn when installed but empty', async () => {
    const home = path.join(tmp, 'rad');
    await writeInstallSkeleton({ root: home, packageVersion: '0.0.0', defaultHarness: 'claude' });
    const result = await runDoctor({ env: { RADORCH_HOME: home } });
    expect(result.all_passed).toBe(true); // warns allowed; only fails block
    const reg = result.checks.find((c) => c.category === 'Registry');
    expect(reg?.status).toBe('warn');
    expect(['Environment', 'Install', 'Registry', 'Plugin']).toEqual([
      ...new Set(result.checks.map((c) => c.category)),
    ]);
  });

  it('every check carries a closed-enum status', async () => {
    const home = path.join(tmp, 'rad');
    await writeInstallSkeleton({ root: home, packageVersion: '0.0.0', defaultHarness: 'claude' });
    const result = await runDoctor({ env: { RADORCH_HOME: home } });
    for (const c of result.checks) {
      expect(['pass', 'warn', 'fail']).toContain(c.status);
    }
  });
});

describe('doctorCommand mapResult', () => {
  it('produces a valid `ok: true` envelope with exit_code 0 when all_passed', () => {
    const r = { all_passed: true, checks: [] };
    const env = doctorCommand.mapResult!(r);
    expect(() => validateEnvelope(env)).not.toThrow();
    expect(env.ok).toBe(true);
    expect((env as { data: typeof r }).data).toEqual(r);
    expect((env as { exit_code: number }).exit_code).toBe(0);
  });
  it('produces a valid `ok: true` envelope with exit_code 1 when any check fails', () => {
    const r = { all_passed: false, checks: [{ category: 'environment' as const, name: 'node', status: 'fail' as const }] };
    const env = doctorCommand.mapResult!(r);
    expect(() => validateEnvelope(env)).not.toThrow();
    expect(env.ok).toBe(true);
    expect((env as { data: typeof r }).data).toEqual(r);
    expect((env as { exit_code: number }).exit_code).toBe(1);
  });
});

describe('plugin-aware doctor checks', () => {
  let home: string;
  beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doc-')); });
  afterEach(async () => { await fs.rm(home, { recursive: true, force: true }); });

  it('reports bootstrap status, UI PID consistency, and version skew', async () => {
    // Fresh home — bootstrap missing
    let result = await runPluginChecks({ root: home, localVersion: '1.1.0' });
    expect(result.find((c) => c.name === 'bootstrap-skeleton')?.status).toBe('fail');
    expect(result.find((c) => c.name === 'version-skew')?.status).toBe('pass'); // no install.json yet
    expect(result.find((c) => c.name === 'ui-pid-consistency')?.status).toBe('pass'); // no pid file

    // Bootstrap manually
    await fs.mkdir(path.join(home, 'projects'), { recursive: true });
    await fs.writeFile(path.join(home, 'registry.yml'), 'repos: []\nworkspaces: []\n');
    await fs.writeFile(path.join(home, 'config.yml'), 'default_active_harness: claude\n');
    await fs.writeFile(path.join(home, 'install.json'), JSON.stringify({
      package_version: '1.1.0',
      installed_at: '2026-05-08T00:00:00.000Z',
      last_writer_version: '1.5.0',
      state_schema_version: 'v5',
    }));
    result = await runPluginChecks({ root: home, localVersion: '1.1.0' });
    expect(result.find((c) => c.name === 'bootstrap-skeleton')?.status).toBe('pass');
    expect(result.find((c) => c.name === 'version-skew')?.status).toBe('fail');

    // Stale PID file — process is dead
    await fs.mkdir(path.join(home, 'runtime'), { recursive: true });
    await fs.writeFile(
      path.join(home, 'runtime', 'ui.pid'),
      JSON.stringify({ pid: 999997, port: 3000, started_at: new Date().toISOString() }),
    );
    result = await runPluginChecks({ root: home, localVersion: '1.5.0' });
    expect(result.find((c) => c.name === 'ui-pid-consistency')?.status).toBe('warn');
  });

  it('does not throw when install.json lacks last_writer_version (iter-01 install)', async () => {
    const homeIter01 = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doctor-iter01-'));
    try {
      // Pre-iter-02 install.json shape: only package_version + installed_at, no last_writer_version
      await fs.mkdir(homeIter01, { recursive: true });
      await fs.writeFile(
        path.join(homeIter01, 'install.json'),
        JSON.stringify({ package_version: '1.0.0-alpha.7', installed_at: '2026-04-01T00:00:00.000Z' }, null, 2) + '\n',
        'utf8',
      );
      const results = await runPluginChecks({ root: homeIter01, localVersion: '1.0.0-alpha.8' });
      // Must not throw. version-skew check should report a non-fail status (skip/pass/warn — no crash).
      const skew = results.find((r) => r.name === 'version-skew');
      expect(skew).toBeDefined();
      expect(skew?.status).not.toBe('fail');
    } finally {
      await fs.rm(homeIter01, { recursive: true, force: true });
    }
  });
});
