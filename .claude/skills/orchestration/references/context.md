# Orchestration System Context

This workspace contains a **document-driven agent orchestration system** built on Copilot's native primitives (custom agents, skills, prompt files, and instruction files). The system takes software projects from idea through planning, execution, and review using 9 specialized agents.

## How It Works

- **Brainstorm an idea**: Use `@brainstormer` to collaboratively explore and refine a project idea before starting the pipeline. This is optional — you can skip straight to `@orchestrator` if you already have a clear idea.
- **Start a project**: Use `@orchestrator` with a project idea. The Orchestrator reads state and spawns specialized agents to advance the pipeline. If a `BRAINSTORMING.md` exists, it uses that as input.
- **Continue a project**: Use `@orchestrator` and ask to continue. It reads `state.json` to determine the next step automatically.
- **Check status**: Use `@orchestrator` and ask for project status. It reads `state.json` to determine the current status.

## Agents

| Agent | Purpose |
|-------|---------|
| `@brainstormer` | Collaboratively brainstorms and refines project ideas — standalone, outside the pipeline |
| `@orchestrator` | Coordinates the pipeline — spawns agents, reads state, asks human questions. **Never writes files.** |
| `@planner` | Authors the lean Requirements ledger and inlined Master Plan via `rad-create-plans` |
| `@coder` | Executes coding tasks from self-contained task handoffs |
| `@coder-junior` | Executes simpler coding tasks with additional guardrails |
| `@coder-senior` | Executes complex coding tasks with expanded autonomy |
| `@reviewer` | Reviews code and phases against planning documents |

## Pipeline

```
Planning Process: Depends on the selected process template for the project.
Execution Process: Depends on the selected process template for the project.
Final:     Comprehensive Review → PR Creation (if auto_pr) → Human Approval → Complete
```

## Key Rules

1. **Start with `@brainstormer` (optional) or `@orchestrator`** — brainstorm ideas first, or go directly to the Orchestrator if you have a clear idea.
2. **The Coder reads ONLY its Task Handoff** — everything it needs is self-contained in that one document.
3. **No agent directly writes `state.json`** — all state mutations performed by the `@orchestrator` agent via the (`pipeline.js`) script.
4. **Human gates** are enforced after planning (Master Plan review) and after final review.
5. **Documents are the interface** — agents communicate through structured markdown files, never through shared state or memory.
6. **PR creation is non-blocking** — when `auto_pr === 'always'`, the pipeline creates a GitHub PR after the comprehensive review and before the human gate. If PR creation fails, the human gate fires without a PR URL. PR failure never blocks the pipeline.

> **Note:** `{orch_root}` is your orchestration root folder — `.claude` by default. Set via `system.orch_root` in `orchestration.yml`. See [Configuration](docs/configuration.md).

## Configuration

System configuration lives in `{orch_root}/skills/orchestration/config/orchestration.yml`. It controls:
- Project storage paths (`projects.base_path`)
- Pipeline limits (max phases, tasks, retries)
- Human gate defaults

## Project Files

Project artifacts are stored in a configurable location set by `orchestration.yml` → `projects.base_path` (supports both relative and absolute paths). Each project gets a subfolder: `{base_path}/{PROJECT-NAME}/`.

Contents:
- Brainstorming: `BRAINSTORMING.md` (optional, created by `@brainstormer`)
- Planning docs: `MASTER-PLAN.md` (inlined phase + task plan written by `@planner`), `REQUIREMENTS.md` (lean project-level ledger written by `@planner`)
- Execution docs: `phases/`, `tasks/`, `reports/`
- State: `state.json`
- Error log: `ERROR-LOG.md` (append-only, created by `@orchestrator` via `log-error` skill)

## Naming Conventions

- **Project files**: `SCREAMING-CASE` with project prefix — `MYAPP-MASTER-PLAN.md`, `MYAPP-TASK-P01-T03-AUTH.md`. See [document-conventions.md](document-conventions.md) for the full set of filename patterns, placement rules, and frontmatter field values.
- **Skills**: lowercase with hyphens — `{orch_root}/skills/rad-create-plans/`
- **Agents**: lowercase with hyphens — `{orch_root}/agents/planner.md`
