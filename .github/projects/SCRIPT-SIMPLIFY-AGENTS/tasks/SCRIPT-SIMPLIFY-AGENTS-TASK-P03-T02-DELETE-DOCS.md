---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
task: 2
title: "Delete Shadow Docs & Schemas Dir"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 3
---

# Delete Shadow Docs & Schemas Dir

## Objective

Delete the prose shadow documentation file (`state-json-schema.md`), the instruction file that is now redundant post-refactor (`state-management.instructions.md`), and the `.github/orchestration/schemas/` directory that will be empty after the schema deletion.

## Context

The orchestration system was refactored in Phases 1–2 to introduce `pipeline.js` as the sole state-mutation authority. The prose `state-json-schema.md` was a shadow of `constants.js` + `state-validator.js` and is now outdated and unused. The `state-management.instructions.md` file targeted `**/state.json` to guide agents on state writes, but no agent writes state post-refactor — only `pipeline.js` does. The `copilot-instructions.md` and agent definitions were updated in Phase 2 and no longer reference these files. T01 of this phase already deleted the 3 standalone scripts and their tests; this task continues the cleanup by removing the shadow documentation artifacts.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| DELETE | `.github/orchestration/schemas/state-json-schema.md` | Prose shadow of `constants.js` + `state-validator.js`; no runtime consumer |
| DELETE | `.github/instructions/state-management.instructions.md` | All 6 sections wrong/redundant post-refactor; `applyTo: **/state.json` no longer relevant since no agent writes state |
| DELETE | `.github/orchestration/schemas/` | Directory will be empty after `state-json-schema.md` deletion; remove the directory itself |

## Implementation Steps

1. **Verify no runtime references to `state-json-schema.md`**: Grep the workspace (excluding `.github/projects/`) for the string `state-json-schema.md`. Confirm zero matches in active system files (agents, skills, instructions, scripts, config). Matches in project planning docs (`.github/projects/`) are expected and acceptable.
2. **Verify no runtime references to `state-management.instructions.md`**: Grep the workspace (excluding `.github/projects/`) for the string `state-management.instructions.md`. Confirm zero matches in active system files. The only expected reference is in `.github/copilot-instructions.md` under the `<instructions>` block — but Phase 2 T07 already removed it. If an unexpected reference is found, note it in the task report but proceed with deletion.
3. **Delete `.github/orchestration/schemas/state-json-schema.md`**: Remove the file.
4. **Delete the `.github/orchestration/schemas/` directory**: After the schema file is deleted, the directory should be empty. Remove the directory. If any unexpected files exist in the directory, list them in the task report and delete them as well (the Architecture marks the entire directory for deletion).
5. **Delete `.github/instructions/state-management.instructions.md`**: Remove the file. After deletion, the `.github/instructions/` directory should still contain `project-docs.instructions.md` — do NOT delete that file or the directory.
6. **Verify preserved files are intact**: Confirm the following still exist and are unmodified:
   - `.github/instructions/project-docs.instructions.md`
   - `.github/orchestration/scripts/pipeline.js`
   - `.github/orchestration/scripts/lib/` (all 8 modules)
   - `.github/orchestration/scripts/tests/` (all 8 test files)
7. **Run all test suites**: Execute `node --test .github/orchestration/scripts/tests/*.test.js` and confirm all 321 tests pass with 0 failures. No test file should be modified or deleted by this task.

## Contracts & Interfaces

No contracts or interfaces apply — this task performs only file deletions.

## Styles & Design Tokens

Not applicable — no UI changes.

## Test Requirements

- [ ] All 8 preserved test suites pass after deletions (321/321 tests, 0 failures)
- [ ] No new tests are required — this task only deletes files

## Acceptance Criteria

- [ ] `.github/orchestration/schemas/state-json-schema.md` does not exist
- [ ] `.github/orchestration/schemas/` directory does not exist
- [ ] `.github/instructions/state-management.instructions.md` does not exist
- [ ] `.github/instructions/project-docs.instructions.md` still exists (unchanged)
- [ ] `.github/orchestration/scripts/pipeline.js` still exists (unchanged)
- [ ] All files in `.github/orchestration/scripts/lib/` still exist (unchanged)
- [ ] All files in `.github/orchestration/scripts/tests/` still exist (unchanged)
- [ ] All test suites pass (`node --test` exits 0) — 321/321 tests, 0 failures
- [ ] No files were created or modified — only deletions
- [ ] Grep for `state-json-schema.md` in active system files (outside `.github/projects/`) returns zero matches
- [ ] Grep for `state-management.instructions.md` in active system files (outside `.github/projects/`) returns zero matches

## Constraints

- Do NOT delete `.github/instructions/project-docs.instructions.md`
- Do NOT delete or modify any files in `.github/skills/`
- Do NOT delete or modify any files in `.github/agents/`
- Do NOT delete or modify `.github/orchestration/scripts/pipeline.js`
- Do NOT delete or modify any files in `.github/orchestration/scripts/lib/`
- Do NOT delete or modify any files in `.github/orchestration/scripts/tests/`
- Do NOT modify any file — this task performs deletions only
- Do NOT update `state.json` — the pipeline script handles all state mutations
