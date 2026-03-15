---
project: "PIPELINE-HOTFIX"
phase: 3
task: 3
title: "Project Structure & Overview Documentation"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Project Structure & Overview Documentation

## Objective

Add `ERROR-LOG.md` as a project artifact in `docs/project-structure.md` and update `README.md` to include error logging in the project files description and key features.

## Context

The orchestration system now includes a `log-error` skill that the Orchestrator invokes on pipeline failures (`success: false`). It produces an append-only `{NAME}-ERROR-LOG.md` file in each project folder. The Orchestrator is the sole writer. The two documentation files targeted by this task need to reflect this artifact. All documentation describes current system behavior only — no references to prior behavior, migration history, or before/after language.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/project-structure.md` | Add ERROR-LOG.md to project folder tree, document types table, and file ownership |
| MODIFY | `README.md` | Mention ERROR-LOG.md and error logging capability |

## Implementation Steps

### `docs/project-structure.md`

1. **Read the file** to understand current structure and style conventions.

2. **Add `{NAME}-ERROR-LOG.md` to the Project Folder Structure tree**. Insert it after `{NAME}-MASTER-PLAN.md` (alongside other top-level project files, before the `phases/` subfolder). The current tree is:

   ```
   {PROJECT-NAME}/
   ├── state.json
   ├── BRAINSTORMING.md
   ├── {NAME}-RESEARCH-FINDINGS.md
   ├── {NAME}-PRD.md
   ├── {NAME}-DESIGN.md
   ├── {NAME}-ARCHITECTURE.md
   ├── {NAME}-MASTER-PLAN.md
   ├── phases/
   │   ├── ...
   ├── tasks/
   │   ├── ...
   └── reports/
       ├── ...
   ```

   Add this line after `{NAME}-MASTER-PLAN.md`:
   ```
   ├── {NAME}-ERROR-LOG.md
   ```

3. **Add an `ERROR-LOG.md` row to the Execution Documents table**. The current table is in the "Document Types" → "Execution Documents" section. Add a new row at the end of the table:

   | Document | Sole Writer | Contents |
   |----------|-------------|----------|
   | `ERROR-LOG.md` | Orchestrator (via `log-error` skill) | Append-only numbered error entries from pipeline failures |

4. **Add `ERROR-LOG.md` to the Naming Conventions table**. The current "Project Files" naming table ends with `CODE-REVIEW-P{NN}-T{NN}.md`. Add a new row:

   | Pattern | Example |
   |---------|---------|
   | `{NAME}-ERROR-LOG.md` | `MYAPP-ERROR-LOG.md` |

### `README.md`

5. **Read the file** to understand current structure and style.

6. **Add error logging to the "Continuous Verification" subsection** under "Key Features". The current text is:

   ```markdown
   ### Continuous Verification

   Every task produces a report. Every report is reviewed against the plan. Minor issues trigger automatic corrective tasks. Critical issues halt the pipeline for human intervention. Plans don't drift unchecked.
   ```

   Append one sentence about error logging to the end of this paragraph:
   ```
   Pipeline failures are logged to a structured, append-only error log (`ERROR-LOG.md`) in each project folder.
   ```

   The updated paragraph should read:
   ```markdown
   ### Continuous Verification

   Every task produces a report. Every report is reviewed against the plan. Minor issues trigger automatic corrective tasks. Critical issues halt the pipeline for human intervention. Plans don't drift unchecked. Pipeline failures are logged to a structured, append-only error log (`ERROR-LOG.md`) in each project folder.
   ```

7. **No other changes to README.md**. The mention is brief and fits naturally in the existing section. Do not add a new subsection, bullet, or separate feature block for error logging.

## Contracts & Interfaces

Not applicable — this is a documentation-only task with no code contracts.

## Styles & Design Tokens

Not applicable — no UI components.

## Test Requirements

- [ ] `docs/project-structure.md` contains `{NAME}-ERROR-LOG.md` in the project folder tree
- [ ] `docs/project-structure.md` contains an `ERROR-LOG.md` row in the Execution Documents table with sole writer `Orchestrator (via log-error skill)`
- [ ] `docs/project-structure.md` contains `{NAME}-ERROR-LOG.md` in the naming conventions table
- [ ] `README.md` mentions `ERROR-LOG.md` in the Continuous Verification section

## Acceptance Criteria

- [ ] `docs/project-structure.md` project folder tree includes `{NAME}-ERROR-LOG.md` as a top-level project file (after `{NAME}-MASTER-PLAN.md`, before `phases/`)
- [ ] `docs/project-structure.md` Execution Documents table includes `ERROR-LOG.md` with sole writer `Orchestrator (via log-error skill)` and contents description
- [ ] `docs/project-structure.md` naming conventions table includes `{NAME}-ERROR-LOG.md` pattern with example `MYAPP-ERROR-LOG.md`
- [ ] `README.md` Continuous Verification section mentions `ERROR-LOG.md` and error logging
- [ ] No documentation references prior behavior, migration steps, or before/after language
- [ ] Both files maintain their existing formatting style and conventions
- [ ] No other files are modified

## Constraints

- Do NOT add a separate "Error Logging" feature subsection to README.md — integrate into the existing Continuous Verification subsection
- Do NOT reference any planning documents (PRD, Architecture, Design, Master Plan) in the content you write
- Do NOT use before/after language or mention that error logging is "new" or was "added"
- Do NOT modify any sections beyond those specified above
- Do NOT add error logging to the Mermaid diagram in README.md
- Documentation describes current system behavior as fact — present tense, no change narrative
