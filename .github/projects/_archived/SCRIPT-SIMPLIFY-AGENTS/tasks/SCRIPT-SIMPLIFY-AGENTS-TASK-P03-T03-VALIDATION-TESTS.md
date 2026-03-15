---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
task: 3
title: "Update Validation Test Suites"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update Validation Test Suites

## Objective

Update the 5 validation test suites under `.github/orchestration/scripts/tests/` to remove stale references to files and artifacts deleted in Phase 3 Tasks 1–2, and verify that validation check modules themselves contain no stale references. All 321 tests must continue to pass after changes.

## Context

Phase 3 T01 deleted 3 standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) and their 3 test files. T02 deleted `state-management.instructions.md`, `state-json-schema.md`, and the `schemas/` directory. Phase 2 renamed `review-code` skill to `review-task` and deleted `triage-report` skill. The validation test suites use mock data that may still reference these deleted artifacts. The known stale reference is in `instructions.test.js` lines 196 and 211 where mock data uses the deleted filename `state-management.instructions.md`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/instructions.test.js` | Update mock data referencing `state-management.instructions.md` (lines 196, 211) |
| VERIFY | `.github/orchestration/scripts/tests/structure.test.js` | Confirm no stale references to `schemas/`, deleted scripts, or deleted docs |
| VERIFY | `.github/orchestration/scripts/tests/cross-refs.test.js` | Confirm no stale references to `review-code` skill or `triage-report` skill |
| VERIFY | `.github/orchestration/scripts/tests/skills.test.js` | Confirm no stale references to `triage-report` or `review-code` skill names |
| VERIFY | `.github/orchestration/scripts/tests/agents.test.js` | Confirm no stale references to deleted artifacts |
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/checks/structure.js` | Confirm no references to `schemas/` or deleted scripts |
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/checks/cross-refs.js` | Confirm no references to `review-code` or `triage-report` |
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/checks/skills.js` | Confirm no references to `triage-report` or `review-code` |
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/checks/agents.js` | Confirm no references to deleted artifacts |
| VERIFY | `.github/skills/validate-orchestration/scripts/lib/checks/instructions.js` | Confirm no references to `state-management.instructions.md` |

## Implementation Steps

1. **Open `instructions.test.js`** and locate the test `'multiple instruction files — all validated, all added to context'` (~line 191).

2. **Update the mock filename** on line 196: change `'state-management.instructions.md'` to `'coding-standards.instructions.md'` (or any non-deleted generic name). This is in the `mockListFiles` return array.

3. **Update the assertion** on line 211: change `'state-management.instructions.md'` to the same replacement name used in step 2. This is in `assert.strictEqual(ctx.instructions[1].filename, ...)`.

4. **Search `structure.test.js`** for any string matching `schemas`, `next-action`, `triage.js`, `validate-state`, `state-management`, or `state-json-schema`. If any mock data or assertions reference these, update them. (Expected: none found — the structure check validates `.github/` directory layout, not script files.)

5. **Search `cross-refs.test.js`** for `review-code` and `triage-report`. If any mock skill names or assertions use these old names, update to `review-task` and remove `triage-report` references respectively. (Expected: none found — mock data uses generic skill names like `create-prd`, `research-codebase`.)

6. **Search `skills.test.js`** for `review-code` and `triage-report`. Same check as step 5. (Expected: none found — mock data uses generic names like `create-prd`, `run-tests`.)

7. **Search `agents.test.js`** for `review-code`, `triage-report`, `next-action`, `triage.js`, `validate-state`, `state-management`, `schemas`. (Expected: none found — mock data uses generic agent names.)

8. **Search the 5 check modules** under `.github/skills/validate-orchestration/scripts/lib/checks/` for: `review-code`, `triage-report`, `state-management`, `next-action.js`, `validate-state.js`, `triage.js`, `schemas/`, `state-json-schema`. If any check module hardcodes these, update it AND update the corresponding test. (Expected: none found — check modules use dynamic discovery, not hardcoded filenames.)

9. **Run all 8 preserved+pipeline test suites** to confirm 321/321 tests pass:
   ```
   node --test .github/orchestration/scripts/tests/constants.test.js .github/orchestration/scripts/tests/resolver.test.js .github/orchestration/scripts/tests/state-validator.test.js .github/orchestration/scripts/tests/triage-engine.test.js .github/orchestration/scripts/tests/mutations.test.js .github/orchestration/scripts/tests/pipeline-engine.test.js .github/orchestration/scripts/tests/pipeline.test.js .github/orchestration/scripts/tests/state-io.test.js
   ```

10. **Run all 5 validation test suites** to confirm they pass:
    ```
    node --test .github/orchestration/scripts/tests/instructions.test.js .github/orchestration/scripts/tests/structure.test.js .github/orchestration/scripts/tests/cross-refs.test.js .github/orchestration/scripts/tests/skills.test.js .github/orchestration/scripts/tests/agents.test.js
    ```

## Contracts & Interfaces

No new interfaces. The existing test files use the following mock/assertion patterns that must be preserved:

```javascript
// instructions.test.js — mock pattern (line ~196)
// mockListFiles returns an array of instruction filenames
mockListFiles = () => ['project-docs.instructions.md', '<replacement-name>.instructions.md'];

