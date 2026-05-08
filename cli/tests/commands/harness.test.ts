import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runHarnessUse, runHarnessList, harnessUseCommand } from '../../src/commands/harness-use.js';
import { writeInstallSkeleton } from '../../src/commands/install/skeleton.js';
import { resolveInstallRoot, installPaths } from '../../src/lib/paths.js';
import { UserError } from '../../src/framework/errors.js';

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
  it('emits a stderr info line when the requested harness is already active', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'radorch-harness-c1-'));
    try {
      // Set up an installed root with claude already active.
      const env = { RADORCH_HOME: tmp } as unknown as NodeJS.ProcessEnv;
      const root = resolveInstallRoot(env);
      const p = installPaths(root);
      await fs.mkdir(p.logsDir, { recursive: true });
      await fs.writeFile(p.installJson, '{}');
      await fs.writeFile(p.harnessPointer, 'claude\n');

      const stderrChunks: string[] = [];
      const fakeStderr = {
        write: (chunk: string | Uint8Array) => {
          stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
          return true;
        },
      } as unknown as NodeJS.WriteStream;

      const ctx = {
        env,
        stderr: fakeStderr,
        logger: { info: async () => {}, warn: async () => {}, error: async () => {}, debug: async () => {}, flush: async () => {} },
        prompter: { input: async () => '', confirm: async () => false, select: async () => 'a' },
        theme: { banner: (s: string) => s, heading: (s: string) => s, success: (s: string) => s, warning: (s: string) => s, error: (s: string) => s, hint: (s: string) => s },
        ux: { isTTY: true, nonInteractive: false, noColor: false, json: false },
      } as unknown as Parameters<typeof harnessUseCommand.handler>[0]['ctx'];

      const result = await harnessUseCommand.handler({ args: { harness: 'claude' }, flags: {}, ctx });
      expect(result.no_change).toBe(true);
      const stderrText = stderrChunks.join('');
      expect(stderrText.length).toBeGreaterThan(0);
      expect(stderrText).toMatch(/already active|no change/i);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
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
  it('runHarnessList errors with user_error when install root is missing', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'radorch-harness-list-missing-'));
    try {
      const env = { RADORCH_HOME: tmp } as unknown as NodeJS.ProcessEnv;
      await expect(runHarnessList({ env })).rejects.toBeInstanceOf(UserError);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
