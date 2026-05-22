import { describe, it, expect, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import {
  validateLaunchFlags,
  worktreeLaunch,
  worktreeLaunchCommand,
  repairMsysPrompt,
  VALID_PERMISSION_MODES,
} from '../../../src/commands/worktree/launch.js';
import { runCommand } from '../../../src/framework/command.js';

const addDir = path.join(os.homedir(), '.radorch', 'projects');

describe('validateLaunchFlags', () => {
  it('rejects --prompt with --agent vscode', () => {
    const r = validateLaunchFlags({ agent: 'vscode', prompt: '/x', permissionMode: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/--prompt.*vscode/);
  });
  it('rejects missing --prompt with --agent claude', () => {
    const r = validateLaunchFlags({ agent: 'claude', prompt: undefined, permissionMode: undefined });
    expect(r.ok).toBe(false);
  });
  it('rejects --permission-mode with --agent copilot', () => {
    const r = validateLaunchFlags({ agent: 'copilot', prompt: '/x', permissionMode: 'auto' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/--permission-mode.*claude/);
  });
  it('accepts default permission-mode auto for claude', () => {
    const r = validateLaunchFlags({ agent: 'claude', prompt: '/x', permissionMode: undefined });
    expect(r.ok).toBe(true);
  });
  it('rejects an invalid permission-mode', () => {
    const r = validateLaunchFlags({ agent: 'claude', prompt: '/x', permissionMode: 'wat' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/valid values/);
  });
  for (const mode of VALID_PERMISSION_MODES) {
    it(`accepts permission-mode ${mode} for claude`, () => {
      expect(validateLaunchFlags({ agent: 'claude', prompt: '/x', permissionMode: mode }).ok).toBe(true);
    });
  }
});

describe('repairMsysPrompt', () => {
  it('restores the leading slash when MSYS mangled the path', () => {
    const m = 'C:/Program Files/Git/rad-execute X';
    expect(repairMsysPrompt(m)).toBe('/rad-execute X');
  });
  it('leaves non-mangled prompts alone', () => {
    expect(repairMsysPrompt('/rad-execute X')).toBe('/rad-execute X');
    expect(repairMsysPrompt('not a slash command')).toBe('not a slash command');
  });
});

describe('worktreeLaunch dispatch matrix', () => {
  function runCase(agent: 'claude' | 'copilot' | 'vscode' | 'terminal', platform: NodeJS.Platform) {
    const spawn = vi.fn(() => ({ unref: () => undefined }) as never);
    const result = worktreeLaunch({
      agent, worktreePath: '/wt/x',
      prompt: agent === 'claude' || agent === 'copilot' ? '/rad-execute X' : undefined,
      permissionMode: agent === 'claude' ? 'auto' : undefined,
      platform, spawn,
    });
    expect(result.ok).toBe(true);
    return { spawn, result };
  }

  function deliveredPayload(spawnFn: ReturnType<typeof vi.fn>, platform: NodeJS.Platform): string {
    const call = spawnFn.mock.calls[0]!;
    const args = call[1] as string[];
    if (platform === 'win32') {
      const idx = args.indexOf('-EncodedCommand');
      if (idx === -1) return '';
      const encoded = args[idx + 1] ?? '';
      return Buffer.from(encoded, 'base64').toString('utf16le');
    }
    if (platform === 'darwin') {
      const idx = args.indexOf('-e');
      return args[idx + 1] ?? '';
    }
    // linux: gnome-terminal -- bash -c "<shell>"
    const dashDash = args.indexOf('--');
    const cIdx = args.indexOf('-c', dashDash);
    return args[cIdx + 1] ?? '';
  }

  it.each(['win32', 'darwin', 'linux'] as const)('launches claude on %s with internally-resolved --add-dir', (platform) => {
    const { spawn } = runCase('claude', platform);
    const payload = deliveredPayload(spawn, platform);
    expect(payload).toContain('claude');
    expect(payload).toContain(addDir);
    expect(payload).toContain('--permission-mode');
    expect(payload).toContain('auto');
  });

  it.each(['win32', 'darwin', 'linux'] as const)('launches copilot on %s with internally-resolved --add-dir', (platform) => {
    const { spawn } = runCase('copilot', platform);
    const payload = deliveredPayload(spawn, platform);
    expect(payload).toContain('copilot');
    expect(payload).toContain(addDir);
  });

  it.each(['win32', 'darwin', 'linux'] as const)('launches vscode on %s without --prompt or --add-dir', (platform) => {
    const { spawn } = runCase('vscode', platform);
    const payload = deliveredPayload(spawn, platform);
    expect(payload).toContain('code');
    expect(payload).not.toContain('--prompt');
    expect(payload).not.toContain(addDir);
  });

  it.each(['win32', 'darwin', 'linux'] as const)('launches terminal on %s with cd to worktree', (platform) => {
    const { spawn } = runCase('terminal', platform);
    const payload = deliveredPayload(spawn, platform);
    expect(payload.toLowerCase()).toContain('wt/x'.toLowerCase());
  });

  it('on win32 claude uses wt + EncodedCommand', () => {
    const { spawn } = runCase('claude', 'win32');
    const target = spawn.mock.calls[0]![0];
    const args = spawn.mock.calls[0]![1] as string[];
    expect(target).toBe('wt');
    expect(args).toContain('-EncodedCommand');
  });

  it('on darwin uses osascript', () => {
    const { spawn } = runCase('claude', 'darwin');
    expect(spawn.mock.calls[0]![0]).toBe('osascript');
  });

  it('on linux uses gnome-terminal', () => {
    const { spawn } = runCase('claude', 'linux');
    expect(spawn.mock.calls[0]![0]).toBe('gnome-terminal');
  });
});

describe('worktreeLaunch CLI path (runCommand argv → handler args)', () => {
  // Locks the framework contract: --worktree-path (required) and
  // --permission-mode (optional) must arrive at the handler under their
  // declared hyphenated keys. Before the framework fix --worktree-path
  // reproduced as "Missing required argument --worktree-path" regardless of
  // what the user supplied.
  it('passes --worktree-path, --agent, --prompt, --permission-mode through runCommand', async () => {
    type LaunchArgs = { agent?: string; 'worktree-path'?: string; prompt?: string; 'permission-mode'?: string };
    let received: LaunchArgs = {};
    const probeDef = {
      ...worktreeLaunchCommand,
      handler: async ({ args }: { args: LaunchArgs; ctx: unknown }) => {
        received = args;
        return { probed: true } as never;
      },
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: [
        '--agent', 'claude',
        '--worktree-path', '/wt/x',
        '--prompt', '/rad-execute X',
        '--permission-mode', 'auto',
      ],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: false,
      stderr: process.stderr,
    });
    expect(received.agent).toBe('claude');
    expect(received['worktree-path']).toBe('/wt/x');
    expect(received.prompt).toBe('/rad-execute X');
    expect(received['permission-mode']).toBe('auto');
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });

  it('returns a well-formed user_error envelope when --worktree-path is omitted in non-interactive mode', async () => {
    // Probe handler keeps the test from invoking real spawn.
    const probeDef = {
      ...worktreeLaunchCommand,
      handler: async () => ({ probed: true } as never),
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: ['--non-interactive', '--agent', 'terminal'],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: true,
      stderr: process.stderr,
    });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(env.error.message).toMatch(/worktree-path/);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); exit.mockRestore();
  });
});
