---
project: "UI-LIVE-PROJECTS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Design

## Design Overview

This project delivers purely behavioral improvements to the existing sidebar experience — no new screens, components, or visual changes are introduced. The user's experience changes in exactly three ways: new project folders appear in the sidebar automatically within 500 ms, deleted project folders disappear automatically within 500 ms, and a manual page refresh always returns current data. All changes are transparent to the user; the sidebar continues to look and behave identically to today, it simply stays accurate without any user intervention.

---

## User Flows

### Flow 1 — New project appears automatically (Goal 1 / US-1, US-4)

```
User (or pipeline agent) creates a project directory on disk
  → SSE server detects directory creation (addDir event, ≤ 500 ms)
  → SSE server debounces 300 ms then emits project_added { projectName }
  → Client receives project_added event
  → Client re-fetches /api/projects with cache: 'no-store'
  → discoverProjects() reads the new directory; returns hasState: false, tier: not_initialized
  → Sidebar renders the new project entry (not_initialized tier badge)
  → User sees the new project in the sidebar — no action required
```

**If `state.json` appears within 300 ms of directory creation**: The debounce timer resets on the second event (both keyed by `projectName`). Only one `project_added` is emitted and one re-fetch is triggered. The re-fetch reads both the directory AND the state file, so the project appears with its correct tier immediately.

---

### Flow 2 — Manual refresh always shows current projects (Goal 2 / US-3)

```
SSE connection is live but user manually refreshes the browser
  → Browser fetches /api/projects with cache: 'no-store' (no stale cache hit)
  → Server calls discoverProjects() — live filesystem read, no server-side cache
  → Response reflects current directories on disk
  → Sidebar renders the accurate current project list
  → User sees up-to-date project list
```

---

### Flow 3 — Deleted project disappears automatically (Goal 3 / US-2)

**Sub-flow A — Project has no `state.json` (brainstorming-only)**:

```
User deletes project directory (no state.json inside)
  → SSE server detects directory removal (unlinkDir event, ≤ 500 ms)
  → SSE server debounces 300 ms then emits project_removed { projectName }
  → Client receives project_removed event
  → Client removes project from local state in-memory (no re-fetch)
  → Sidebar removes the project entry
  → User sees project is gone — no action required
```

**Sub-flow B — Project has a `state.json`**:

```
User deletes project directory (state.json inside)
  → OS fires unlink (state.json) and unlinkDir (directory) in rapid succession
  → Both handlers call debouncedEmit(projectName, ...) — second call resets timer
  → Debounce coalesces to a single project_removed { projectName }
  → Client removes project from local state in-memory
  → Sidebar removes the project entry
```

---

## Layout & Components

### Sidebar — Project List (existing, no changes)

**Breakpoints**: Desktop (≥1024px) | Tablet (≥768px) | Mobile (<768px)

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Sidebar | `ProjectList` | — | Existing component; no changes |
| Sidebar item | `ProjectEntry` | — | Existing component; no changes |
| Sidebar item badge | `PipelineTierBadge` | — | Existing; `not_initialized` tier already supported |

### New Components

None. This project introduces no new components.

---

## State Transitions

### Project entry — sidebar states

The sidebar already handles all required states. The behavioral fix ensures these transitions fire automatically rather than requiring a rebuild.

| Trigger | Before Fix | After Fix | Sidebar State |
|---------|------------|-----------|---------------|
| New directory created (no `state.json`) | No change until rebuild | Auto-appears within 500 ms | `not_initialized` tier badge |
| `state.json` created after directory | No change until rebuild | Auto-appears or updates within 500 ms | Correct tier from state file |
| Directory deleted (no `state.json`) | No change until rebuild | Disappears within 500 ms | Entry removed |
| Directory deleted (has `state.json`) | No change until rebuild | Disappears within 500 ms | Entry removed |
| Manual page refresh | May show stale list | Always shows current list | Accurate current state |

### `not_initialized` tier — confirmed rendering

