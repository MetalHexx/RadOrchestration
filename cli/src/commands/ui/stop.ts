import { resolveInstallRoot, installPaths } from '../../lib/paths.js';
import { readPidFile, removePidFile, isPidAlive } from './pid-file.js';

export interface StopResult {
  stopped: true;
  pid?: number;
}

export async function runStop(opts: { env: NodeJS.ProcessEnv }): Promise<StopResult> {
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
  return { stopped: true, pid: entry.pid };
}
