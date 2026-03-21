# Skills

Skills are reusable capability bundles that give agents domain-specific knowledge, templates, and instructions. Each skill is a self-contained folder with a `SKILL.md` file that defines what the skill does and how to use it. Agents are composed with the skills they need — the system can be extended by adding new skills or remixing existing ones.

## How Skills Work

Skills are discovered by GitHub Copilot through description-based matching. When an agent needs a capability, Copilot matches the request to the most appropriate skill based on its description. Each agent explicitly declares which skills it has access to in its `.agent.md` frontmatter.

Skills can include:
- **Instructions** — step-by-step procedures and rules
- **Templates** — document schemas the skill produces
- **References** — background material and examples
- **Scripts** — CLI tools the skill uses

## Customizing Skills

Skills can be modified to adjust agent behavior — for example, changing the number of steps in a procedure, adjusting quality thresholds, or tailoring instructions to match a team's specific workflow and conventions.

> **Warning**: Core instructions within skills — such as output format requirements, frontmatter schemas, and self-containment rules — should be preserved. Other parts of the pipeline depend on these contracts, and changing them can cause downstream agents to produce incompatible output.

To customize the **output format** of documents a skill produces, modify the skill's template files. See [Templates](templates.md) for details on the 16 output templates and their customization rules.

## Skill Inventory

### Planning Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `brainstorm` | Collaboratively explore, refine, and converge on project ideas through structured ideation | Brainstormer |
| `research-codebase` | Explore and analyze codebases, documentation, and external sources to gather technical context | Research |
| `create-prd` | Generate Product Requirements Documents with numbered requirements (FR-/NFR-) from research findings | Product Manager |
| `create-design` | Create UX Design documents with user flows, layouts, states, and accessibility specs from PRDs | UX Designer |
| `create-architecture` | Define system architecture — layers, modules, contracts, APIs, schemas — from PRD + Design | Architect |
| `create-master-plan` | Synthesize all planning documents into a Master Plan with phases, exit criteria, and risk register | Architect |

### Execution Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `create-phase-plan` | Break project phases into concrete tasks with dependencies, execution order, and acceptance criteria | Tactical Planner |
| `create-task-handoff` | Create self-contained task documents that inline all contracts, interfaces, and requirements | Tactical Planner |
| `execute-coding-task` | Full coding task execution loop — read handoff, implement code, run tests, verify acceptance criteria, write Task Report | Coder |
| `generate-task-report` | Document task completion — files changed, test results, deviations, discoveries | Coder, Tactical Planner |
| `generate-phase-report` | Summarize phase outcomes — aggregated task results, exit criteria assessment, carry-forward items | Tactical Planner |
| `run-tests` | Execute the project test suite and report structured results with pass/fail and error details | Coder, Tactical Planner |
| `log-error` | Log pipeline errors to a structured, append-only per-project error log (`ERROR-LOG.md`) | Orchestrator |

### Review Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `review-task` | Review task output against the task handoff, architecture, and design — produce verdicts with severity | Reviewer |
| `review-phase` | Cross-task integration review for entire phases — module consistency, exit criteria, test coverage | Reviewer |

### Meta Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `create-agent` | Scaffold new agent definitions (`.agent.md`) with proper frontmatter and tool declarations | Any |
| `create-skill` | Scaffold new skills with `SKILL.md`, directory structure, and optional scripts/references | Any |

### System Skills

| Skill | Description | Used By |
|-------|-------------|---------|
| `orchestration` | Orchestration system runtime, configuration, validation, and context. All pipeline agents load this skill for system context. The Orchestrator receives pipeline-specific guidance. Reviewers and Tactical Planners receive validation guidance. | All Agents |

## Skill-Agent Composition

Each agent is explicitly assigned skills in its `.agent.md` frontmatter. This table shows the full mapping:

| Agent | Skills |
|-------|--------|
| Brainstormer | `orchestration`, `brainstorm` |
| Orchestrator | `orchestration`, `log-error` |
| Research | `orchestration`, `research-codebase` |
| Product Manager | `orchestration`, `create-prd` |
| UX Designer | `orchestration`, `create-design` |
| Architect | `orchestration`, `create-architecture`, `create-master-plan` |
| Tactical Planner | `orchestration`, `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
| Coder | `orchestration`, `execute-coding-task`, `generate-task-report`, `run-tests` |
| Reviewer | `orchestration`, `review-task`, `review-phase` |

## Skill Recommendation in Task Handoffs

When creating task handoffs, the Tactical Planner enumerates the agent skills directory and evaluates each skill's description against the task being prepared. Skills that would help the Coder complete the task are listed in the handoff's `skills` field.

## Creating New Skills

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

Use the `create-skill` meta-skill to scaffold a new skill:

1. Invoke Copilot with a description of what the skill should do
2. The skill is created under `.github/skills/{skill-name}/` _(or your [configured root](configuration.md))_ with:
   - `SKILL.md` — the main skill file with frontmatter and instructions
   - `scripts/` — optional CLI tools
   - `references/` — optional background material
   - `assets/` — optional static assets
3. Assign the skill to an agent by adding it to the agent's `.agent.md`
4. Run the [validation tool](validation.md) to verify cross-references

## Skill File Structure

```
.github/skills/{skill-name}/
├── SKILL.md              # Main skill definition (required)
├── scripts/              # CLI tools used by the skill
├── references/           # Background material, examples
└── assets/               # Static assets
```

The `SKILL.md` file contains:
- **Frontmatter** — description for auto-discovery matching
- **Instructions** — step-by-step procedures
- **Templates** — output document schemas
- **Rules** — constraints and quality standards

## Prompts

Prompts (`.prompt.md` files) are slash-command shortcuts that invoke a specific agent with a predefined instruction. They differ from skills — skills provide knowledge bundles that agents load, while prompts trigger a workflow by sending a ready-made instruction directly to a target agent.

### Prompt Inventory

| Prompt | File | Agent | Description |
|--------|------|-------|-------------|
| `/rad-plan` | `.github/prompts/rad-plan.prompt.md` | Orchestrator | Start the full planning pipeline for a new project — Research through Master Plan |
| `/rad-execute` | `.github/prompts/rad-execute.prompt.md` | Orchestrator | Continue a project through the orchestration pipeline |

### rad-plan

- **Purpose**: Kicks off the complete planning pipeline: Research → PRD → Design → Architecture → Master Plan.
- **When to use**: When you have a project idea (either a free-text description or an existing `BRAINSTORMING.md` document) and want to produce a full planning suite in one shot.
- **Behavior**: If a `BRAINSTORMING.md` exists for the project, it is used as the starting input. Otherwise, the user's description in the conversation is used. The Orchestrator presents the Master Plan for human approval when complete.

### rad-execute

- **Purpose**: Continues a project through the execution pipeline after the Master Plan has been approved.
- **When to use**: After the planning pipeline completes and the Master Plan is approved, use this prompt to begin or resume phase execution.
- **Behavior**: Instructs the Orchestrator to mark the plan as approved (if not already) and execute the project according to the Master Plan using the proper execution pipeline.

## Next Steps

- [Templates](templates.md) — Customize the 16 output templates that skills produce
- [Agents](agents.md) — See which agents use which skills
