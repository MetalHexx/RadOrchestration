# Orchestration System Context

This workspace contains a **document-driven agent orchestration system** built on the host harness's native primitives (custom agents, skills, prompt files, instruction files). The system takes software projects from idea through planning, execution, and review using a small set of specialized agents.

## How It Works

- **Brainstorm an idea**: Use `@brainstormer` to collaboratively explore and refine a project idea before starting the pipeline. This is optional — you can skip straight to `@orchestrator` if you already have a clear idea.
- **Start a project**: Use `@orchestrator` with a project idea. The Orchestrator signals the pipeline, parses the JSON envelope from `radorch pipeline signal`, and executes the instructions carried on `data.prompt`. If a `BRAINSTORMING.md` exists, it uses that as input.
- **Continue a project**: Use `@orchestrator` and ask to continue. It signals `start` against the existing `state.json`; the pipeline loads state, skips mutation, and returns the next action.
- **Check status**: Use `@orchestrator` and ask for project status. It reads `state.json` to determine the current status.

## Envelope-driven instructions

The orchestrator is an event-driven controller around one CLI. Every signal to `radorch pipeline signal` returns a JSON envelope; success envelopes carry:

- `data.action` — the operation the orchestrator must perform next.
- `data.prompt` — the **composed instruction text** for that action. This is the sole authoritative source for what to do; per-action routing tables and per-event signaling references do not live in this skill.
- `data.completion_event` — the event to signal when the action is done, or `null` for terminal actions.
- `data.context` — action-specific payload (file paths, identifiers, configuration flags).

The pipeline assembles `data.prompt` at envelope-build time from the catalog under `~/.radorc/action-events/`. Each catalog file's body is concatenated with the matching completion-event body and a derived `Signal: <event> [--flag <value>]` line. To change the orchestrator's behavior for a given action, edit the catalog file (or add a `custom/` overlay) — never edit this skill.

Step-node status transitions to `in_progress` are written optimistically by the engine on the same response that returns the action. There is **no `_started` two-step protocol** anywhere in the pipeline — the orchestrator does not signal `task_executor_started`, `code_review_started`, etc. before doing the work.

## Agents

| Agent | Purpose |
|-------|---------|
| `@brainstormer` | Collaboratively brainstorms and refines project ideas — standalone, outside the pipeline |
| `@orchestrator` | Coordinates the pipeline — signals events, executes the action prompt returned on each envelope, asks human questions. **Writes only**: `## Orchestrator Addendum` section + additive frontmatter on existing Code Review docs, and corrective Task Handoff files under `tasks/`. |
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
2. **`data.prompt` is the orchestrator's sole instruction source** — everything the orchestrator needs to execute the next action is composed into it; no separate routing or signaling tables.
3. **The Coder reads ONLY its Task Handoff** — everything it needs is self-contained in that one document.
4. **No agent directly writes `state.json`** — all state mutations are performed by the `radorch pipeline signal` subcommand. The engine writes `in_progress` transitions optimistically; agents never simulate them.
5. **Human gates** are enforced after planning (Master Plan review) and after final review.
6. **Documents are the interface** — agents communicate through structured markdown files, never through shared state or memory.
7. **PR creation is non-blocking** — when `auto_pr === 'always'`, the pipeline creates a GitHub PR after the comprehensive review and before the human gate. If PR creation fails, the human gate fires without a PR URL. PR failure never blocks the pipeline.

## Configuration

System configuration lives in `~/.radorc/orchestration.yml`. It controls:
- Pipeline limits (max phases, tasks, retries)
- Human gate defaults
- Source control mode (`auto_commit`, `auto_pr`)

Per-action and per-event prose lives in `~/.radorc/action-events/`. The composer reads it on every signal.

## Project Files

Project artifacts are stored at `~/.radorc/projects/{PROJECT-NAME}/`.

Contents:
- Brainstorming: `{NAME}-BRAINSTORMING.md` (optional, created by `@brainstormer`)
- Planning docs: `{NAME}-MASTER-PLAN.md` (inlined phase + task plan written by `@planner`), `{NAME}-REQUIREMENTS.md` (lean project-level ledger written by `@planner`)
- Execution docs: `phases/`, `tasks/`, `reports/`
- State: `state.json`
- Error log: `{NAME}-ERROR-LOG.md` (append-only, created by `@orchestrator` via `rad-log-error` skill)

## Naming Conventions

- **Project files**: `SCREAMING-CASE` with project prefix — `MYAPP-MASTER-PLAN.md`, `MYAPP-TASK-P01-T03-AUTH.md`. See [document-conventions.md](document-conventions.md) for the full set of filename patterns, placement rules, and frontmatter field values.
- **Skills**: lowercase with hyphens (e.g. `rad-create-plans`). The orchestrator resolves skills by name; physical placement varies by install path (harness folders for the legacy installer, plugin folder for the Claude plugin).
- **Agents**: lowercase with hyphens (e.g. `planner`). Resolved by name; same placement note as skills.
- **Action / event catalog files**: `action.<name>.md` and `event.<name>.md` under `~/.radorc/action-events/`; see [document-conventions.md](document-conventions.md) for the frontmatter contract.
