---
project: "UI-LIVE-PROJECTS"
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Architecture

## Technical Overview

This project delivers two surgical, purely-additive modifications to the existing Next.js 14 monitoring UI. A shallow chokidar watcher (`depth: 0`) is added to the SSE route to emit `project_added` and `project_removed` events when directories are created or deleted under `projects.base_path` — filling the gap left by the existing glob watcher which only observes `state.json` files. A `{ cache: 'no-store' }` option is added to both client-side `fetch("/api/projects")` call sites in `use-projects.ts` to guarantee page refreshes always reflect the current filesystem state. No new modules, types, dependencies, or UI components are introduced.

---

## System Layers

```
┌──────────────────────────────────────────────────────┐
│                    Presentation                       │  (unchanged) React components, sidebar
├──────────────────────────────────────────────────────┤
│                    Application                        │  use-projects.ts  ← MODIFIED (fetch cache)
├──────────────────────────────────────────────────────┤
│                      Domain                           │  (unchanged) types/events.ts, types/state.ts
├──────────────────────────────────────────────────────┤
│                   Infrastructure                      │  app/api/events/route.ts  ← MODIFIED (dirWatcher)
└──────────────────────────────────────────────────────┘
```

---

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|----------------|
| SSE Route | Infrastructure | `ui/app/api/events/route.ts` | Streams `state_change`, `project_added`, `project_removed`, `heartbeat`, and `connected` events to SSE clients; manages both the glob watcher (state files) and the new shallow directory watcher; owns cleanup on disconnect |
| Projects Hook | Application | `ui/hooks/use-projects.ts` | Fetches project list from `/api/projects`; handles incoming SSE events to update sidebar state; drives project selection |
| SSE Hook | Application | `ui/hooks/use-sse.ts` | **(unchanged)** EventSource lifecycle management; exponential-backoff reconnect; dispatches named events to `onEvent` callback |
| Projects API Route | Infrastructure | `ui/app/api/projects/route.ts` | **(unchanged)** `GET /api/projects` — calls `discoverProjects()`; `force-dynamic` already set |
| FS Reader | Infrastructure | `ui/lib/fs-reader.ts` | **(unchanged)** `discoverProjects()` — live `readdir`; handles state-less dirs (`hasState: false`) |
| Path Resolver | Infrastructure | `ui/lib/path-resolver.ts` | **(unchanged)** Resolves `absoluteProjectsDir` from config |
| SSE Event Types | Domain | `ui/types/events.ts` | **(unchanged)** `SSEEventType`, `SSEEvent<T>`, `SSEPayloadMap` — `project_added` and `project_removed` payloads already defined |

---

## Contracts & Interfaces

### New Shallow Directory Watcher — Configuration

```typescript
// ui/app/api/events/route.ts
// Inserted after the existing watcher.on('error') handler, inside start(controller)

const dirWatcher = chokidar.watch(absoluteProjectsDir, {
  depth: 0,           // immediate children only — no recursion into project subdirs
  ignoreInitial: true, // do not fire for directories that already exist at startup
});
```

**`depth: 0` rationale**: Limits observation to direct subdirectories of `absoluteProjectsDir`. The root dir and any deeper subdirectory changes are completely ignored. This satisfies NFR-5 (no recursive subdirectory watching).

---

### New `addDir` Event Handler

```typescript
// ui/app/api/events/route.ts  — inside start(controller), after dirWatcher declaration
dirWatcher.on('addDir', (dirPath: string) => {
  // Guard: chokidar may emit addDir for the watched root itself in some edge cases
  if (dirPath === absoluteProjectsDir) return;
  const projectName = path.basename(dirPath);
  debouncedEmit(projectName, () => {
    enqueue(createSSEEvent('project_added', { projectName }));
  });
});
```

- **Path extraction**: `path.basename(dirPath)` — `dirPath` is always `{absoluteProjectsDir}/{projectName}` at `depth: 0`, so `basename` returns the project folder name.
- **Debounce key**: `projectName` — identical key used by the existing `watcher.on('add')` handler. If `addDir` and `add` (state.json creation) both fire within 300 ms, the debounce timer resets on the second call and only one `project_added` is emitted (FR-5).
- **Debounce window**: 300 ms (shared with existing watcher — no new constant needed).

---

### New `unlinkDir` Event Handler

```typescript
// ui/app/api/events/route.ts  — inside start(controller), after addDir handler
dirWatcher.on('unlinkDir', (dirPath: string) => {
  const projectName = path.basename(dirPath);
  debouncedEmit(projectName, () => {
    enqueue(createSSEEvent('project_removed', { projectName }));
  });
});
```

