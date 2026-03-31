# Monitoring Dashboard

The monitoring dashboard is a Next.js web application that provides real-time visualization of your orchestration pipeline. It displays project status, planning progress, execution phases, and task details in a unified interface, giving you instant insight into what your agents are doing without manually inspecting state files.

![Monitoring Dashboard](../assets/dashboard-screenshot.png)

## Prerequisites

- **Node.js v18+** — required to run the Next.js development server
- **npm** — for installing dashboard dependencies
- A workspace with orchestration projects configured (see [Getting Started](getting-started.md))

## Getting Started

```bash
# Navigate to the dashboard directory
cd ui

# Install dependencies
npm install

# Start the development server
npm run dev
```

The dashboard opens at `http://localhost:3000`.

You can optionally create a `.env.local` file to customize the workspace root:

```
# .env.local (optional — defaults work for standard workspace layout)
WORKSPACE_ROOT=..
```

## Features

### Project Sidebar

Browse all detected projects in the workspace. The sidebar shows each project's name and current status at a glance. Click a project to select it and view its full details in the main panel.

Projects are sorted by pipeline tier: execution first, then review, planning, not_initialized, halted, and complete last.

### Dashboard Overview

Displays pipeline progress, phase/task summary, and key metrics including total phases, completed tasks, and retry counts. The project header shows the project name alongside a pipeline tier badge indicating the current stage.

### Planning Pipeline

Visualizes the planning steps as a checklist: Research → PRD → Design → Architecture → Master Plan. Each step shows its status (complete, in-progress, or not started) and links to the corresponding planning documents.

### Source Control Card

Appears in the Project Detail Panel below the Planning section and above the Execution Drill-Down section. The card surfaces source control context for the project, showing the current branch, auto-commit and auto-PR configuration, and — for active executions — a per-task commit trail.

The branch row displays the branch name from `pipeline.source_control` in `state.json`. When a compare URL is available, the branch name is rendered as a clickable external link that opens in a new tab. When no compare URL is present, the branch name is shown in plain monospace text.

Auto-commit and auto-PR settings are each shown as a badge. When the value is `"always"`, a SpinnerBadge with a colored dot indicator is used; for any other value, an outline badge is displayed instead. When `auto_pr` is `"always"`, a PR placeholder row is also rendered below the badge, indicating that a pull request will be created automatically.

| Badge | Value | Style |
|-------|-------|-------|
| `auto_commit` | `"always"` | SpinnerBadge (dot indicator) |
| `auto_commit` | other | Outline badge |
| `auto_pr` | `"always"` | SpinnerBadge (dot indicator) + PR placeholder row |
| `auto_pr` | other | Outline badge |

In the Execution Drill-Down view, each TaskCard shows a commit link when the task has a recorded commit hash. The link is constructed from the repository remote URL in `pipeline.source_control` and the task's commit hash from its state entry.

All Source Control Card data (including `remote_url` and branch information) is read from `pipeline.source_control` in `state.json`. Per-task commit hashes come from each task's state entry in `execution.phases[n].tasks[n]`.

### Execution Drill-Down

Phase cards with progress bars showing task completion percentages. Individual task cards display status, retry counts, and verdict badges. Cards are expandable to reveal links to handoff, report, and review documents.

### Final Review

For projects that have reached the final review stage, the dashboard displays a Final Review section showing the final review document alongside the approval gate. When the final review is complete, the approval gate button allows a human to approve the project and advance it to the complete state.

### Other Docs

The dashboard lists supplementary project documents that are not part of the standard pipeline slots — such as brainstorming notes and research findings. These appear in an Other Docs section, making them accessible through the document viewer alongside the primary planning and execution documents.

### Not Initialized View

When a project folder is detected in the workspace but contains no `state.json` file, the dashboard displays a "Not Initialized" view in place of the normal project dashboard. This provides a clear signal that the project has not yet been started through the pipeline.

### Malformed State View

When `state.json` exists but fails JSON parsing or schema validation, the dashboard displays a warning badge containing the specific error message. This allows you to identify and fix corrupted state without leaving the dashboard.

### Approve Gate Button

Human gate steps (planning approval and final approval) display an Approve button directly in the dashboard. Clicking the button opens a confirmation dialog before firing the approval event, preventing accidental approvals. Once confirmed, the pipeline advances automatically.

### Gate Error Banner

If a gate approval API call fails, an inline error banner is displayed immediately below the approval button. The banner shows the error message and remains visible until the next successful action or page navigation.

### Document Navigation

The document viewer drawer includes a prev/next navigation footer that lets you move between project documents without closing and reopening the drawer. A position indicator (for example, "2 of 7") shows your current location within the document set.

### Document Viewer

A slide-out drawer that renders any project Markdown document. Shows parsed frontmatter metadata at the top and syntax-highlighted code blocks within the content. Opened by clicking any document link in the dashboard.

### Configuration Viewer

Displays the parsed `orchestration.yml` settings organized by section: projects, pipeline limits, error severity, human gates, and git strategy. Opened from the gear icon in the header.

### Status Indicators

A collection of visual badges and indicators used throughout the dashboard:

| Indicator | Purpose |
|-----------|---------|
| Connection status | Shows connected, reconnecting, or disconnected state |
| Pipeline tier badge | Displays the current pipeline tier (planning, execution, review, complete, halted) |
| Review verdict badge | Shows approved, changes requested, or rejected |
| Severity badge | Indicates error severity level |
| Retry count badge | Displays the number of task retries |
| Lock badge | Marks human gates that require manual approval |
| Warning badge | Highlights items needing attention |
| Stage badge | Shows the current task or phase stage (e.g., planning, coding, reviewing) |
| Gate mode badge | Shows the active execution gate mode (ask, phase, task, autonomous) |

### Theme Support

System, dark, and light mode toggle available in the header. The toggle uses three icons: Monitor for system, Moon for dark, and Sun for light. The dashboard respects your system preference on first visit and persists your choice across sessions.

## Data Sources

The dashboard reads project data directly from the workspace filesystem:

| File | Purpose |
|------|---------|
| `.github/skills/orchestration/config/orchestration.yml` | System configuration — limits, gates, paths |
| `{project}/state.json` | Pipeline state — tiers, phases, tasks, errors |
| `{project}/*.md` | Planning and execution documents rendered in the document viewer |

The dashboard discovers projects by scanning the configured `projects.base_path` directory. See [Configuration](configuration.md) for details.

## Real-Time Updates

The dashboard stays current without manual refreshing:

- The API layer uses **chokidar** to watch `state.json` files for changes
- When a file changes, the server pushes an event via **Server-Sent Events (SSE)** to the browser
- The browser's SSE client (`/api/events` endpoint) receives the event and triggers a state re-fetch
- Supported event types: `connected`, `state_change`, `project_added`, `project_removed`, `heartbeat`
- Reconnection uses exponential backoff (1s → 2s → 4s → ... → 30s max, up to 10 attempts)

## Next Steps

- [Getting Started](getting-started.md) — set up the orchestration system
- [Configuration](configuration.md) — customize `orchestration.yml`
- [Scripts](scripts.md) — CLI scripts the dashboard monitors
- [Pipeline](pipeline.md) — understand the pipeline the dashboard visualizes
- [Project Structure](project-structure.md) — workspace layout overview
