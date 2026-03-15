---
project: "UI-LIVE-PROJECTS"
phase: 1
phase_id: "P01"
task_id: "P01-T01"
task: 1
title: "SSE Route — Shallow Directory Watcher"
status: "pending"
skills_required: ["typescript", "nodejs", "chokidar"]
skills_optional: []
estimated_files: 1
---

# SSE Route — Shallow Directory Watcher

## Objective

Add a second shallow chokidar directory watcher (`dirWatcher`) to the SSE route so that creating or deleting a project directory triggers a real-time `project_added` or `project_removed` SSE event to all connected clients. The watcher must reuse the existing per-project debounce mechanism so that simultaneous `addDir` + `add` (state.json) events within 300 ms coalesce into a single emission.

## Critical: Read the File Before Making Changes

**Before writing any code, read the full contents of `ui/app/api/events/route.ts`.** The file has been reverted since the last edit attempt and the content below reflects its current reverted state. You must understand the existing watcher setup, `debouncedEmit`, `cleanup()`, and `absoluteProjectsDir` before making any modifications.

## Context

The SSE route lives at `ui/app/api/events/route.ts` and uses a single chokidar `watcher` that watches a glob (`**/state.json`) for file-level changes. It already has `debouncedEmit(projectName, callback)` — a per-project 300 ms debounce keyed on `projectName`. The route also computes `absoluteProjectsDir` (the absolute path to the projects directory) and has a `cleanup()` function that closes `watcher` and clears timers on SSE disconnect. A second watcher (`dirWatcher`) watching `absoluteProjectsDir` at `depth: 0` will detect new and removed project subdirectories directly, complementing the existing file watcher.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/app/api/events/route.ts` | Add `dirWatcher` — no other file may be changed |

## Existing File: Key Sections (Current Reverted State)

The following is the complete current content of `ui/app/api/events/route.ts`. Read the actual file to confirm before editing.

```typescript
import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';