`discoverProjects()` already returns `{ hasState: false, tier: 'not_initialized' }` for directories without a `state.json`. `ProjectSummary` already supports `hasState: false`. `PipelineTierBadge` already renders `not_initialized`. **No new states or badge variants are needed.**

---

## Edge Case Behavior

### Rapid create-then-delete (directory created and deleted within debounce window)

| Scenario | OS events | Debounce result | Client result |
|----------|-----------|-----------------|---------------|
| Directory created at T=0, deleted at T=150 ms (before 300 ms debounce expires) | `addDir` → `unlinkDir` | `debouncedEmit` called twice with same key; second call resets timer. After 300 ms quiet: only the `project_removed` callback runs | Project never visibly appears in the sidebar — correct behavior |
| Directory created at T=0, deleted at T=400 ms (after debounce fires) | `addDir` then (separate debounce) `unlinkDir` | `project_added` fires at T=300 ms, `project_removed` fires at T=700 ms | Project briefly appears then disappears — acceptable; sidebar remains accurate |

> **Note**: The debounce key is `projectName`. When `addDir` and `unlinkDir` fire within 300 ms for the same project, the debounce map ensures only the last-registered callback fires. The client never receives a dangling `project_added` for a project that no longer exists.

### SSE disconnection

| Scenario | Behavior | User impact |
|----------|----------|-------------|
| SSE connection drops (network, server restart) | `use-sse.ts` exponential backoff reconnects (1 s → 2 s → … → 30 s max, 10 attempts) | Sidebar does not update during disconnect; existing entries remain visible |
| SSE reconnects | Server emits `connected { projects: [...] }` with current directory list | Client re-fetches `/api/projects`; sidebar is corrected to current state |
| SSE exhausts reconnect attempts | No further attempts; sidebar frozen at last known state | User must manually refresh to recover accuracy |

> The SSE disconnection behavior is unchanged from today. No new handling is introduced.

### Multiple rapid directory creations (event storm)

| Scenario | Behavior |
|----------|----------|
| N directories created in rapid succession (e.g., pipeline creates 5 projects at once) | Each directory produces its own `addDir` event with a distinct `projectName` key. Debounce is per-project. All N `project_added` events fire (one per project) after the debounce window. All N projects appear in the sidebar. |

### Watcher not firing on first connection

The directory-level watcher uses `ignoreInitial: true`. On SSE connection open, the `connected` event payload already includes all current directories via `readdir`. The directory watcher only fires for changes **after** connection — no duplicate `project_added` events for pre-existing projects on reconnect.

---

## Design Tokens Used

No new design tokens. This project modifies behavior only; all visual treatments remain unchanged.

| Token | Usage | Source |
|-------|-------|--------|
| *(none new)* | — | — |

---

## States & Interactions

| Component | State | Visual Treatment | Changed? |
|-----------|-------|-----------------|----------|
| `PipelineTierBadge` | `not_initialized` | Existing rendering (muted/neutral style) | No — already implemented |
| Sidebar project entry | Appearing | Renders normally when added to list | No — list re-render handles this |
| Sidebar project entry | Disappearing | Removed from list on `project_removed` | No — existing in-memory removal |

---

## Accessibility

No accessibility regressions. The sidebar DOM structure, ARIA roles, focus management, and keyboard navigation are unchanged.

| Requirement | Status |
|-------------|--------|
| Keyboard navigation | Unchanged — no new interactive elements |
| Screen reader | Unchanged — no new ARIA regions or roles; project list updates via React state re-render which screen readers detect via DOM mutation |
| Color contrast | Unchanged — no new colors or tokens |
| Focus indicators | Unchanged — no new focusable elements |
| Live region for sidebar updates | Not required — sidebar project list is not a live region today and this fix does not change that. Screen reader users can navigate the list after it updates. |

---

## Responsive Behavior

No responsive changes. The sidebar layout is unchanged at all breakpoints.

| Breakpoint | Layout Change |
|-----------|--------------|
| Desktop (≥1024px) | None |
| Tablet (≥768px) | None |
| Mobile (<768px) | None |

---

## Design System Additions

None. No new design tokens, component variants, or design system entries are required for this project.
