import { describe, expect, it, vi } from 'vitest';
import { defineCommand, runCommand, pickLogLevel } from '../../src/framework/command.js';
import { UserError } from '../../src/framework/errors.js';

describe('defineCommand', () => {
  it('emits a success envelope with typed data', async () => {
    const cmd = defineCommand({
      name: 'noop',
      description: 'noop',
      args: {},
      flags: {},
      handler: async () => ({ ok: 'ok' as const }),
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(cmd, { argv: [], env: { RADORCH_NO_LOG: '1' }, isTTY: false, stderr: process.stderr });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    expect(JSON.parse(arg)).toEqual({ ok: true, data: { ok: 'ok' } });
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });

  it('maps UserError to envelope + exit code 1', async () => {
    const cmd = defineCommand({
      name: 'fail-user',
      description: 'fails',
      args: {},
      flags: {},
      handler: async () => { throw new UserError('bad'); },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(cmd, { argv: [], env: { RADORCH_NO_LOG: '1' }, isTTY: false, stderr: process.stderr });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    expect(JSON.parse(arg)).toEqual({ ok: false, error: { type: 'user_error', message: 'bad' } });
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); exit.mockRestore();
  });

  it('maps unknown thrown errors to system_error + exit 2', async () => {
    const cmd = defineCommand({
      name: 'fail-sys',
      description: 'sys',
      args: {},
      flags: {},
      handler: async () => { throw new Error('boom'); },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(cmd, { argv: [], env: { RADORCH_NO_LOG: '1' }, isTTY: false, stderr: process.stderr });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('system_error');
    expect(exit).toHaveBeenCalledWith(2);
    log.mockRestore(); exit.mockRestore();
  });

  it('errors with user_error when a required arg is missing in non-interactive mode', async () => {
    const cmd = defineCommand({
      name: 'needs-arg',
      description: 'na',
      args: { who: { description: 'who', required: true } },
      flags: {},
      handler: async ({ args }) => ({ who: args.who }),
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(cmd, { argv: ['--non-interactive'], env: { RADORCH_NO_LOG: '1' }, isTTY: true, stderr: process.stderr });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); exit.mockRestore();
  });

  it('honors --log-level flag over RADORCH_LOG_LEVEL env', async () => {
    // pickLogLevel is the unit boundary; this test confirms the flag wins over env.
    const env = { RADORCH_LOG_LEVEL: 'warn' } as unknown as NodeJS.ProcessEnv;
    expect(pickLogLevel('debug', env)).toBe('debug');
    // And confirm runCommand wires through without throwing when --log-level is supplied.
    // We can't easily assert the live logger threshold from a runCommand integration test
    // without intercepting the file sink, so the unit-level assertion above is the real
    // load-bearing check; this end-to-end smoke confirms no wiring exception.
    const def = defineCommand<object, object, { ok: true }>({
      name: 'lvl',
      description: 'noop',
      args: {},
      flags: {},
      handler: async () => ({ ok: true }),
      mapResult: (r) => ({ ok: true, data: r }),
    });
    // runCommand calls process.exit on success — wrap and swallow it.
    const realExit = process.exit;
    let exited = false;
    // @ts-expect-error — overriding process.exit for the test
    process.exit = (() => { exited = true; throw new Error('exit'); }) as never;
    try {
      await runCommand(def, {
        argv: ['--log-level', 'debug'],
        env: { RADORCH_NO_LOG: '1' } as unknown as NodeJS.ProcessEnv,
        isTTY: false,
        stderr: { write: () => true } as unknown as NodeJS.WriteStream,
      });
    } catch {
      // expected
    }
    process.exit = realExit;
    expect(exited).toBe(true);
  });

  it('pickLogLevel prefers flag over env when flag is a valid LogLevel', () => {
    // Import the helper directly. Step 2 adds it as a named export from command.ts.
    // The test uses runtime-typed strings to confirm validation behavior.
    const env = { RADORCH_LOG_LEVEL: 'warn' } as unknown as NodeJS.ProcessEnv;
    expect(pickLogLevel('debug', env)).toBe('debug');
    expect(pickLogLevel(undefined, env)).toBe('warn');
    expect(pickLogLevel('not-a-level', env)).toBe('warn');
    expect(pickLogLevel('info', { } as unknown as NodeJS.ProcessEnv)).toBe('info');
    expect(pickLogLevel(undefined, { } as unknown as NodeJS.ProcessEnv)).toBe('info');
  });
});
