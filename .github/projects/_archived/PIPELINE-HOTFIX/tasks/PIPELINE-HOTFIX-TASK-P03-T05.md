---
project: "PIPELINE-HOTFIX"
phase: 3
task: 5
title: "Master Plan Skill Instructions — Document total_phases"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Master Plan Skill Instructions — Document `total_phases`

## Objective

Update `.github/skills/create-master-plan/SKILL.md` to document `total_phases` as a required frontmatter field in the master plan. The pipeline engine reads this field on `plan_approved` to initialize the execution phases array.

## Context

The `create-master-plan` skill instructs the Architect Agent on how to produce a Master Plan document. The master plan template already includes `total_phases` in its frontmatter (updated in Phase 1 of this project). The skill instructions (`SKILL.md`) do not yet document this field or explain its significance. The pipeline engine's `plan_approved` handler reads `total_phases` from the master plan frontmatter to initialize `execution.phases[]` with the correct number of phase entries. If the field is missing or invalid, the engine produces a hard error.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/create-master-plan/SKILL.md` | Add `total_phases` documentation to frontmatter field requirements |

## Implementation Steps

1. Read `.github/skills/create-master-plan/SKILL.md` in full to understand its current structure and content.
2. Locate the **Workflow** section, specifically step 7 ("Define phase outline") and step 10 ("Write the Master Plan").
3. Add a new section titled **"## Frontmatter Requirements"** after the **"## Key Rules"** section and before the **"## Template"** section. This section documents the required frontmatter fields for the master plan document.
4. In the new **Frontmatter Requirements** section, include a table of required frontmatter fields. Include all fields from the template: `project`, `total_phases`, `status`, `author`, `created`. Mark `total_phases` with a clear description that it is a required positive integer indicating the number of execution phases in the plan.
5. Add a dedicated note for `total_phases` explaining: the pipeline engine reads this field on `plan_approved` to initialize the execution phases array; the value must be a positive integer matching the number of phases defined in the Phase Outline section; a missing or invalid value produces a hard error.
6. In the **Workflow** section, update step 7 ("Define phase outline") to append: "Ensure `total_phases` in the frontmatter matches the number of phases defined here."
7. In the **Key Rules** section, add a rule: "`total_phases` must be set": The frontmatter `total_phases` field must be a positive integer matching the number of phases in the Phase Outline. The pipeline engine requires this field to initialize execution state.
8. Verify the file parses correctly as Markdown with valid YAML frontmatter after edits.

## Contracts & Interfaces

The master plan template frontmatter (already in the template file) looks like this:

```yaml
---
project: "{PROJECT-NAME}"
total_phases: {NUMBER}
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
---
```

The `total_phases` field:
- **Type**: Positive integer (1 or greater)
- **Set by**: Architect Agent when creating the master plan
- **Read by**: Pipeline engine on `plan_approved` action
- **Purpose**: Initializes `execution.phases[]` with the correct number of `not_started` phase entries
- **On missing/invalid**: Pipeline engine produces a hard error (exit code 1)

## Styles & Design Tokens

Not applicable — this is a documentation-only task.

## Test Requirements

- [ ] `.github/skills/create-master-plan/SKILL.md` has valid YAML frontmatter (the skill's own frontmatter with `name` and `description`)
- [ ] The new Frontmatter Requirements section documents `total_phases` as a required positive integer
- [ ] The Workflow step 7 references `total_phases` consistency with the phase outline
- [ ] The Key Rules section includes a rule about `total_phases`

## Acceptance Criteria

- [ ] `.github/skills/create-master-plan/SKILL.md` contains a Frontmatter Requirements section listing `total_phases` as a required field
- [ ] `total_phases` is described as a required positive integer that must match the number of phases in the Phase Outline
- [ ] The documentation states that the pipeline engine reads `total_phases` on `plan_approved` to initialize the execution phases array
- [ ] The documentation states that a missing or invalid `total_phases` value produces a hard error
- [ ] The Workflow section references `total_phases` in the phase outline step
- [ ] The Key Rules section includes a `total_phases` rule
- [ ] No references to prior behavior, migration steps, or "before/after" language — all documentation describes current system behavior only
- [ ] The file's own YAML frontmatter (`name`, `description`) is unchanged
- [ ] No other files are modified

## Constraints

- Do NOT modify any file other than `.github/skills/create-master-plan/SKILL.md`
- Do NOT modify the skill's own YAML frontmatter (`name` and `description` fields)
- Do NOT reference prior behavior, migration steps, or use "before/after" language — describe current behavior only
- Do NOT modify the template file (`.github/skills/create-master-plan/templates/MASTER-PLAN.md`) — it already has `total_phases`
- Do NOT add test files — this is a documentation-only task
- Match the existing style and tone of the SKILL.md file
