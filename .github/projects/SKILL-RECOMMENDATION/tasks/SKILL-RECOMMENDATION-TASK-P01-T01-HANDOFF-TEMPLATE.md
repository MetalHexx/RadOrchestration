---
project: "SKILL-RECOMMENDATION"
phase: 1
task: 1
title: "Consolidate Skills Field in Task Handoff Template"
status: "pending"
skills: []  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: 1
---

# Consolidate Skills Field in Task Handoff Template

## Objective

Replace the `skills_required` and `skills_optional` frontmatter fields in the task handoff template with a single `skills` array field that includes a mandatory inline YAML comment directing agents to use `.github/skills/` folder names only.

## Context

The task handoff template at `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` defines the frontmatter shape that every task handoff document uses. It currently has two separate fields — `skills_required` and `skills_optional` — which are routinely populated with technology or framework labels (e.g., "TypeScript", "React") instead of actual `.github/skills/` folder names. Consolidating to a single `skills` field with an inline YAML comment eliminates the confusing required/optional distinction and provides a persistent reminder of valid values directly in the template.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` | Replace `skills_required` and `skills_optional` frontmatter fields with single `skills` field |

## Implementation Steps

1. Open `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md`
2. In the YAML frontmatter block, locate the two lines:
   ```yaml
   skills_required: ["{skill-1}", "{skill-2}"]
   skills_optional: ["{skill-3}"]
   ```
3. Remove both lines
4. Insert the following single line in the same position (after `status: "pending"`, before `estimated_files:`):
   ```yaml
   skills: ["{skill-1}", "{skill-2}"]  # Skill folder names from .github/skills/ — NOT technology or framework names
   ```
5. Verify no other frontmatter fields were changed — the `project`, `phase`, `task`, `title`, `status`, and `estimated_files` fields must remain exactly as they are
6. Verify the rest of the template body (everything after the closing `---`) is completely unchanged

## Contracts & Interfaces

The frontmatter after modification must be exactly:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "pending"
skills: ["{skill-1}", "{skill-2}"]  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: {NUMBER}
---
```

Key rules:
- The `skills` field is a YAML array using inline flow syntax (`[...]`)
- Placeholder values use the `{skill-1}`, `{skill-2}` pattern consistent with other template placeholders
- The inline comment (`# Skill folder names from .github/skills/ — NOT technology or framework names`) is mandatory and must appear on the same line as the `skills` field
- The em dash (`—`) in the comment is intentional; do not replace with a hyphen

## Styles & Design Tokens

Not applicable — this task modifies a markdown template file with no visual output.

## Test Requirements

- [ ] The modified file parses as valid YAML frontmatter (the `---` delimiters are intact and the YAML between them is syntactically valid)
- [ ] The `skills` field is present in the frontmatter
- [ ] The `skills_required` field is NOT present in the frontmatter
- [ ] The `skills_optional` field is NOT present in the frontmatter
- [ ] The inline YAML comment text is exactly: `# Skill folder names from .github/skills/ — NOT technology or framework names`
- [ ] The template body below the frontmatter is identical to the original

## Acceptance Criteria

- [ ] The file `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` contains a `skills` frontmatter field with placeholder values `["{skill-1}", "{skill-2}"]`
- [ ] The `skills` field line includes the inline YAML comment `# Skill folder names from .github/skills/ — NOT technology or framework names`
- [ ] The `skills_required` field is completely removed from the frontmatter
- [ ] The `skills_optional` field is completely removed from the frontmatter
- [ ] All other frontmatter fields (`project`, `phase`, `task`, `title`, `status`, `estimated_files`) are unchanged
- [ ] The template body (all content after the closing `---`) is unchanged
- [ ] No other files are modified

## Constraints

- Do NOT modify any frontmatter field other than replacing `skills_required`/`skills_optional` with `skills`
- Do NOT modify the template body below the frontmatter closing `---`
- Do NOT change any other file — this task targets exactly one file
- Do NOT add any new frontmatter fields beyond `skills`
- Do NOT remove the inline YAML comment — it is a critical safeguard against mislabeling
