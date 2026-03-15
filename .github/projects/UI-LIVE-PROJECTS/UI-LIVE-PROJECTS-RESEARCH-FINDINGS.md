---
project: "UI-LIVE-PROJECTS"
author: "research-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Research Findings

## Research Scope

This research investigated the SSE route, projects API, filesystem reader, client hooks, and configuration layer of the monitoring UI (`ui/`) to identify exactly why new project directories are not reflected without a rebuild — and what targeted changes are needed to support live detection of directory creation and deletion.

---

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| SSE Route | `ui/app/api/events/route.ts` | Chokidar watcher setup; where new watch patterns must be added |
| Projects API | `ui/app/api/projects/route.ts` | HTTP response to `/api/projects`; cache control headers |
| FSReader | `ui/lib/fs-reader.ts` | `discoverProjects()` — filesystem enumeration; already handles state-less dirs |
| Path Resolver | `ui/lib/path-resolver.ts` | Resolves `absoluteProjectsDir`; no changes needed |
| Config API | `ui/app/api/config/route.ts` | Exposes `base_path` via `projectStorage.basePath` |
| Projects Hook | `ui/hooks/use-projects.ts` | Client-side fetch of `/api/projects`; SSE event handlers |
| SSE Hook | `ui/hooks/use-sse.ts` | EventSource management; named event listeners; backoff reconnect |
| SSE Event Types | `ui/types/events.ts` | `project_added`, `project_removed` types already defined |
| Components Types | `ui/types/components.ts` | `ProjectSummary` — already supports `hasState: false` + `not_initialized` tier |
| Config Transformer | `ui/lib/config-transformer.ts` | Transforms raw config; `base_path` → `projectStorage.basePath` |
| Orchestration Config | `.github/orchestration.yml` | `projects.base_path: ".github/projects"` |
| Package JSON | `ui/package.json` | `chokidar@^3.6.0` already a runtime dependency |

---

### Current SSE Watcher — Detailed Breakdown

**File**: `ui/app/api/events/route.ts`

#### Watcher setup (lines 91–107)

```typescript
const globPattern = path.join(absoluteProjectsDir, '**', 'state.json');

const watcher = chokidar.watch(globPattern, {
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 50,
  },
  ignored: [/state\.json\.(proposed|empty)$/],
  ignoreInitial: true,
});
```

- **Watches**: glob `{absoluteProjectsDir}/**/state.json` — files only, no directory events
- **`ignoreInitial: true`**: no events fired for pre-existing files at startup
- **`awaitWriteFinish`**: waits 200 ms of file-write stability before emitting `add`/`change`
- **Per-project debounce**: 300 ms, keyed by `projectName`

#### Events currently handled (lines 109–148)

| Chokidar event | Condition | SSE event emitted |
|----------------|-----------|-------------------|
| `change` | `state.json` file content changed | `state_change` |
| `add` | new `state.json` appeared | `project_added { projectName }` |
| `unlink` | `state.json` deleted | `project_removed { projectName }` |
| `error` | OS watcher error | none (console.error only) |

#### Events NOT handled

| Chokidar event | What it would detect | Why it matters |
|----------------|----------------------|----------------|
| `addDir` | New subdirectory under `absoluteProjectsDir` | Directory-only projects (no `state.json`) never trigger `project_added` |
| `unlinkDir` | Subdirectory removed from `absoluteProjectsDir` | Deleting a project folder (especially if it has no `state.json`) never triggers `project_removed` |

#### Connected event (lines 82–90)

```typescript
readdir(absoluteProjectsDir, { withFileTypes: true })
  .then((entries) => {
    const projects = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    enqueue(createSSEEvent('connected', { projects }));
  })
```

This correctly enumerates all existing directories (including those without `state.json`) and sends them in the initial `connected` payload.

#### Cleanup (lines 155–175)

```typescript
function cleanup(): void {
  if (closed) return;
  closed = true;
  clearInterval(heartbeatInterval);
  clearAllDebounceTimers();
  watcher.close().catch(...);
  controller.close();
}
request.signal.addEventListener('abort', cleanup);
```

Cleanup is triggered by the `abort` signal — covers SSE client disconnection.

---

### Projects API — Detailed Breakdown

**File**: `ui/app/api/projects/route.ts` (17 lines)

