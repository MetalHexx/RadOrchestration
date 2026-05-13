import path from 'node:path';
import { resolveInstallRoot, installPaths } from '../../lib/paths.js';
import { ensureDir } from '../../lib/fs-helpers.js';
import { readPidFile, removePidFile, writePidFile, isPidAlive } from './pid-file.js';
import { probePortFree as defaultProbe, openLogFd, spawn as defaultSpawn } from './spawn.js';
import { UserError, SystemError } from '../../framework/errors.js';

const PORT_LO = 3000;
const PORT_HI = 3010;

export interface StartResult {
  pid: number;
  port: number;
  url: string;
  started_at: string;
}

export async function runStart(opts: {
  env: NodeJS.ProcessEnv;
  _probePortFree?: (p: number) => Promise<boolean>;
  _spawn?: typeof defaultSpawn;
}): Promise<StartResult> {
  const root = resolveInstallRoot();
  const p = installPaths(root);
  await ensureDir(p.runtimeDir);
  await ensureDir(p.logsDir);
  // Idempotency: if a recorded UI server is already alive, return its handle
  // instead of spawning a duplicate. A stale entry (process already dead) is
  // cleaned up so we proceed with a fresh spawn.
  const existing = await readPidFile(p.uiPidFile);
  if (existing) {
    if (isPidAlive(existing.pid)) {
      return {
        pid: existing.pid,
        port: existing.port,
        url: `http://localhost:${existing.port}`,
        started_at: existing.started_at,
      };
    }
    await removePidFile(p.uiPidFile);
  }
  const probe = opts._probePortFree ?? defaultProbe;
  let chosenPort: number | null = null;
  const tried: number[] = [];
  for (let port = PORT_LO; port <= PORT_HI; port++) {
    tried.push(port);
    if (await probe(port)) {
      chosenPort = port;
      break;
    }
  }
  if (chosenPort === null) {
    throw new UserError(
      `every port ${PORT_LO}-${PORT_HI} is taken (tried ${tried.join(', ')}); free one and retry`,
    );
  }
  // UI dir resolution: the bootstrap (SessionStart hook) copies ui/ from the
  // plugin cache into ~/.radorch/ui/ via the manifest routing in route.ts.
  // Always launch from ~/.radorch/ui so the UI process is independent of the
  // plugin cache location. RADORCH_UI_DIR is the explicit override for tests.
  const uiDir = opts.env['RADORCH_UI_DIR']
    ?? path.join(resolveInstallRoot(), 'ui');
  const serverJs = path.join(uiDir, 'server.js');
  const spawnFn = opts._spawn ?? defaultSpawn;
  // In plugin mode, ~/.radorch is the canonical workspace and orch root in
  // one. WORKSPACE_ROOT must be the dir that contains
  // skills/rad-orchestration/config/orchestration.yml (provisioned by the
  // SessionStart hook); ORCH_ROOT="." means workspace IS the orch root.
  // The UI's ui/lib/path-resolver.ts then reads orchestration.yml's
  // base_path field (default "projects") to resolve the projects dir.
  //
  // RADORCH_CLI_PATH hands the spawned UI server the path to this CLI
  // bundle so the gate route can shell back out without hardcoding the
  // install location (which now varies by channel — plugin staging dir for
  // the Claude plugin vs ~/.claude/skills/... for the legacy installer).
  const env = {
    ...opts.env,
    WORKSPACE_ROOT: root,
    ORCH_ROOT: '.',
    PORT: String(chosenPort),
    HOSTNAME: '127.0.0.1',
    RADORCH_CLI_PATH: process.argv[1] ?? '',
  };
  const logFd = opts._spawn ? -1 : openLogFd(p.uiLog);
  const child = spawnFn('node', [serverJs], {
    detached: true,
    windowsHide: true,
    stdio: opts._spawn ? 'ignore' : (['ignore', logFd, logFd] as never),
    env,
    cwd: uiDir,
  });
  if (!child.pid) throw new SystemError('failed to spawn UI server');
  child.unref();
  const started_at = new Date().toISOString();
  await writePidFile(p.uiPidFile, { pid: child.pid, port: chosenPort, started_at });
  return { pid: child.pid, port: chosenPort, url: `http://localhost:${chosenPort}`, started_at };
}
