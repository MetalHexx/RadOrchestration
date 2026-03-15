---
project: "MONITORING-UI"
phase: 3
task: 1
title: "SSE API Endpoint"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# SSE API Endpoint

## Objective

Create a Server-Sent Events endpoint at `GET /api/events` that uses chokidar to watch all `state.json` files under the projects directory, debounces file changes per-project (300ms), normalizes state data, and streams typed SSE events to the browser in real time. Send a `connected` event on initial connection, a heartbeat every 30 seconds, and clean up the watcher on client disconnect.

## Context

The MONITORING-UI dashboard is a Next.js 14 App Router application in the `ui/` directory. It reads orchestration project data from `{WORKSPACE_ROOT}/.github/projects/*/state.json`. Types for SSE events already exist in `ui/types/events.ts`. Utility modules `path-resolver.ts`, `fs-reader.ts`, and `normalizer.ts` handle workspace resolution, config reading, and state normalization. chokidar `^3.6.0` is already installed in `package.json`. The endpoint must use the App Router streaming `ReadableStream` response pattern — not the Pages Router `res.write()` approach.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/app/api/events/route.ts` | SSE streaming endpoint with chokidar file watcher |
| MODIFY | `ui/types/events.ts` | Add `heartbeat` to `SSEEventType` union and `SSEPayloadMap` |

## Implementation Steps

1. **Update `ui/types/events.ts`**: Add `'heartbeat'` to the `SSEEventType` union type. Add `heartbeat: Record<string, never>` to the `SSEPayloadMap` interface. This extends the existing types without breaking downstream consumers.

2. **Create `ui/app/api/events/route.ts`**: Export an `async function GET(request: Request)` handler. Read `WORKSPACE_ROOT` from `process.env` via `getWorkspaceRoot()`. Read `orchestration.yml` via `readConfig(root)` to get `config.projects.base_path`. Compute the absolute projects directory via `resolveBasePath(root, config.projects.base_path)`.

3. **Build a `ReadableStream`**: Create `new ReadableStream({ start(controller) { ... } })`. Inside the `start` callback, set up the chokidar watcher, heartbeat interval, and abort listener. Return `new Response(stream, { headers })` with the SSE headers.

4. **Discover existing projects and send `connected` event**: In the `start` callback, list subdirectories of the projects base path (using `readdir` with `withFileTypes`), filter to directories, and immediately enqueue a `connected` event with the project names array.

5. **Set up chokidar watcher**: Watch `{absoluteProjectsDir}/**/state.json` with options: `awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }`, `ignored: [/state\.json\.(proposed|empty)$/]`, `ignoreInitial: true`. Bind handlers for `change`, `add`, and `unlink` events.

6. **Implement per-project debounce**: Create a `Map<string, NodeJS.Timeout>` keyed by project name. On each watched event, extract the project name from the file path, clear any existing timeout for that project, then set a new 300ms timeout that executes the actual event emission logic.

7. **Handle `change` events**: Inside the debounced callback, read the file with `readFile(filePath, 'utf-8')`, parse as JSON, cast to `RawStateJson`, normalize with `normalizeState()`, and enqueue a `state_change` event containing the project name and normalized state.

8. **Handle `add` and `unlink` events**: On `add`, extract the project name and enqueue a `project_added` event. On `unlink`, enqueue a `project_removed` event. Apply the same per-project debounce.

9. **Start heartbeat interval**: Set a 30-second `setInterval` that enqueues a `heartbeat` SSE event (with empty payload) to keep the connection alive through proxies and detect stale connections.

10. **Wire up cleanup on disconnect**: Call `request.signal.addEventListener('abort', cleanup)`. In the cleanup function: call `watcher.close()`, clear the heartbeat interval, clear all debounce timers, and call `controller.close()`. Wrap cleanup in a guard flag to prevent double-close.

## Contracts & Interfaces

### SSE Event Types — `ui/types/events.ts` (after modification)

```typescript
import type { NormalizedProjectState } from './state';

/** SSE event types sent from server to client */
export type SSEEventType = 'state_change' | 'project_added' | 'project_removed' | 'connected' | 'heartbeat';

export interface SSEEvent<T extends SSEEventType = SSEEventType> {
  type: T;
  timestamp: string;      // ISO 8601
  payload: SSEPayloadMap[T];
}

