---
project: "SKILL-RECOMMENDATION"
author: "brainstormer-agent"
created: "2026-03-15T00:00:00Z"
---

# SKILL-RECOMMENDATION — Brainstorming

## Problem Space

Two behavioral gaps in the planning pipeline have been identified:

**Skills field mislabeling**: The `TASK-HANDOFF.md` template includes `skills_required` and `skills_optional` frontmatter fields intended to direct the Coder Agent toward relevant skills from `.github/skills/` that can assist with completing the task (e.g., `run-tests` to validate work, `review-task` to self-review before submitting). In practice, the Tactical Planner populates these with generic technology labels like "CSS" or "Tailwind v4" instead — because neither the `create-task-handoff` skill nor the template gives any instruction to enumerate the available skills in `.github/skills/` and select ones that are genuinely useful to a coder working on that specific task. As a result, the Coder receives no useful skill guidance.

**UX Designer over-production**: The UX Designer Agent always produces a full Design document regardless of whether the project has a UI. For pure non-UI projects (backend services, CLI tools, pipeline scripts), the agent generates a filled-out design document that is unnecessary and misleading — adding noise to the project folder and wasting planning time. For projects with user-facing flows but no visual UI (e.g., a wizard or interactive CLI), a lightweight flow-only document is appropriate. For projects with no user interaction at all, the agent should produce a minimal stub that records the decision ("Not required") rather than a fabricated design spec.

## Validated Goals

### Goal 1: Enumerate available skills during handoff creation

**Description**: Add a discovery step to the `create-task-handoff` SKILL.md instructing the Tactical Planner to list the contents of `.github/skills/` and evaluate each available skill as a potential coding aid before writing the handoff. The planner selects skills that would genuinely help a coder completing this specific task (e.g., `run-tests` for any task with test requirements, `review-task` for tasks where self-review is valuable) and populates the `skills` field with their names.

**Rationale**: The Tactical Planner is currently given no signal that these fields should reference skills from `.github/skills/` — ones that actively help the Coder do their work. Making the discovery step explicit in the skill instructions is the minimal correct fix — no agent definition changes required.

**Key considerations**:
- The discovery step should enumerate `.github/skills/` by folder name, then match each skill's `description` (from its `SKILL.md` frontmatter) against the task's objective and implementation steps
- The lens is: "would a coder working on this task benefit from invoking this skill?" — not "is this skill part of the pipeline process?"
- The planner should prefer skills with a direct functional match over broad or speculative ones
- Technology/framework labels (e.g., "Tailwind", "TypeScript") are NOT valid values — this field is for skill names from `.github/skills/`, period

### Goal 2: Simplify the template — drop `skills_required` / `skills_optional` distinction

**Description**: Replace the two separate frontmatter fields (`skills_required`, `skills_optional`) with a single `skills` array. Add an inline comment in the template clarifying that values must be skill names from `.github/skills/` that will help the Coder complete the task — not technology or framework names.

**Rationale**: The required/optional distinction introduces ambiguity without adding actionable meaning for the Coder. A single `skills` list that the Coder can consult as a "recommended tools for this task" set is cleaner and less error-prone.

**Key considerations**:
- The template comment should be unambiguous: "Skill names from `.github/skills/` that will help the Coder complete this task — not technology/framework names"
- Any existing task handoffs in active projects will have the old frontmatter shape — this change is forward-only; no migration needed

### Goal 3: Update documentation to mention skill recommendation

**Description**: Add a concise note to the relevant docs (`.github/docs/skills.md` and/or `.github/docs/agents.md`) explaining that the Tactical Planner enumerates `.github/skills/` when creating task handoffs and selects skills that will help the Coder complete the task. This closes the documentation gap that makes the intended behavior invisible to developers and agents reading those docs.

**Rationale**: Without a doc reference, this behavior is opaque — there's no signal to a developer (or agent) reading the tools documentation that skill selection is meant to guide the Coder's work, not label technology choices.

**Key considerations**:
- Keep it concise — one paragraph or a tight bullet, not a new section
- Target existing docs rather than creating new files

### Goal 4: UX Designer — triage before producing a design document

**Description**: Add a triage step to both `ux-designer.agent.md` and the `create-design` SKILL.md that evaluates the PRD before producing any output. The agent routes to one of three paths:

| Project type | Output |
|---|---|
| Has a visual UI (frontend, views, components) | Full Design document — current behavior |
| Has user-facing flows but no visual UI (CLI wizard, interactive terminal, multi-step process) | Lightweight document with flows only — no layout spec, no breakpoints, no design tokens |
| No user interaction at all (backend service, pipeline script, data processor) | Minimal stub recording the decision: "UX design not required for this project — [reason]" |

The triage decision is based on reading the PRD's user stories and functional requirements. The agent should default to "not required" when uncertain, not default to producing content.

**Rationale**: A fabricated Design document for a non-UI project is misleading — it suggests design decisions were made when they weren't, and gives downstream agents (Architect, Tactical Planner) false inputs. Producing a decision stub still satisfies the pipeline's expectation that a DESIGN.md file exists, while being honest about what was assessed.

**Key considerations**:
- The triage logic belongs in both the agent instructions AND the `create-design` skill — both need to know about the three paths so either entry point produces consistent behavior
- The "flows only" path should use a simplified template: user flow diagrams and step descriptions only, no layout/component/token/accessibility/responsive sections
- The "not required" stub should be a small frontmatter + one-section doc: status, decision, and a one-sentence rationale — enough to show a deliberate choice was made
- The full Design template is unchanged for the UI path
- No pipeline or script changes needed — the DESIGN.md file is always produced, just with different content

## Scope Boundaries

### In Scope
- `create-task-handoff` SKILL.md — add skill discovery step
- `TASK-HANDOFF.md` template — replace `skills_required`/`skills_optional` with single `skills` field; add clarifying comment
- `docs/skills.md` and/or `docs/agents.md` — brief note about the skill recommendation behavior
- `ux-designer.agent.md` — add triage step to the workflow
- `create-design` SKILL.md — add triage logic and document the three output paths
- `DESIGN.md` template — consider adding lightweight flows-only and not-required stub sections or separate templates

### Out of Scope
- Changes to `tactical-planner.agent.md`
- Migrating existing task handoff documents to the new frontmatter shape
- Adding new orchestration skills
- Changes to how the Coder agent consumes the `skills` field (that is already defined in the Coder's agent instructions)
- Changes to the pipeline engine or state transitions

## Key Constraints

- No script changes — all fixes are in documentation and instruction files only
- The task handoff template change is forward-only; no migration of existing handoffs
- The Design document file must always be produced (even as a stub) so downstream pipeline steps don't break

## Open Questions

- **Project name**: This project now covers two distinct behavioral gaps (skill mislabeling and UX Designer over-production). The name "SKILL-RECOMMENDATION" is too narrow — consider renaming to something like `PLANNING-FIXES` before progressing to Research.

## Summary

Two behavioral gaps in the planning pipeline need correction. First, the skills field in task handoffs is being filled with technology labels instead of `.github/skills/` skill names that genuinely help the Coder — fixed by a discovery step in the `create-task-handoff` skill and a simplified template. Second, the UX Designer always produces a full Design document even for non-UI projects — fixed by adding a triage step to the agent and skill that routes to a full doc, a flows-only doc, or a "not required" stub based on PRD content. All fixes are documentation/instruction changes only; no scripts change.
