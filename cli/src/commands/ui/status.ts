import { resolveInstallRoot, installPaths } from '../../lib/paths.js';
import { readPidFile, removePidFile, isPidAlive } from './pid-file.js';

export interface StatusResult {
  running: boolean;
  pid?: number;
  port?: number;
  url?: string;
}

export async function runStatus(): Promise<StatusResult> {
  const p = installPaths(resolveInstallRoot());
  const entry = await readPidFile(p.uiPidFile);
  if (!entry) return { running: false };
  if (!isPidAlive(entry.pid)) {
    await removePidFile(p.uiPidFile);
    return { running: false };
  }
  return { running: true, pid: entry.pid, port: entry.port, url: `http://localhost:${entry.port}` };
}
