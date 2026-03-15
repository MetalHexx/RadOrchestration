---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 4
title: "Cleanup & Final Verification"
status: "pending"
skills_required: ["coder"]
skills_optional: ["run-tests"]
estimated_files: 2
---

# Cleanup & Final Verification

## Objective

Delete the old `lib-old/` and `tests-v3/` directories that are no longer needed after the v3 swap, perform a comprehensive grep audit confirming no stale v2 references remain in active operational files, and run final verification (full test suite + pipeline CLI smoke test) to confirm the production engine is healthy.

## Context

Phase 4 Task 1 (File Swap) renamed `lib-v3/` → `lib/` and `lib/` → `lib-old/`, copied `tests-v3/` into `tests/`, and fixed all require paths. The `lib-v3/` directory no longer exists. Tasks T02 (Prompts) and T03 (Docs) completed all editorial and documentation alignment. This task performs final cleanup and verification — no code modifications are involved, only deletions and auditing. As of T01, 522 tests pass with 0 failures.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| DELETE | `.github/orchestration/scripts/lib-old/` | Entire directory — the preserved v2 modules (7 files). No longer needed for rollback. |
| DELETE | `.github/orchestration/scripts/tests-v3/` | Entire directory — the original v3 test location. All files already copied to `tests/` with fixed require paths in T01. |

## Implementation Steps

1. **Delete `lib-old/` directory**: Remove `.github/orchestration/scripts/lib-old/` and all its contents. This contains the original v2 modules preserved during the T01 swap for rollback safety.

2. **Delete `tests-v3/` directory**: Remove `.github/orchestration/scripts/tests-v3/` and all its contents (test files + `helpers/` subdirectory). These files were already copied to `tests/` with corrected require paths in T01.

3. **Verify `lib-v3/` does not exist**: Confirm `.github/orchestration/scripts/lib-v3/` directory does NOT exist. It was renamed to `lib/` in T01. If it somehow still exists, delete it.

4. **Grep audit — stale path references**: Search the following directories for `lib-v3/` and `tests-v3/` path references:
   - `.github/orchestration/scripts/` (all `.js` files)
   - `.github/agents/` (all `.md` files)
   - `.github/skills/` (all `.md` files)
   - `.github/instructions/` (all `.md` files)
   - `docs/` (all `.md` files)
   
   **Expected**: Zero matches in these locations. References in `.github/projects/PIPELINE-SIMPLIFICATION/` planning documents (PRD, Architecture, Master Plan, Phase Plans, Task Handoffs, Reports) are historical and acceptable — do NOT flag these.

5. **Grep audit — stale v2 terms**: Search the same directories (agents, skills, instructions, docs, scripts) for:
   - `triage-engine` or `triage_engine` (old module name)
   - `orchestration-state-v2` (old schema identifier)
   - `state-validator` (old module name — v3 uses `validator`)
   - `TRIAGE_LEVELS` (removed enum)
   - `create_corrective_handoff` or `CREATE_CORRECTIVE_HANDOFF` (merged action)
   
   **Expected**: Zero matches in active operational files. Matches in project planning documents under `.github/projects/PIPELINE-SIMPLIFICATION/` are historical and acceptable.

6. **Categorize grep findings**: For any matches found, categorize each as:
   - **Historical/Acceptable**: In project docs (PRD, Architecture, Research, Master Plan, Phase Plans, Task Handoffs, Task Reports, Code Reviews, Phase Reports) — these document what was done and should NOT be modified.
   - **Stale/Must-Fix**: In active operational files (agents, skills, instructions, docs, scripts) — these indicate incomplete alignment from T02/T03 and must be reported as issues.

7. **Run full test suite**: Execute all tests in `.github/orchestration/scripts/tests/` directory. All 522+ tests must pass with 0 failures. Report the exact count.

8. **Verify pipeline CLI**: Run the pipeline entry point to confirm it loads and returns a valid response:
   ```
   node .github/orchestration/scripts/pipeline.js --event start --project-dir .github/projects/PIPELINE-SIMPLIFICATION
   ```
   The command should:
   - Exit with code 0
   - Print valid JSON to stdout
   - The JSON must contain `success`, `action`, and `context` fields (the `PipelineResult` contract)

9. **Verify no broken requires**: Run a quick `node -e "require('./.github/orchestration/scripts/lib/pipeline-engine')"` to confirm the production engine module loads without errors.

## Contracts & Interfaces

**PipelineResult** (expected shape from pipeline CLI in step 8):

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js
// processEvent returns:
{
  success: Boolean,        // true if mutation + validation + write succeeded
  action: String,          // one of ~18 external actions from NEXT_ACTIONS
  context: Object,         // action-specific context (doc_path, details, is_correction, etc.)
  mutations_applied: Array // list of mutation descriptions applied
}
```

**CLI flags** (for step 8):
- `--event <event_name>` — the pipeline event to process (e.g., `start`)
- `--project-dir <path>` — relative path to the project directory

## Styles & Design Tokens

N/A — no UI or design work in this task.

## Test Requirements

- [ ] Full test suite passes: all tests in `.github/orchestration/scripts/tests/` run with 0 failures
- [ ] Pipeline CLI returns valid JSON with `PipelineResult` contract fields
- [ ] Production engine module loads without errors (`require()` succeeds)
- [ ] `lib-old/` directory does not exist after cleanup
- [ ] `tests-v3/` directory does not exist after cleanup
- [ ] `lib-v3/` directory does not exist (was already removed in T01)

## Acceptance Criteria

- [ ] `.github/orchestration/scripts/lib-old/` directory deleted (does not exist)
- [ ] `.github/orchestration/scripts/tests-v3/` directory deleted (does not exist)
- [ ] `.github/orchestration/scripts/lib-v3/` directory does not exist
- [ ] Grep audit for `lib-v3/` returns zero matches in active operational files (agents, skills, instructions, docs, scripts)
- [ ] Grep audit for `tests-v3/` returns zero matches in active operational files
- [ ] Grep audit for `triage-engine`/`triage_engine` returns zero matches in active operational files
- [ ] Grep audit for `orchestration-state-v2` returns zero matches in active operational files
- [ ] Grep audit for `state-validator` returns zero matches in active operational files
- [ ] Grep audit for `TRIAGE_LEVELS` returns zero matches in active operational files
- [ ] Grep audit for `create_corrective_handoff`/`CREATE_CORRECTIVE_HANDOFF` returns zero matches in active operational files
- [ ] All stale findings (if any) categorized as historical/acceptable or stale/must-fix in the task report
- [ ] Full test suite passes (522+ tests, 0 failures)
- [ ] Pipeline CLI (`node pipeline.js --event start --project-dir ...`) exits code 0 with valid JSON output
- [ ] Production engine module loads without `require()` errors
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify any source code in `.github/orchestration/scripts/lib/` — T04 is cleanup only
- Do NOT modify any agent, skill, instruction, or documentation files — T02 and T03 handled those
- Do NOT modify any files under `.github/projects/PIPELINE-SIMPLIFICATION/` (planning documents are historical)
- Do NOT delete `lib-old/` or `tests-v3/` before confirming the full test suite passes — verify first, then delete, then re-verify
- Do NOT create new files — this task only deletes existing files/directories and runs verification
- If the grep audit surfaces any stale/must-fix references, report them as issues in the task report — do NOT fix them (that would be out of scope for T04)