```typescript
export const dynamic = 'force-dynamic';

export async function GET() {
  const root = getWorkspaceRoot();
  const config = await readConfig(root);
  const projects = await discoverProjects(root, config.projects.base_path);
  return NextResponse.json({ projects }, { status: 200 });
}
```

- `force-dynamic` disables Next.js build-time static generation for this route
- `discoverProjects()` calls `readdir()` on every request — no in-memory cache
- `NextResponse.json()` returns no explicit `Cache-Control` header by default in Next.js 14.x
- **Next.js 14 behavior**: In Next.js 14, `force-dynamic` prevents static pre-rendering but does not set `Cache-Control: no-store` on the HTTP response. The default may be `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` depending on the Next.js version, but this must be verified empirically — the route does not set headers explicitly.

---

### `discoverProjects()` — Detailed Breakdown

**File**: `ui/lib/fs-reader.ts` lines 28–90

- Does a live `readdir(absBasePath, { withFileTypes: true })` every call — no memoization
- For each directory: attempts to `readFile(statePath)` + `JSON.parse`
- `ENOENT` → `{ hasState: false, tier: 'not_initialized' }` ← directory-only projects already supported
- Malformed JSON → `{ hasMalformedState: true, tier: 'not_initialized' }`
- **No caching, no stale-data risk on the server side**

---

### Client-Side Fetch — `use-projects.ts`

**File**: `ui/hooks/use-projects.ts`

All fetch calls to `/api/projects`:

| Location | Code | Cache option |
|----------|------|--------------|
| Mount fetch (line 141) | `fetch("/api/projects")` | None — uses browser default |
| `fetchProjectList` callback (line 45) | `fetch("/api/projects")` | None — uses browser default |

**No `{ cache: 'no-store' }`, no `Cache-Control` request header is set.**

Browser default: respects the HTTP `Cache-Control` response header from the server. If the response header is permissive (e.g., `no-cache` without `no-store`), the browser may serve a cached response on subsequent calls.

#### SSE event → client action mapping (lines 56–78)

| SSE event type | Client action |
|----------------|---------------|
| `connected` | Calls `fetchProjectList()` → re-fetches `/api/projects` |
| `project_added` | Calls `fetchProjectList()` → re-fetches `/api/projects` |
| `project_removed` | Removes project from local state in-memory; does NOT re-fetch |
| `state_change` | Updates `projectState` for the selected project |

**Notable**: `project_added` and `project_removed` types are **already handled** by the client. The handler is wired. The server just never emits `project_added` for directory-only projects or `project_removed` for directory-deletion events.

---

### SSE Client Hook — `use-sse.ts`

**File**: `ui/hooks/use-sse.ts`

- `EVENT_TYPES` array (line 17): `["connected", "state_change", "project_added", "project_removed", "heartbeat"]`
- Uses `es.addEventListener(eventType, ...)` for each named event — not the generic `message` listener
- The server formats SSE as: `event: {type}\ndata: {json}\n\n` — named events, correctly matched
- Exponential backoff: initial 1s, multiplier 2x, max 30s, max 10 attempts
- `project_added` and `project_removed` are already registered listeners — **no client-side changes needed for new event types**

---

### Config API — `use-config/route.ts`

**File**: `ui/app/api/config/route.ts`

- `force-dynamic` set
- Returns `{ config: { projectStorage: { basePath: ".github/projects", ... }, ... } }`
- The `base_path` is exposed to the client but is not used by the events route (which reads it directly from `orchestration.yml`)

---

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 14.2.35 | App Router; `force-dynamic` available |
| Runtime | Node.js | 20.x (types) | `fs/promises` APIs available |
| Language | TypeScript | ^5 | Strict mode |
| File watching | chokidar | ^3.6.0 | Already a runtime dependency; `addDir`/`unlinkDir` events supported |
| UI Framework | React | ^18 | Hooks-based; SSE via `EventSource` |
| SSE Transport | `ReadableStream` + `Response` | Web Streams API | Server-side; cleans up on `request.signal` abort |

---

### Existing Patterns

