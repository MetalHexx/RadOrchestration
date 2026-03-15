---
project: "SKILL-RECOMMENDATION"
phase: 1
task: 6
title: "Add Skill Discovery and Design Triage Documentation"
status: "pending"
skills: []  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: 2
---

# Add Skill Discovery and Design Triage Documentation

## Objective

Add documentation notes to two existing docs files: a "Skill Recommendation in Task Handoffs" section in `docs/skills.md` explaining how the Tactical Planner discovers and recommends skills during handoff creation, and a triage behavior note in `docs/agents.md` explaining the UX Designer's three-path output routing.

## Context

The `create-task-handoff` skill now includes a skill discovery step (step 2) that enumerates `.github/skills/` folders and selects Coder-relevant skills for the handoff's `skills` field. The UX Designer agent now includes a triage step (step 3) that routes to full Design, flows-only, or "not required" stub based on PRD analysis. These behavioral changes need corresponding documentation in the human-facing docs so pipeline maintainers understand the intended behaviors without reading agent/skill source files. Both docs files already exist with established structure — the additions are additive insertions at specific locations.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/skills.md` | Insert new section after "Skill-Agent Composition", before "Creating New Skills" |
| MODIFY | `docs/agents.md` | Insert triage note into UX Designer section, after the existing description paragraph |

## Implementation Steps

1. Open `docs/skills.md` and locate the "## Skill-Agent Composition" section and the "## Creating New Skills" section that follows it.
2. Insert the following new section between "Skill-Agent Composition" and "Creating New Skills":

```markdown
## Skill Recommendation in Task Handoffs

When creating task handoffs, the Tactical Planner enumerates `.github/skills/` and evaluates each skill's description against the task being prepared. Skills that would help the Coder complete the task (e.g., `run-tests` for tasks with test requirements, `validate-orchestration` for tasks modifying orchestration files) are listed in the handoff's `skills` field. Only skill folder names are valid — technology or framework names are not.
```

3. Open `docs/agents.md` and locate the "### UX Designer" section.
4. Find the existing description paragraph that ends with "defines user flows, component layouts, interaction states, responsive behavior, accessibility requirements, and design tokens."
5. Insert the following paragraph immediately after the existing description, before the "**Input:**" line:

```markdown
Before producing any content, the UX Designer triages the PRD to determine the project's interaction model. Visual UI projects receive a full Design document. Projects with non-visual user-facing flows (e.g., CLI wizards) receive a flows-only document. Projects with no user interaction receive a "not required" stub. A DESIGN.md file is always produced to satisfy downstream pipeline expectations.
```

6. Verify that no existing content was removed, reordered, or modified in either file — only the two insertions described above.

## Contracts & Interfaces

Not applicable. This task adds plain markdown text to documentation files — no code interfaces, APIs, or type contracts are involved.

## Styles & Design Tokens

Not applicable. No visual output or design tokens involved.

## Test Requirements

- [ ] `docs/skills.md` contains a section titled "## Skill Recommendation in Task Handoffs" between the "Skill-Agent Composition" section and the "Creating New Skills" section
- [ ] The skill recommendation section mentions: Tactical Planner enumerating `.github/skills/`, evaluating skill descriptions, populating the handoff's `skills` field, and that only skill folder names are valid
- [ ] `docs/agents.md` UX Designer subsection contains the triage behavior paragraph mentioning three output paths (full Design, flows-only, "not required" stub)
- [ ] The triage paragraph states that a DESIGN.md file is always produced
- [ ] All pre-existing content in both files is unchanged (no deletions, no reordering, no rewording of existing text)

## Acceptance Criteria

- [ ] `docs/skills.md` has a "## Skill Recommendation in Task Handoffs" heading after "## Skill-Agent Composition" and before "## Creating New Skills"
- [ ] The inserted section text matches the specification from Implementation Steps (step 2)
- [ ] `docs/agents.md` UX Designer section contains the triage behavior paragraph after the existing description and before the "**Input:**" line
- [ ] The inserted paragraph text matches the specification from Implementation Steps (step 5)
- [ ] No existing content in `docs/skills.md` was removed or modified
- [ ] No existing content in `docs/agents.md` was removed or modified
- [ ] No other files were created or modified

## Constraints

- Do NOT restructure, reformat, or reword any existing content in either file
- Do NOT add content to any section other than the two specified insertion points
- Do NOT create new files — only modify the two existing docs files
- Do NOT add table of contents entries, navigation links, or cross-references beyond what is specified
- Do NOT modify any files outside `docs/skills.md` and `docs/agents.md`
