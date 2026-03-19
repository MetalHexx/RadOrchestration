# Templates

## Overview

Templates are structured markdown files bundled inside skill folders that control the format and structure of each skill's output. There are 16 templates across 14 skills, organized into four groups: Planning, Execution, Review, and Meta. They define the sections, headings, and frontmatter that agents produce when executing a skill.

## How Skills and Templates Relate

Each skill that produces a document bundles a template in its `templates/` subfolder. The agent reads the template when executing the skill and produces output matching its structure. Four of the 18 skills have no template — `execute-coding-task`, `run-tests`, `create-skill`, and `validate-orchestration` — because they don't produce structured documents. One skill, `create-design`, has three template variants to accommodate different project types.

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
| [`DESIGN.md`](../.github/skills/create-design/templates/DESIGN.md) | `create-design` | Full UX design with layout, components, tokens, and accessibility |
| [`DESIGN-NOT-REQUIRED.md`](../.github/skills/create-design/templates/DESIGN-NOT-REQUIRED.md) | `create-design` | Design triage record for projects with no user interaction |
| [`DESIGN-FLOWS-ONLY.md`](../.github/skills/create-design/templates/DESIGN-FLOWS-ONLY.md) | `create-design` | User flows and information architecture without visual UI specs |
| [`ARCHITECTURE.md`](../.github/skills/create-architecture/templates/ARCHITECTURE.md) | `create-architecture` | System architecture, module map, API contracts, and file structure |
| [`MASTER-PLAN.md`](../.github/skills/create-master-plan/templates/MASTER-PLAN.md) | `create-master-plan` | Phased execution plan synthesizing PRD, design, and architecture |

## Execution Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`PHASE-PLAN.md`](../.github/skills/create-phase-plan/templates/PHASE-PLAN.md) | `create-phase-plan` | Phase-level task breakdown with dependencies and execution order |
| [`TASK-HANDOFF.md`](../.github/skills/create-task-handoff/templates/TASK-HANDOFF.md) | `create-task-handoff` | Self-contained coding task assignment with contracts and acceptance criteria |
| [`TASK-REPORT.md`](../.github/skills/generate-task-report/templates/TASK-REPORT.md) | `generate-task-report` | Task completion report with files changed, tests, and deviations |
| [`PHASE-REPORT.md`](../.github/skills/generate-phase-report/templates/PHASE-REPORT.md) | `generate-phase-report` | Phase summary aggregating task results and exit criteria assessment |

## Review Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`CODE-REVIEW.md`](../.github/skills/review-task/templates/CODE-REVIEW.md) | `review-task` | Task-level code review with verdict, checklist, and issues |
| [`PHASE-REVIEW.md`](../.github/skills/review-phase/templates/PHASE-REVIEW.md) | `review-phase` | Phase-level integration review with cross-task assessment |

## Meta Templates

| Template | Skill | Description |
|----------|-------|-------------|
| [`ERROR-LOG.md`](../.github/skills/log-error/templates/ERROR-LOG.md) | `log-error` | Append-only pipeline error log with numbered entries |
| [`AGENT.md`](../.github/skills/create-agent/templates/AGENT.md) | `create-agent` | Agent definition file scaffold for new custom agents |

## Design Variants

The `create-design` skill selects one of three template variants based on the project's user interaction profile. The UX Designer agent performs a triage assessment to determine which variant fits.

| Variant | Template File | When Selected |
|---------|---------------|---------------|
| Full Design | `DESIGN.md` | Project has a visual UI — frontend views, components, pages, or interactive elements |
| Flows Only | `DESIGN-FLOWS-ONLY.md` | Project has user-facing flows but no visual UI — CLI tools, terminal interfaces, documentation reading paths |
| Not Required | `DESIGN-NOT-REQUIRED.md` | Project has no user interaction — backend services, scripts, infrastructure, or documentation-only changes |

## Next Steps

- [Skills](skills.md) — Explore the 18 skill bundles and their capabilities
- [Agents](agents.md) — Learn about the 9 specialized agents that use these templates
- [Configuration](configuration.md) — Configure pipeline behavior and project settings
