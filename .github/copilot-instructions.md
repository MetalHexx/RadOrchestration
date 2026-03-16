# Copilot Workspace Instructions

> These instructions are always loaded by GitHub Copilot in this workspace.

## Orchestration System

This workspace contains a **document-driven agent orchestration system** built on Copilot's native primitives (custom agents, skills, prompt files, and instruction files). The system takes software projects from idea through planning, execution, and review using 9 specialized agents.

### How It Works

- **Brainstorm an idea**: Use `@Brainstormer` to collaboratively explore and refine a project idea before starting the pipeline. This is optional — you can skip straight to `@Orchestrator` if you already have a clear idea.
- **Start a project**: Use `@Orchestrator` with a project idea. The Orchestrator reads state and spawns specialized agents to advance the pipeline. If a `BRAINSTORMING.md` exists, it uses that as input.
- **Continue a project**: Use `@Orchestrator` and ask to continue. It reads `state.json` to determine the next step automatically.
- **Check status**: Use `@Orchestrator` and ask for project status. It reads `state.json` to determine the current status.

### Agents

| Agent | Purpose |
|-------|---------|
| `@Brainstormer` | Collaboratively brainstorms and refines project ideas — standalone, outside the pipeline |
| `@Orchestrator` | Coordinates the pipeline — spawns agents, reads state, asks human questions. **Never writes files.** |
| `@Research` | Explores codebase and external sources to gather context |
| `@Product Manager` | Creates PRDs from research findings |
| `@UX Designer` | Creates design documents from PRDs |
| `@Architect` | Creates architecture docs and master plans |
| `@Tactical Planner` | Breaks phases into tasks, creates task handoffs, generates phase reports |
| `@Coder` | Executes coding tasks from self-contained task handoffs |
| `@Reviewer` | Reviews code and phases against planning documents |

### Pipeline

```
Planning:  Brainstorming (optional) → Research → PRD → Design → Architecture → Master Plan → Human Approval
Execution: Phase Plan → Task Handoffs → Code → Review → (loop) → Phase Review
Final:     Comprehensive Review → Human Approval → Complete
```

### Key Rules

1. **Start with `@Brainstormer` (optional) or `@Orchestrator`** — brainstorm ideas first, or go directly to the Orchestrator if you have a clear idea.
2. **The Coder reads ONLY its Task Handoff** — everything it needs is self-contained in that one document.
3. **No agent directly writes `state.json`** — all state mutations performed by the `@Orchestrator` agent via the (`pipeline.js`) script.
4. **Human gates** are enforced after planning (Master Plan review) and after final review.
5. **Documents are the interface** — agents communicate through structured markdown files, never through shared state or memory.

### Configuration

System configuration lives in `.github/orchestration.yml`. It controls:
- Project storage paths (`projects.base_path`)
- Pipeline limits (max phases, tasks, retries)
- Error severity classification (critical vs. minor)
- Human gate defaults
- Git strategy

### Project Files

Project artifacts are stored in a configurable location set by `orchestration.yml` → `projects.base_path` (supports both relative and absolute paths). Each project gets a subfolder: `{base_path}/{PROJECT-NAME}/`.

Contents:
- Brainstorming: `BRAINSTORMING.md` (optional, created by `@Brainstormer`)
- Planning docs: `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `MASTER-PLAN.md`
- Execution docs: `phases/`, `tasks/`, `reports/`
- State: `state.json`
- Error log: `ERROR-LOG.md` (append-only, created by `@Orchestrator` via `log-error` skill)

### Naming Conventions

- **Project files**: `SCREAMING-CASE` with project prefix — `MYAPP-PRD.md`, `MYAPP-TASK-P01-T03-AUTH.md`
- **Skills**: lowercase with hyphens — `.github/skills/create-prd/`
- **Agents**: lowercase with hyphens — `.github/agents/orchestrator.agent.md`
