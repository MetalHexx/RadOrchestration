import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runStart } from '../../src/commands/ui/start.js';
import { runStop } from '../../src/commands/ui/stop.js';
import { runStatus } from '../../src/commands/ui/status.js';
import { writePidFile, readPidFile } from '../../src/commands/ui/pid-file.js';

let home: string;
let homedirSpy: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-ui-'));
  homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(home);
});
afterEach(async () => {
  homedirSpy.mockRestore();
  await fs.rm(home, { recursive: true, force: true });
});

// resolveInstallRoot() = path.join(home, '.radorc')
// installPaths(root).uiPidFile = path.join(home, '.radorc', 'runtime', 'ui.pid')
function pidFilePath(): string { return path.join(home, '.radorc', 'runtime', 'ui.pid'); }
function runtimeDir(): string { return path.join(home, '.radorc', 'runtime'); }

describe('pid-file', () => {
  it('writes and reads {pid, port, started_at}', async () => {
    const f = path.join(home, 'ui.pid');
    await writePidFile(f, { pid: 12345, port: 3001, started_at: '2026-05-08T00:00:00.000Z' });
    const r = await readPidFile(f);
    expect(r).toEqual({ pid: 12345, port: 3001, started_at: '2026-05-08T00:00:00.000Z' });
  });
  it('returns null when missing', async () => {
    const r = await readPidFile(path.join(home, 'absent.pid'));
    expect(r).toBeNull();
  });
});

describe('ui status', () => {
  it('reports stopped when no PID file', async () => {
    const r = await runStatus({ env: process.env });
    expect(r.running).toBe(false);
  });
  it('cleans stale pid file when process is dead', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    await writePidFile(f, { pid: 999999, port: 3000, started_at: new Date().toISOString() });
    const r = await runStatus({ env: process.env });
    expect(r.running).toBe(false);
    const after = await readPidFile(f);
    expect(after).toBeNull();
  });
  it('reports running when PID is alive (using current process)', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    await writePidFile(f, { pid: process.pid, port: 3007, started_at: new Date().toISOString() });
    const r = await runStatus({ env: process.env });
    expect(r.running).toBe(true);
    expect(r.url).toBe('http://localhost:3007');
  });
});

describe('ui stop', () => {
  it('reports stopped + removes pid file when pid is dead', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    await writePidFile(f, { pid: 999998, port: 3000, started_at: new Date().toISOString() });
    const probe = vi.fn().mockResolvedValue(true);
    const r = await runStop({ env: process.env, _probePortFree: probe });
    expect(r.stopped).toBe(true);
    expect(r.port_released).toBe(true);
    const after = await readPidFile(f);
    expect(after).toBeNull();
  });
  it('reports stopped when no pid file existed', async () => {
    const r = await runStop({ env: process.env });
    expect(r.stopped).toBe(true);
  });
  it('returns port_released:true after polling succeeds on a later attempt', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    await writePidFile(f, { pid: 999997, port: 3007, started_at: new Date().toISOString() });
    // First two probes report port still bound; third reports free.
    const probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    let mockTime = 0;
    const r = await runStop({
      env: process.env,
      _probePortFree: probe,
      _now: () => mockTime,
      _sleep: async (ms) => { mockTime += ms; },
    });
    expect(r.stopped).toBe(true);
    expect(r.port_released).toBe(true);
    expect(probe).toHaveBeenCalledTimes(3);
    expect(probe).toHaveBeenCalledWith(3007);
  });
  it('returns port_released:false when probe never succeeds within timeout', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    await writePidFile(f, { pid: 999996, port: 3000, started_at: new Date().toISOString() });
    const probe = vi.fn().mockResolvedValue(false);
    let mockTime = 0;
    const r = await runStop({
      env: process.env,
      _probePortFree: probe,
      _now: () => mockTime,
      _sleep: async (ms) => { mockTime += ms; },
    });
    expect(r.stopped).toBe(true);
    expect(r.port_released).toBe(false);
    // 5000ms timeout / 200ms interval = ~25 iterations. The exact count depends
    // on whether the loop probes once more after the final sleep — accept >=20.
    expect(probe.mock.calls.length).toBeGreaterThanOrEqual(20);
  });
});

describe('ui start (with mocked spawn)', () => {
  it('emits user_error when every port 3000-3010 is taken', async () => {
    const probe = vi.fn().mockResolvedValue(false); // no port free
    await expect(runStart({ env: process.env, _probePortFree: probe })).rejects.toThrow(/3000.*3010/);
    expect(probe).toHaveBeenCalledTimes(11);
  });
  it('writes pid file with {pid, port, started_at} on successful spawn', async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const fakeSpawn = vi.fn().mockReturnValue({ pid: 4242, unref: () => {} });
    const r = await runStart({
      env: { ...process.env, RADORCH_UI_DIR: path.join(home, 'fake-ui') },
      _probePortFree: probe,
      _spawn: fakeSpawn as never,
    });
    expect(r.url).toBe('http://localhost:3000');
    expect(r.pid).toBe(4242);
    const pidFile = await readPidFile(pidFilePath());
    expect(pidFile?.pid).toBe(4242);
    expect(pidFile?.port).toBe(3000);
    // verify env-bridge: in plugin mode ~/.radorc IS the canonical workspace
    // and orch root in one, so WORKSPACE_ROOT=root, ORCH_ROOT=".". The UI's
    // path-resolver then reads orchestration.yml at <root>/skills/...
    const spawnCall = fakeSpawn.mock.calls[0];
    const spawnEnv = spawnCall[2].env;
    expect(spawnEnv.WORKSPACE_ROOT).toBe(path.join(home, '.radorc'));
    expect(spawnEnv.ORCH_ROOT).toBe('.');
    expect(spawnCall[2].detached).toBe(true);
    expect(spawnCall[2].windowsHide).toBe(true);
  });
  it('is idempotent: returns existing handle without re-spawning when a live PID is recorded', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    // current process pid is alive — simulates a live UI server entry
    await writePidFile(f, { pid: process.pid, port: 3007, started_at: '2026-05-08T00:00:00.000Z' });
    const probe = vi.fn().mockResolvedValue(true);
    const fakeSpawn = vi.fn();
    const r = await runStart({
      env: { ...process.env, RADORCH_UI_DIR: path.join(home, 'fake-ui') },
      _probePortFree: probe,
      _spawn: fakeSpawn as never,
    });
    expect(fakeSpawn).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    expect(r.pid).toBe(process.pid);
    expect(r.port).toBe(3007);
    expect(r.url).toBe('http://localhost:3007');
    expect(r.started_at).toBe('2026-05-08T00:00:00.000Z');
  });
  it('clears a stale PID file (dead process) and proceeds to a fresh spawn', async () => {
    const f = pidFilePath();
    await fs.mkdir(runtimeDir(), { recursive: true });
    await writePidFile(f, { pid: 999996, port: 3007, started_at: new Date().toISOString() });
    const probe = vi.fn().mockResolvedValue(true);
    const fakeSpawn = vi.fn().mockReturnValue({ pid: 5151, unref: () => {} });
    const r = await runStart({
      env: { ...process.env, RADORCH_UI_DIR: path.join(home, 'fake-ui') },
      _probePortFree: probe,
      _spawn: fakeSpawn as never,
    });
    expect(fakeSpawn).toHaveBeenCalledTimes(1);
    expect(r.pid).toBe(5151);
    expect(r.port).toBe(3000);
  });
});
