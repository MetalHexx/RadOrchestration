---
project: "ORCHESTRATION-REORG"
phase: 1
task: 4
title: "Validation Gate"
status: "pending"
skills_required: ["testing", "validation"]
skills_optional: []
estimated_files: 0
---

# Validation Gate

## Objective

Verify that all 7 migrated scripts load correctly at their new `.github/orchestration/scripts/` locations, that the schema file exists at its target path, and that original `src/` scripts remain functional and unmodified. This is a verification-only task — no files are created or modified.

## Context

Phase 1 tasks T01–T03 created directory structure, copied 4 lib modules + 1 schema file verbatim, and copied 3 CLI scripts with 5 updated `require()` paths. This task validates the entire migration by running module load checks, existence checks, original integrity checks, and content diffs. Each `node -e` invocation must run in its own process to avoid Node.js module caching effects.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| VERIFY | `.github/orchestration/scripts/next-action.js` | Must load without errors |
| VERIFY | `.github/orchestration/scripts/triage.js` | Must load without errors |
| VERIFY | `.github/orchestration/scripts/validate-state.js` | Must load without errors |
| VERIFY | `.github/orchestration/scripts/lib/constants.js` | Must load without errors |
| VERIFY | `.github/orchestration/scripts/lib/resolver.js` | Must load without errors |
| VERIFY | `.github/orchestration/scripts/lib/state-validator.js` | Must load without errors |
| VERIFY | `.github/orchestration/scripts/lib/triage-engine.js` | Must load without errors |
| VERIFY | `.github/orchestration/schemas/state-json-schema.md` | Must exist |
| VERIFY | `src/next-action.js` | Must still load (original integrity) |
| VERIFY | `src/triage.js` | Must still load (original integrity) |
| VERIFY | `src/validate-state.js` | Must still load (original integrity) |

## Implementation Steps

1. **Run module load checks for all 7 new-location scripts** — Execute each command separately (one `node -e` per module) to avoid Node.js require cache masking failures:
   - `node -e "require('./.github/orchestration/scripts/next-action.js')"`
   - `node -e "require('./.github/orchestration/scripts/triage.js')"`
   - `node -e "require('./.github/orchestration/scripts/validate-state.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/constants.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/resolver.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/state-validator.js')"`
   - `node -e "require('./.github/orchestration/scripts/lib/triage-engine.js')"`
   Record pass/fail for each. If any command exits with a non-zero code or prints an error to stderr, record it as FAIL.

2. **Verify schema file existence** — Run:
   - `node -e "require('fs').accessSync('.github/orchestration/schemas/state-json-schema.md'); console.log('EXISTS')"`
   Confirm the output is `EXISTS`. If the command throws, record FAIL.

3. **Run original file integrity checks** — Execute each command separately:
   - `node -e "require('./src/next-action.js')"`
   - `node -e "require('./src/triage.js')"`
   - `node -e "require('./src/validate-state.js')"`
   Record pass/fail for each. All must exit cleanly (code 0).

4. **Run content diff for lib modules (byte-identical check)** — For each of the 4 lib files, compare original and new:
   - `node -e "const fs=require('fs'); const a=fs.readFileSync('src/lib/constants.js'); const b=fs.readFileSync('.github/orchestration/scripts/lib/constants.js'); console.log(a.equals(b) ? 'IDENTICAL' : 'DIFFER')"`
   - `node -e "const fs=require('fs'); const a=fs.readFileSync('src/lib/resolver.js'); const b=fs.readFileSync('.github/orchestration/scripts/lib/resolver.js'); console.log(a.equals(b) ? 'IDENTICAL' : 'DIFFER')"`
   - `node -e "const fs=require('fs'); const a=fs.readFileSync('src/lib/state-validator.js'); const b=fs.readFileSync('.github/orchestration/scripts/lib/state-validator.js'); console.log(a.equals(b) ? 'IDENTICAL' : 'DIFFER')"`
   - `node -e "const fs=require('fs'); const a=fs.readFileSync('src/lib/triage-engine.js'); const b=fs.readFileSync('.github/orchestration/scripts/lib/triage-engine.js'); console.log(a.equals(b) ? 'IDENTICAL' : 'DIFFER')"`
   All 4 must print `IDENTICAL`. If any prints `DIFFER`, record FAIL.