- **chokidar 3.x compatibility**: chokidar 3.x fires `unlinkDir` when a directory is deleted. Confirmed supported at `depth: 0` — the watcher observes the immediate contents of `absoluteProjectsDir`, so when a child directory is removed the `unlinkDir` event fires with the deleted path.
- **Debounce coalescence for projects with `state.json`**: If both `unlink` (state.json) and `unlinkDir` (directory) fire within 300 ms, the shared debounce key (`projectName`) ensures only one `project_removed` is emitted (Design Flow 3, Sub-flow B).

---

### New `dirWatcher` Error Handler

```typescript
// ui/app/api/events/route.ts  — inside start(controller), after unlinkDir handler
dirWatcher.on('error', (err: Error) => {
  console.error('[SSE] Chokidar dir watcher error:', err);
});
```

Follows the identical pattern of the existing `watcher.on('error')` handler — logs to stderr, does not terminate the stream.

---

### Modified `cleanup()` Function

```typescript
// ui/app/api/events/route.ts  — existing cleanup() function
// ADD dirWatcher.close() alongside the existing watcher.close() call

function cleanup(): void {
  if (closed) return;
  closed = true;

  clearInterval(heartbeatInterval);
  clearAllDebounceTimers();

  watcher.close().catch((err) => {
    console.error('[SSE] Error closing watcher:', err);
  });
  dirWatcher.close().catch((err) => {          // ← NEW LINE
    console.error('[SSE] Error closing dir watcher:', err);
  });

  try {
    controller.close();
  } catch {
    // Already closed — ignore
  }
}
```

Both watchers are closed in the same `cleanup()`. `cleanup()` is already called via `request.signal.addEventListener('abort', cleanup)` — covering all SSE disconnect scenarios (FR-4, NFR-2).

---

### Modified `fetchProjectList` — `use-projects.ts`

```typescript
// ui/hooks/use-projects.ts  — inside fetchProjectList useCallback
// BEFORE:
const res = await fetch("/api/projects");
// AFTER:
const res = await fetch("/api/projects", { cache: 'no-store' });
```

---

### Modified Mount `useEffect` Fetch — `use-projects.ts`

```typescript
// ui/hooks/use-projects.ts  — inside fetchProjects() inside the mount useEffect
// BEFORE:
const res = await fetch("/api/projects");
// AFTER:
const res = await fetch("/api/projects", { cache: 'no-store' });
```

Both fetch call sites receive `{ cache: 'no-store' }`. This bypasses the browser HTTP cache and guarantees fresh data on every call — including manual page refreshes (FR-3, NFR-1).

---

## SSE Event Payloads

These types are **already defined** in `ui/types/events.ts` and are **unchanged**. Documented here for implementation reference.

```typescript
// ui/types/events.ts  (no changes — reference only)

// Emitted by: dirWatcher.on('addDir') via debouncedEmit
project_added: {
  projectName: string;   // basename of the created directory
};

// Emitted by: dirWatcher.on('unlinkDir') via debouncedEmit  
project_removed: {
  projectName: string;   // basename of the deleted directory
};
```

The wire format (SSE text stream) is handled by the existing `formatSSE()` function, unchanged:

```
event: project_added
data: {"type":"project_added","timestamp":"2026-03-15T12:00:00.000Z","payload":{"projectName":"MY-PROJECT"}}

```

---

## API Endpoints

| Method | Path | Request | Response | Auth | Changes |
|--------|------|---------|----------|------|---------|
| `GET` | `/api/events` | — | `text/event-stream` | None | **Modified**: adds `dirWatcher` inside `start(controller)` |
| `GET` | `/api/projects` | — | `{ projects: ProjectSummary[] }` | None | **Unchanged** (server-side) |

---

## Dependencies

### External Dependencies

| Package | Version | Purpose | Change |
|---------|---------|---------|--------|
| `chokidar` | `^3.6.0` | Filesystem event watching | **Unchanged** — already a runtime dependency in `ui/package.json`; `addDir`/`unlinkDir` events confirmed supported in 3.x |

No new external dependencies. This satisfies NFR-4.

### Internal Dependencies (module → module)

```
use-projects.ts
  → /api/projects (fetch, cache: 'no-store')        ← MODIFIED
  → use-sse.ts
      → /api/events (EventSource)
          → events/route.ts
              → path-resolver.ts (absoluteProjectsDir)
              → fs-reader.ts (readConfig)
              → chokidar (glob watcher — unchanged)
              → chokidar (dirWatcher — NEW, depth: 0)
```

---

## File Structure

Only two files are modified. No new files are created.