export interface SSEPayloadMap {
  state_change: {
    projectName: string;
    state: NormalizedProjectState;
  };
  project_added: {
    projectName: string;
  };
  project_removed: {
    projectName: string;
  };
  connected: {
    projects: string[];
  };
  heartbeat: Record<string, never>;
}
```

### State Types — `ui/types/state.ts` (DO NOT MODIFY)

```typescript
export interface RawStateJson {
  $schema?: string;
  project: { name: string; description?: string | null; created: string; updated: string; brainstorming_doc?: string | null };
  pipeline: { current_tier: string; human_gate_mode: string };
  planning: { status: string; steps: Record<string, unknown>; human_approved: boolean };
  execution: { status: string; current_phase: number; total_phases: number; phases: RawPhase[] };
  final_review: { status: string; report_doc: string | null; human_approved: boolean };
  errors: { total_retries: number; total_halts: number; active_blockers: unknown[] };
  limits: { max_phases: number; max_tasks_per_phase: number; max_retries_per_task: number };
}

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: { current_tier: PipelineTier; human_gate_mode: HumanGateMode };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: { status: FinalReviewStatus; report_doc: string | null; human_approved: boolean };
  errors: { total_retries: number; total_halts: number; active_blockers: unknown[] };
  limits: { max_phases: number; max_tasks_per_phase: number; max_retries_per_task: number };
}
```

### Config Type — `ui/types/config.ts` (DO NOT MODIFY)

```typescript
export interface OrchestrationConfig {
  version: string;
  projects: {
    base_path: string;    // e.g., ".github/projects"
    naming: string;
  };
  limits: { max_phases: number; max_tasks_per_phase: number; max_retries_per_task: number; max_consecutive_review_rejections: number };
  errors: { severity: { critical: string[]; minor: string[] }; on_critical: string; on_minor: string };
  git: { strategy: string; branch_prefix: string; commit_prefix: string; auto_commit: boolean };
  human_gates: { after_planning: boolean; execution_mode: string; after_final_review: boolean };
}
```

### Existing Utility Functions (DO NOT MODIFY — import and use)

```typescript
// ui/lib/path-resolver.ts
export function getWorkspaceRoot(): string;
// Reads process.env.WORKSPACE_ROOT. Throws if not set.

export function resolveBasePath(workspaceRoot: string, basePath: string): string;
// Returns path.resolve(workspaceRoot, basePath)
```

```typescript
// ui/lib/fs-reader.ts
export async function readConfig(workspaceRoot: string): Promise<OrchestrationConfig>;
// Reads {workspaceRoot}/.github/orchestration.yml, parses YAML, returns OrchestrationConfig
```

```typescript
// ui/lib/normalizer.ts
export function normalizeState(raw: RawStateJson): NormalizedProjectState;
// Normalizes a raw state.json (v1 or v2) into the canonical form
```

### orchestration.yml Config Structure (read-only reference)

```yaml
projects:
  base_path: ".github/projects"    # relative to workspace root — this is the glob root
  naming: "SCREAMING_CASE"
```

### SSE Wire Format

Each SSE frame must follow the standard `text/event-stream` format exactly:

```
event: state_change
data: {"type":"state_change","timestamp":"2026-03-09T14:30:00Z","payload":{"projectName":"VALIDATOR","state":{...}}}

event: project_added
data: {"type":"project_added","timestamp":"2026-03-09T14:31:00Z","payload":{"projectName":"NEW-PROJECT"}}

event: connected
data: {"type":"connected","timestamp":"2026-03-09T14:30:00Z","payload":{"projects":["VALIDATOR","MONITORING-UI"]}}

event: heartbeat
data: {"type":"heartbeat","timestamp":"2026-03-09T14:30:30Z","payload":{}}

```

Note: each frame ends with TWO newlines (`\n\n`) — one after `data:` line, plus the blank line separator.

### ReadableStream SSE Pattern for Next.js App Router

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

export const dynamic = 'force-dynamic';   // disable static optimization for streaming

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  // ... resolve workspace root, read config, compute basePath ...

  const stream = new ReadableStream({
    start(controller) {
      // 1. Discover projects, send connected event
      // 2. Set up chokidar watcher
      // 3. Start heartbeat interval
      // 4. Register abort cleanup

      request.signal.addEventListener('abort', () => {
        // Close watcher, clear intervals, clear debounce timers, controller.close()
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### chokidar Watcher Pattern

```typescript
const globPattern = path.join(absoluteProjectsDir, '**', 'state.json');

const watcher = chokidar.watch(globPattern, {
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 50,
  },
  ignored: [/state\.json\.(proposed|empty)$/],
  ignoreInitial: true,     // don't fire 'add' for files that already exist on startup
});

