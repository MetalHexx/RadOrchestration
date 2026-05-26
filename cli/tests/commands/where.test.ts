import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { runWhere, WHERE_NAMES, whereHelpText } from '../../src/commands/where.js';

interface CapturedStreams {
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  readStdout: () => string;
  readStderr: () => string;
}

function makeStreams(): CapturedStreams {
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  return {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    readStdout: () => Buffer.concat(stdoutChunks).toString('utf8'),
    readStderr: () => Buffer.concat(stderrChunks).toString('utf8'),
  };
}

let tmp: string;
let homedirSpy: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-where-'));
  homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmp);
});
afterEach(async () => {
  homedirSpy.mockRestore();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('runWhere', () => {
  it('projects resolves to <home>/.radorc/projects on stdout, exit 0', async () => {
    const s = makeStreams();
    const code = await runWhere({ name: 'projects', stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(0);
    expect(s.readStdout().trim()).toBe(path.join(tmp, '.radorc', 'projects'));
    expect(s.readStderr()).toBe('');
  });

  it('root resolves to <home>/.radorc', async () => {
    const s = makeStreams();
    const code = await runWhere({ name: 'root', stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(0);
    expect(s.readStdout().trim()).toBe(path.join(tmp, '.radorc'));
  });

  it('install-json resolves to <home>/.radorc/install.json', async () => {
    const s = makeStreams();
    const code = await runWhere({ name: 'install-json', stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(0);
    expect(s.readStdout().trim()).toBe(path.join(tmp, '.radorc', 'install.json'));
  });

  it('logs resolves to <home>/.radorc/logs', async () => {
    const s = makeStreams();
    const code = await runWhere({ name: 'logs', stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(0);
    expect(s.readStdout().trim()).toBe(path.join(tmp, '.radorc', 'logs'));
  });

  it('plugin-root errors with exit 1 on stderr when CLAUDE_PLUGIN_ROOT is unset', async () => {
    const s = makeStreams();
    const code = await runWhere({ name: 'plugin-root', stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(1);
    expect(s.readStdout()).toBe('');
    expect(s.readStderr()).toMatch(/CLAUDE_PLUGIN_ROOT is not set/);
  });

  it('plugin-root resolves to CLAUDE_PLUGIN_ROOT env value when set', async () => {
    const s = makeStreams();
    const pluginRoot = '/tmp/some/plugin/root';
    const code = await runWhere({
      name: 'plugin-root',
      stdout: s.stdout,
      stderr: s.stderr,
      env: { CLAUDE_PLUGIN_ROOT: pluginRoot },
    });
    expect(code).toBe(0);
    expect(s.readStdout().trim()).toBe(pluginRoot);
  });

  it('unknown name writes error + name list to stderr, exit 1', async () => {
    const s = makeStreams();
    const code = await runWhere({ name: 'does-not-exist', stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(1);
    expect(s.readStdout()).toBe('');
    expect(s.readStderr()).toMatch(/unknown: does-not-exist/);
    for (const n of Object.keys(WHERE_NAMES)) {
      expect(s.readStderr()).toContain(n);
    }
  });

  it('no name prints two-column name+path table on stdout, exit 0', async () => {
    const s = makeStreams();
    const code = await runWhere({ stdout: s.stdout, stderr: s.stderr, env: {} });
    expect(code).toBe(0);
    expect(s.readStderr()).toBe('');
    const out = s.readStdout();
    for (const n of Object.keys(WHERE_NAMES)) {
      expect(out).toContain(n);
    }
    expect(out).toContain(path.join(tmp, '.radorc', 'projects'));
    expect(out).toContain('<unset: CLAUDE_PLUGIN_ROOT is not set>');
  });

  it('no name with CLAUDE_PLUGIN_ROOT set shows the value in the table', async () => {
    const s = makeStreams();
    const code = await runWhere({
      stdout: s.stdout,
      stderr: s.stderr,
      env: { CLAUDE_PLUGIN_ROOT: '/foo/bar' },
    });
    expect(code).toBe(0);
    expect(s.readStdout()).toContain('/foo/bar');
    expect(s.readStdout()).not.toContain('<unset:');
  });
});

describe('whereHelpText', () => {
  it('contains every supported name and its description', () => {
    const help = whereHelpText();
    expect(help.startsWith('Names:')).toBe(true);
    for (const [name, spec] of Object.entries(WHERE_NAMES)) {
      expect(help).toContain(name);
      expect(help).toContain(spec.description);
    }
  });
});
