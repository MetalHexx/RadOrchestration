---
project: "MONITORING-UI"
author: "brainstormer-agent"
created: "2026-03-09T00:00:00Z"
---

# MONITORING-UI — Brainstorming

## Problem Space

The orchestration system produces rich structured state (`state.json`, `STATUS.md`) as projects move through the pipeline, but there is no visual interface to monitor that state in real time. Developers and professional colleagues currently must read raw JSON and markdown files to understand what a project is doing. A purpose-built monitoring UI would make project status immediately readable, scannable, and shareable — without any changes to the underlying orchestration system.

## Validated Ideas

### Idea 1: Real-Time Project Dashboard

**Description**: A primary view that renders the equivalent of `STATUS.md` as a live, visual dashboard — pipeline tier badge, planning step checklist, per-phase task progress with individual task statuses, error log, and gate history. The page updates automatically as files change on disk, with no manual refresh required.

**Rationale**: The `STATUS.md` template already defines exactly what information matters at a glance. Translating it into a structured UI with status icons, progress bars, and color-coded badges makes it immediately consumable for colleagues unfamiliar with the raw files.

**Key considerations**: Must read directly from `state.json` — the authoritative source — rather than `STATUS.md` prose, for structured, reliable rendering. The dashboard is read-only; no state mutations through the UI.

### Idea 2: Project Switcher Sidebar

**Description**: A sidebar that enumerates all project folders found under `projects.base_path` (read from `orchestration.yml`). Each project entry shows its name and a pipeline tier badge (`planning`, `execution`, `halted`, `complete`) derived from its `state.json`. Selecting a project loads its dashboard.

**Rationale**: The orchestration system is designed to manage multiple concurrent projects. The UI should reflect that multi-project reality from the start, even though the initial scope is single-workspace. Navigating between projects should be instant and require no configuration.

**Key considerations**: The base path is sourced from `orchestration.yml` at the workspace root. Projects without a `state.json` (e.g., brainstorming-only folders) should still appear but with a neutral "not started" state.

### Idea 3: Real-Time File Watching via SSE + chokidar

**Description**: A Next.js API route establishes an SSE stream with the client. On the server, `chokidar` watches the entire `projects/` directory tree for changes to `state.json` files. When a file changes, the server reads the updated file and pushes a structured event to the connected client. The client React state updates immediately — no polling, no WebSocket upgrade complexity.

**Rationale**: SSE is the right primitive for this data flow — it is unidirectional (server→client), works over plain HTTP, requires no special protocol, and is natively supported in all modern browsers. The orchestration pipeline writes files sequentially, so file-change events are the ideal trigger for UI updates.

**Key considerations**: chokidar's `persistent: true` mode keeps the watcher alive for the lifetime of the SSE connection. The Next.js API route must handle client disconnect to clean up the watcher and prevent memory leaks. During active pipeline execution, writes are infrequent enough that SSE push has negligible overhead.

### Idea 4: Inline Document Viewer

**Description**: Any document path referenced in `state.json` — task handoffs, code reviews, phase reports, PRDs, architecture docs — is rendered as a link in the dashboard. Clicking opens the document rendered as formatted markdown in a drawer or modal panel, without leaving the dashboard view.

**Rationale**: The orchestration system's artifacts are structured markdown. Providing a quick in-app viewer removes the need to navigate the filesystem or open a separate editor just to read a report or handoff. It keeps the workflow inside one interface.

**Key considerations**: Documents are read-only. The viewer renders markdown only — no editing capability. Paths are resolved relative to the project folder. Missing documents (e.g., a `report_doc: null` field) simply render as disabled links.

### Idea 5: `orchestration.yml` Viewer

**Description**: A dedicated read-only pane that displays the parsed contents of `orchestration.yml` in a structured, human-readable format — project storage path, pipeline limits, error severity classifications, git strategy, and human gate settings. Presented as a clean settings summary, not a raw YAML dump.

**Rationale**: Colleagues browsing the UI may want to understand how the pipeline is configured without reading raw YAML. A structured view of the configuration provides useful context alongside the project dashboards.

**Key considerations**: Read-only. No editing capability in this scope. Updated on page load or when the file changes on disk.

## Scope Boundaries

### In Scope
- Next.js App Router application, source in `/ui` at the workspace root
- Server-Sent Events stream with `chokidar` for real-time `state.json` change detection
- Project switcher sidebar listing all projects under `projects.base_path`
- Per-project dashboard rendering pipeline tier, planning steps, phase/task progress, error log, gate history
- Inline markdown document viewer for all docs linked from `state.json`
- Read-only `orchestration.yml` configuration viewer
- Beautiful, professional UI using `shadcn/ui` and Tailwind CSS
- Local development only (`localhost`)

### Out of Scope
- Writing to `state.json`, `STATUS.md`, or any orchestration file
- Editing `orchestration.yml` through the UI
- Approving human gates through the UI
- Multi-workspace or remote deployment support
- Authentication or access control
- Mobile-responsive layout (desktop-first is sufficient)
- Any integration with the GitHub Copilot agent system

## Key Constraints

- **Read-only**: The UI is a passive observer — it reads files, never writes them. Zero risk of corrupting orchestration state.
- **Single workspace**: The app is configured against one workspace root, identified at startup (e.g., via an environment variable or config file in `/ui`).
- **No external services**: All data comes from the local filesystem. No database, no cloud API, no auth service.
- **Next.js App Router**: Server Components handle file reads; API Routes handle the SSE stream. Aligns with the modern Next.js architecture and gives colleagues a familiar, well-documented stack.
- **Zero impact on orchestration system**: The UI is entirely additive. The existing `.github/` structure, agents, scripts, and state management are untouched.

## Open Questions

- Should the workspace root be configured via a `.env.local` variable (e.g., `WORKSPACE_ROOT=c:\dev\orchestration\v3`), or should the app always run from the workspace root and resolve paths relatively?
- What is the desired behavior when a project's `state.json` is malformed or missing required fields — show a degraded card, or hide the project entirely?
- Should the document viewer support rendering mermaid diagrams found in architecture and pipeline docs, or plain markdown only for now?
- Is there a preference for light mode, dark mode, or a system-preference toggle at launch?

## Summary

MONITORING-UI is a locally-run Next.js dashboard that gives developers and colleagues a real-time, read-only visual window into the orchestration system's project state. It watches the filesystem with `chokidar` and pushes updates to the browser via Server-Sent Events, rendering `state.json` data as a polished project dashboard with a project switcher sidebar, phase/task progress views, inline document viewer, and configuration summary. The stack is Next.js App Router with `shadcn/ui` and Tailwind — professional, maintainable, and immediately recognizable to any modern web developer.