5. **Run content diff for schema file** — Compare original and new:
   - `node -e "const fs=require('fs'); const a=fs.readFileSync('plan/schemas/state-json-schema.md'); const b=fs.readFileSync('.github/orchestration/schemas/state-json-schema.md'); console.log(a.equals(b) ? 'IDENTICAL' : 'DIFFER')"`
   Must print `IDENTICAL`.

6. **Run content diff for CLI scripts (only require() lines changed)** — For each of the 3 CLI scripts, verify that the diff is exactly the expected `require()` changes and nothing else:
   - For `next-action.js`: Diff `src/next-action.js` vs `.github/orchestration/scripts/next-action.js`. Expect exactly 2 lines differ — the 2 `require()` paths that changed from `'../.github/skills/...'` to `'../../skills/...'`.
   - For `triage.js`: Diff `src/triage.js` vs `.github/orchestration/scripts/triage.js`. Expect exactly 2 lines differ — the 2 `require()` paths that changed.
   - For `validate-state.js`: Diff `src/validate-state.js` vs `.github/orchestration/scripts/validate-state.js`. Expect exactly 1 line differs — the 1 `require()` path that changed.
   Use this approach per file:
   ```
   node -e "const fs=require('fs'); const a=fs.readFileSync('src/{FILE}','utf8').split('\n'); const b=fs.readFileSync('.github/orchestration/scripts/{FILE}','utf8').split('\n'); let diffs=0; for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i]!==b[i])diffs++}; console.log('DIFF_COUNT='+diffs)"
   ```
   Replace `{FILE}` with each script name. Expected counts: `next-action.js` → 2, `triage.js` → 2, `validate-state.js` → 1. Total: 5 changed lines across all 3 files. Any other count is a FAIL.

7. **Verify the exact require() path values in new CLI scripts** — Confirm the updated paths are correct:
   - `node -e "const c=require('fs').readFileSync('.github/orchestration/scripts/next-action.js','utf8'); console.log(c.includes(\"require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')\") ? 'PASS' : 'FAIL'); console.log(c.includes(\"require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')\") ? 'PASS' : 'FAIL')"`
   - `node -e "const c=require('fs').readFileSync('.github/orchestration/scripts/triage.js','utf8'); console.log(c.includes(\"require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')\") ? 'PASS' : 'FAIL'); console.log(c.includes(\"require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter')\") ? 'PASS' : 'FAIL')"`
   - `node -e "const c=require('fs').readFileSync('.github/orchestration/scripts/validate-state.js','utf8'); console.log(c.includes(\"require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')\") ? 'PASS' : 'FAIL')"`
   All 5 checks must print `PASS`.

8. **Compile results** — Create a results summary table with all checks and their pass/fail status. If ALL checks pass, the task is complete. If ANY check fails, record the failure details.

## Contracts & Interfaces

No contracts or interfaces apply — this is a verification-only task with no code creation or modification.

## Styles & Design Tokens

Not applicable — no UI components involved.

## Test Requirements

- [ ] All 7 `node -e "require()"` commands for new-location modules exit with code 0
- [ ] Schema file existence check returns `EXISTS`
- [ ] All 3 `node -e "require()"` commands for original `src/` modules exit with code 0
- [ ] All 4 lib module byte-identity comparisons return `IDENTICAL`
- [ ] Schema file byte-identity comparison returns `IDENTICAL`
- [ ] CLI script diff counts match expected: next-action.js=2, triage.js=2, validate-state.js=1
- [ ] All 5 updated `require()` path values confirmed present in new CLI scripts

## Acceptance Criteria

- [ ] All 7 modules at `.github/orchestration/scripts/` load without errors (7/7 pass)
- [ ] All `require()` paths in CLI scripts resolve correctly at new locations
- [ ] `state-json-schema.md` exists at `.github/orchestration/schemas/`
- [ ] Original `src/` scripts remain untouched and functional (3/3 pass)
- [ ] Zero import/require errors across all 7 new-location modules
- [ ] Lib modules are byte-identical to originals (4/4 identical)
- [ ] Schema file is byte-identical to original
- [ ] CLI scripts differ from originals only in the 5 expected `require()` lines (diff counts: 2, 2, 1)

## Constraints

- Do NOT create any files — this task is verification-only
- Do NOT modify any files — neither the new copies nor the originals
- Run each `node -e "require()"` in a separate process — do NOT combine into a single Node.js invocation (module caching can mask failures)
- Run all commands from the repository root directory (`c:\dev\orchestration\v3`)
- If any check fails, report it clearly in the task report with the exact error output — do NOT skip or mask failures
