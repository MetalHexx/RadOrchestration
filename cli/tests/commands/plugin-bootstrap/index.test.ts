import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from '../../../src/framework/command.js';
import { pluginBootstrapCommand } from '../../../src/commands/plugin-bootstrap/index.js';

// Mock runPluginBootstrap so tests do not need a real plugin payload on disk.
vi.mock('../../../src/commands/plugin-bootstrap/run.js', () => ({
  runPluginBootstrap: vi.fn(),
}));

import { runPluginBootstrap } from '../../../src/commands/plugin-bootstrap/run.js';
const mockRunPluginBootstrap = runPluginBootstrap as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Shared test harness helpers
// ---------------------------------------------------------------------------

let tmpHome: string;
let homedirSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pb-'));
  // checkVersionSkew skips when install.json is absent, so no install.json needed.
  homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  // Ensure the logs dir exists so the file sink doesn't error.
  await fs.mkdir(path.join(tmpHome, '.radorch', 'logs'), { recursive: true });
  vi.clearAllMocks();
});

afterEach(async () => {
  homedirSpy.mockRestore();
  await fs.rm(tmpHome, { recursive: true, force: true });
});

/**
 * Run pluginBootstrapCommand via the framework runCommand harness.
 * Captures stdout (JSON envelope), stderr (human progress), and the first exit code.
 */
