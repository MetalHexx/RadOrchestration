# Getting Started

This guide walks you through setting up the orchestration system and running your first project.

## Prerequisites

- **Node.js v18+** — powers the CLI scripts and validation tool (no `npm install` required)
- **VS Code** with **GitHub Copilot** and agent mode enabled
- A workspace where you want to run orchestrated projects

## Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd orchestration
   ```

2. **Open in VS Code** with GitHub Copilot enabled

3. **Copy into your project** (if using in an existing workspace)

   Copy the `.github/` directory into the root of your target project. It contains all agents, skills, instructions, configuration, and orchestration scripts.

4. **Configure the system**

   Run the `/configure-system` prompt in Copilot. This creates or updates `.github/orchestration.yml` with your preferences — project storage path, pipeline limits, git strategy, and human gate settings.

   Or manually edit `.github/orchestration.yml` — see [Configuration](configuration.md) for all options.

## Your First Project

### Option A: Start with Brainstorming

If you have a rough idea but want to explore it first:

1. Open Copilot chat and invoke `@Brainstormer`
2. Describe your idea — the Brainstormer will ask questions, explore trade-offs, and help you converge on a clear concept
   - Add any other docs or resources to the brainstorming folder as needed — the Brainstormer can read them for context
3. The output is a `BRAINSTORMING.md` document in your project folder
4. Then invoke `@Orchestrator` — it will pick up the brainstorming document and start the planning pipeline and scaffold the project structure
   - You can provide additional instructions or resources to the Orchestrator as needed — it reads the entire project folder for context

### Option B: Start Directly

If you already know what you want to build:

1. Open Copilot chat and invoke `@Orchestrator`
2. Describe your project: *"Build me a REST API for managing inventory with auth, CRUD operations, and a React dashboard"* -- You can do better than that ;)
3. The Orchestrator initializes the project and begins the planning pipeline

### What Happens Next

The Orchestrator automatically sequences agents through the pipeline:

1. **Research** — analyzes your codebase, tech stack, and relevant patterns
2. **Product Manager** — creates a PRD with requirements, user stories, and success metrics
3. **UX Designer** — produces a design document with flows, layouts, and accessibility specs
4. **Architect** — defines system architecture, module structure, API contracts, and interfaces
5. **Architect** — synthesizes everything into a Master Plan with phased execution
6. **Human gate** — you review and approve the Master Plan before any code is written

After approval, execution begins:

7. **Tactical Planner** — breaks each phase into concrete tasks
8. **Coder** — executes tasks from self-contained handoff documents
9. **Reviewer** — reviews code against the plan
10. Loop until all phases are complete, then final review and human approval

> Pro Tip:  Tell it that you want a human gate at the task completion, phase completion or go fully autonomous for the entire project.

## Continuing a Project

To resume a project that's already in progress:

```
@Orchestrator continue the project
```

The Orchestrator reads `state.json` to determine exactly where the pipeline left off and spawns the appropriate agent. The deterministic `pipeline.js` event-driven engine — with its 17-event vocabulary and 19-action output set — ensures consistent routing regardless of how many times you resume.

## Checking Status

```
@Orchestrator what's the project status?
```

The Orchestrator reads `state.json` directly to determine the current project status, or calls `pipeline.js --event start` to get the current state and recommended next action. Every state mutation flows through `pipeline.js`, so `state.json` is always the authoritative source of truth. The `pipeline.current_tier` field identifies the active tier (`planning`, `execution`, or `complete`).

> Recommended: Check out the [UI Status Dashboard](dashboard.md) — it surfaces the current status, recent activity, and next steps based on `state.json` in a human-friendly format and in realtime.

## Running Validation

Validate that all orchestration files are correctly configured:

```bash
node .github/skills/validate-orchestration/scripts/validate-orchestration.js
```

Add `--verbose` for detailed output, or `--category agents` to check a single category. See [Validation](validation.md) for full CLI options.

## Key Commands

| Command | What It Does |
|---------|-------------|
| `@Brainstormer` + idea | Collaboratively explore and refine a project idea |
| `@Orchestrator` + idea | Start a new project through the full pipeline |
| `@Orchestrator` continue | Resume an in-progress project |
| `@Orchestrator` status | Check current project status |
| `/configure-system` | Create or update `orchestration.yml` |
| `/execute-plan` | Approve a Master Plan and begin execution |
| `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` | Validate orchestration files |

## Next Steps

- [Agents](agents.md) — understand the 9 specialized agents and their roles
- [Pipeline](pipeline.md) — learn how the planning and execution pipeline works
- [Configuration](configuration.md) — customize pipeline behavior via `orchestration.yml`
- [Project Structure](project-structure.md) — understand the file layout and naming conventions
- [Skills](skills.md) — explore the 18 skill bundles agents use to produce artifacts
- [Templates](templates.md) — discover the 16 output templates and how to customize them
- [Dashboard](dashboard.md) — monitor project status and manage human gates in the UI
