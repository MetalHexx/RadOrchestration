---
project: "ORCHESTRATION-REORG"
phase: 2
title: "Test Suite Migration"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-11T04:00:00Z"
---

# Phase 2: Test Suite Migration

## Phase Goal

Migrate all 18 test files to `.github/orchestration/scripts/tests/` with corrected `require()` paths (both static and dynamic), without deleting or modifying the originals in `tests/`. After this phase, both old and new test locations coexist.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../ORCHESTRATION-REORG-MASTER-PLAN.md) | Phase 2 scope, exit criteria, dependency on Phase 1 |
| [Architecture](../ORCHESTRATION-REORG-ARCHITECTURE.md) | Layer 2 module map, Category E (Family A: 7 files, 11 changes) and Category F (Family B: 11 files, 12 static + 11 dynamic changes), dynamic `require.resolve()` patterns |
| [Design](../ORCHESTRATION-REORG-DESIGN.md) | Target directory layout — tests co-located with scripts at `.github/orchestration/scripts/tests/` |
| [Phase 1 Report](ORCHESTRATION-REORG-PHASE-REPORT-P01.md) | Carry-forward: dual-path coexistence active, Phase 2 path transformations depend on exact Phase 1 directory structure |
| [Phase 1 Review](PHASE-REVIEW-P01.md) | Verdict: approved. Recommendations: originals must remain untouched, 3-level nesting determines all 23+ test `require()` transformations |
| [Issues Log](../ORCHESTRATION-REORG-ISSUES.md) | ISSUE-001: Do NOT advance `current_task` on task completion — only on `advance_task` action |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Create tests directory & migrate Family A tests (script-targeting) | — | file creation, file copy, path rewrite | 7 | `tasks/ORCHESTRATION-REORG-TASK-P02-T01-FAMILY-A-TESTS.md` |
| T2 | Migrate Family B — simple validator tests (static requires only) | T1 | file copy, path rewrite | 5 | `tasks/ORCHESTRATION-REORG-TASK-P02-T02-FAMILY-B-SIMPLE.md` |
| T3 | Migrate Family B — mock-pattern validator tests (dynamic requires) | T1 | file copy, path rewrite, dynamic path analysis | 6 | `tasks/ORCHESTRATION-REORG-TASK-P02-T03-FAMILY-B-MOCKS.md` |
| T4 | Validation gate — run all 18 tests at new locations | T1, T2, T3 | testing, validation | 0 (verification only) | `tasks/ORCHESTRATION-REORG-TASK-P02-T04-VALIDATION-GATE.md` |

## Task Details

### T1: Create Tests Directory & Migrate Family A Tests (Script-Targeting)

**Objective**: Create the target test directory and copy the 7 script-targeting test files with corrected `require()` paths. These tests import from `src/` modules; after both tests and scripts have moved, the relative path changes from `../src/<path>` to `../<path>`.

**Directory to create**:
- `.github/orchestration/scripts/tests/`

**Files to copy and modify (7 files, 11 `require()` changes)**:

| Source | Target | Changes |
|--------|--------|---------|
| `tests/constants.test.js` | `.github/orchestration/scripts/tests/constants.test.js` | 1 |
| `tests/next-action.test.js` | `.github/orchestration/scripts/tests/next-action.test.js` | 2 |
| `tests/resolver.test.js` | `.github/orchestration/scripts/tests/resolver.test.js` | 2 |
| `tests/state-validator.test.js` | `.github/orchestration/scripts/tests/state-validator.test.js` | 1 |
| `tests/triage-engine.test.js` | `.github/orchestration/scripts/tests/triage-engine.test.js` | 2 |
| `tests/triage.test.js` | `.github/orchestration/scripts/tests/triage.test.js` | 1 |
| `tests/validate-state.test.js` | `.github/orchestration/scripts/tests/validate-state.test.js` | 2 |

**Transformation pattern**: `../src/` → `../` (remove the `src/` segment — tests now live inside `scripts/`)

**Exact `require()` transformations (from Architecture § Category E)**:

