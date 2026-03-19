import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';

import type { SSEEvent, SSEEventType, SSEPayloadMap } from '@/types/events';
import type { ProjectState } from '@/types/state';
import { getWorkspaceRoot, resolveBasePath } from '@/lib/path-resolver';
import { readConfig } from '@/lib/fs-reader';

export const dynamic = 'force-dynamic';

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

// ─── Path Helpers ───────────────────────────────────────────────────────────

function extractProjectName(filePath: string, projectsDir: string): string {
  const relative = path.relative(projectsDir, filePath);
  return relative.split(path.sep)[0];
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const workspaceRoot = getWorkspaceRoot();
  const config = await readConfig(workspaceRoot);
  const absoluteProjectsDir = resolveBasePath(workspaceRoot, config.projects.base_path);

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

      // ── 2. Set up chokidar watcher ─────────────────────────────────
      const globPattern = path.join(absoluteProjectsDir, '**', 'state.json');

      const watcher = chokidar.watch(globPattern, {
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50,
        },
        ignored: [/state\.json\.(proposed|empty)$/],
        ignoreInitial: true,
      });

      // change handler — read, parse, emit v4 state directly
      watcher.on('change', (filePath: string) => {
        const projectName = extractProjectName(filePath, absoluteProjectsDir);
        debouncedEmit(projectName, () => {
          readFile(filePath, 'utf-8')
            .then((content) => {
              const state: ProjectState = JSON.parse(content);
              enqueue(createSSEEvent('state_change', { projectName, state }));
            })
            .catch((err) => {
              console.error(`[SSE] Error reading/parsing ${filePath}:`, err);
            });
        });
      });

      // add handler — new state.json appeared
      watcher.on('add', (filePath: string) => {
        const projectName = extractProjectName(filePath, absoluteProjectsDir);
        debouncedEmit(projectName, () => {
          enqueue(createSSEEvent('project_added', { projectName }));
        });
      });

      // unlink handler — state.json deleted
      watcher.on('unlink', (filePath: string) => {
        const projectName = extractProjectName(filePath, absoluteProjectsDir);
        debouncedEmit(projectName, () => {
          enqueue(createSSEEvent('project_removed', { projectName }));
        });
      });

      // error handler — log OS-level watcher errors (CF-B)
      watcher.on('error', (error: Error) => {
        console.error('[SSE] Chokidar watcher error:', error);
      });

      // ── 3. Set up shallow directory watcher ───────────────────────
      const dirWatcher = chokidar.watch(absoluteProjectsDir, {
        depth: 0,
        ignoreInitial: true,
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

      dirWatcher.on('error', (error: Error) => {
        console.error('[SSE] Chokidar dir watcher error:', error);
      });

      // ── 4. Heartbeat interval (30s) ────────────────────────────────
      const heartbeatInterval = setInterval(() => {
        enqueue(createSSEEvent('heartbeat', {} as Record<string, never>));
      }, 30_000);

      // ── 5. Cleanup on disconnect ───────────────────────────────────
      function cleanup(): void {
        if (closed) return;
        closed = true;

        clearInterval(heartbeatInterval);
        clearAllDebounceTimers();
        watcher.close().catch((err) => {
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