watcher.on('change', (filePath: string) => { /* debounced handler */ });
watcher.on('add', (filePath: string) => { /* new state.json appeared */ });
watcher.on('unlink', (filePath: string) => { /* state.json deleted */ });

// On cleanup:
await watcher.close();
```

### Per-Project Debounce Pattern

```typescript
const debounceTimers = new Map<string, NodeJS.Timeout>();

function extractProjectName(filePath: string, projectsDir: string): string {
  // filePath: /abs/.github/projects/MY-PROJECT/state.json
  // projectsDir: /abs/.github/projects
  const relative = path.relative(projectsDir, filePath);   // "MY-PROJECT/state.json" or "MY-PROJECT\\state.json"
  return relative.split(path.sep)[0];                       // "MY-PROJECT"
}

function debouncedEmit(projectName: string, callback: () => void): void {
  const existing = debounceTimers.get(projectName);
  if (existing) clearTimeout(existing);
  debounceTimers.set(projectName, setTimeout(() => {
    debounceTimers.delete(projectName);
    callback();
  }, 300));
}

// Cleanup all timers:
function clearAllDebounceTimers(): void {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}
```

### SSE Event Formatting Helper

```typescript
function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function createSSEEvent<T extends SSEEventType>(
  type: T,
  payload: SSEPayloadMap[T]
): SSEEvent<T> {
  return {
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}
```

## Styles & Design Tokens

Not applicable — this is a server-side API endpoint with no UI rendering.

## Test Requirements

- [ ] `GET /api/events` returns HTTP 200 with `Content-Type: text/event-stream` header
- [ ] First event received is `event: connected` with a `projects` array payload listing discovered projects
- [ ] Modifying a `state.json` file on disk triggers a `state_change` event within ~500ms (300ms debounce + processing)
- [ ] Rapid successive writes (< 300ms apart) to the same project's `state.json` produce only ONE `state_change` event (debounce works)
- [ ] Changes to `state.json.proposed` files do NOT trigger events (ignored pattern works)
- [ ] Client disconnect triggers watcher cleanup — no lingering chokidar instances or intervals
- [ ] Heartbeat event is sent within ~30 seconds of connection
- [ ] Malformed JSON in `state.json` does not crash the SSE stream — error is logged and event is skipped

## Acceptance Criteria

- [ ] `ui/app/api/events/route.ts` exists and exports a named `GET` function
- [ ] Route is marked with `export const dynamic = 'force-dynamic'`
- [ ] `ui/types/events.ts` includes `'heartbeat'` in the `SSEEventType` union
- [ ] `ui/types/events.ts` includes `heartbeat: Record<string, never>` in `SSEPayloadMap`
- [ ] Response headers include `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- [ ] A `connected` event with `{ projects: string[] }` payload is sent immediately on connection
- [ ] chokidar watches `{basePath}/**/state.json` with `awaitWriteFinish` and ignored pattern for `.proposed`/`.empty` files
- [ ] `ignoreInitial: true` is set on the chokidar watcher
- [ ] Per-project debounce (300ms) prevents rapid-fire `state_change` events during active writes
- [ ] `state_change` events contain normalized state produced by `normalizeState()` from `@/lib/normalizer`
- [ ] `project_added` events fire on chokidar `add`
- [ ] `project_removed` events fire on chokidar `unlink`
- [ ] Heartbeat events (`event: heartbeat`) are sent every 30 seconds
- [ ] Watcher, heartbeat interval, and debounce timers are all cleaned up on `request.signal` abort
- [ ] Cleanup is guarded against double-close
- [ ] File read/parse errors are caught with `console.error` — stream continues
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT use Pages Router API (`res.write()`, `res.flush()`) — use App Router `ReadableStream` pattern only
- Do NOT create a singleton/shared watcher across connections — each SSE connection gets its own watcher instance
- Do NOT modify `ui/lib/path-resolver.ts`, `ui/lib/fs-reader.ts`, or `ui/lib/normalizer.ts`
- Do NOT modify `ui/types/state.ts` or `ui/types/config.ts`
- Do NOT install any new npm packages — all dependencies are already in `package.json`
- Use `import type` for type-only imports
- Use `@/` path aliases for all internal imports (e.g., `@/types/events`, `@/lib/normalizer`)
- Error handling: `console.error` and skip on file read/parse failure — never crash or close the stream
- Do NOT send the full raw state.json — always normalize with `normalizeState()` before including in events
