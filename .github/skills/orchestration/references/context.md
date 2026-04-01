# Orchestration System Context

This workspace contains a **document-driven agent orchestration system** built on Copilot's native primitives (custom agents, skills, prompt files, and instruction files). The system takes software projects from idea through planning, execution, and review using 12 specialized agents.

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
| `@research` | Explores codebase and external sources to gather context |
| `@product-manager` | Creates PRDs from research findings |
| `@ux-designer` | Creates design documents from PRDs |
| `@architect` | Creates architecture docs and master plans |
| `@tactical-planner` | Breaks phases into tasks, creates task handoffs, generates phase reports |
| `@coder` | Executes coding tasks from self-contained task handoffs |
| `@coder-junior` | Executes simpler coding tasks with additional guardrails |
| `@coder-senior` | Executes complex coding tasks with expanded autonomy |
| `@reviewer` | Reviews code and phases against planning documents |

## Pipeline

```
Planning:  Brainstorming (optional) → Research → PRD → Design → Architecture → Master Plan → Human Approval
Execution: Phase Plan → Task Handoffs → Code → Review → (correction loop) → Phase Review → (next / correction loop)
Final:     Comprehensive Review → PR Creation (if auto_pr) → Human Approval → Complete
```

## Key Rules

1. **Start with `@brainstormer` (optional) or `@orchestrator`** — brainstorm ideas first, or go directly to the Orchestrator if you have a clear idea.
2. **The Coder reads ONLY its Task Handoff** — everything it needs is self-contained in that one document.
3. **No agent directly writes `state.json`** — all state mutations performed by the `@orchestrator` agent via the (`pipeline.js`) script.
4. **Human gates** are enforced after planning (Master Plan review) and after final review.
5. **Documents are the interface** — agents communicate through structured markdown files, never through shared state or memory.
6. **PR creation is non-blocking** — when `auto_pr === 'always'`, the pipeline creates a GitHub PR after the comprehensive review and before the human gate. If PR creation fails, the human gate fires without a PR URL. PR failure never blocks the pipeline.

> **Note:** `{orch_root}` is your orchestration root folder — `.github` by default. Set via `system.orch_root` in `orchestration.yml`. See [Configuration](docs/configuration.md).

## Configuration

System configuration lives in `{orch_root}/skills/orchestration/config/orchestration.yml`. It controls:
- Project storage paths (`projects.base_path`)
- Pipeline limits (max phases, tasks, retries)
- Human gate defaults

## Project Files

Project artifacts are stored in a configurable location set by `orchestration.yml` → `projects.base_path` (supports both relative and absolute paths). Each project gets a subfolder: `{base_path}/{PROJECT-NAME}/`.

Contents:
- Brainstorming: `BRAINSTORMING.md` (optional, created by `@brainstormer`)
- Planning docs: `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `MASTER-PLAN.md`
- Execution docs: `phases/`, `tasks/`, `reports/`
- State: `state.json`
- Error log: `ERROR-LOG.md` (append-only, created by `@orchestrator` via `log-error` skill)

## Naming Conventions

- **Project files**: `SCREAMING-CASE` with project prefix — `MYAPP-PRD.md`, `MYAPP-TASK-P01-T03-AUTH.md`. See [document-conventions.md](document-conventions.md) for the full set of filename patterns, placement rules, and frontmatter field values.
- **Skills**: lowercase with hyphens — `{orch_root}/skills/create-prd/`
- **Agents**: lowercase with hyphens — `{orch_root}/agents/orchestrator.agent.md`
