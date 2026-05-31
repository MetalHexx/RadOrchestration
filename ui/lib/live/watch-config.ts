import type { ChokidarOptions } from 'chokidar';

/** New chosen settle window — distinct from the route's 0.2s stabilityThreshold
 *  and its separate 300ms per-project debounce. */
export const SETTLE_WINDOW_MS = 500;

const HEAVY_DIR_RE = /[\\/](node_modules|\.git|\.next|\.cache|backups)([\\/]|$)/;

export function isIgnoredPath(p: string): boolean {
  return HEAVY_DIR_RE.test(p);
}

export function buildWatchOptions(usePolling: boolean): ChokidarOptions & {
  awaitWriteFinish: { stabilityThreshold: number; pollInterval: number };
} {
  return {
    usePolling,
    ignoreInitial: true,
    // chokidar v4 watches the directory natively (no glob patterns).
    ignored: (p: string) => isIgnoredPath(p),
    awaitWriteFinish: { stabilityThreshold: SETTLE_WINDOW_MS, pollInterval: 50 },
  };
}
