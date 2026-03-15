---
project: "SKILL-RECOMMENDATION"
phase: 1
task: 2
title: "Add Skill Discovery Step to create-task-handoff Skill"
status: "pending"
skills: ["validate-orchestration"]  # Skill folder names from .github/skills/ — NOT technology or framework names
estimated_files: 1
---

# Add Skill Discovery Step to create-task-handoff Skill

## Objective

Add a skill discovery step to the `create-task-handoff/SKILL.md` workflow that instructs the Tactical Planner to enumerate `.github/skills/` folder names, read each skill's description, evaluate which skills would help the Coder complete the task, and populate the handoff's `skills` frontmatter field with the selected skill folder names. Insert this step after "Read inputs" (step 1) and before "Write objective" (current step 2), renumbering all subsequent steps.

## Context

The `create-task-handoff/SKILL.md` file defines the step-by-step workflow the Tactical Planner follows when creating task handoffs. The task handoff template (modified in T01) now has a single `skills` field with an inline comment: `# Skill folder names from .github/skills/ — NOT technology or framework names`. Currently, no workflow step tells the Tactical Planner how to populate that field. Without an explicit discovery step, the Planner defaults to technology labels (e.g., "TypeScript", "React") instead of actual skill folder names. This task adds the missing workflow step.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/create-task-handoff/SKILL.md` | Insert new step 2; renumber steps 2–12 to 3–13 |

## Implementation Steps

1. **Read the current SKILL.md file** at `.github/skills/create-task-handoff/SKILL.md` to confirm the existing workflow step structure
2. **Locate the Workflow section** — find the numbered list under `## Workflow`
3. **Confirm the current step structure** is:
   ```
   1. **Read inputs**: ...
   2. **Write objective**: ...
   3. **Write context**: ...
   4. **Define file targets**: ...
   5. **Write implementation steps**: ...
   6. **Inline contracts**: ...
   7. **Inline design tokens**: ...
   8. **Define test requirements**: ...
   9. **Define acceptance criteria**: ...
   10. **Add constraints**: ...
   11. **Write the Task Handoff**: ...
   12. **Save**: ...
   ```
4. **Insert the following as new step 2**, immediately after step 1 ("Read inputs") and before the current step 2 ("Write objective"):
   ```markdown
   2. **Discover available skills**: Enumerate `.github/skills/` folder names. For each skill, read the `description` field from its `SKILL.md` frontmatter. Evaluate each skill against this task's objective and implementation steps using the lens: "would a coder working on this task benefit from invoking this skill?" Select only skills with a direct functional match. Populate the `skills` frontmatter field with the selected skill folder names. Technology or framework names (e.g., "TypeScript", "React") are NOT valid values — only `.github/skills/` folder names.
   ```
5. **Renumber all subsequent steps**: Current steps 2–12 become steps 3–13. The new numbering is:
   ```
   1. Read inputs
   2. Discover available skills        ← NEW
   3. Write objective                  ← was 2
   4. Write context                    ← was 3
   5. Define file targets              ← was 4
   6. Write implementation steps       ← was 5
   7. Inline contracts                 ← was 6
   8. Inline design tokens             ← was 7
   9. Define test requirements         ← was 8
   10. Define acceptance criteria      ← was 9
   11. Add constraints                 ← was 10
   12. Write the Task Handoff          ← was 11
   13. Save                            ← was 12
   ```
6. **Verify no other sections reference step numbers** — if any prose in the file references specific step numbers (e.g., "steps 2–12" in the Corrective Handling section), update those references to reflect the new numbering

## Contracts & Interfaces

The new step 2 must use this exact text:

```markdown
2. **Discover available skills**: Enumerate `.github/skills/` folder names. For each skill, read the `description` field from its `SKILL.md` frontmatter. Evaluate each skill against this task's objective and implementation steps using the lens: "would a coder working on this task benefit from invoking this skill?" Select only skills with a direct functional match. Populate the `skills` frontmatter field with the selected skill folder names. Technology or framework names (e.g., "TypeScript", "React") are NOT valid values — only `.github/skills/` folder names.
```

Placement rule: After step 1 ("Read inputs"), before the current step 2 ("Write objective"). Current steps 2–12 become steps 3–13.

## Styles & Design Tokens

Not applicable — this task modifies a markdown instruction file with no visual output.

## Test Requirements

- [ ] The modified file has valid markdown structure (headings, numbered list, no broken formatting)
- [ ] Step 1 is still "Read inputs" with its original content unchanged
- [ ] Step 2 is the new "Discover available skills" step with the exact text specified in Contracts above
- [ ] Step 3 is "Write objective" (previously step 2) with its original content unchanged
- [ ] Step 13 is "Save" (previously step 12) with its original content unchanged
- [ ] Total step count in the Workflow section is 13 (was 12)
- [ ] No step from the original workflow is missing or has altered content (only numbers changed)

## Acceptance Criteria

- [ ] `.github/skills/create-task-handoff/SKILL.md` contains a step numbered 2 with bold title `**Discover available skills**`
- [ ] The discovery step text includes: enumerate `.github/skills/` folder names, read `description` field from `SKILL.md` frontmatter, evaluate each skill against task objective, populate `skills` frontmatter field
- [ ] The discovery step text includes the prohibition: "Technology or framework names (e.g., "TypeScript", "React") are NOT valid values — only `.github/skills/` folder names"
- [ ] The discovery step appears between step 1 ("Read inputs") and step 3 ("Write objective")
- [ ] All subsequent steps are correctly renumbered (original steps 2–12 are now 3–13)
- [ ] All original step content is preserved — only step numbers changed
- [ ] No other files are modified

## Constraints

- Do NOT modify any text content of the existing steps — only change their step numbers
- Do NOT modify sections outside the Workflow numbered list (except step-number references in other sections if they exist)
- Do NOT modify the SKILL.md frontmatter (name, description fields)
- Do NOT modify the task handoff template file (`templates/TASK-HANDOFF.md`) — that was completed in T01
- Do NOT add, remove, or reorder any other sections of the SKILL.md file
- This is a single-file change — only `.github/skills/create-task-handoff/SKILL.md` is modified