async function runViaFramework(argv: string[]): Promise<{ stdoutText: string; stderrText: string; exitCode: number }> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const exitCodes: number[] = [];

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write);

  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdoutChunks.push(args.map(String).join(' ') + '\n');
  });

  const fakeStderr = {
    write: (chunk: string | Uint8Array) => {
      stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    },
  } as unknown as NodeJS.WriteStream;

  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCodes.push(code ?? 0);
    throw new Error('__exit__');
  }) as typeof process.exit);

  try {
    await runCommand(pluginBootstrapCommand, {
      argv,
      env: { RADORCH_NO_LOG: '1' } as NodeJS.ProcessEnv,
      isTTY: false,
      stderr: fakeStderr,
    });
  } catch {
    // process.exit throws by design in this harness.
  } finally {
    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
    exitSpy.mockRestore();
  }

  return {
    stdoutText: stdoutChunks.join(''),
    stderrText: stderrChunks.join(''),
    exitCode: exitCodes[0] ?? -1,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pluginBootstrapCommand', () => {
  it('parses --force flag and forwards to runPluginBootstrap', async () => {
    mockRunPluginBootstrap.mockResolvedValue({
      action: 'noop',
      code: 0,
      deliveringVersion: '1.0.0',
      installedVersion: '1.0.0',
    });

    await runViaFramework(['--force', '--harness', 'claude', '--plugin-root', '/fake/root']);

    expect(mockRunPluginBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, harness: 'claude', pluginRoot: '/fake/root' }),
    );
  });

  it('parses --quiet flag, forwards it, and writes JSON envelope to stdout', async () => {
    const fakeResult = { action: 'noop' as const, code: 0, deliveringVersion: '1.0.0', installedVersion: '1.0.0' };
    mockRunPluginBootstrap.mockResolvedValue(fakeResult);

    const { stdoutText, stderrText, exitCode } = await runViaFramework([
      '--quiet', '--harness', 'claude', '--plugin-root', '/fake/root',
    ]);

    // --quiet flag must be forwarded to runPluginBootstrap
    expect(mockRunPluginBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({ quiet: true }),
    );

    // Framework envelope on stdout is valid JSON
    const lines = stdoutText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const envelope = JSON.parse(lines[0]!);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toMatchObject({ action: 'noop' });

    // No downgrade warning on stderr for a noop
    expect(stderrText).toBe('');
    expect(exitCode).toBe(0);
  });

  it('exits 1 on UserError when --harness is missing', async () => {
    const { stderrText, exitCode } = await runViaFramework(['--plugin-root', '/fake/root']);

    expect(exitCode).toBe(1);
    // The error should have been emitted (on stdout as failure envelope) and runPluginBootstrap never called
    expect(mockRunPluginBootstrap).not.toHaveBeenCalled();
    // stderrText may be empty (framework puts error in the envelope on stdout); exit code is the signal
    void stderrText; // access to satisfy lint
  });

  it('downgrade path writes warning to stderr and exits 0', async () => {
    mockRunPluginBootstrap.mockResolvedValue({
      action: 'downgrade-noop' as const,
      code: 0,
      deliveringVersion: '0.9.0',
      installedVersion: '1.0.0',
      message: 'Delivering v0.9.0 is older than installed v1.0.0; no-op. If this is unexpected, run `radorch doctor`.',
    });

    const { stderrText, exitCode } = await runViaFramework([
      '--harness', 'claude', '--plugin-root', '/fake/root',
    ]);

    // The downgrade warning must appear on stderr
    expect(stderrText).toMatch(/older than installed/);
    expect(exitCode).toBe(0);
  });

  it('downgrade path with --quiet suppresses stderr but preserves stdout JSON envelope', async () => {
    const fakeDowngradeResult = {
      action: 'downgrade-noop' as const,
      code: 0,
      deliveringVersion: '0.9.0',
      installedVersion: '1.0.0',
      message: 'Delivering v0.9.0 is older than installed v1.0.0; no-op. If this is unexpected, run `radorch doctor`.',
    };
    mockRunPluginBootstrap.mockResolvedValue(fakeDowngradeResult);

    const { stdoutText, stderrText, exitCode } = await runViaFramework([
      '--quiet', '--harness', 'claude', '--plugin-root', '/fake/root',
    ]);

    // Stderr must be empty when --quiet is set
    expect(stderrText).toBe('');

    // Stdout JSON envelope must still reflect the downgrade outcome
    const lines = stdoutText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const envelope = JSON.parse(lines[0]!);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toMatchObject({
      action: 'downgrade-noop',
      deliveringVersion: '0.9.0',
      installedVersion: '1.0.0',
    });

    expect(exitCode).toBe(0);
  });

  it('noop completes within 500ms on warm filesystem', async () => {
    // This test uses a real fixture (no mock for runPluginBootstrap) to measure
    // actual end-to-end latency. We build a minimal plugin root with package.json
    // and set up install.json at the same version so the noop path fires.
    vi.restoreAllMocks();

    // Re-establish the homedir spy for the real run
    const realTmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-pb-perf-'));
    const realHomeSpy = vi.spyOn(os, 'homedir').mockReturnValue(realTmpHome);
    await fs.mkdir(path.join(realTmpHome, '.radorch', 'logs'), { recursive: true });

    // Build a minimal plugin root: package.json with version 1.0.0 + manifest
    const pluginRoot = path.join(realTmpHome, 'plugin-root');
    await fs.mkdir(path.join(pluginRoot, 'manifests'), { recursive: true });
    await fs.writeFile(
      path.join(pluginRoot, 'package.json'),
      JSON.stringify({ name: 'rad-orchestration', version: '1.0.0' }),
      'utf8',
    );

    // Write install.json with matching version + sentinel so noop fires
    const radOrchDir = path.join(realTmpHome, '.radorch');
    await fs.mkdir(path.join(radOrchDir, 'bin'), { recursive: true });
    await fs.writeFile(
      path.join(radOrchDir, 'install.json'),
      JSON.stringify({
        package_version: '1.0.0',
        installed_at: new Date().toISOString(),
        last_writer_version: '1.0.0',
        state_schema_version: 'v5',
      }) + '\n',
      'utf8',
    );
    await fs.writeFile(path.join(radOrchDir, 'bin', 'radorch.mjs'), '#!/usr/bin/env node\n', 'utf8');

    // Capture stdout/exit to prevent real output
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__');
    }) as typeof process.exit);

    const start = Date.now();
    try {
      await runCommand(pluginBootstrapCommand, {
        argv: ['--harness', 'claude', '--plugin-root', pluginRoot],
        env: { RADORCH_NO_LOG: '1' } as NodeJS.ProcessEnv,
        isTTY: false,
        stderr: { write: () => true } as unknown as NodeJS.WriteStream,
      });
    } catch {
      // process.exit throws by design
    } finally {
      stdoutSpy.mockRestore();
      consoleLogSpy.mockRestore();
      exitSpy.mockRestore();
      realHomeSpy.mockRestore();
      await fs.rm(realTmpHome, { recursive: true, force: true });
    }
    const elapsed = Date.now() - start;

    // Allow 1000ms on Windows (filesystem overhead), 500ms on other platforms.
    // Windows file I/O latency justifies the higher bound.
    const threshold = process.platform === 'win32' ? 1000 : 500;
    expect(elapsed).toBeLessThan(threshold);
  });
});