```
ui/
├── app/
│   └── api/
│       └── events/
│           └── route.ts          # MODIFIED: add dirWatcher (addDir/unlinkDir) + cleanup
└── hooks/
    └── use-projects.ts           # MODIFIED: add { cache: 'no-store' } to both fetch("/api/projects") calls
```

### Exact change locations within each file

#### `ui/app/api/events/route.ts`

| Section | Change | Location within file |
|---------|--------|----------------------|
| After `watcher.on('error')` handler | Add `dirWatcher` declaration + `addDir`, `unlinkDir`, `error` handlers | Inside `start(controller)` callback, after the existing 4 watcher event handlers |
| `cleanup()` function | Add `dirWatcher.close().catch(...)` | After `watcher.close().catch(...)`, before `controller.close()` |

#### `ui/hooks/use-projects.ts`

| Call site | Change | Location within file |
|-----------|--------|----------------------|
| `fetchProjectList` useCallback | `fetch("/api/projects")` → `fetch("/api/projects", { cache: 'no-store' })` | Inside the `try` block of `fetchProjectList` |
| Mount `useEffect` | `fetch("/api/projects")` → `fetch("/api/projects", { cache: 'no-store' })` | Inside `fetchProjects()` async function inside the mount `useEffect` |

---

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| Error handling | `dirWatcher.on('error', ...)` mirrors the existing glob watcher's error handler — logs to stderr; the SSE stream continues. No new error-handling patterns. |
| Resource management | `dirWatcher.close()` added to `cleanup()` alongside `watcher.close()`; both watchers close on every SSE disconnect via the existing `request.signal.addEventListener('abort', cleanup)` pathway |
| Debounce / event deduplication | Shared `debounceTimers` Map and `debouncedEmit()` function used by both watchers; key is `projectName`; window is 300 ms. No new debounce infrastructure. |
| State management | No changes to React state shape, context, or hook interfaces; `project_added` and `project_removed` handlers in `use-projects.ts` are already wired and already produce correct behavior |
| Authentication | None — SSE route and projects route are unauthenticated; unchanged |
| Logging | `console.error('[SSE] Chokidar dir watcher error:', ...)` follows the `[SSE]` prefix convention already present in the file |
| Compatibility | Chokidar 3.x `addDir`/`unlinkDir` events are stable and platform-portable (macOS + Linux). `{ cache: 'no-store' }` is a standard `fetch` option supported in all modern browsers and Node.js 18+ |

---

## Phasing Recommendations

Single phase, two sequential tasks. Task 2 has no dependency on Task 1 (the files are independent), but sequential ordering is recommended for easier review.

### Phase 1 — Live Project Detection

**Goal**: Deliver all three user stories (US-1, US-2, US-3) in a single atomic phase.

**Exit criteria**:
- A new directory created under `projects.base_path` triggers a `project_added` SSE event and the project appears in the sidebar within 500 ms, with no rebuild or manual refresh
- A directory deleted from `projects.base_path` triggers a `project_removed` SSE event and the project disappears from the sidebar within 500 ms
- A directory-only project (no `state.json`) appears correctly with `not_initialized` tier badge
- When both `addDir` and `add` (state.json) fire within 300 ms, exactly one `project_added` event is delivered to the client
- A manual page refresh always returns the current project list (no stale cache hit)
- Closing the SSE connection does not leak watcher handles (both watchers are closed in cleanup)
- All pre-existing state-change behavior is unaffected

#### Task 1 — Add shallow directory watcher to SSE route

**File**: `ui/app/api/events/route.ts`

1. Declare `dirWatcher` using `chokidar.watch(absoluteProjectsDir, { depth: 0, ignoreInitial: true })` after the existing `watcher.on('error')` handler
2. Register `addDir` handler: guard root path, extract `path.basename(dirPath)`, call `debouncedEmit(projectName, () => enqueue(createSSEEvent('project_added', { projectName })))`
3. Register `unlinkDir` handler: extract `path.basename(dirPath)`, call `debouncedEmit(projectName, () => enqueue(createSSEEvent('project_removed', { projectName })))`
4. Register `error` handler: `console.error('[SSE] Chokidar dir watcher error:', err)`
5. In `cleanup()`: add `dirWatcher.close().catch(...)` after `watcher.close().catch(...)`

#### Task 2 — Add `cache: 'no-store'` to project list fetches

**File**: `ui/hooks/use-projects.ts`

1. In `fetchProjectList` useCallback: change `fetch("/api/projects")` → `fetch("/api/projects", { cache: 'no-store' })`
2. In mount `useEffect` `fetchProjects` function: change `fetch("/api/projects")` → `fetch("/api/projects", { cache: 'no-store' })`