- **`force-dynamic`**: All three API routes set `export const dynamic = 'force-dynamic'` at top of file
- **Chokidar cleanup via `abort` signal**: SSE route closes watcher on `request.signal.addEventListener('abort', cleanup)`
- **Per-project debounce**: `debouncedEmit(projectName, callback)` — 300 ms, keyed by project name; must be reused for new events
- **`extractProjectName`**: Utility function strips `absoluteProjectsDir` prefix and takes the first path segment — works for files and directories at depth 1
- **`createSSEEvent` + `enqueue`**: Pattern for emitting SSE; type-safe via `SSEPayloadMap`
- **Named SSE events**: Server emits `event: {type}\n`, client listens via `addEventListener(type, ...)`; exact match required
- **Debounce map key**: `projectName` — shared across `change`, `add`, `unlink` handlers. Any new handlers must also key by `projectName` to prevent event storms when directory + `state.json` appear in rapid succession.
- **`ignoreInitial: true`**: Prevents backfill on watcher startup; must be preserved for directory-level watchers too

---

## External Research

| Source | Key Finding |
|--------|-------------|
| Chokidar v3 docs — `addDir` event | Fired when a directory is added. Works with `depth: 0` to watch only the immediate children of a watched directory. |
| Chokidar v3 docs — `unlinkDir` event | Fired when a directory is removed. To watch only immediate children (depth 0), pass `depth: 0` to the watcher options. |
| Chokidar v3 docs — `depth` option | `depth: 0` means watch only the given directory, not subdirectories. Limits `addDir`/`unlinkDir` to the immediate children of the watched path. |
| Chokidar v3 docs — `ignored` option | Accepts regex or function; not needed for a shallow directory watcher but can be preserved for safety. |
| Next.js 14 Route Caching | `force-dynamic` prevents static generation. The `/api/…` response headers default to `private, no-cache, no-store, max-age=0, must-revalidate` in Next.js 14 Route Handlers. This means the **server-side cache is not the problem**. |
| Browser `fetch` caching | Without an explicit `cache` option, `fetch` follows HTTP semantics. If the server sends `no-store`, the browser will never cache. If headers are ambiguous, stale responses may be served in some browsers. Adding `{ cache: 'no-store' }` to `fetch()` calls is the safest defense. |
| Chokidar v3 stability | chokidar 3.6.0 is the latest stable release of v3; v4.0 (Node.js-native `fs.watch`) is in active development but not production-ready as of March 2026. v3 is safe to use. |

---

## Gap Analysis

### Gap 1 — Directory creation not detected (blocks Goal 1 + partially Goal 3)

**Root cause**: The chokidar watcher uses glob `**/state.json` which only matches files. Directory creation events (`addDir`) are never fired for a glob-based watch.

**What's working**: The `connected` event on SSE connection open already enumerates all directories including state-less ones — so initial page load is correct.

**What's missing**: A chokidar watcher on `absoluteProjectsDir` at `depth: 0` listening for `addDir` to emit `project_added`.

**Recommended fix**: Add a second chokidar watcher instance watching `absoluteProjectsDir` directly (not a glob) with `depth: 0`, `ignoreInitial: true`. On `addDir`, extract the project name and `debouncedEmit` a `project_added` event.

**Alternative**: Use a single watcher and add `absolute: true` + a custom `ignored` function — more complex and harder to maintain. Separate watcher is cleaner.

---

### Gap 2 — Directory deletion not detected for state-less projects (blocks Goal 3)

**Root cause**: `project_removed` is only emitted when `state.json` is unlinked. If a project directory has no `state.json` (brainstorming-only), deleting the directory will not fire `unlink` on `state.json` → no `project_removed` event.

**For projects WITH `state.json`**: Deleting the entire directory on most OSes will fire `unlink` for `state.json` before `unlinkDir` for the directory — so `project_removed` IS fired correctly for state-ful projects today.

**What's missing**: An `unlinkDir` listener on `absoluteProjectsDir` at `depth: 0` to emit `project_removed` for any deleted project directory.

**Coordination risk**: If a project WITH `state.json` is deleted, both `unlink` (state.json) and `unlinkDir` (directory) will fire. Both would trigger `project_removed`. Since the client handles `project_removed` by removing from local state, duplicate events for the same project are idempotent client-side. The debounce map will also coalesce them.

