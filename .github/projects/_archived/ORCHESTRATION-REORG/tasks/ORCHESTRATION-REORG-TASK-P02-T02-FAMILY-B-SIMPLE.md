---
project: "ORCHESTRATION-REORG"
phase: 2
task: 2
title: "Migrate Family B — Simple Validator Tests"
status: "pending"
skills_required: ["file-copy", "path-rewrite"]
skills_optional: []
estimated_files: 5
---

# Migrate Family B — Simple Validator Tests

## Objective

Copy 5 Family B test files (static `require()` only — no `require.resolve()` mock patterns) from `tests/` to `.github/orchestration/scripts/tests/`, applying the path transformation `../.github/skills/` → `../../../skills/` to all path references. Verify each file passes at its new location.

## Context

The target directory `.github/orchestration/scripts/tests/` already exists and contains 7 Family A test files from P02-T01. These 5 Family B "simple" files import validator modules from `.github/skills/validate-orchestration/`; moving them 3 levels deeper changes the relative path prefix. The `path.join`/`path.resolve` calls in these files use `os.tmpdir()` temp directories for test fixtures (not `.github/` paths), but you MUST verify this by grepping — the T01 code review found unexpected `path.join`/`path.resolve` references in Family A files that also needed updating.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests/frontmatter.test.js` | Copy from `tests/frontmatter.test.js`, update 1 require() |
| CREATE | `.github/orchestration/scripts/tests/fs-helpers.test.js` | Copy from `tests/fs-helpers.test.js`, update 1 require() |
| CREATE | `.github/orchestration/scripts/tests/reporter.test.js` | Copy from `tests/reporter.test.js`, update 2 require() |
| CREATE | `.github/orchestration/scripts/tests/structure.test.js` | Copy from `tests/structure.test.js`, update 1 require() |
| CREATE | `.github/orchestration/scripts/tests/yaml-parser.test.js` | Copy from `tests/yaml-parser.test.js`, update 1 require() |

## Implementation Steps

1. **For each of the 5 source files**, grep the file for ALL occurrences of `require(`, `require.resolve(`, `path.join(`, `path.resolve(`, and `__dirname` to build a complete inventory of path references BEFORE making changes. Record which lines reference `../.github/skills/` or `../.github/` — those need updating. Lines referencing `os.tmpdir()`, `tmpDir`, or Node built-ins (`assert`, `fs`, `path`, `os`) do NOT need changes.

2. **Copy `tests/frontmatter.test.js`** → `.github/orchestration/scripts/tests/frontmatter.test.js` and apply this 1 change:

   | Line | Current | New |
   |------|---------|-----|
   | 4 | `require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |

3. **Copy `tests/fs-helpers.test.js`** → `.github/orchestration/scripts/tests/fs-helpers.test.js` and apply this 1 change:

   | Line | Current | New |
   |------|---------|-----|
   | 7 | `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |

   Note: This file has many `path.join(tmpDir, ...)` and `path.join(os.tmpdir(), ...)` calls — those reference temp directories, NOT `.github/` paths. Do NOT modify them.

4. **Copy `tests/reporter.test.js`** → `.github/orchestration/scripts/tests/reporter.test.js` and apply these 2 changes:

   | Line | Current | New |
   |------|---------|-----|
   | 3 | `require('../.github/skills/validate-orchestration/scripts/lib/reporter')` | `require('../../../skills/validate-orchestration/scripts/lib/reporter')` |
   | 215 | `require('../.github/skills/validate-orchestration/scripts/validate-orchestration')` | `require('../../../skills/validate-orchestration/scripts/validate-orchestration')` |

5. **Copy `tests/structure.test.js`** → `.github/orchestration/scripts/tests/structure.test.js` and apply this 1 change:

   | Line | Current | New |
   |------|---------|-----|
   | 7 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/structure')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/structure')` |

   Note: This file has many `path.join(tmpDir, ...)` and `path.join(ghDir, ...)` calls — those reference temp test fixture directories, NOT `.github/skills/` paths. Do NOT modify them.

6. **Copy `tests/yaml-parser.test.js`** → `.github/orchestration/scripts/tests/yaml-parser.test.js` and apply this 1 change:

   | Line | Current | New |
   |------|---------|-----|
   | 4 | `require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')` | `require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` |

7. **After all 5 files are created**, run a stale-path grep across all 5 new files to confirm zero remaining `../.github/skills/` or `../.github/` references:
   ```bash
   grep -n "../.github/" .github/orchestration/scripts/tests/frontmatter.test.js .github/orchestration/scripts/tests/fs-helpers.test.js .github/orchestration/scripts/tests/reporter.test.js .github/orchestration/scripts/tests/structure.test.js .github/orchestration/scripts/tests/yaml-parser.test.js
   ```
   Expected: 0 matches. If any matches are found, apply the same `../.github/skills/` → `../../../skills/` transformation.

8. **Run a comprehensive path audit** — grep each new file for `path.join`, `path.resolve`, and `__dirname` references that contain `.github` or `skills` in the argument strings. If any are found that point to `.github/skills/` with a stale prefix, apply the same transformation. (Based on source inspection, none are expected — the `path.join`/`path.resolve` calls in these files use temp dirs, not workspace paths.)

9. **Smoke-test each file individually**:
   ```bash
   node --test .github/orchestration/scripts/tests/frontmatter.test.js
   node --test .github/orchestration/scripts/tests/fs-helpers.test.js
   node --test .github/orchestration/scripts/tests/reporter.test.js
   node --test .github/orchestration/scripts/tests/structure.test.js
   node --test .github/orchestration/scripts/tests/yaml-parser.test.js
   ```
   All 5 must pass with 0 failures.

10. **Verify originals are untouched** — confirm `git diff tests/frontmatter.test.js tests/fs-helpers.test.js tests/reporter.test.js tests/structure.test.js tests/yaml-parser.test.js` returns empty (zero modifications).

## Contracts & Interfaces

No new interfaces or contracts are introduced. This is a pure file-copy-and-path-rewrite task.

**Path transformation contract** (applied uniformly):

```
BEFORE: require('../.github/skills/validate-orchestration/...')
AFTER:  require('../../../skills/validate-orchestration/...')

Pattern: replace the prefix '../.github/skills/' with '../../../skills/'
```

**Path geometry proof** (from `.github/orchestration/scripts/tests/<file>`):
- `../` → `.github/orchestration/scripts/`
- `../../` → `.github/orchestration/`
- `../../../` → `.github/`
- `../../../skills/` → `.github/skills/` ✓

## Styles & Design Tokens

N/A — no UI components in scope.

## Test Requirements

- [ ] `frontmatter.test.js` — all tests pass at new location via `node --test`
- [ ] `fs-helpers.test.js` — all tests pass at new location via `node --test`
- [ ] `reporter.test.js` — all tests pass at new location via `node --test`
- [ ] `structure.test.js` — all tests pass at new location via `node --test`
- [ ] `yaml-parser.test.js` — all tests pass at new location via `node --test`

## Acceptance Criteria

- [ ] All 5 test files exist at `.github/orchestration/scripts/tests/`
- [ ] Exactly 6 static `require()` paths updated — all `../.github/skills/` → `../../../skills/`
- [ ] Zero occurrences of `../.github/` remain in any of the 5 new files (stale-path grep returns 0 matches)
- [ ] Any `path.join`/`path.resolve`/`__dirname` references targeting `.github/skills/` are also updated (grep audit in step 8 confirms none missed)
- [ ] No logic, structure, or comment changes — only path strings modified
- [ ] Original `tests/` files remain byte-identical (git diff confirms zero changes)
- [ ] All 5 test files pass at new locations with 0 failures

## Constraints

- Do NOT modify original files in `tests/` — they must remain byte-identical
- Do NOT modify the 7 Family A test files already at `.github/orchestration/scripts/tests/`
- Do NOT touch any files outside the 5 target test files
- Do NOT change any code logic, assertions, test structure, or comments — ONLY path strings
- Do NOT create any new directories — `.github/orchestration/scripts/tests/` already exists
- Do NOT advance `current_task` in state — the Tactical Planner handles state transitions (ISSUE-001)
