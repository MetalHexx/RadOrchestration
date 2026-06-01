import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';

import type { SSEEvent, SSEEventType, SSEPayloadMap } from '@/types/events';
import type { ProjectState } from '@/types/state';
import { getProjectsRoot } from '@/lib/path-resolver';
import { getLiveRuntime } from '@/lib/live/live-hub-runtime';
import { wireProjectStateWatcher } from './state-watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Skip project-internal scaffold dirs so the watcher doesn't recurse into a
// project's own node_modules/.next/.git — on Windows that triggers a stream of
// EPERM errors and a slow memory leak in chokidar as watcher state piles up,
// eventually OOM-crashing the Node process. Matches both POSIX and Windows
// path separators.
const IGNORED_PROJECT_DIR_RE = /[\\/](node_modules|\.git|\.next|\.cache)([\\/]|$)/;

// ─── SSE Helpers ────────────────────────────────────────────────────────────

function createSSEEvent<T extends SSEEventType>(
  type: T,
  payload: SSEPayloadMap[T],
): SSEEvent<T> {
  return {
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const absoluteProjectsDir = getProjectsRoot();
  const usePolling = process.env.CHOKIDAR_USEPOLLING === '1';

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      // ── Per-project debounce ────────────────────────────────────────
      const debounceTimers = new Map<string, NodeJS.Timeout>();

      function clearAllDebounceTimers(): void {
        debounceTimers.forEach((timer) => {
          clearTimeout(timer);
        });
        debounceTimers.clear();
      }

      function debouncedEmit(projectName: string, callback: () => void): void {
        const existing = debounceTimers.get(projectName);
        if (existing) clearTimeout(existing);
        debounceTimers.set(
          projectName,
          setTimeout(() => {
            debounceTimers.delete(projectName);
            callback();
          }, 300),
        );
      }

      // ── Safe enqueue ────────────────────────────────────────────────
      function enqueue(event: SSEEvent): void {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          // Stream already closed — ignore
        }
      }

      // ── 1. Discover existing projects & send connected event ────────
      readdir(absoluteProjectsDir, { withFileTypes: true })
        .then((entries) => {
          const projects = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
          enqueue(createSSEEvent('connected', { projects }));
        })
        .catch((err) => {
          console.error('[SSE] Failed to discover projects:', err);
          enqueue(createSSEEvent('connected', { projects: [] }));
        });

      // ── 2. Set up the state.json watcher ───────────────────────────
      // chokidar v4 removed glob support: a glob string like `**​/state.json`
      // is treated as a literal path and matches nothing. So we watch the
      // projects directory recursively and the helper filters to `state.json`
      // basenames itself (mirrors the v4-correct watcher in lib/live/). The
      // helper owns the add/change/unlink → event mapping; here we translate
      // each normalized event into the exact SSE event it always produced.
      const stateWatcher = wireProjectStateWatcher({
        projectsDir: absoluteProjectsDir,
        makeWatcher: (watchPath) => {
          const w = chokidar.watch(watchPath, {
            usePolling,
            awaitWriteFinish: {
              stabilityThreshold: 200,
              pollInterval: 50,
            },
            // v4-safe `ignored`: a function `(path) => boolean`, not a glob
            // array. Skips proposed/empty sidecar files and heavy scaffold dirs.
            ignored: (p: string) =>
              /state\.json\.(proposed|empty)$/.test(p) ||
              IGNORED_PROJECT_DIR_RE.test(p),
            ignoreInitial: true,
          });
          // error handler — log OS-level watcher errors (CF-B).
          // v4 types the error callback as `(err: unknown)`.
          w.on('error', (error: unknown) => {
            console.error('[SSE] Chokidar watcher error:', error);
          });
          return w;
        },
        emit: (event) => {
          const { projectName, filePath } = event;
          debouncedEmit(projectName, () => {
            switch (event.type) {
              case 'state_change':
                // read, parse, emit v4 state directly
                readFile(filePath, 'utf-8')
                  .then((content) => {
                    const state: ProjectState = JSON.parse(content);
                    enqueue(
                      createSSEEvent('state_change', { projectName, state }),
                    );
                  })
                  .catch((err) => {
                    console.error(
                      `[SSE] Error reading/parsing ${filePath}:`,
                      err,
                    );
                  });
                break;
              case 'project_added':
                enqueue(createSSEEvent('project_added', { projectName }));
                break;
              case 'project_removed':
                enqueue(createSSEEvent('project_removed', { projectName }));
                break;
            }
          });
        },
      });

      // ── 3. Set up shallow directory watcher ───────────────────────
      const dirWatcher = chokidar.watch(absoluteProjectsDir, {
        usePolling,
        depth: 0,
        ignoreInitial: true,
        // Defensive: depth:0 already keeps this watcher at the projects-dir top
        // level so scaffold dirs inside a project aren't reachable today, but
        // pairing the same ignore list with the state.json watcher above keeps
        // the two consistent if `depth` ever changes.
        ignored: [IGNORED_PROJECT_DIR_RE],
      });

      dirWatcher.on('addDir', (dirPath: string) => {
        if (dirPath === absoluteProjectsDir) return;
        const projectName = path.basename(dirPath);
        debouncedEmit(projectName, () => {
          enqueue(createSSEEvent('project_added', { projectName }));
        });
      });

      dirWatcher.on('unlinkDir', (dirPath: string) => {
        if (dirPath === absoluteProjectsDir) return;
        const projectName = path.basename(dirPath);
        debouncedEmit(projectName, () => {
          enqueue(createSSEEvent('project_removed', { projectName }));
        });
      });

      // v4 types the error callback as `(err: unknown)`; match the state watcher.
      dirWatcher.on('error', (error: unknown) => {
        console.error('[SSE] Chokidar dir watcher error:', error);
      });

      // ── 4. Heartbeat interval (30s) ────────────────────────────────
      const heartbeatInterval = setInterval(() => {
        enqueue(createSSEEvent('heartbeat', {} as Record<string, never>));
      }, 30_000);

      // ── 5. Subscribe to the shared artifact hub (O(1) watcher) ─────
      // The hub lazily warms a single process-level watcher shared across
      // all SSE connections. Each connection registers a connection-scoped
      // all-topics subscriber that fans in every project's artifact topic.
      const liveRuntime = getLiveRuntime({ projectsRoot: absoluteProjectsDir });
      const unsubArtifacts = liveRuntime.subscribeAllArtifactTopics((n) =>
        enqueue(createSSEEvent('artifact_change', n.payload)),
      );
      const unsubDegraded = liveRuntime.subscribeDegraded((n) =>
        enqueue(createSSEEvent('live_degraded', n.payload)),
      );

      // ── 6. Cleanup on disconnect ───────────────────────────────────
      function cleanup(): void {
        if (closed) return;
        closed = true;

        clearInterval(heartbeatInterval);
        clearAllDebounceTimers();
        unsubArtifacts();
        unsubDegraded();
        stateWatcher.close().catch((err) => {
          console.error('[SSE] Error closing watcher:', err);
        });
        dirWatcher.close().catch((err) => {
          console.error('[SSE] Error closing dir watcher:', err);
        });

        try {
          controller.close();
        } catch {
          // Already closed — ignore
        }
      }

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
