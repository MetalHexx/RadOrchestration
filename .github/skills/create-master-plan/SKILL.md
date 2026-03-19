---
name: create-master-plan
description: 'Create a Master Plan document that serves as the single source of truth for a project. Use when synthesizing a PRD, Design, and Architecture into a master plan, defining project phases, creating phase outlines with exit criteria, or preparing for execution. Produces a structured master plan with executive summary, key requirements, technical decisions, phase outlines, and risk register.'
---

# Create Master Plan

Generate a Master Plan that is the single source of truth for the project. Synthesizes the PRD, Design, and Architecture into an executive-level overview with phase outlines. This is the primary input for the Tactical Planner.

## When to Use This Skill

- After the PRD, Design, and Architecture are all complete
- When the Orchestrator spawns the Architect Agent to create a Master Plan
- When synthesizing all planning documents into a single execution-ready plan

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Brainstorming document *(optional)* | `{NAME}-BRAINSTORMING.md` | Project idea, validated concepts, and scope boundaries. |
| Research Findings | `RESEARCH-FINDINGS.md` | Codebase analysis, constraints |
| PRD | `{NAME}-PRD.md` | Requirements, user stories, success metrics |
| Design | `{NAME}-DESIGN.md` | UI components, flows, accessibility |
| Architecture | `{NAME}-ARCHITECTURE.md` | Modules, contracts, file structure, phasing recommendations |

## Workflow

1. **Read all inputs**: Load every planning document
2. **Write executive summary**: 3-5 sentences that let a new reader understand the project
3. **Link source documents**: Table of all planning docs with paths and status
4. **Curate key requirements**: Extract P0 functional and critical non-functional requirements from the PRD (3-8 items, not a copy)
5. **Curate key technical decisions**: Extract architectural decisions that constrain implementation (3-8 items)
6. **Curate key design constraints**: Extract design decisions that affect implementation (3-8 items)
7. **Define phase outline**: High-level phases with goals, scope bullets (cross-referencing source docs), and exit criteria.
8. **Set execution constraints**: Pull limits from `orchestration.yml` — max phases, max tasks, git strategy, human gates
9. **Build risk register**: Aggregate risks from PRD and Architecture with mitigation strategies
10. **Write the Master Plan**: Use the bundled template at [templates/MASTER-PLAN.md](./templates/MASTER-PLAN.md)
11. **Save**: Write to `{PROJECT-DIR}/{NAME}-MASTER-PLAN.md`

## Key Rules

- **Executive summary stands alone**: A new reader understands the project from this alone
- **Curated summaries, not copies**: 3-8 items per section, linking back to source doc sections
- **Phase outline is high-level**: NO task details — each phase has a goal, scope bullets, and exit criteria
- **Phase docs are NOT created here**: Just placeholders with future paths — the Tactical Planner creates them at execution time

## Frontmatter Requirements

The master plan document must include the following YAML frontmatter fields:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `project` | Yes | String | The project name (e.g., `MY-PROJECT`) |
| `status` | Yes | String | Document status: `draft` or `approved` |
| `author` | Yes | String | Agent that created the document (e.g., `architect-agent`) |
| `created` | Yes | String | ISO-8601 date of creation |

## Template

Use the bundled template: [MASTER-PLAN.md](./templates/MASTER-PLAN.md)
