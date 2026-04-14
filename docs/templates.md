# Templates

## Overview

Templates are structured markdown files bundled inside skill folders that control the format and structure of each skill's output. There are 15 templates across 12 skills, organized into four groups: Planning, Execution, Review, and Meta. They define the sections, headings, and frontmatter that agents produce when executing a skill.

## How Skills and Templates Relate

Each skill that produces a document bundles one or more templates in its `templates/` subfolder. The agent reads the template when executing the skill and produces output matching its structure. 

## Customization

**Content is customizable.** You can modify template body content to adjust output verbosity, add or remove sections, or change table formats. For example, you might reduce the number of sections in `ARCHITECTURE.md` for smaller projects.

**Frontmatter must not be changed.** The YAML frontmatter block at the top of each template (between `---` markers) contains metadata fields that the pipeline and dashboard depend on. Changing field names, removing fields, or altering the frontmatter structure will break pipeline state tracking.

> **Note:** Check the `skills/` directory for the latest template inventory, as new skills or templates may be added after this documentation was written.

## Planning Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`BRAINSTORMING.md`](../.github/skills/brainstorm/templates/BRAINSTORMING.md) | `brainstorm` | Collaborative ideation and project goal refinement |
| [`RESEARCH-FINDINGS.md`](../.github/skills/research-codebase/templates/RESEARCH-FINDINGS.md) | `research-codebase` | Codebase analysis, patterns, constraints, and recommendations |
| [`PRD.md`](../.github/skills/create-prd/templates/PRD.md) | `create-prd` | Product requirements with user stories, functional and non-functional requirements |
| [`DESIGN.md`](../.github/skills/rad-create-plans/references/design/templates/DESIGN.md) | `rad-create-plans` | Full UX design — per-component layouts (heading-per-item), interaction states, optional tokens and accessibility |
| [`DESIGN-light.md`](../.github/skills/rad-create-plans/references/design/templates/DESIGN-light.md) | `rad-create-plans` | Light UX design — mandatory sections only (Design Overview, User Flows, Layout & Components, New Components, States & Interactions) |
| [`ARCHITECTURE.md`](../.github/skills/create-architecture/templates/ARCHITECTURE.md) | `create-architecture` | System architecture, module map, API contracts, and file structure |
| [`MASTER-PLAN.md`](../.github/skills/create-master-plan/templates/MASTER-PLAN.md) | `create-master-plan` | Phased execution plan synthesizing PRD, design, and architecture |

## Execution Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`PHASE-PLAN.md`](../.github/skills/create-phase-plan/templates/PHASE-PLAN.md) | `create-phase-plan` | Phase-level task breakdown with dependencies and execution order |
| [`TASK-HANDOFF.md`](../.github/skills/create-task-handoff/templates/TASK-HANDOFF.md) | `create-task-handoff` | Self-contained coding task assignment with contracts and acceptance criteria |
| [`PHASE-REPORT.md`](../.github/skills/generate-phase-report/templates/PHASE-REPORT.md) | `generate-phase-report` | Phase summary aggregating task results and exit criteria assessment |

## Review Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`CODE-REVIEW.md`](../.github/skills/code-review/templates/CODE-REVIEW.md) | `code-review` | Task-level code review with verdict, checklist, and issues |
| [`PHASE-REVIEW.md`](../.github/skills/code-review/templates/PHASE-REVIEW.md) | `code-review` | Phase-level integration review with cross-task assessment |
| [`FINAL-REVIEW.md`](../.github/skills/code-review/templates/FINAL-REVIEW.md) | `code-review` | Project-level final review with architectural integrity and P0 requirement coverage |

## Meta Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`ERROR-LOG.md`](../.github/skills/log-error/templates/ERROR-LOG.md) | `log-error` | Append-only pipeline error log with numbered entries |
| [`AGENT.md`](../.github/skills/create-agent/templates/AGENT.md) | `create-agent` | Agent definition file scaffold for new custom agents |

## Design Variants

The `rad-create-plans` skill selects one of two design template variants based on the project's user interaction profile. The UX Designer agent performs a triage assessment to determine which variant fits. If the project has no user interaction, the agent skips design document creation entirely — no stub document is produced.

| Variant | Template File | When Selected |
|---------|---------------|---------------|
| Full Design | `DESIGN.md` | Project has a visual UI — frontend views, components, pages, or interactive elements |
| Light Design | `DESIGN-light.md` | Project has user-facing flows but limited or no visual UI — CLI tools, terminal interfaces, or scoped interaction |

When uncertain whether a design document is needed, default to skipping. No document is preferable to a low-signal placeholder.

## Next Steps

- [Skills](skills.md) — Explore the 16 skills and their capabilities
- [Agents](agents.md) — Learn about the 12 agents that use these templates
- [Configuration](configuration.md) — Configure pipeline behavior and project settings
