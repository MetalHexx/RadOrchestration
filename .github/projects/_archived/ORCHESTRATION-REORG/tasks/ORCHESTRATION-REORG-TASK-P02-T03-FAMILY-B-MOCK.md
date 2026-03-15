---
project: "ORCHESTRATION-REORG"
phase: 2
task: 3
title: "Migrate Family B — Mock-Pattern Validator Tests"
status: "pending"
skills_required: ["file creation", "file copy", "path rewrite", "dynamic path analysis"]
skills_optional: []
estimated_files: 6
---

# Migrate Family B — Mock-Pattern Validator Tests

## Objective

Copy 6 Family B test files that use the `require.resolve()` + `require.cache` mock pattern from `tests/` to `.github/orchestration/scripts/tests/`, updating all static `require()` and dynamic `require.resolve()` path strings from `../.github/skills/` to `../../../skills/`.

## Context

The project is relocating test files from the repo-root `tests/` directory into `.github/orchestration/scripts/tests/`. Phase 2 Task 1 already created the target directory and migrated Family A tests. Task 2 migrated the 5 simpler Family B files. This task handles the remaining 6 Family B files — the ones that manipulate `require.cache` to inject mock dependencies. The path depth change means `../.github/skills/` (1 level up to repo root, then into `.github/`) becomes `../../../skills/` (3 levels up to `.github/`, then into `skills/`). The `require.cache[]` key references use resolved absolute path variables and do NOT need string changes.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests/agents.test.js` | Copy from `tests/agents.test.js`, update 3 path strings |
| CREATE | `.github/orchestration/scripts/tests/config.test.js` | Copy from `tests/config.test.js`, update 3 path strings |
| CREATE | `.github/orchestration/scripts/tests/cross-refs.test.js` | Copy from `tests/cross-refs.test.js`, update 2 path strings |
| CREATE | `.github/orchestration/scripts/tests/instructions.test.js` | Copy from `tests/instructions.test.js`, update 3 path strings |
| CREATE | `.github/orchestration/scripts/tests/prompts.test.js` | Copy from `tests/prompts.test.js`, update 3 path strings |
| CREATE | `.github/orchestration/scripts/tests/skills.test.js` | Copy from `tests/skills.test.js`, update 3 path strings |

## Implementation Steps

1. **Copy each source file** from `tests/<name>.test.js` to `.github/orchestration/scripts/tests/<name>.test.js` (6 files total).

2. **In each copied file, apply the text replacement** `../.github/skills/` → `../../../skills/` to ALL occurrences. This single find-and-replace handles both static `require()` and dynamic `require.resolve()` calls because they share the same prefix string.

3. **Verify the exact transformation count per file** against the table below — confirm no occurrences were missed and no extra replacements were made:

   | File | Expected Replacements |
   |------|-----------------------|
   | `agents.test.js` | 3 (lines 18, 19, 49) |
   | `config.test.js` | 3 (lines 15, 16, 45) |
   | `cross-refs.test.js` | 2 (lines 14, 31) |
   | `instructions.test.js` | 3 (lines 16, 17, 46) |
   | `prompts.test.js` | 3 (lines 16, 17, 46) |
   | `skills.test.js` | 3 (lines 19, 20, 46) |

4. **Audit for false positives**: Some files contain `.github` in test fixture data (e.g., `base_path: '.github/projects'` in `config.test.js` and `cross-refs.test.js`, or `applyTo: '.github/projects/**'` in `instructions.test.js`). These are NOT path references and must NOT be modified. The find-and-replace in step 2 targets `../.github/skills/` specifically, which will not match these fixture strings.

5. **Verify `require.cache[]` keys are untouched**: The `require.cache[fsHelpersPath]`, `require.cache[frontmatterPath]`, and `require.cache[yamlParserPath]` assignments use variable names (not string literals) as keys. Confirm these lines are unchanged — they resolve at runtime from the updated `require.resolve()` calls.

6. **Verify no `path.join()` or `path.resolve()` filesystem path constructs** reference `../.github/skills/` or `../src/`. These files should have NONE (confirmed by pre-task audit).

7. **Confirm originals are untouched**: Verify the 6 source files in `tests/` are byte-identical to their committed versions (e.g., `git diff tests/agents.test.js tests/config.test.js tests/cross-refs.test.js tests/instructions.test.js tests/prompts.test.js tests/skills.test.js`).

8. **Smoke test**: Run at least 1 mock-pattern test at the new location to confirm the `require.resolve()` → `require.cache` mock wiring works:
   ```bash
   node --test .github/orchestration/scripts/tests/agents.test.js
   ```

## Contracts & Interfaces

No new interfaces or contracts. This is a file-copy-and-path-rewrite task.

### Path Transformation Contract

**Single replacement rule**: In every copied file, replace ALL occurrences of the string `../.github/skills/` with `../../../skills/`.

**Path geometry proof** (from new file location `.github/orchestration/scripts/tests/<file>`):
- `../` → `.github/orchestration/scripts/`
- `../../` → `.github/orchestration/`
- `../../../` → `.github/`
- `../../../skills/...` → `.github/skills/...` ✓

### Exact Transformations — Static `require()` (6 total)

| File | Line | Current | New |
|------|------|---------|-----|
| `agents.test.js` | 49 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/agents')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/agents')` |
| `config.test.js` | 45 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/config')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/config')` |
| `cross-refs.test.js` | 31 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/cross-refs')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/cross-refs')` |
| `instructions.test.js` | 46 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/instructions')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/instructions')` |
| `prompts.test.js` | 46 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/prompts')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/prompts')` |
| `skills.test.js` | 46 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/skills')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/skills')` |

### Exact Transformations — Dynamic `require.resolve()` (11 total)

| File | Line | Current | New |
|------|------|---------|-----|
| `agents.test.js` | 18 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `agents.test.js` | 19 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `config.test.js` | 15 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `config.test.js` | 16 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` |
| `cross-refs.test.js` | 14 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `instructions.test.js` | 16 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `instructions.test.js` | 17 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `prompts.test.js` | 16 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `prompts.test.js` | 17 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `skills.test.js` | 19 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `skills.test.js` | 20 | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |

## Styles & Design Tokens

N/A — no UI components in scope.

## Test Requirements

- [ ] Run `node --test .github/orchestration/scripts/tests/agents.test.js` — all tests pass
- [ ] Run `node --test .github/orchestration/scripts/tests/config.test.js` — all tests pass
- [ ] Run `node --test .github/orchestration/scripts/tests/cross-refs.test.js` — all tests pass
- [ ] Run `node --test .github/orchestration/scripts/tests/instructions.test.js` — all tests pass
- [ ] Run `node --test .github/orchestration/scripts/tests/prompts.test.js` — all tests pass
- [ ] Run `node --test .github/orchestration/scripts/tests/skills.test.js` — all tests pass

## Acceptance Criteria

- [ ] All 6 test files exist at `.github/orchestration/scripts/tests/`
- [ ] All 6 static `require()` paths updated — `../.github/skills/` → `../../../skills/`
- [ ] All 11 dynamic `require.resolve()` paths updated — `../.github/skills/` → `../../../skills/`
- [ ] Total of exactly 17 string replacements across all 6 files (6 static + 11 dynamic)
- [ ] `require.cache[]` key assignments use variable names (not string literals) — confirmed unchanged
- [ ] No test fixture data modified (e.g., `base_path: '.github/projects'` strings remain as-is)
- [ ] No other code modifications — only the `require()` and `require.resolve()` path strings change
- [ ] Original 6 `tests/` files remain untouched (`git diff` returns empty)
- [ ] At least 1 mock-pattern test passes at new location (smoke test)
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify the original files in `tests/` — only create new copies
- Do NOT modify `require.cache[]` key expressions — they use resolved path variables, not string literals
- Do NOT modify `.github` references that appear in test fixture data (e.g., `base_path: '.github/projects'`, `applyTo: '.github/projects/**'`) — those are test data, not import paths
- Do NOT modify any `require('node:test')`, `require('node:assert')`, or `require('path')` imports — only `../.github/skills/` paths change
- Do NOT add, remove, or reorder any code — this is a pure path-string replacement task
- Do NOT modify files from previous tasks (Family A tests, Family B simple tests)
