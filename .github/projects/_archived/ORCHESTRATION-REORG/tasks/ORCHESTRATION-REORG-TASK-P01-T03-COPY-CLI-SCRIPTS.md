---
project: "ORCHESTRATION-REORG"
phase: 1
task: 3
title: "Copy and Update CLI Scripts"
status: "pending"
skills_required: ["file copy", "path rewrite"]
skills_optional: []
estimated_files: 3
---

# Copy and Update CLI Scripts

## Objective

Copy the 3 CLI scripts (`next-action.js`, `triage.js`, `validate-state.js`) from `src/` to `.github/orchestration/scripts/` and update exactly 5 cross-tree `require()` paths so they resolve correctly from the new location. All `./lib/` relative imports remain unchanged. Original `src/` files must not be modified.

## Context

Task T1 created the target directories: `.github/orchestration/scripts/`, `.github/orchestration/scripts/lib/`, and `.github/orchestration/schemas/`. Task T2 copied 4 lib modules (`constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) to `.github/orchestration/scripts/lib/` — these are the files that the `./lib/` relative imports in the CLI scripts will resolve to at the new location. The cross-tree `require()` paths reference utilities under `.github/skills/validate-orchestration/scripts/lib/utils/` — only these paths change because the new script location is two directories deeper inside `.github/` instead of one directory above it.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/next-action.js` | Copy from `src/next-action.js`, update 2 require() paths |
| CREATE | `.github/orchestration/scripts/triage.js` | Copy from `src/triage.js`, update 2 require() paths |
| CREATE | `.github/orchestration/scripts/validate-state.js` | Copy from `src/validate-state.js`, update 1 require() path |

## Implementation Steps

1. **Copy** `src/next-action.js` to `.github/orchestration/scripts/next-action.js`
2. In the new `.github/orchestration/scripts/next-action.js`, change the `fs-helpers` require:
   - **FROM**: `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
   - **TO**: `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
3. In the same file, change the `yaml-parser` require:
   - **FROM**: `require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')`
   - **TO**: `require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')`
4. Verify `require('./lib/resolver')` remains unchanged in the new file
5. **Copy** `src/triage.js` to `.github/orchestration/scripts/triage.js`
6. In the new `.github/orchestration/scripts/triage.js`, change the `fs-helpers` require:
   - **FROM**: `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
   - **TO**: `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
7. In the same file, change the `frontmatter` require:
   - **FROM**: `require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')`
   - **TO**: `require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter')`
8. Verify `require('./lib/triage-engine')` and `require('./lib/constants')` remain unchanged in the new file
9. **Copy** `src/validate-state.js` to `.github/orchestration/scripts/validate-state.js`
10. In the new `.github/orchestration/scripts/validate-state.js`, change the `fs-helpers` require:
    - **FROM**: `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')`
    - **TO**: `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')`

After step 10, verify `require('./lib/state-validator')` remains unchanged in the new file.

## Contracts & Interfaces

No new interfaces or contracts. Each target file must be an exact copy of its source with only the specified `require()` string literals changed. The complete set of require() lines in each target file:

```javascript
// .github/orchestration/scripts/next-action.js — 3 requires total
const { readFile, exists } = require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');  // CHANGED
const { parseYaml } = require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');        // CHANGED
const { resolveNextAction } = require('./lib/resolver');                                                    // UNCHANGED
```

```javascript
// .github/orchestration/scripts/triage.js — 5 requires total (path, fs are Node built-ins)
const path = require('path');                                                                               // UNCHANGED (built-in)
const fs = require('fs');                                                                                   // UNCHANGED (built-in)
const { readFile } = require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');           // CHANGED
const { extractFrontmatter } = require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter'); // CHANGED
const { executeTriage } = require('./lib/triage-engine');                                                   // UNCHANGED
const { TRIAGE_LEVELS } = require('./lib/constants');                                                       // UNCHANGED
```

```javascript
// .github/orchestration/scripts/validate-state.js — 2 requires total
const { readFile } = require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');           // CHANGED
const { validateTransition } = require('./lib/state-validator');                                            // UNCHANGED
```

## Styles & Design Tokens

N/A — no UI components in this task.

## Test Requirements

- [ ] File `.github/orchestration/scripts/next-action.js` exists
- [ ] File `.github/orchestration/scripts/triage.js` exists
- [ ] File `.github/orchestration/scripts/validate-state.js` exists
- [ ] In `next-action.js`: `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` present
- [ ] In `next-action.js`: `require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` present
- [ ] In `next-action.js`: `require('./lib/resolver')` present and unchanged
- [ ] In `triage.js`: `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` present
- [ ] In `triage.js`: `require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` present
- [ ] In `triage.js`: `require('./lib/triage-engine')` present and unchanged
- [ ] In `triage.js`: `require('./lib/constants')` present and unchanged
- [ ] In `validate-state.js`: `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` present
- [ ] In `validate-state.js`: `require('./lib/state-validator')` present and unchanged
- [ ] Original `src/next-action.js` contains `require('../.github/skills/` (unchanged)
- [ ] Original `src/triage.js` contains `require('../.github/skills/` (unchanged)
- [ ] Original `src/validate-state.js` contains `require('../.github/skills/` (unchanged)

## Acceptance Criteria

- [ ] All 3 CLI scripts exist at `.github/orchestration/scripts/`
- [ ] Exactly 5 `require()` paths updated as specified (2 in next-action.js, 2 in triage.js, 1 in validate-state.js)
- [ ] All `./lib/` relative imports remain unchanged in every target file
- [ ] No other code modifications — only the `require()` path strings change between source and target
- [ ] Original `src/next-action.js` remains untouched
- [ ] Original `src/triage.js` remains untouched
- [ ] Original `src/validate-state.js` remains untouched

## Constraints

- Do NOT modify any file under `src/` — originals must remain untouched
- Do NOT change any code logic, comments, or whitespace — only the 5 specified `require()` path strings change
- Do NOT add, remove, or reorder any `require()` statements
- Do NOT modify files in `.github/orchestration/scripts/lib/` (those were placed by T02)
- Do NOT create any new directories (they already exist from T01)
