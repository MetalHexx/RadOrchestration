# Skills

The orchestration system includes 16 reusable skills — self-contained capability bundles that give agents domain-specific knowledge, templates, and instructions. Agents are composed with the skills they need, and GitHub Copilot matches requests to skills through description-based matching.

## Skill Inventory

### Planning Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `rad-brainstorm` | Collaboratively explore, refine, and converge on project ideas through structured ideation | brainstormer |
| `rad-create-plans` | Consolidated planning skill — routes research, PRD, design, architecture, master plan, and phase plan creation to purpose-built workflows | research, product-manager, ux-designer, architect, tactical-planner |
| `create-architecture` | Define system architecture — layers, modules, contracts, APIs, schemas — from PRD + Design | architect |
| `create-master-plan` | Synthesize all planning documents into a Master Plan with phases, exit criteria, and risk register | architect |

### Execution Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `create-phase-plan` | Break project phases into concrete tasks with dependencies, execution order, and acceptance criteria | tactical-planner |
| `create-task-handoff` | Create self-contained task documents that inline all contracts, interfaces, and requirements | tactical-planner |
| `rad-execute-coding-task` | Full coding task execution loop — read handoff, implement code, run tests, verify acceptance criteria | coder, coder-junior, coder-senior |
| `generate-phase-report` | Summarize phase outcomes — aggregated task results, exit criteria assessment, carry-forward items | tactical-planner |
| `rad-run-tests` | Execute the project test suite and report structured results with pass/fail and error details | coder, coder-junior, coder-senior |
| `rad-log-error` | Log pipeline errors to a structured, append-only per-project error log | orchestrator, source-control |
| `rad-source-control` | Source control automation — git commit and push via CLI wrapper; PR creation via GitHub CLI | source-control |

### Review Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `rad-code-review` | Review code, phases, and projects for quality, correctness, and conformance — supports task review, phase review, and final review modes with dual-pass approach | reviewer |

### System Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `rad-orchestration` | Orchestration system runtime, configuration, validation, and context. All pipeline agents load this skill for system context. The Orchestrator receives pipeline-specific guidance. Reviewers and Tactical Planners receive validation guidance. | all agents |

## Skill-Agent Composition

Each agent is assigned skills in its `.agent.md` definition. This table shows the full mapping:

| Agent | Skills |
|-------|--------|
| brainstormer | `rad-orchestration`, `rad-brainstorm` |
| orchestrator | `rad-orchestration`, `rad-log-error` |
| research | `rad-orchestration`, `rad-create-plans` |
| product-manager | `rad-orchestration`, `rad-create-plans` |
| ux-designer | `rad-orchestration`, `rad-create-plans` |
| architect | `rad-orchestration`, `create-architecture`, `create-master-plan` |
| tactical-planner | `rad-orchestration`, `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
| coder | `rad-orchestration`, `rad-execute-coding-task`, `rad-run-tests` |
| coder-junior | `rad-orchestration`, `rad-execute-coding-task`, `rad-run-tests` |
| coder-senior | `rad-orchestration`, `rad-execute-coding-task`, `rad-run-tests` |
| reviewer | `rad-orchestration`, `rad-code-review` |
| source-control | `rad-orchestration`, `rad-source-control`, `rad-log-error` |

## Human-Facing Entry Points

These skills and prompts are invoked directly by humans rather than by the pipeline.

| Skill | Description | Used By |
|-------|-------------|---------|
| `rad-execute-parallel` | Set up a parallel git worktree for a project and launch orchestration execution in it | any |

### Prompt Inventory

Prompts (`.prompt.md` files) are slash-command shortcuts that invoke a specific agent with a predefined instruction.

| Prompt | File | Agent | Description |
|--------|------|-------|-------------|
| `/rad-plan` | `.claude/skills/rad-plan.prompt.md` | orchestrator | Start the full planning pipeline using the chosen template (default unless overridden) |
| `/rad-plan-quick` | `.claude/skills/rad-plan-quick/SKILL.md` | orchestrator | Start the planning pipeline in quick mode — quick template, Extra Large tasks, autonomous execution mode all hardcoded |
| `/rad-execute` | `.claude/skills/rad-execute.prompt.md` | orchestrator | Continue a project through the orchestration pipeline |
| `/rad-configure-system` | `.claude/skills/rad-configure-system/SKILL.md` | agent | Configure the orchestration system using a structured questionnaire |

### rad-plan

Kicks off the complete planning pipeline using the chosen template — Requirements through Master Plan with the audit pass and the plan approval gate. Use when you want to choose the template explicitly or when you want the standard ceremony with per-task code review and per-task gate, the phase review, and the phase gate — planning ceremony, the audit pass, the plan approval gate, the final review, and the final approval gate are preserved.

### rad-plan-quick

Kicks off the planning pipeline in quick mode. Quick mode is `default.yml` minus per-task code review, the per-task gate, the phase review, and the phase gate — planning ceremony, the audit pass, the plan approval gate, the final review, and the final approval gate are preserved. The skill hardcodes `--template quick`, sets task size to Extra Large, and sets the human-gate execution mode to autonomous.

**When to use default vs quick.**

Use **default** when:
- The project is mission-critical or unfamiliar territory.
- You want a code review on every task and a review at the end of every phase.
- You want to keep the per-task gate so you can stop the run mid-stream.

Use **quick** when:
- The project is small, well-scoped, and low-risk.
- You are comfortable letting tasks chain without per-task review and letting phases close without a per-phase review.
- You want a single final review at the end and an autonomous mid-execution flow.

Both modes preserve the plan approval gate (last human checkpoint before any task executes) and the final approval gate after the final review.

### rad-execute

Continues a project through the execution pipeline after the Master Plan is approved. Use after planning completes to begin or resume phase execution.

### rad-configure-system

Walks through orchestration system configuration using a structured questionnaire — system root, project storage, pipeline limits, gate behavior, and source control settings — then generates `orchestration.yml`.

## Customizing Skills

Skills can be modified to adjust agent behavior, but core instructions (format requirements, frontmatter schemas, self-containment rules) must be preserved — other pipeline agents depend on these contracts. To customize document output format, modify the skill's template files; see [Templates](templates.md) for details.

## Next Steps

- [Templates](templates.md) — Customize the output templates that skills produce
- [Agents](agents.md) — See which agents use which skills
- [Configuration](configuration.md) — Configure pipeline settings
