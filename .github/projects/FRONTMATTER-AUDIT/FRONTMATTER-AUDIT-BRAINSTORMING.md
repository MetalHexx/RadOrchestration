---
project: "FRONTMATTER-AUDIT"
author: "brainstormer-agent"
created: "2026-03-14T23:00:00Z"
---

# FRONTMATTER-AUDIT — Brainstorming

## Problem Space

The PIPELINE-BEHAVIORAL-TESTS project introduced a `tasks` array in phase plan frontmatter containing `id`, `title`, and `depends_on` per task entry. Investigation reveals that `depends_on` has zero consumers anywhere in the system — no code, no agent, no skill, no test reads or acts on it. The `id` and `title` fields are stored into state.json by `handlePhasePlanCreated` but are never read back by any pipeline, triage, resolver, or validator code afterward — they serve only as display labels visible in state.json for the Orchestrator and monitoring UI.

This raises a broader principle: **frontmatter fields in pipeline-consumed templates should have explicit, traceable consumers**. Fields that exist purely for "context" without any mechanical consumer are duplicative of information already present in document bodies, prone to drift (nothing validates them), and set a precedent that encourages agents to invent arbitrary frontmatter fields — as the Tactical Planner did with `depends_on`.

## Validated Goals

### Goal 1: Remove `depends_on` from phase plan documents

**Description**: Strip the `depends_on` field from the three existing PIPELINE-BEHAVIORAL-TESTS phase plan documents and ensure it does not appear in the phase plan template or skill instructions.
**Rationale**: Zero consumers. Not in the PRD (FR-1 specifies only `id` and `title`). Not in the architecture schema. Added unilaterally by the Tactical Planner. Leaving it creates a false signal that this field matters.
**Key considerations**: This is a data-only cleanup in three phase plan files. No code changes needed. The field is harmless if left (YAML parsers ignore unknown fields), but removing it prevents other Tactical Planner runs from copying the pattern.

### Goal 2: Evaluate whether `id` and `title` belong in frontmatter

**Description**: Determine whether `id` and `title` in the phase plan frontmatter `tasks` array should remain, be removed, or be replaced with a mechanism that has an explicit consumer.
**Rationale**: These fields are pre-read from frontmatter by the pipeline engine and stored into state.json, but no downstream code (triage, resolver, validator) ever references `task.id` or `task.title`. The Orchestrator uses them for display context when spawning agents, and the monitoring UI shows them. However, the same information exists in the phase plan document body (Task Outline table) and in task handoff filenames. If the only consumer is "the Orchestrator reads state.json and sees labels," that's a display concern being encoded into a pipeline contract — the pre-read validates their presence, returns errors if they're missing, yet nothing fails functionally without them.
**Key considerations**: 
- Removing `id`/`title` from frontmatter means the Orchestrator would need another way to know task names (e.g., reading the phase plan body, or deriving from `task_number` and phase title)
- The `total_tasks` field already tells the pipeline how many tasks to scaffold — `id` and `title` add metadata to that scaffold but don't change behavior
- The pipeline engine pre-read currently **requires** the `tasks` array and errors if missing — this enforcement exists for fields that only serve display purposes
- Compare with `total_phases` in the master plan: that field directly controls how many phase slots are created in state, which is a functional purpose. `id`/`title` don't control anything — they label what was already created

### Goal 3: Establish a frontmatter governance principle

**Description**: Define a clear rule for when a field belongs in frontmatter vs. document body, and apply it retroactively to existing templates.
**Rationale**: Without a principle, agents will continue inventing frontmatter fields. The current system has two categories: fields the pipeline engine pre-reads and acts on (`total_phases`, `status`, `verdict`, `severity`, `has_deviations`, `deviation_type`, `exit_criteria_met`) and fields that are stored but never read back (`id`, `title`). The first category drives pipeline behavior. The second category is metadata duplication.
**Key considerations**:
- Proposed rule: **A frontmatter field MUST have at least one code consumer that reads it and changes behavior based on its value.** Display-only metadata belongs in document body sections, not frontmatter
- This would mean the `tasks` array either needs a functional consumer (e.g., the pipeline uses `id` for handoff filename generation, or `title` for log messages) or should be reduced to just a count (which `total_tasks` already provides)
- Alternatively: accept that "stored in state.json for Orchestrator context" is a valid consumer, but then document that explicitly and don't error on absence — make it optional

## Scope Boundaries

### In Scope
- Removing `depends_on` from existing phase plan documents
- Analyzing `id`/`title` purpose and deciding keep/remove/make-optional
- Defining a frontmatter governance principle for all pipeline templates
- Updating the phase plan template and SKILL.md if fields are removed or changed
- Updating the PIPELINE-BEHAVIORAL-TESTS architecture schema if the phase plan frontmatter contract changes

### Out of Scope
- Implementing `depends_on` as a real feature (task dependency ordering) — that's a separate project if desired
- Changing frontmatter fields that have verified functional consumers (`verdict`, `severity`, `has_deviations`, etc.)
- Modifying the monitoring UI or Orchestrator agent prompts
- Refactoring how state.json stores task data

## Key Constraints

- PIPELINE-BEHAVIORAL-TESTS is an active project — changes to the phase plan frontmatter schema must not break its in-progress phases or the behavioral test suite it's building
- The pipeline engine pre-read for `phase_plan_created` was just added — removing the `tasks` array entirely would require removing that pre-read block too
- Existing project documents (from PIPELINE-BEHAVIORAL-TESTS phase plans) already contain these fields — backward compatibility of existing documents is relevant

## Open Questions

- Should `id` and `title` be demoted from REQUIRED to optional (pipeline stores them if present, uses defaults if absent)?
- Is "stored in state.json for Orchestrator display" a sufficient justification for a REQUIRED frontmatter field, or should that data come from a different source?
- If `id`/`title` are removed from frontmatter, should `handlePhasePlanCreated` generate synthetic IDs (e.g., `T01`, `T02`) and titles (e.g., `Task 1`, `Task 2`) from `total_tasks` instead?
- Should the `tasks` array remain in frontmatter but contain only a count (replacing `total_tasks`), or should it be removed entirely in favor of keeping `total_tasks` as the sole task-count mechanism?

## Summary

The PIPELINE-BEHAVIORAL-TESTS project added `depends_on`, `id`, and `title` to phase plan frontmatter task entries. `depends_on` is entirely unused and should be removed. `id` and `title` are stored in state.json but never functionally consumed — they're display labels with no behavioral impact. This project establishes the principle that frontmatter fields must have explicit code consumers, audits the current templates against that principle, and cleans up fields that don't meet the bar.