| File | Current | New |
|------|---------|-----|
| `constants.test.js` | `require('../src/lib/constants')` | `require('../lib/constants')` |
| `next-action.test.js` (×2) | `require('../src/next-action.js')` | `require('../next-action.js')` |
| `resolver.test.js` | `require('../src/lib/resolver.js')` | `require('../lib/resolver.js')` |
| `resolver.test.js` | `require('../src/lib/constants.js')` | `require('../lib/constants.js')` |
| `state-validator.test.js` | `require('../src/lib/state-validator.js')` | `require('../lib/state-validator.js')` |
| `triage-engine.test.js` | `require('../src/lib/triage-engine.js')` | `require('../lib/triage-engine.js')` |
| `triage-engine.test.js` | `require('../src/lib/constants.js')` | `require('../lib/constants.js')` |
| `triage.test.js` | `require('../src/triage')` | `require('../triage')` |
| `validate-state.test.js` (×2) | `require('../src/validate-state.js')` | `require('../validate-state.js')` |

**Acceptance Criteria**:
- [ ] Directory `.github/orchestration/scripts/tests/` exists
- [ ] All 7 test files exist at target locations
- [ ] Exactly 11 `require()` paths updated — all `../src/` → `../`
- [ ] No other code modifications — only the require() path strings change
- [ ] Original `tests/` files remain untouched
- [ ] Smoke test: at least 1 Family A test passes at new location (e.g., `node --test .github/orchestration/scripts/tests/constants.test.js`)

---

### T2: Migrate Family B — Simple Validator Tests (Static Requires Only)

**Objective**: Copy the 5 Family B test files that have ONLY static `require()` calls (no `require.resolve()` mock patterns). These tests import from `.github/skills/validate-orchestration/`; the relative path changes from `../.github/skills/` to `../../../skills/`.

**Files to copy and modify (5 files, 7 `require()` changes)**:

| Source | Target | Changes |
|--------|--------|---------|
| `tests/frontmatter.test.js` | `.github/orchestration/scripts/tests/frontmatter.test.js` | 1 |
| `tests/fs-helpers.test.js` | `.github/orchestration/scripts/tests/fs-helpers.test.js` | 1 |
| `tests/reporter.test.js` | `.github/orchestration/scripts/tests/reporter.test.js` | 2 |
| `tests/structure.test.js` | `.github/orchestration/scripts/tests/structure.test.js` | 1 |
| `tests/yaml-parser.test.js` | `.github/orchestration/scripts/tests/yaml-parser.test.js` | 1 |

**Transformation pattern**: `../.github/skills/` → `../../../skills/`

**Path calculation**: From `.github/orchestration/scripts/tests/<file>`:
- `../` = `.github/orchestration/scripts/`
- `../../` = `.github/orchestration/`
- `../../../` = `.github/`
- `../../../skills/...` reaches `.github/skills/...` ✓

**Exact `require()` transformations (from Architecture § Category F)**:

| File | Current | New |
|------|---------|-----|
| `frontmatter.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `fs-helpers.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `reporter.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/reporter')` | `require('../../../skills/validate-orchestration/scripts/lib/reporter')` |
| `reporter.test.js` | `require('../.github/skills/validate-orchestration/scripts/validate-orchestration')` | `require('../../../skills/validate-orchestration/scripts/validate-orchestration')` |
| `structure.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/structure')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/structure')` |
| `yaml-parser.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')` | `require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` |

**Important**: The Coder must grep each file for ALL `require()` calls to confirm no dynamic paths were missed. These 5 files should have only simple static requires, but verify.

**Acceptance Criteria**:
- [ ] All 5 test files exist at target locations
- [ ] All 7 static `require()` paths updated — all `../.github/skills/` → `../../../skills/`
- [ ] No other code modifications — only the require() path strings change
- [ ] Original `tests/` files remain untouched
- [ ] Smoke test: at least 1 Family B simple test passes at new location (e.g., `node --test .github/orchestration/scripts/tests/fs-helpers.test.js`)

---

### T3: Migrate Family B — Mock-Pattern Validator Tests (Dynamic Requires)

