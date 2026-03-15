---
project: "ORCHESTRATION-REORG"
phase: 4
task: 4
title: "Create docs/dashboard.md"
status: "pending"
skills_required: ["file-creation"]
skills_optional: []
estimated_files: 1
---

# Create docs/dashboard.md

## Objective

Create a new documentation page at `docs/dashboard.md` for the monitoring dashboard. The page must contain all 10 required sections (title, intro, screenshot, prerequisites, getting started, features, data sources, real-time updates, component architecture, next steps) and follow the structural conventions of existing docs pages.

## Context

The workspace includes a Next.js monitoring dashboard under `ui/` that provides real-time project status visualization. No documentation page for it exists yet. Existing docs pages (`docs/scripts.md`, `docs/getting-started.md`) use a consistent structure: single `#` title, intro paragraph without heading, `##` major sections, `###` subsections, code blocks with language hints, and tables for reference information. The screenshot path `../assets/dashboard-screenshot.png` will not resolve until Phase 5 creates the asset — this is expected.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `docs/dashboard.md` | New documentation page — all 10 sections per spec below |

## Implementation Steps

1. Create the file `docs/dashboard.md`.
2. Write the `# Monitoring Dashboard` title (section 1).
3. Write a 2–3 sentence intro paragraph (no heading) describing what the dashboard is, what it shows, and why it exists (section 2).
4. Add the screenshot image reference: `![Monitoring Dashboard](../assets/dashboard-screenshot.png)` (section 3).
5. Write `## Prerequisites` section listing Node.js v18+, npm, and a workspace with orchestration projects configured (section 4).
6. Write `## Getting Started` section with startup commands and `.env.local` setup (section 5) — see inline spec below.
7. Write `## Features` section with 8 subsections (section 6) — see inline spec below.
8. Write `## Data Sources` section explaining what files the dashboard reads (section 7) — see inline spec below.
9. Write `## Real-Time Updates` section explaining SSE + chokidar (section 8) — see inline spec below.
10. Write `## Component Architecture` section with high-level component map (section 9) and `## Next Steps` with links (section 10) — see inline specs below.

## Contracts & Interfaces

No code interfaces — this is a documentation-only task. The file must be valid Markdown.

## Styles & Design Tokens

Follow the structural conventions of existing docs pages:

- **Title**: Single `#` heading — `# Monitoring Dashboard`
- **Intro**: Plain paragraph immediately after title, no heading
- **Major sections**: `##` headings
- **Subsections**: `###` headings
- **Shell commands**: Fenced code blocks with `bash` language hint and inline comments
- **Reference data**: Tables with `|` delimiters
- **Internal links**: Relative paths to sibling docs (e.g., `[Scripts](scripts.md)`, `[Getting Started](getting-started.md)`)
- **Image references**: Relative path from `docs/` to root: `../assets/dashboard-screenshot.png`

## Inline Content Specifications

### Section 5 — Getting Started

```bash
# Navigate to the dashboard directory
cd ui

# Install dependencies
npm install

# Start the development server
npm run dev
```

Include a note about optional `.env.local` configuration:

```
# .env.local (optional — defaults work for standard workspace layout)
WORKSPACE_ROOT=..
```

State the dashboard opens at `http://localhost:3000`.

### Section 6 — Features (8 subsections)

Each as a `###` subsection under `## Features`:

| Subsection Title | Content to Cover |
|-----------------|-----------------|
| `### Project Sidebar` | Browse all detected projects in the workspace; shows project name and status at a glance; click to select and view details |
| `### Dashboard Overview` | Pipeline progress, phase/task summary, key metrics (total phases, completed tasks, retry counts); project header with pipeline tier badge |
| `### Planning Pipeline` | Visualizes planning steps as a checklist: Research → PRD → Design → Architecture → Master Plan; shows step status (complete, in-progress, not started); links to planning documents |
| `### Execution Drill-Down` | Phase cards with progress bars showing task completion; individual task cards with status, retries, verdict badges; expandable to view handoff/report/review document links |
| `### Document Viewer` | Slide-out drawer that renders any project Markdown document; shows parsed frontmatter metadata; syntax-highlighted code blocks; opened by clicking any document link in the dashboard |
| `### Configuration Viewer` | Displays parsed `orchestration.yml` settings; organized by section (projects, pipeline limits, error severity, human gates, git strategy); opened from the header gear icon |
| `### Status Indicators` | Connection status indicator (connected/reconnecting/disconnected); pipeline tier badges; review verdict badges (approved/changes requested/rejected); severity badges; retry count badges; lock badges for human gates; warning badges |
| `### Theme Support` | Light and dark mode toggle in the header; respects system preference; persists choice across sessions |

### Section 7 — Data Sources

Explain what files the dashboard reads using a table:

| File | Purpose |
|------|---------|
| `.github/orchestration.yml` | System configuration — limits, gates, paths |
| `{project}/state.json` | Pipeline state — tiers, phases, tasks, errors |
| `{project}/*.md` | Planning and execution documents rendered in the document viewer |

State that the dashboard discovers projects by scanning the configured `projects.base_path` directory (default: `.github/projects/`).

### Section 8 — Real-Time Updates

Explain the mechanism:
- The API layer uses **chokidar** to watch `state.json` files for changes
- When a file changes, the server pushes an event via **Server-Sent Events (SSE)** to the browser
- The browser's SSE client (`/api/events` endpoint) receives the event and triggers a state re-fetch
- Supported event types: `connected`, `state_change`, `project_added`, `project_removed`, `heartbeat`
- Reconnection uses exponential backoff (1s → 2s → 4s → ... → 30s max, up to 10 attempts)

### Section 9 — Component Architecture

Provide a high-level component map:

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

### Section 10 — Next Steps

Provide links to related documentation:

- [Getting Started](getting-started.md) — set up the orchestration system
- [Configuration](configuration.md) — customize `orchestration.yml`
- [Scripts](scripts.md) — CLI scripts the dashboard monitors
- [Pipeline](pipeline.md) — understand the pipeline the dashboard visualizes
- [Project Structure](project-structure.md) — workspace layout overview

## Test Requirements

- [ ] `docs/dashboard.md` exists and is valid Markdown
- [ ] File contains exactly one `# Monitoring Dashboard` title
- [ ] All 10 sections are present (title, intro, screenshot, prerequisites, getting started, features, data sources, real-time updates, component architecture, next steps)
- [ ] All 8 feature subsections are present under `## Features`
- [ ] Screenshot image reference is `![Monitoring Dashboard](../assets/dashboard-screenshot.png)`
- [ ] Getting Started includes `cd ui && npm install && npm run dev`
- [ ] Links to other docs use relative paths (e.g., `getting-started.md`, not absolute paths)

## Acceptance Criteria

- [ ] `docs/dashboard.md` exists at the correct path
- [ ] File contains all 10 required sections per the spec above
- [ ] All 8 feature subsections exist under `## Features`
- [ ] Structural conventions match existing docs pages (`#` title, `##` sections, `###` subsections, fenced code blocks with language hints, tables)
- [ ] Screenshot reference uses `../assets/dashboard-screenshot.png`
- [ ] Internal links use correct relative paths to sibling docs
- [ ] No references to external planning documents (PRD, Design, Architecture)
- [ ] File renders correctly in Markdown preview

## Constraints

- Do NOT create the screenshot image itself — `assets/dashboard-screenshot.png` is created in Phase 5
- Do NOT modify any existing documentation files — this task creates only `docs/dashboard.md`
- Do NOT reference internal project documents (PRD, Design, Architecture) in the content
- Do NOT use absolute paths for links or images — all references must be relative
- Do NOT add the dashboard to `README.md` — that is T05's scope