// instructions.test.js — assertion pattern (line ~211)
assert.strictEqual(ctx.instructions[1].filename, '<replacement-name>.instructions.md');
```

The test verifies that the `checkInstructions` function correctly validates multiple instruction files and populates the context. The specific filenames in mock data are arbitrary — they just need to look like valid instruction file names (pattern: `*.instructions.md`).

## Styles & Design Tokens

N/A — no UI components.

## Test Requirements

- [ ] `instructions.test.js` — all 11 tests pass after mock data update
- [ ] `structure.test.js` — all 8 tests pass (expected: no changes needed)
- [ ] `cross-refs.test.js` — all 17 tests pass (expected: no changes needed)
- [ ] `skills.test.js` — all 22 tests pass (expected: no changes needed)
- [ ] `agents.test.js` — all 17 tests pass (expected: no changes needed)
- [ ] All 8 preserved lib + pipeline test suites (321 tests total) still pass unmodified

## Acceptance Criteria

- [ ] No validation test file references `state-management.instructions.md`
- [ ] No validation test file references `review-code` as a skill name (should be `review-task` if present)
- [ ] No validation test file references `triage-report` as a skill name
- [ ] No validation test file references `next-action.js`, `triage.js`, or `validate-state.js`
- [ ] No validation test file references `state-json-schema.md` or `schemas/`
- [ ] No validation check module (under `.github/skills/validate-orchestration/scripts/lib/checks/`) hardcodes any of the above deleted artifact names
- [ ] All 5 validation test suites pass: `instructions.test.js`, `structure.test.js`, `cross-refs.test.js`, `skills.test.js`, `agents.test.js`
- [ ] All 8 lib + pipeline test suites pass (321 total tests, 0 failures)
- [ ] Build succeeds (no syntax errors, all imports resolve)

## Constraints

- Do NOT modify any lib module under `.github/orchestration/scripts/lib/` (constants.js, resolver.js, state-validator.js, triage-engine.js)
- Do NOT modify any pipeline module (pipeline.js, pipeline-engine.js, mutations.js, state-io.js)
- Do NOT modify any pipeline or lib test file (mutations.test.js, pipeline-engine.test.js, pipeline.test.js, state-io.test.js, constants.test.js, resolver.test.js, state-validator.test.js, triage-engine.test.js)
- Do NOT modify `state.json`
- Do NOT modify agent definitions, skill files, or instruction files
- If a check module itself contains stale references (not expected based on analysis), fix the check module AND its test — but flag this as a deviation in the task report
- Replacement mock filenames must follow the `*.instructions.md` naming pattern and must not reference any real file that could be deleted in the future
