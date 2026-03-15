---
project: "SKILL-RECOMMENDATION"
status: "draft"
author: "product-manager-agent"
created: "2026-03-15T00:00:00Z"
---

# SKILL-RECOMMENDATION — Product Requirements

## Problem Statement

The planning pipeline has two behavioral gaps that degrade downstream agent effectiveness. First, the task handoff `skills_required` and `skills_optional` fields — intended to direct the Coder toward helpful `.github/skills/` capabilities — are populated with technology labels (e.g., "TypeScript", "Tailwind CSS") or vague activity labels (e.g., "coding", "scaffold") instead of actual skill names. Only ~4 of ~30 surveyed task handoffs contain a valid `.github/skills/` name. Second, the UX Designer always produces a full Design document regardless of whether the project has a UI, generating fabricated content (e.g., ANSI color tokens as "design tokens") for non-UI projects that misleads downstream agents.

## Goals

- **G1**: Every new task handoff contains only valid `.github/skills/` skill names in its skills field, selected based on the task's specific needs
- **G2**: The task handoff template uses a single `skills` field with an unambiguous inline comment, eliminating the confusing `skills_required`/`skills_optional` distinction
- **G3**: The UX Designer produces the appropriate level of design documentation based on project type — full document for visual UI projects, flows-only for non-visual interactive projects, and a "not required" stub for projects with no user interaction
- **G4**: Relevant documentation reflects the updated skill recommendation and design triage behaviors

## Non-Goals

- Modifying the Tactical Planner agent definition (`tactical-planner.agent.md`)
- Migrating existing task handoffs to the new frontmatter shape
- Changing how the Coder agent consumes the `skills` field (already defined in its agent instructions)
- Adding new orchestration skills to `.github/skills/`
- Changing the pipeline engine, state transitions, or `orchestration.yml`
- Modifying `pipeline.js` or any scripts

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Tactical Planner agent | discover available skills from `.github/skills/` when creating a task handoff | I populate the skills field with skill names that genuinely help the Coder complete the task | P0 |
| 2 | Coder agent | see a curated list of relevant `.github/skills/` skill names in my task handoff | I know which skills to invoke while completing the task (e.g., `run-tests`, `validate-orchestration`) | P0 |
| 3 | Tactical Planner agent | use a single `skills` field with a clear inline comment | I am not confused by the required/optional distinction and I know exactly what values are valid | P0 |
| 4 | UX Designer agent | evaluate the PRD before producing a Design document | I produce the appropriate document type (full, flows-only, or stub) based on whether the project has a visual UI | P0 |
| 5 | Architect agent | receive an honest Design document (or stub) from the UX Designer | I am not misled by fabricated design content for non-UI projects | P1 |
| 6 | Pipeline maintainer | read documentation that explains skill recommendation and design triage behaviors | I understand the intended pipeline behaviors without reading agent/skill source files | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The `create-task-handoff` skill must include a workflow step that enumerates `.github/skills/` folder names and reads each skill's description before writing the handoff | P0 | Discovery step added to skill instructions |
| FR-2 | The skill discovery step must evaluate each available skill against the task's objective and implementation steps, selecting only skills that would help the Coder complete the task | P0 | Selection criteria: "would a coder working on this task benefit from invoking this skill?" |
| FR-3 | The task handoff template must replace `skills_required` and `skills_optional` with a single `skills` array field | P0 | Forward-only change; no migration of existing handoffs |
| FR-4 | The `skills` field in the template must include an inline YAML comment stating that values must be skill folder names from `.github/skills/` — not technology or framework names | P0 | Prevents the current mislabeling behavior |
| FR-5 | The UX Designer agent must include a triage step that evaluates the PRD's user stories and functional requirements before producing any Design content | P0 | Triage occurs before any template writing |
| FR-6 | The triage step must route to one of three output paths: (a) full Design document for projects with a visual UI, (b) flows-only document for projects with non-visual user-facing flows, (c) "not required" stub for projects with no user interaction | P0 | The default when uncertain must be "not required" |
| FR-7 | The `create-design` skill must include the same triage logic and document the three output paths | P0 | Both agent and skill must be consistent so either entry point produces the same behavior |
| FR-8 | The flows-only document must contain only user flow diagrams and step descriptions — no layout, component, design token, accessibility, or responsive sections | P1 | Lightweight alternative to the full template |
| FR-9 | The "not required" stub must contain frontmatter, a status, a decision statement, and a one-sentence rationale — enough to record a deliberate choice | P1 | Satisfies the pipeline expectation that DESIGN.md exists |
| FR-10 | Documentation (`docs/skills.md` and/or `docs/agents.md`) must include a brief note explaining that the Tactical Planner enumerates `.github/skills/` during handoff creation and selects Coder-relevant skills | P1 | Closes the documentation gap |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Consistency | The triage decision in the UX Designer agent and `create-design` skill must produce identical routing for the same PRD input |
| NFR-2 | Backward Compatibility | Existing task handoffs with `skills_required`/`skills_optional` must remain valid; no migration is required |
| NFR-3 | Pipeline Integrity | A DESIGN.md file must always be produced (even as a stub) so downstream pipeline steps do not break |
| NFR-4 | Maintainability | All changes are limited to markdown instruction and template files — no scripts, no config changes |
| NFR-5 | Clarity | Inline comments and documentation additions must be concise and unambiguous, preventing future misinterpretation of valid field values |

## Assumptions

- The Tactical Planner agent will follow the updated `create-task-handoff` skill instructions without requiring changes to its own agent definition
- The Coder agent already has its own skills declared in its agent frontmatter and does not need changes to benefit from correct skill recommendations in the handoff
- Downstream agents (Architect, Tactical Planner) that read DESIGN.md will correctly handle a stub or flows-only document without errors
- The three-path triage (full, flows-only, not required) covers all project types the pipeline encounters

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | The Tactical Planner ignores the new skill discovery step and reverts to technology labels | High | The inline template comment reinforces valid values; the skill workflow makes discovery an explicit numbered step that is hard to skip |
| 2 | The UX Designer misclassifies a project type (e.g., treats a UI project as non-UI) | Medium | The triage defaults to "not required" when uncertain, which is safer than fabricating content; the PRD's user stories provide strong signal for classification |
| 3 | Downstream agents fail when receiving a stub DESIGN.md instead of a full document | Medium | The stub includes valid frontmatter and a clear status field; test with a non-UI project early in execution |
| 4 | The flows-only template path is ambiguous — agents aren't sure when to use it vs. the full template | Low | The triage criteria are explicit: "has user-facing flows but no visual UI" (e.g., CLI wizard, interactive terminal) |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Valid skill names in new task handoffs | 100% of `skills` field values are `.github/skills/` folder names | Manual review of task handoffs produced after the change |
| Technology labels eliminated | 0 technology or framework labels in the `skills` field of new handoffs | Manual review of task handoffs produced after the change |
| Design triage accuracy | Non-UI projects receive a stub or flows-only document, not a full Design doc | Review DESIGN.md content for the next 3 non-UI projects |
| Documentation updated | Skills docs and/or agents docs reference the skill recommendation behavior | Verify the note exists in `docs/skills.md` or `docs/agents.md` |
