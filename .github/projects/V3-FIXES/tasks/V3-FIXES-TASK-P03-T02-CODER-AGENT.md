---
project: "V3-FIXES"
phase: 3
task: 2
title: "Add CWD Restoration Step to Coder Agent Workflow"
status: "pending"
skills: []
estimated_files: 1
---

# Add CWD Restoration Step to Coder Agent Workflow

## Objective

Insert a CWD restoration step into the Coder agent's workflow in `coder.agent.md`, between the current step 9 ("Run build") and step 10 ("Check acceptance criteria"), and renumber subsequent steps so the workflow runs from 1 to 13.

## Context

The orchestration pipeline invokes `pipeline.js` using relative or workspace-root-relative paths. If the Coder agent changes the working directory during task execution (e.g., `cd` into a subdirectory to run tests or builds) and does not restore it, subsequent `pipeline.js` invocations by the Orchestrator silently fail. This step adds a tertiary hardening rule — a mandatory CWD restore — to the Coder's workflow to prevent CWD drift.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/coder.agent.md` | Insert new step 10 in the Workflow section; renumber steps 10–12 → 11–13 |

## Implementation Steps

1. Open `.github/agents/coder.agent.md`.
2. Locate the "## Workflow" section and find the numbered step list.
3. Identify step 9: `**Run build**: Execute the build command to verify compilation`.
4. Immediately after step 9, insert the following as new step 10:

   ```markdown
   10. **Restore the working directory**: After running any terminal commands inside a project subdirectory, restore CWD to the workspace root before continuing:
       ```
       cd <workspace-root>
       ```
       Failure to restore CWD will silently break all subsequent `pipeline.js` invocations in this run.
   ```

5. Renumber the existing step 10 ("Check acceptance criteria") to step 11.
6. Renumber the existing step 11 ("Use the `generate-task-report` skill") to step 12.
7. Renumber the existing step 12 ("Save the Task Report") to step 13.
8. Verify the final step list runs sequentially from 1 to 13 with no gaps or duplicates.
9. Verify no existing text in the file has been removed or altered beyond the step renumbering.

## Contracts & Interfaces

Not applicable — this task modifies a markdown instruction file, not source code. No interfaces or contracts apply.

## Styles & Design Tokens

Not applicable — no UI components involved.

## Test Requirements

- [ ] Manual inspection: the new step 10 text matches the verbatim wording in Implementation Steps (step 4) above
- [ ] Manual inspection: steps 1–9 remain unchanged from the original file
- [ ] Manual inspection: the former steps 10, 11, 12 now appear as steps 11, 12, 13 with their original text intact

## Acceptance Criteria

- [ ] CWD restoration step is present in the Coder workflow at position 10, between "Run build" (step 9) and "Check acceptance criteria" (step 11)
- [ ] The step is phrased as a hard requirement with consequence: includes the sentence "Failure to restore CWD will silently break all subsequent `pipeline.js` invocations in this run."
- [ ] Subsequent steps are renumbered correctly: "Check acceptance criteria" = 11, "generate-task-report" = 12, "Save the Task Report" = 13
- [ ] No existing instruction text in `coder.agent.md` has been removed or broken
- [ ] Only `.github/agents/coder.agent.md` is modified — no other files touched
- [ ] Build succeeds (no build applies — markdown only; this criterion is automatically met)

## Constraints

- Do NOT modify any file other than `.github/agents/coder.agent.md`
- Do NOT alter the YAML frontmatter of the file
- Do NOT change the content of any existing step — only renumber steps 10–12
- Do NOT add any other new steps, sections, or rules beyond the single CWD restoration step
- Do NOT remove or reword any existing text in the file