**Objective**: Copy the 6 Family B test files that use the `require.resolve()` + `require.cache` mock pattern. These files have BOTH static `require()` calls AND dynamic `require.resolve()` calls that construct paths from variables. Both static and dynamic paths need the same `../.github/skills/` → `../../../skills/` transformation.

**Files to copy and modify (6 files, 6 static + 11 dynamic = 17 total changes)**:

| Source | Target | Static | Dynamic | Total |
|--------|--------|--------|---------|-------|
| `tests/agents.test.js` | `.github/orchestration/scripts/tests/agents.test.js` | 1 | 2 | 3 |
| `tests/config.test.js` | `.github/orchestration/scripts/tests/config.test.js` | 1 | 2 | 3 |
| `tests/cross-refs.test.js` | `.github/orchestration/scripts/tests/cross-refs.test.js` | 1 | 1 | 2 |
| `tests/instructions.test.js` | `.github/orchestration/scripts/tests/instructions.test.js` | 1 | 2 | 3 |
| `tests/prompts.test.js` | `.github/orchestration/scripts/tests/prompts.test.js` | 1 | 2 | 3 |
| `tests/skills.test.js` | `.github/orchestration/scripts/tests/skills.test.js` | 1 | 2 | 3 |

**Transformation pattern (same for both static and dynamic)**: `../.github/skills/` → `../../../skills/`

**Static `require()` transformations (6 total, from Architecture § Category F)**:

| File | Current | New |
|------|---------|-----|
| `agents.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/agents')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/agents')` |
| `config.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/config')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/config')` |
| `cross-refs.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/cross-refs')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/cross-refs')` |
| `instructions.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/instructions')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/instructions')` |
| `prompts.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/prompts')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/prompts')` |
| `skills.test.js` | `require('../.github/skills/validate-orchestration/scripts/lib/checks/skills')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/skills')` |

**Dynamic `require.resolve()` transformations (11 total — discovered via workspace grep)**:

