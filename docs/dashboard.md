# Dashboard

The orchestration dashboard provides a real-time view of project progress,
pipeline status, and task details in a unified web interface. It gives you
instant insight into what your agents are doing across all projects in the
workspace.

<img width="1557" height="1188" alt="image" src="https://github.com/user-attachments/assets/462d76eb-8a61-4822-9d8d-30f58d52b1b8" />

## Getting Started

See [Getting Started](getting-started.md) for prerequisites and initial
setup.

To launch the dashboard:

```bash
cd ui
npm run dev
```

The dashboard opens at `http://localhost:3000`.

## Features

### Project Overview

The sidebar lists all detected projects in the workspace along with their
current status. Select a project to view its full details in the main panel,
including phase progress, task breakdown, and key metrics. Each project
displays its pipeline stage so you can see at a glance which projects are
in planning, execution, review, or complete.

### Pipeline Progress

The dashboard visualizes progress through the planning and execution stages
of the pipeline. Planning steps appear as a checklist from research through
master plan, showing which steps are complete, in progress, or not yet
started. Execution phases display task completion with progress indicators.
Expandable task cards link to the corresponding handoff, report, and review
documents.

### Source Control Status

Each project displays its current branch, commit history, and pull request
status at a glance. During active execution, the dashboard shows a per-task
commit trail so you can track exactly which changes each task introduced.
Auto-commit and auto-PR settings are visible alongside the branch
information.  Full branch diffs can be seen by clicking on the branch name.
Once the project execution completes, a link to the opened PR becomes available
for each access.

### Configuration

Open the configuration viewer from the gear icon in the header to review and edit
system settings. Settings cover project paths,pipeline limits, human gates, and git 
strategy. See [Configuration](configuration.md) for details on available options for
customizing the pipeline behaviors.

### Real-Time Updates

The dashboard updates automatically as the pipeline advances. When project
state changes — new tasks completing, phases progressing, or projects being
added — the interface refreshes without any manual action. Connection status
is visible in the header so you always know the dashboard is up to date.

## Next Steps

- [Getting Started](getting-started.md) — installation and setup
- [Pipeline](pipeline.md) — understand pipeline stages shown in the dashboard
- [Configuration](configuration.md) — configure system behavior
