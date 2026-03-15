---
project: "PIPELINE-HOTFIX"
phase: 3
task: 4
title: "Instruction File Updates"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Instruction File Updates

## Objective

Update `.github/copilot-instructions.md` and `.github/instructions/project-docs.instructions.md` to include `ERROR-LOG.md` as a recognized project artifact with its ownership entry.

## Context

The orchestration system uses two instruction files that describe project structure and document ownership. The `log-error` skill (created in Phase 2) produces `{NAME}-ERROR-LOG.md` files inside project directories. These two instruction files must list `ERROR-LOG.md` so that all agents are aware it exists and know which agent writes it. The Orchestrator is the sole writer of `ERROR-LOG.md` (via the `log-error` skill).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/copilot-instructions.md` | Add `ERROR-LOG.md` to the Project Files contents list |
| MODIFY | `.github/instructions/project-docs.instructions.md` | Add `ERROR-LOG.md` row to the File Ownership table |

## Implementation Steps

1. **Read** `.github/copilot-instructions.md` in full to understand its current structure and style.
2. **Locate** the `### Project Files` section. Within the `Contents:` bullet list, add a new bullet for `ERROR-LOG.md` after the `State: state.json` entry. Use this exact line:
   ```
   - Error log: `ERROR-LOG.md` (append-only, created by `@Orchestrator` via `log-error` skill)
   ```
3. **Verify** no other sections in `.github/copilot-instructions.md` need changes. Do not modify any other content.
4. **Read** `.github/instructions/project-docs.instructions.md` in full to understand its current structure and style.
5. **Locate** the `## File Ownership (Sole Writer Policy)` section and its markdown table. Add a new row at the end of the table (after the `PHASE-REVIEW.md` row) with these exact values:

   | `ERROR-LOG.md` | Orchestrator (via `log-error` skill) |

6. **Verify** no other sections in `.github/instructions/project-docs.instructions.md` need changes. Do not modify any other content.
7. **Confirm** both files maintain their existing formatting style — match indentation, bullet style, table alignment, and Markdown conventions already used in each file.

## Contracts & Interfaces

Not applicable — this is a documentation-only task with no code contracts.

## Styles & Design Tokens

Not applicable — no UI components involved.

## Test Requirements

- [ ] No automated tests — this is a documentation-only task
- [ ] Manual verification: `.github/copilot-instructions.md` contains `ERROR-LOG.md` in the Project Files contents list
- [ ] Manual verification: `.github/instructions/project-docs.instructions.md` contains `ERROR-LOG.md` in the ownership table with sole writer `Orchestrator (via log-error skill)`

## Acceptance Criteria

- [ ] `.github/copilot-instructions.md` Project Files contents list includes an `ERROR-LOG.md` bullet entry
- [ ] `.github/instructions/project-docs.instructions.md` File Ownership table includes an `ERROR-LOG.md` row with sole writer `Orchestrator (via log-error skill)`
- [ ] No documentation references prior behavior, migration steps, or before/after language — all text describes current system behavior in present tense
- [ ] Both files maintain their existing formatting style and conventions
- [ ] No other files are modified
- [ ] No other sections within either file are modified beyond the specified additions

## Constraints

- Do NOT modify any content outside the specified sections in each file
- Do NOT add explanatory comments, migration notes, or changelog entries
- Do NOT reference prior behavior or use before/after language — describe only current system behavior
- Do NOT modify `state.json` or any other project files
- Do NOT reformat or restructure existing content in either file