import type { SSEEvent, SSEEventType, SSEPayloadMap } from '@/types/events';
import type { RawStateJson } from '@/types/state';
import { getWorkspaceRoot, resolveBasePath } from '@/lib/path-resolver';
import { readConfig } from '@/lib/fs-reader';
import { normalizeState } from '@/lib/normalizer';

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
        debounceTimers.forEach((timer) => { clearTimeout(timer); });
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

      // change handler — read, parse, normalize, emit
      watcher.on('change', (filePath: string) => {
        const projectName = extractProjectName(filePath, absoluteProjectsDir);
        debouncedEmit(projectName, () => {
          readFile(filePath, 'utf-8')
            .then((content) => {
              const raw: RawStateJson = JSON.parse(content);
              const state = normalizeState(raw);
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

      // error handler — log OS-level watcher errors
      watcher.on('error', (error: Error) => {
        console.error('[SSE] Chokidar watcher error:', error);
      });

      // ── 3. Heartbeat interval (30s) ────────────────────────────────
      const heartbeatInterval = setInterval(() => {
        enqueue(createSSEEvent('heartbeat', {} as Record<string, never>));
      }, 30_000);

      // ── 4. Cleanup on disconnect ───────────────────────────────────
      function cleanup(): void {
        if (closed) return;
        closed = true;

        clearInterval(heartbeatInterval);
        clearAllDebounceTimers();
        watcher.close().catch((err) => {
          console.error('[SSE] Error closing watcher:', err);
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
```

## Implementation Steps

1. **Read the actual file** at `ui/app/api/events/route.ts` and confirm its content matches the listing above before making any edits.

2. **Declare `dirWatcher`** immediately after the existing `watcher.on('error', ...)` handler (before the heartbeat comment block). Use exactly:
   ```typescript
   const dirWatcher = chokidar.watch(absoluteProjectsDir, {
     depth: 0,
     ignoreInitial: true,
   });
   ```

3. **Add the `addDir` handler** on `dirWatcher`:
   ```typescript
   dirWatcher.on('addDir', (dirPath: string) => {
     if (dirPath === absoluteProjectsDir) return;
     const projectName = path.basename(dirPath);
     debouncedEmit(projectName, () => {
       enqueue(createSSEEvent('project_added', { projectName }));
     });
   });
   ```

4. **Add the `unlinkDir` handler** on `dirWatcher`:
   ```typescript
   dirWatcher.on('unlinkDir', (dirPath: string) => {
     if (dirPath === absoluteProjectsDir) return;
     const projectName = path.basename(dirPath);
     debouncedEmit(projectName, () => {
       enqueue(createSSEEvent('project_removed', { projectName }));
     });
   });
   ```

5. **Add the `error` handler** on `dirWatcher` (mirror the existing `watcher` convention):
   ```typescript
   dirWatcher.on('error', (error: Error) => {
     console.error('[SSE] Chokidar dir watcher error:', error);
   });
   ```

6. **Insert a section comment** above the `dirWatcher` block for readability, following the existing `// ──` comment style:
   ```typescript
   // ── 3. Set up shallow directory watcher ───────────────────────
   ```
   Renumber the subsequent section comments (`Heartbeat` becomes `// ── 4.`, `Cleanup` becomes `// ── 5.`).

7. **Update `cleanup()`** to close `dirWatcher` alongside the existing `watcher.close()` call:
   ```typescript
   watcher.close().catch((err) => {
     console.error('[SSE] Error closing watcher:', err);
   });
   dirWatcher.close().catch((err) => {
     console.error('[SSE] Error closing dir watcher:', err);
   });
   ```

8. **Do not add any imports** — `chokidar` and `path` are already imported at the top of the file.

9. **Do not change any other logic** — all existing handlers (`change`, `add`, `unlink`), `debouncedEmit`, `enqueue`, `createSSEEvent`, and the `connected` readdir call remain untouched.

10. **Verify `next build`** produces no TypeScript errors.

## Contracts & Interfaces

The following types are already defined in `@/types/events` and used throughout the file. The new handlers must use `createSSEEvent` and `enqueue` in exactly the same way as the existing `add` and `unlink` handlers:

```typescript
// @/types/events.ts (inline — do not re-import)
// SSEEventType includes: 'connected' | 'state_change' | 'project_added' | 'project_removed' | 'heartbeat'
// SSEPayloadMap['project_added'] = { projectName: string }
// SSEPayloadMap['project_removed'] = { projectName: string }
```

**`debouncedEmit` signature** (already defined in the file):
```typescript
function debouncedEmit(projectName: string, callback: () => void): void
```
- First argument: the debounce key (must be `projectName` — a bare directory name, not a full path)
- Second argument: callback that calls `enqueue(...)` with the SSE event
- Any calls for the same `projectName` within 300 ms are coalesced — only the last callback fires

**`enqueue` signature** (already defined in the file):
```typescript
function enqueue(event: SSEEvent): void
```

## Styles & Design Tokens

Not applicable — this is a server-side API route with no UI components.

## Test Requirements

- [ ] Manually create a new subdirectory inside the projects directory — confirm a `project_added` SSE event is received by a connected client with the correct `projectName`
- [ ] Manually delete a subdirectory from the projects directory — confirm a `project_removed` SSE event is received with the correct `projectName`
- [ ] Trigger both `addDir` (new project dir) and `add` (state.json inside it) within 300 ms — confirm exactly **one** `project_added` event is emitted, not two
- [ ] Disconnect the SSE client — confirm `cleanup()` calls `dirWatcher.close()` without throwing
- [ ] Run `next build` from the `ui/` directory and confirm it exits with code 0 and no TypeScript errors

## Acceptance Criteria

- [ ] A `dirWatcher` variable is declared in the same scope as `watcher` (inside `start(controller)`)
- [ ] `dirWatcher` is initialized with `chokidar.watch(absoluteProjectsDir, { depth: 0, ignoreInitial: true })`
- [ ] The `addDir` handler skips when `dirPath === absoluteProjectsDir` (root path guard present)
- [ ] The `unlinkDir` handler skips when `dirPath === absoluteProjectsDir` (root path guard present)
- [ ] Both `addDir` and `unlinkDir` call `debouncedEmit(path.basename(dirPath), ...)` — `path.basename(dirPath)` is the debounce key
- [ ] `dirWatcher.close()` is called inside `cleanup()` alongside `watcher.close()`
- [ ] No files other than `ui/app/api/events/route.ts` are modified
- [ ] `next build` passes with no TypeScript errors
- [ ] All pre-existing watcher behavior (`change`, `add`, `unlink`, heartbeat, `connected`) is unaffected

## Constraints

- **Do NOT add any new imports** — `chokidar` and `path` (from `node:path`) are already imported
- **Do NOT modify any existing handler** (`change`, `add`, `unlink`, `error` on `watcher`)
- **Do NOT change `debouncedEmit`, `enqueue`, `clearAllDebounceTimers`, or `createSSEEvent`**
- **Do NOT use `depth: 1` or omit `ignoreInitial: true`** — both options are required exactly as specified
- **Do NOT use `path.basename` anywhere other than extracting `projectName` from `dirPath`** — the root guard compares the raw `dirPath` to `absoluteProjectsDir` before calling `basename`
- **Only one file is in scope**: `ui/app/api/events/route.ts`
