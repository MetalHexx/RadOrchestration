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

### Dashboard Overview

Displays pipeline progress, phase/task summary, and key metrics including total phases, completed tasks, and retry counts. The project header shows the project name alongside a pipeline tier badge indicating the current stage.

### Planning Pipeline

Visualizes the planning steps as a checklist: Research → PRD → Design → Architecture → Master Plan. Each step shows its status (complete, in-progress, or not started) and links to the corresponding planning documents.

### Execution Drill-Down

Phase cards with progress bars showing task completion percentages. Individual task cards display status, retry counts, and verdict badges. Cards are expandable to reveal links to handoff, report, and review documents.

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

### Theme Support

Light and dark mode toggle available in the header. The dashboard respects your system preference on first visit and persists your choice across sessions.

## Data Sources

The dashboard reads project data directly from the workspace filesystem:

| File | Purpose |
|------|---------|
| `.github/orchestration.yml` | System configuration — limits, gates, paths |
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

## Component Architecture

```
ui/
├── app/
│   ├── page.tsx              # Main page — assembles all top-level components
│   ├── layout.tsx            # Root layout with theme provider
│   └── api/                  # API routes (projects, events, config)
├── components/
│   ├── sidebar/              # Project list, search, selection
│   ├── dashboard/            # Project header, planning section, execution phases
│   ├── planning/             # Planning checklist, error summary
│   ├── execution/            # Phase cards, task cards, progress bars
│   ├── documents/            # Document drawer, markdown renderer
│   ├── config/               # Config drawer, config sections
│   ├── badges/               # Status indicators (tier, verdict, severity, connection)
│   ├── layout/               # App header, main dashboard shell
│   └── theme/                # Theme toggle (light/dark)
├── hooks/                    # Custom React hooks (useProjects, useSSE, useTheme, etc.)
├── types/                    # TypeScript type definitions
└── lib/                      # Utilities (path resolver, markdown parser, YAML parser)
```

## Next Steps

- [Getting Started](getting-started.md) — set up the orchestration system
- [Configuration](configuration.md) — customize `orchestration.yml`
- [Scripts](scripts.md) — CLI scripts the dashboard monitors
- [Pipeline](pipeline.md) — understand the pipeline the dashboard visualizes
- [Project Structure](project-structure.md) — workspace layout overview
