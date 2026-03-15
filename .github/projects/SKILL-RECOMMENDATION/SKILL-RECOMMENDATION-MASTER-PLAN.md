---
project: "SKILL-RECOMMENDATION"
total_phases: 1
status: "draft"
author: "architect-agent"
created: "2026-03-15T00:00:00Z"
---

# SKILL-RECOMMENDATION — Master Plan

## Executive Summary

The planning pipeline has two behavioral gaps that degrade downstream agent effectiveness: task handoff skill fields are populated with technology labels instead of actual `.github/skills/` names (only ~4 of ~30 surveyed handoffs contain a valid skill name), and the UX Designer always produces a full Design document even for non-UI projects, generating fabricated content that misleads downstream agents. This project fixes both gaps through documentation and instruction file changes only — modifying 6 existing markdown files and creating 2 new template files. A skill discovery step is added to the `create-task-handoff` workflow, the template's `skills_required`/`skills_optional` fields are consolidated into a single `skills` array, and the UX Designer gains a triage step that routes to full, flows-only, or "not required" output paths based on PRD content. No scripts, configs, or runtime code change.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [SKILL-RECOMMENDATION-BRAINSTORMING.md](.github/projects/SKILL-RECOMMENDATION/SKILL-RECOMMENDATION-BRAINSTORMING.md) | ✅ |
| Research Findings | [SKILL-RECOMMENDATION-RESEARCH-FINDINGS.md](.github/projects/SKILL-RECOMMENDATION/SKILL-RECOMMENDATION-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [SKILL-RECOMMENDATION-PRD.md](.github/projects/SKILL-RECOMMENDATION/SKILL-RECOMMENDATION-PRD.md) | ✅ |
| Design | [SKILL-RECOMMENDATION-DESIGN.md](.github/projects/SKILL-RECOMMENDATION/SKILL-RECOMMENDATION-DESIGN.md) | ✅ (not-required stub) |
| Architecture | [SKILL-RECOMMENDATION-ARCHITECTURE.md](.github/projects/SKILL-RECOMMENDATION/SKILL-RECOMMENDATION-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-1**: The `create-task-handoff` skill must include a workflow step that enumerates `.github/skills/` folder names and reads each skill's description before writing the handoff
- **FR-2**: The discovery step must evaluate each skill against the task's objective, selecting only skills that would help the Coder complete the task
- **FR-3**: The task handoff template must replace `skills_required` and `skills_optional` with a single `skills` array field
- **FR-4**: The `skills` field must include an inline YAML comment stating values must be skill folder names from `.github/skills/` — not technology or framework names
- **FR-5**: The UX Designer agent must include a triage step that evaluates the PRD before producing any Design content
- **FR-6**: The triage must route to full Design / flows-only / "not required" stub, defaulting to "not required" when uncertain
- **FR-7**: The `create-design` skill must include identical triage logic so either entry point produces consistent behavior
- **NFR-3**: A DESIGN.md file must always be produced (even as a stub) so downstream pipeline steps do not break

## Key Technical Decisions (from Architecture)

- **Instruction-layer only**: All changes are to markdown files (agents, skills, templates, docs) — no scripts, config, or runtime code changes
- **Single `skills` field**: Replaces the `skills_required`/`skills_optional` distinction with one array plus an inline YAML comment; forward-only, no migration of existing handoffs
- **Three-path design triage**: Full template (visual UI), flows-only template (non-visual interactive), not-required stub (no user interaction); default is "not required" when uncertain
- **Dual-location triage logic**: Triage criteria appear in both `ux-designer.agent.md` and `create-design/SKILL.md` with identical routing, so either entry point produces the same output
- **Two new templates**: `DESIGN-FLOWS-ONLY.md` and `DESIGN-NOT-REQUIRED.md` added alongside the existing `DESIGN.md` template — the full template is unchanged
- **Discovery step placement**: Inserted after "Read inputs" and before "Write objective" in the `create-task-handoff` skill workflow, with all subsequent steps renumbered

## Key Design Constraints (from Design)

- **No design constraints apply**: The Design document is a "not required" stub — this project modifies only markdown instruction files with no user interface, no user-facing flows, and no visual output
- **Downstream agents**: The Architect and Tactical Planner should treat the Design stub as confirmation that no design decisions constrain implementation

## Phase Outline

### Phase 1: Instruction and Template Changes

**Goal**: Implement all skill discovery, template consolidation, design triage, and documentation changes across the two independent workstreams plus documentation updates.

**Scope**:
- Modify task handoff template — replace `skills_required`/`skills_optional` with single `skills` field + inline comment — refs: [FR-3](SKILL-RECOMMENDATION-PRD.md), [FR-4](SKILL-RECOMMENDATION-PRD.md), [Task Handoff Template contract](SKILL-RECOMMENDATION-ARCHITECTURE.md)
- Add skill discovery step to `create-task-handoff/SKILL.md` — refs: [FR-1](SKILL-RECOMMENDATION-PRD.md), [FR-2](SKILL-RECOMMENDATION-PRD.md), [Skill Discovery Step contract](SKILL-RECOMMENDATION-ARCHITECTURE.md)
- Create `DESIGN-FLOWS-ONLY.md` and `DESIGN-NOT-REQUIRED.md` templates — refs: [FR-8](SKILL-RECOMMENDATION-PRD.md), [FR-9](SKILL-RECOMMENDATION-PRD.md), [Flows-Only Template contract](SKILL-RECOMMENDATION-ARCHITECTURE.md), [Not-Required Stub contract](SKILL-RECOMMENDATION-ARCHITECTURE.md)
- Add triage logic to `create-design/SKILL.md` — refs: [FR-7](SKILL-RECOMMENDATION-PRD.md), [create-design Skill Triage contract](SKILL-RECOMMENDATION-ARCHITECTURE.md)
- Add triage step to `ux-designer.agent.md` — refs: [FR-5](SKILL-RECOMMENDATION-PRD.md), [FR-6](SKILL-RECOMMENDATION-PRD.md), [UX Designer Triage Step contract](SKILL-RECOMMENDATION-ARCHITECTURE.md)
- Add documentation notes to `docs/skills.md` and `docs/agents.md` — refs: [FR-10](SKILL-RECOMMENDATION-PRD.md), [Documentation Additions contract](SKILL-RECOMMENDATION-ARCHITECTURE.md)

**Exit Criteria**:
- [ ] Task handoff template has single `skills` field with inline YAML comment; `skills_required` and `skills_optional` fields are removed
- [ ] `create-task-handoff/SKILL.md` workflow includes skill discovery step with enumeration and evaluation instructions
- [ ] `DESIGN-FLOWS-ONLY.md` template exists with Design Overview, Triage Decision, User Flows, and Sections Omitted
- [ ] `DESIGN-NOT-REQUIRED.md` template exists with frontmatter (`status: "not-required"`), Design Overview, Triage Decision, Sections Omitted, and No Design Decisions Needed
- [ ] `create-design/SKILL.md` includes triage logic routing to three output paths with template references
- [ ] `ux-designer.agent.md` includes triage step with identical routing criteria and default-when-uncertain rule
- [ ] Triage logic in agent and skill produces identical routing for the same PRD input
- [ ] `docs/skills.md` contains note explaining Tactical Planner skill discovery during handoff creation
- [ ] `docs/agents.md` contains note explaining UX Designer triage behavior
- [ ] All changes are markdown files only — no scripts, config, or pipeline engine changes
- [ ] Existing full `DESIGN.md` template is unchanged

**Phase Doc**: phases/SKILL-RECOMMENDATION-PHASE-01-INSTRUCTION-AND-TEMPLATE-CHANGES.md *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Git strategy**: Single branch, sequential commits, prefix `[orch]`
- **Human gates**: Ask at start (after planning: true, after final review: true)

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Tactical Planner ignores the new skill discovery step and reverts to technology labels | High | Inline template comment reinforces valid values; skill workflow makes discovery an explicit numbered step that is hard to skip | Tactical Planner / Reviewer |
| UX Designer misclassifies a project type (e.g., treats a UI project as non-UI) | Medium | Triage defaults to "not required" when uncertain — safer than fabricating content; PRD user stories provide strong classification signal | UX Designer / Reviewer |
| Downstream agents fail when receiving a stub DESIGN.md instead of a full document | Medium | Stub includes valid frontmatter and clear status field; verify with a non-UI project early after deployment | Architect / Tactical Planner |
| Flows-only template path is ambiguous — agents aren't sure when to use it vs. full template | Low | Triage criteria are explicit: "has user-facing flows but no visual UI" (CLI wizard, interactive terminal) | UX Designer |
| Agent and skill triage logic drift out of sync after future edits | Low | Architecture documents the consistency constraint; Reviewer should verify both files match during code review | Reviewer |
