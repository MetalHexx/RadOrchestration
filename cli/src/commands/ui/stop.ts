import { resolveInstallRoot, installPaths } from '../../lib/paths.js';
import { readPidFile, removePidFile, isPidAlive } from './pid-file.js';
import { probePortFree as defaultProbe } from './spawn.js';

export interface StopResult {
  stopped: true;
  pid?: number;
  port_released?: boolean;
}

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 5000;

export async function runStop(opts: {
  env: NodeJS.ProcessEnv;
  _probePortFree?: (port: number) => Promise<boolean>;
  _now?: () => number;
  _sleep?: (ms: number) => Promise<void>;
}): Promise<StopResult> {
  const p = installPaths(resolveInstallRoot(opts.env));
  const entry = await readPidFile(p.uiPidFile);
  if (!entry) return { stopped: true };
  if (isPidAlive(entry.pid)) {
    try {
      process.kill(entry.pid, 'SIGTERM');
    } catch {
      /* race; best effort */
    }
  }
  await removePidFile(p.uiPidFile);

  // SIGTERM is asynchronous and the detached child can take a few seconds to
  // release the TCP listener. Poll until the port is free or we hit the
  // timeout. On timeout we still report stopped:true (the process is dead) but
  // surface port_released:false so a caller that immediately re-starts knows
  // it may race on port acquisition.
  const probe = opts._probePortFree ?? defaultProbe;
  const now = opts._now ?? Date.now;
  const sleep = opts._sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const startedAt = now();
  let port_released = false;
  while (now() - startedAt < POLL_TIMEOUT_MS) {
    if (await probe(entry.port)) {
      port_released = true;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { stopped: true, pid: entry.pid, port_released };
}
