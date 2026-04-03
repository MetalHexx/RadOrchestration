# Getting Started

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

This guide covers prerequisites, installation, and next steps for the orchestration system.

## Prerequisites

- **Node.js v18+** — required for the installer, CLI scripts, and validation
- **VS Code** with **GitHub Copilot** and agent mode enabled
- A workspace directory where you want to install the orchestration system

## Installation

The interactive installer sets up the orchestration system in one step — no clone or repository setup required:

```bash
npx rad-orchestration
```

The installer walks you through configuration options including AI tool selection, workspace directory, pipeline limits, gate behavior, and an optional dashboard.

See [Configuration](configuration.md) for details on each option.

Alternatively, install globally and run from any project directory:

```bash
npm install -g rad-orchestration
radorch
```

## Next Steps

Once installed, explore these resources to start building:

- [Guides](guides.md) — step-by-step walkthroughs for planning and executing projects
- [Pipeline](pipeline.md) — learn how the planning and execution pipeline works
- [Agents](agents.md) — understand the specialized agents and their roles
- [Configuration](configuration.md) — customize pipeline behavior via `orchestration.yml`