| File | Current | New |
|------|---------|-----|
| `agents.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `agents.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `config.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `config.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` |
| `cross-refs.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `instructions.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `instructions.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `prompts.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `prompts.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| `skills.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| `skills.test.js` | `require.resolve('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require.resolve('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |

**CRITICAL — Dynamic path handling**: These files use `require.resolve()` to get absolute paths for module cache manipulation. The `require.resolve()` calls use the same string prefix as static `require()` calls, so the same text replacement applies. However, the Coder MUST:
1. Grep each file for ALL occurrences of `require(` and `require.resolve(` to catch every reference
2. Verify no other dynamic path construction patterns exist (e.g., `path.join()`, template literals)
3. Confirm the `require.cache[]` key updates are not needed (they use the resolved absolute path variable, not the literal string — so they are NOT affected)

**Note on Architecture doc**: The Architecture mentions only `agents.test.js` and `config.test.js` as having dynamic paths. The workspace grep revealed 4 additional files (`cross-refs.test.js`, `instructions.test.js`, `prompts.test.js`, `skills.test.js`) also use `require.resolve()` with the same pattern. This task covers all 6.

**Acceptance Criteria**:
- [ ] All 6 test files exist at target locations
- [ ] All 6 static `require()` paths updated — `../.github/skills/` → `../../../skills/`
- [ ] All 11 dynamic `require.resolve()` paths updated — `../.github/skills/` → `../../../skills/`
- [ ] No other code modifications — only the require() path strings change
- [ ] Original `tests/` files remain untouched
- [ ] Smoke test: at least 1 mock-pattern test passes at new location (e.g., `node --test .github/orchestration/scripts/tests/agents.test.js`)

---

### T4: Validation Gate — Run All 18 Tests at New Locations

**Objective**: Verify all 18 migrated test files pass at their new locations with zero failures, and that original test files remain untouched.

**Validation steps**:

1. **Run all 18 tests at new locations** (one command):
   ```bash
   node --test .github/orchestration/scripts/tests/*.test.js
   ```
   Expected: 18/18 test files pass, 0 failures.

2. **Run individual test files** for any failures in step 1 (to get per-file error output):
   ```bash
   # Family A (7 files)
   node --test .github/orchestration/scripts/tests/constants.test.js
   node --test .github/orchestration/scripts/tests/next-action.test.js
   node --test .github/orchestration/scripts/tests/resolver.test.js
   node --test .github/orchestration/scripts/tests/state-validator.test.js
   node --test .github/orchestration/scripts/tests/triage-engine.test.js
   node --test .github/orchestration/scripts/tests/triage.test.js
   node --test .github/orchestration/scripts/tests/validate-state.test.js
   
   # Family B — simple (5 files)
   node --test .github/orchestration/scripts/tests/frontmatter.test.js
   node --test .github/orchestration/scripts/tests/fs-helpers.test.js
   node --test .github/orchestration/scripts/tests/reporter.test.js
   node --test .github/orchestration/scripts/tests/structure.test.js
   node --test .github/orchestration/scripts/tests/yaml-parser.test.js
   
   # Family B — mock-pattern (6 files)
   node --test .github/orchestration/scripts/tests/agents.test.js
   node --test .github/orchestration/scripts/tests/config.test.js
   node --test .github/orchestration/scripts/tests/cross-refs.test.js
   node --test .github/orchestration/scripts/tests/instructions.test.js
   node --test .github/orchestration/scripts/tests/prompts.test.js
   node --test .github/orchestration/scripts/tests/skills.test.js
   ```

3. **Original tests still pass** — Verify originals are untouched:
   ```bash
   node --test tests/*.test.js
   ```
   Expected: all original tests still pass (confirms no accidental edits).

4. **Stale path grep** — Verify no old path patterns remain in migrated files:
   ```bash
   grep -rn "require.*'\.\./src/" .github/orchestration/scripts/tests/
   grep -rn "require.*'\.\./\.github/skills/" .github/orchestration/scripts/tests/
   ```
   Expected: 0 results for both (all paths should use the new patterns).

5. **File count verification** — Confirm exactly 18 test files at new location:
   ```bash
   ls .github/orchestration/scripts/tests/*.test.js | wc -l
   ```
   Expected: 18.

**Acceptance Criteria**:
- [ ] All 18 tests pass at `.github/orchestration/scripts/tests/` with zero failures
- [ ] All `require()` paths (static and dynamic) resolve correctly at new locations
- [ ] Original `tests/` files remain untouched and functional (all original tests still pass)
- [ ] Zero occurrences of `../src/` or `../.github/skills/` in migrated test files
- [ ] Exactly 18 `.test.js` files exist in `.github/orchestration/scripts/tests/`

## Execution Order

```
T1 (create dir + Family A tests)
 ├→ T2 (Family B simple tests, depends on T1 dir)
 └→ T3 (Family B mock-pattern tests, depends on T1 dir)  ← parallel-ready with T2
T4 (validation gate, depends on T1 + T2 + T3)
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T2 and T3 are parallel-ready (no mutual dependency — they operate on disjoint file sets) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] All 18 tests pass at new locations with zero failures
- [ ] All `require()` paths (static and dynamic) resolve correctly
- [ ] Original `tests/` files remain untouched and functional
- [ ] All 4 tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Dynamic `require.resolve()` paths are more widespread than documented**: The Architecture doc mentions only 2 files with dynamic patterns, but workspace grep found 6. T3 has been scoped to cover all 6. The Coder must still grep every file to confirm no additional patterns were missed.
- **`require.cache` key manipulation**: The mock-pattern tests replace modules in `require.cache` using resolved absolute paths stored in variables. The cache keys themselves do NOT need updating (they are computed at runtime from `require.resolve()`), but the `require.resolve()` argument strings DO need updating.
- **Test isolation**: Some tests mock shared modules (fs-helpers, frontmatter). Running all 18 tests in a single `node --test` invocation should be safe because Node.js test runner executes each file in a separate context, but the validation gate (T4) will catch any isolation issues.
- **ISSUE-001 reminder**: Do NOT advance `current_task` when updating state after task completion — only advance on `advance_task` action after code review.
