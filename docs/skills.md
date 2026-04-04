# Skills

The orchestration system includes 18 reusable skills — self-contained capability bundles that give agents domain-specific knowledge, templates, and instructions. Agents are composed with the skills they need, and GitHub Copilot matches requests to skills through description-based matching.

## Skill Inventory

### Planning Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `brainstorm` | Collaboratively explore, refine, and converge on project ideas through structured ideation | brainstormer |
| `research-codebase` | Explore and analyze codebases, documentation, and external sources to gather technical context | research |
| `create-prd` | Generate Product Requirements Documents with numbered requirements (FR-/NFR-) from research findings | product-manager |
| `create-design` | Create UX Design documents with user flows, layouts, states, and accessibility specs from PRDs | ux-designer |
| `create-architecture` | Define system architecture — layers, modules, contracts, APIs, schemas — from PRD + Design | architect |
| `create-master-plan` | Synthesize all planning documents into a Master Plan with phases, exit criteria, and risk register | architect |

### Execution Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `create-phase-plan` | Break project phases into concrete tasks with dependencies, execution order, and acceptance criteria | tactical-planner |
| `create-task-handoff` | Create self-contained task documents that inline all contracts, interfaces, and requirements | tactical-planner |
| `execute-coding-task` | Full coding task execution loop — read handoff, implement code, run tests, verify acceptance criteria | coder, coder-junior, coder-senior |
| `generate-phase-report` | Summarize phase outcomes — aggregated task results, exit criteria assessment, carry-forward items | tactical-planner |
| `run-tests` | Execute the project test suite and report structured results with pass/fail and error details | coder, coder-junior, coder-senior |
| `log-error` | Log pipeline errors to a structured, append-only per-project error log | orchestrator, source-control |
| `source-control` | Source control automation — git commit and push via CLI wrapper; PR creation via GitHub CLI | source-control |

### Review Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `code-review` | Review code, phases, and projects for quality, correctness, and conformance — supports task review, phase review, and final review modes with dual-pass approach | reviewer |

### Meta Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `create-agent` | Scaffold new agent definitions (`.agent.md`) with proper frontmatter and tool declarations | any |
| `create-skill` | Scaffold new skills with `SKILL.md`, directory structure, and optional scripts/references | any |

### System Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `orchestration` | Orchestration system runtime, configuration, validation, and context. All pipeline agents load this skill for system context. The Orchestrator receives pipeline-specific guidance. Reviewers and Tactical Planners receive validation guidance. | all agents |

## Skill-Agent Composition

Each agent is assigned skills in its `.agent.md` definition. This table shows the full mapping:

| Agent | Skills |
|-------|--------|
| brainstormer | `orchestration`, `brainstorm` |
| orchestrator | `orchestration`, `log-error` |
| research | `orchestration`, `research-codebase` |
| product-manager | `orchestration`, `create-prd` |
| ux-designer | `orchestration`, `create-design` |
| architect | `orchestration`, `create-architecture`, `create-master-plan` |
| tactical-planner | `orchestration`, `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
| coder | `orchestration`, `execute-coding-task`, `run-tests` |
| coder-junior | `orchestration`, `execute-coding-task`, `run-tests` |
| coder-senior | `orchestration`, `execute-coding-task`, `run-tests` |
| reviewer | `orchestration`, `code-review` |
| source-control | `orchestration`, `source-control`, `log-error` |

## Human-Facing Entry Points

These skills and prompts are invoked directly by humans rather than by the pipeline.

| Skill | Description | Used By |
|-------|-------------|---------|
| `rad-execute-parallel` | Set up a parallel git worktree for a project and launch orchestration execution in it | any |

### Prompt Inventory

Prompts (`.prompt.md` files) are slash-command shortcuts that invoke a specific agent with a predefined instruction.

| Prompt | File | Agent | Description |
|--------|------|-------|-------------|
| `/rad-plan` | `.github/prompts/rad-plan.prompt.md` | orchestrator | Start the full planning pipeline — Research through Master Plan |
| `/rad-execute` | `.github/prompts/rad-execute.prompt.md` | orchestrator | Continue a project through the orchestration pipeline |
| `/configure-system` | `.github/prompts/configure-system.prompt.md` | agent | Configure the orchestration system using a structured questionnaire |

### rad-plan

Kicks off the complete planning pipeline: Research → PRD → Design → Architecture → Master Plan. Use when you have a project idea and want to produce a full planning suite in one shot.

### rad-execute

Continues a project through the execution pipeline after the Master Plan is approved. Use after planning completes to begin or resume phase execution.

### configure-system

Walks through orchestration system configuration using a structured questionnaire — system root, project storage, pipeline limits, gate behavior, and source control settings — then generates `orchestration.yml`.

## Customizing Skills

Skills can be modified to adjust agent behavior, but core instructions (format requirements, frontmatter schemas, self-containment rules) must be preserved — other pipeline agents depend on these contracts. To customize document output format, modify the skill's template files; see [Templates](templates.md) for details.

## Next Steps

- [Templates](templates.md) — Customize the output templates that skills produce
- [Agents](agents.md) — See which agents use which skills
- [Configuration](configuration.md) — Configure pipeline settings
