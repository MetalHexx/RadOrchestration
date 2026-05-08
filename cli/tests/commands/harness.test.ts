import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runHarnessUse, runHarnessList } from '../../src/commands/harness-use.js';
import { writeInstallSkeleton } from '../../src/commands/install/skeleton.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-h-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('radorch harness use', () => {
  it('errors when install root is missing', async () => {
    await expect(runHarnessUse({ harness: 'claude', env: { RADORCH_HOME: path.join(tmp, 'absent') } })).rejects.toMatchObject({ type: 'user_error' });
  });
  it('rejects unknown harness with user_error', async () => {
    const home = path.join(tmp, 'rad');
    await writeInstallSkeleton({ root: home, packageVersion: '0.0.0', defaultHarness: 'claude' });
    await expect(runHarnessUse({ harness: 'cursor' as never, env: { RADORCH_HOME: home } })).rejects.toMatchObject({ type: 'user_error' });
  });
  it('switches active harness and is idempotent', async () => {
    const home = path.join(tmp, 'rad');
    await writeInstallSkeleton({ root: home, packageVersion: '0.0.0', defaultHarness: 'claude' });
    const r1 = await runHarnessUse({ harness: 'copilot-cli', env: { RADORCH_HOME: home } });
    expect(r1.active).toBe('copilot-cli');
    expect(r1.no_change).toBe(false);
    const r2 = await runHarnessUse({ harness: 'copilot-cli', env: { RADORCH_HOME: home } });
    expect(r2.no_change).toBe(true);
  });
});

describe('radorch harness list', () => {
  it('lists three harnesses with the active flag set', async () => {
    const home = path.join(tmp, 'rad');
    await writeInstallSkeleton({ root: home, packageVersion: '0.0.0', defaultHarness: 'copilot-vscode' });
    const r = await runHarnessList({ env: { RADORCH_HOME: home } });
    expect(r.harnesses).toEqual([
      { name: 'claude', active: false },
      { name: 'copilot-vscode', active: true },
      { name: 'copilot-cli', active: false },
    ]);
  });
});
