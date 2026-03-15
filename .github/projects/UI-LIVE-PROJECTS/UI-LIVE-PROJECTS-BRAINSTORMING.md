---
project: "UI-LIVE-PROJECTS"
author: "brainstormer-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Brainstorming

## Problem Space

The monitoring UI currently requires a full rebuild (`next build`) to pick up newly created project folders. This creates friction for users running the pipeline — every new project they start means stopping, rebuilding, and restarting the UI. The app already has a real-time SSE infrastructure, so the gap is that new project directories (created without a `state.json` yet) are invisible to the existing file watcher, and page refreshes may also get a cached result.

## Validated Goals

### Goal 1: Show new projects without a page refresh

**Description**: When a new project folder is created under the configured `projects.base_path`, it should appear in the sidebar automatically — no rebuild, no manual refresh.
**Rationale**: The SSE infrastructure already handles live `state.json` changes; new folder creation should be treated the same way.
**Key considerations**: Projects may be created with just a directory (no `state.json` yet), so the watcher must detect directory creation, not just file creation.

### Goal 2: Show new projects on page refresh (no rebuild required)

**Description**: If the user does manually refresh the browser, the `/api/projects` response should always reflect the current filesystem — never a stale build-time snapshot.
**Rationale**: The API routes already have `export const dynamic = 'force-dynamic'`, but client-side fetch caching may still serve stale data.
**Key considerations**: Need to audit whether the issue is Next.js route caching, browser fetch caching, or both.

### Goal 3: Remove projects from the sidebar when their folder is deleted

**Description**: If a project folder is removed, it should disappear from the sidebar in real time (or on refresh).
**Rationale**: Symmetry with Goal 1 — the watcher should handle removals as well as additions.
**Key considerations**: Currently only `state.json` unlink events fire `project_removed`; removing the whole directory is not detected.

## Scope Boundaries

### In Scope
- Filesystem watching for new/removed project directories in the SSE route
- Ensuring `/api/projects` fetch calls bypass any client or server cache
- Projects with no `state.json` (brainstorming-only folders) appearing in the sidebar

### Out of Scope
- Changes to how `state.json` changes are watched (already works)
- Polling fallback if SSE is unavailable
- Supporting project folders outside the configured `base_path`
- UI changes to how projects are rendered in the sidebar

## Key Constraints

- Must work in both `next dev` and `next build && next start` modes
- The existing chokidar dependency is already in use — should be leveraged rather than adding a new watcher library
- Must clean up any new watchers on SSE disconnect to avoid resource leaks
- `force-dynamic` is already set on all relevant API routes

## Open Questions

- Is the stale-data-on-refresh problem caused by Next.js route cache, browser `fetch` cache, or both? Needs verification before assuming a fix.
- Should projects with no `state.json` be visually distinguished in the sidebar (e.g., a "not initialized" badge)?
- What is the correct debounce strategy when a directory is created and a `state.json` is added within milliseconds — should both `addDir` and `add` events fire, or should one suppress the other?

## Summary

The UI only detects new projects when a `state.json` appears or changes, leaving directory-only projects (common at the brainstorming stage) invisible until a rebuild. The fix requires two targeted changes: (1) adding a shallow `chokidar` watcher on the projects directory to emit `project_added`/`project_removed` SSE events when folders appear or disappear, and (2) ensuring page refreshes always fetch fresh data from the filesystem. Both changes are additive and do not affect existing state-change watching behavior.
