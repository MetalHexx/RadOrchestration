import { describe, expect, it, vi } from 'vitest';
import { defineCommand, runCommand } from '../../src/framework/command.js';
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
});
