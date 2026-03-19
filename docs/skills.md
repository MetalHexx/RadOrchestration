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
| `validate-orchestration` | Validate all orchestration files — agents, skills, instructions, config, cross-references | Any |

## Skill-Agent Composition

Each agent is explicitly assigned skills in its `.agent.md` frontmatter. This table shows the full mapping:

| Agent | Skills |
|-------|--------|
| Brainstormer | `brainstorm` |
| Orchestrator | `log-error` |
| Research | `research-codebase` |
| Product Manager | `create-prd` |
| UX Designer | `create-design` |
| Architect | `create-architecture`, `create-master-plan` |
| Tactical Planner | `create-phase-plan`, `create-task-handoff`, `generate-phase-report` |
| Coder | `execute-coding-task`, `generate-task-report`, `run-tests` |
| Reviewer | `review-task`, `review-phase` |

## Skill Recommendation in Task Handoffs

When creating task handoffs, the Tactical Planner enumerates the agent skills directory and evaluates each skill's description against the task being prepared. Skills that would help the Coder complete the task are listed in the handoff's `skills` field.

## Creating New Skills

Use the `create-skill` meta-skill to scaffold a new skill:

1. Invoke Copilot with a description of what the skill should do
2. The skill is created under `.github/skills/{skill-name}/` with:
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

## Next Steps

- [Templates](templates.md) — Customize the 16 output templates that skills produce
- [Agents](agents.md) — See which agents use which skills