**Recommended fix**: Add `unlinkDir` handler to the directory-level watcher (same instance as Gap 1's fix). Use the same `debouncedEmit` keyed by `projectName`.

---

### Gap 3 — Fetch caching on page refresh (blocks Goal 2)

**Root cause**: `fetch("/api/projects")` in `use-projects.ts` has no explicit `{ cache: 'no-store' }` option.

**Severity**: Low-to-medium. Next.js 14 Route Handlers set `no-store` by default for `force-dynamic` routes per the framework documentation. However, this is not enforced explicitly in the code, meaning a future Next.js upgrade or non-standard deployment could regress.

**Recommended fix**: Add `{ cache: 'no-store' }` to both `fetch("/api/projects")` call sites in `use-projects.ts` (the mount effect and `fetchProjectList` callback). This is a 2-line change.

**Optional belt-and-suspenders**: Add explicit `Cache-Control: no-store` header to the `/api/projects` `NextResponse.json()` call, so the HTTP response itself is unambiguous regardless of client-side fetch options.

---

### Gap 4 — `addDir`/`project_added` debounce coordination with `add`/`project_added`

**Scenario**: User creates a project directory, then the pipeline immediately creates `state.json` inside it (< 300 ms).

**Current behavior without fix**: Only the `add`/`state.json` event fires → one `project_added` event.

**With Gap 1 fix**: Both `addDir` (directory watcher) and `add` (state.json watcher) fire → two `debouncedEmit` calls for the same `projectName`. Because they share the same debounce map keyed by `projectName`, the second call resets the timer → only ONE `project_added` event is ultimately emitted.

**Conclusion**: The existing debounce map already handles this coordination correctly. No additional logic needed.

---

## Constraints Discovered

- Must work in both `next dev` and `next build && next start`
- `chokidar@^3.6.0` is already a runtime dependency — no new packages required
- Any new chokidar watcher must be closed in the existing `cleanup()` function alongside the file watcher
- `ignoreInitial: true` must be set on the directory watcher to avoid replaying existing directories on SSE reconnect (which would cause spurious `project_added` events for already-known projects)
- The per-project debounce map (`debounceTimers`) must be shared between the file watcher and the directory watcher to prevent duplicate events when directory creation and `state.json` creation happen in rapid succession
- `extractProjectName()` already correctly handles directory paths (takes first segment relative to `projectsDir`) — no changes needed
- `project_added` and `project_removed` event types are already defined in `ui/types/events.ts` and registered in `use-sse.ts` `EVENT_TYPES` — no type changes needed
- `discoverProjects()` already handles directories without `state.json` (returns `not_initialized` tier) — no changes needed
- `ProjectSummary` type already supports `hasState: false` + `not_initialized` — no type changes needed

---

## Recommendations

1. **Add a second shallow chokidar watcher** in `ui/app/api/events/route.ts` watching `absoluteProjectsDir` directly with `depth: 0` and `ignoreInitial: true`. Register `addDir` → `project_added` and `unlinkDir` → `project_removed` handlers. Use the existing `debouncedEmit` function (shared debounce map). Close this watcher alongside the existing one in `cleanup()`.

2. **Add `{ cache: 'no-store' }` to both `fetch("/api/projects")` calls** in `ui/hooks/use-projects.ts`. This is a 2-line defensive change that removes any ambiguity about browser-level caching on refresh.

3. **Optionally add explicit `Cache-Control: no-store` to `/api/projects` response** — belt-and-suspenders: `return NextResponse.json({ projects }, { status: 200, headers: { 'Cache-Control': 'no-store' } })`. Not strictly required given Next.js 14 defaults, but makes the intent explicit and protects against framework version changes.

4. **Do not change the existing `state.json` file watcher** — it works correctly for `state_change`, `project_added` (when `state.json` appears), and `project_removed` (when `state.json` is deleted from a project that still has it). The new directory watcher supplements it, it does not replace it.

5. **Do not change client-side SSE event handling** — `project_added` and `project_removed` handlers in `use-projects.ts` already work correctly for all cases once the server emits the events.

6. **Scope is minimal**: The entire server-side fix is localized to `ui/app/api/events/route.ts` (add ~20 lines for the second watcher). The client-side fix is localized to `ui/hooks/use-projects.ts` (add `{ cache: 'no-store' }` to 2 fetch calls). No new files, no new dependencies, no new types.
