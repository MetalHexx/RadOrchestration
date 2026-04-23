// ui/lib/sse/singleton.ts
import { SSEBroadcaster } from './broadcaster';
import { getWorkspaceRoot, resolveBasePath } from '@/lib/path-resolver';

const KEY = '__sseBroadcaster';
type GlobalWithBroadcaster = typeof globalThis & { [KEY]?: SSEBroadcaster };

export function getBroadcaster(): SSEBroadcaster {
  const g = globalThis as GlobalWithBroadcaster;
  if (g[KEY]) return g[KEY];

  const projectsDir =
    process.env.__SSE_TEST_PROJECTS_DIR ??
    resolveBasePath(getWorkspaceRoot(), readConfigSync().projects.base_path);

  const b = new SSEBroadcaster({
    projectsDir,
    debounceMs: 300,
    heartbeatMs: 30_000,
  });
  g[KEY] = b;
  return b;
}

function readConfigSync(): { projects: { base_path: string } } {
  // Synchronous init path for the singleton. readConfig is async; we
  // resolve the value once at first-import time via top-level await in
  // the caller (route handler), so this helper is only used when the
  // env override is absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readConfigSync } = require('@/lib/fs-reader-sync') as {
    readConfigSync: (root: string) => { projects: { base_path: string } };
  };
  return readConfigSync(getWorkspaceRoot());
}
