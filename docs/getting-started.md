# Getting Started

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

This guide walks you through setting up the orchestration system and running your first project.

## Prerequisites

- **Node.js v18+** — required for the installer, CLI scripts, and validation
- **VS Code** with **GitHub Copilot** and agent mode enabled
- A workspace directory where you want to install the orchestration system

## Installation

There are two ways to install the orchestration system. The interactive installer is recommended — it walks you through all configuration options and sets everything up in one step. Manual installation is available as an alternative.

### Using the Installer (Recommended)

Run the installer directly — no clone or repository setup required:

```bash
npx rad-orchestration
```

This launches an interactive wizard with 6 configuration sections.

Alternatively, install globally and run from any project directory:

```bash
npm install -g rad-orchestration
radorch
```

#### Getting Started

Select your AI coding tool and the target workspace directory.

- **AI tool**: Choose GitHub Copilot. _(Cursor and Claude Code are shown as "coming soon.")_
- **Target workspace**: The directory where orchestration files will be installed. 
> Note: The orchestration system installs as a set of skill files into the target workspace, so it lives alongside your project code.

#### Orchestration Root

Choose the root folder inside your workspace where orchestration files will live:

| Option | Description |
|--------|-------------|
| `.github` (default) | Standard location for VS Code and GitHub tooling |
| `.agents` | Alternative configuration root |
| Custom | Enter any valid folder name |

#### Project Storage

Configure where project folders are created and how they are named:

- **Storage path**: The base directory for all project folders (default: `orchestration-projects`)
- **Naming convention**:
  - `SCREAMING_CASE` (default) — e.g. `MY-PROJECT`
  - `lowercase` — e.g. `my-project`
  - `numbered` — sequential numbering

#### Pipeline Limits

Set scope guards for the pipeline:

| Setting | Default | Description |
|---------|---------|-------------|
| Max phases per project | 10 | Upper bound on phases in any single project |
| Max tasks per phase | 8 | Maximum tasks the planner can create in a phase |
| Max retries per task | 2 | How many times a failed task can be retried |
| Max consecutive review rejections | 3 | Rejections before the pipeline halts for human review |

#### Gate Behavior

Choose how much human oversight you want during execution:

| Mode | Description |
|------|-------------|
| `ask` (default) | Prompt for approval before each plan execution begins |
| `phase` | Gate between phases |
| `task` | Gate between every task |
| `autonomous` | Fully automated — no gates |

#### Dashboard UI

Optionally install the real-time monitoring dashboard.

- **Install dashboard?**: Defaults to `Yes`. Answer `No` to skip the dashboard.
- **Installation directory**: Where the dashboard files go (default: `{workspace}/ui`).

When enabled, the installer copies the dashboard source files, runs `npm install`, and builds the application. If the build fails, core orchestration installation still succeeds — the installer shows the specific retry command to run manually.

### Alternative: Manual Installation

1. **Copy the orchestration files into your project**

   Copy the `.github/` directory _(or your [configured root](configuration.md))_ into the root of your target project. It contains all agents, skills, instructions, configuration, and orchestration scripts.

2. **Open in VS Code** with GitHub Copilot enabled

3. **Configure the system**

   Run the `/configure-system` prompt in Copilot. This creates or updates `.github/skills/orchestration/config/orchestration.yml` _(or your [configured root](configuration.md))_ with your preferences — project storage path, pipeline limits, and human gate settings.

   Or manually edit `.github/skills/orchestration/config/orchestration.yml` — see [Configuration](configuration.md) for all options.

## Your First Project

### Option A: Start with Brainstorming

If you have a rough idea but want to explore it first:

1. Open Copilot chat and select the `Brainstormer` agent
2. Describe your idea — the Brainstormer will ask questions, explore trade-offs, and help you converge on a clear concept
   - Add any other docs or resources to the brainstorming folder as needed — the Brainstormer can read them for context
3. The output is a `<PROJECT-NAME>-BRAINSTORMING.md` document in your project folder
4. Then type `/rad-plan` in Copilot Chat — it picks up the brainstorming document and runs the full planning pipeline (Research → PRD → Design → Architecture → Master Plan)
   - You can provide additional context or instructions alongside `/rad-plan` as needed

### Option B: Start Directly

If you already know what you want to build:

1. Open Copilot Chat and type `/rad-plan` with a description of your project:
   ```
   /rad-plan Build a REST API for managing inventory with auth, CRUD operations, and a React dashboard
   ```
2. The Orchestrator runs the full planning pipeline (Research → PRD → Design → Architecture → Master Plan)

### Add Additonal Documents as Planning Input
As with all agent systems, you can provide anything else you need to the planning step.  This includes other documents, code references, images, etc.  The Brainstormer / Brainstorm documents are optional.

### What Happens Next

The Orchestrator automatically sequences agents through the pipeline:

1. **Research** — analyzes your codebase, tech stack, and relevant patterns
2. **Product Manager** — creates a PRD with requirements, user stories, and success metrics
3. **UX Designer** — produces a design document with flows, layouts, and accessibility specs
4. **Architect** — defines system architecture, module structure, API contracts, and interfaces
5. **Architect** — synthesizes everything into a Master Plan with phased execution
6. **Human gate** — you review and approve the Master Plan before any code is written

After approval, type `/rad-execute` to begin the execution pipeline:

7. **Tactical Planner** — breaks each phase into concrete tasks
8. **Coder** — executes tasks from self-contained handoff documents
9. **Reviewer** — reviews code against the plan
10. Loop until all phases are complete, then final review and human approval

> Pro Tip:  Tell it that you want a human gate at the task completion, phase completion or go fully autonomous for the entire project.

## Continuing a Project

After Master Plan approval, type `/rad-execute` to begin execution. You can also use it to resume a project that's already in progress:

```
/rad-execute
```

Or use the `Orchestrator` agent directly:

```
@orchestrator continue the project
```

## Checking Status

```
Just ask the orchestrator. :)
```

> Recommended:  Check out the [UI Status Dashboard](dashboard.md) — it surfaces the current status, recent activity, and next steps based in a human-friendly format and in realtime.


## Next Steps

- [Agents](agents.md) — understand the 9 specialized agents and their roles
- [Pipeline](pipeline.md) — learn how the planning and execution pipeline works
- [Configuration](configuration.md) — customize pipeline behavior via `orchestration.yml`
- [Project Structure](project-structure.md) — understand the file layout and naming conventions
- [Skills](skills.md) — explore the 18 skill bundles agents use to produce artifacts
- [Templates](templates.md) — discover the 16 output templates and how to customize them
- [Dashboard](dashboard.md) — monitor project status and manage human gates in the UI
