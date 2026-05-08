import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runDoctor, doctorCommand } from '../../src/commands/doctor/index.js';
import { writeInstallSkeleton } from '../../src/commands/install/skeleton.js';
import { validateEnvelope } from '../../src/framework/output.js';

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
    expect(['Environment', 'Install', 'Registry']).toEqual([
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
