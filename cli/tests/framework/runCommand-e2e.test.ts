import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineCommand, runCommand } from '../../src/framework/command.js';

describe('runCommand E2E (envelope + NDJSON in one run)', () => {
  let tmpHome: string;
  let homedirSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'radorch-e2e-'));
    homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
    // resolveInstallRoot() = path.join(tmpHome, '.radorch')
    // installPaths(root).cliLog = path.join(tmpHome, '.radorch', 'logs', 'cli.log')
    await fs.mkdir(path.join(tmpHome, '.radorch', 'logs'), { recursive: true });
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('emits a valid envelope on stdout and a matching NDJSON entry to the log file', async () => {
    // Capture stdout (envelope) and intercept process.exit. We spy on both
    // process.stdout.write (used by console.log under the hood) and console.log
    // itself, since Vitest's runtime can capture console output before it
    // reaches stdout.write reassignment.
    const stdoutChunks: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stdout.write);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdoutChunks.push(args.map(String).join(' ') + '\n');
    });
    const exitCodes: number[] = [];
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCodes.push(code ?? 0);
      throw new Error('__exit__');
    }) as typeof process.exit);

    const def = defineCommand<object, object, { msg: string }>({
      name: 'noop',
      description: 'no-op command for e2e',
      args: {},
      flags: {},
      handler: async () => ({ msg: 'hello' }),
      mapResult: (r) => ({ ok: true, data: r }),
    });

    try {
      await runCommand(def, {
        argv: [],
        env: process.env,
        isTTY: false,
        stderr: { write: () => true } as unknown as NodeJS.WriteStream,
      });
    } catch {
      // process.exit throws by design in this harness.
    } finally {
      stdoutSpy.mockRestore();
      consoleLogSpy.mockRestore();
      exitSpy.mockRestore();
    }
    // First exit call reflects the success path; subsequent calls (if any) come
    // from runCommand's outer catch re-handling the synthetic __exit__ throw.
    const exitCode = exitCodes[0];

    // Envelope on stdout — take the first JSON line we see (the success envelope
    // produced before process.exit's throw is rethrown by runCommand's catch block).
    const allLines = stdoutChunks.join('').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const envelopeLine = allLines[0];
    expect(envelopeLine).toBeDefined();
    const envelope = JSON.parse(envelopeLine!);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toEqual({ msg: 'hello' });
    expect(exitCode).toBe(0);

    // NDJSON entry in cli.log under tmpHome/.radorch/logs/
    const logPath = path.join(tmpHome, '.radorch', 'logs', 'cli.log');
    const logContent = await fs.readFile(logPath, 'utf8');
    const logLines = logContent.split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
    const completeEntry = logLines.find((e) => e.message === 'command_complete');
    expect(completeEntry).toBeDefined();
    expect(completeEntry.command).toBe('noop');
    expect(completeEntry.result).toBe('ok');
  });
});
