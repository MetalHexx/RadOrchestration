---
project: "STATE-TRANSITION-SCRIPTS"
phase: 3
task: 4
title: "Triage CLI Entry Point"
status: "pending"
skills_required: ["coding"]
skills_optional: ["run-tests"]
estimated_files: 2
---

# Triage CLI Entry Point

## Objective

Create `src/triage.js` — the CLI entry point that wires the triage engine to real filesystem I/O. Parses `--state`, `--level`, and `--project-dir` flags, reads `state.json`, wires a real `readDocument` callback using `fs-helpers` + `frontmatter`, calls `executeTriage()`, writes the resolved verdict/action to `state.json` atomically, and emits result JSON to stdout. Also create `tests/triage.test.js` with CLI argument parsing tests and `require.main === module` guard verification.

## Context

`src/lib/triage-engine.js` exports `executeTriage(state, level, readDocument)` as a pure domain function. The CLI wrapper (`src/triage.js`) is the infrastructure layer that performs I/O: reading `state.json`, resolving document paths relative to `--project-dir`, wiring `readDocument` to `readFile` + `extractFrontmatter`, and writing the updated `state.json` back. Follows the same CLI pattern as `src/next-action.js` and `src/validate-state.js`: shebang, `parseArgs()`, async `main()`, `require.main === module` guard, exit codes 0/1.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/triage.js` | CLI entry point for triage executor |
| CREATE | `tests/triage.test.js` | CLI argument parsing tests |

## Implementation Steps

1. Create `src/triage.js` with shebang `#!/usr/bin/env node`, `'use strict'`, CommonJS.
2. Import dependencies:
   ```javascript
   const path = require('path');
   const fs = require('fs');
   const { readFile } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
   const { extractFrontmatter } = require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter');
   const { executeTriage } = require('./lib/triage-engine');
   const { TRIAGE_LEVELS } = require('./lib/constants');
   ```
3. Implement `parseArgs(argv)`:
   - Parse `--state`, `--level`, `--project-dir` flags from argv array.
   - Validate: throw `Error` if `--state` is missing, if `--level` is missing, or if `--project-dir` is missing.
   - Validate: throw `Error` if `--level` is not `'task'` or `'phase'`.
   - Return `{ state: string, level: 'task'|'phase', projectDir: string }`.
4. Implement `readDocument` wiring function:
   ```javascript
   function createReadDocument(projectDir) {
     return function readDocument(docPath) {
       const fullPath = path.resolve(projectDir, docPath);
       const content = readFile(fullPath);
       if (content === null) return null;
       return extractFrontmatter(content);
     };
   }
   ```
5. Implement `async main()`:
   - Call `parseArgs(process.argv.slice(2))`.
   - Read `state.json`: `const stateRaw = readFile(args.state)`. If null, write error to stderr and exit 1.
   - Parse JSON: `JSON.parse(stateRaw)`. On parse error, write error to stderr and exit 1.
   - Create readDocument: `const readDoc = createReadDocument(args.projectDir)`.
   - Call `executeTriage(stateObj, args.level, readDoc)`.
   - If `result.success === true`:
     - Apply verdict/action to the in-memory state:
       - Task-level: set `phases[current_phase].tasks[current_task].review_verdict = result.verdict` and `.review_action = result.action`.
       - Phase-level: set `phases[current_phase].phase_review_verdict = result.verdict` and `.phase_review_action = result.action`.
     - Update `stateObj.project.updated` to current ISO timestamp.
     - Write atomically: `fs.writeFileSync(args.state, JSON.stringify(stateObj, null, 2) + '\n')`.
     - Emit `JSON.stringify(result, null, 2)` to stdout.
     - Exit 0.
   - If `result.success === false`:
     - Do NOT modify `state.json`.
     - Emit `JSON.stringify(result, null, 2)` to stdout.
     - Exit 1.
6. Add `if (require.main === module)` guard with `.catch()` safety net:
   ```javascript
   if (require.main === module) {
     main().catch(err => {
       process.stderr.write(`[ERROR] triage: ${err.message}\n`);
       process.exit(1);
     });
   }
   ```
7. Export `parseArgs` and `createReadDocument` via `module.exports`.
8. Create `tests/triage.test.js` with `'use strict'`, `node:test` framework:
   - Import `parseArgs` from `../src/triage.js`.
   - Test valid args: `parseArgs(['--state', 'foo.json', '--level', 'task', '--project-dir', '/tmp'])` → `{ state: 'foo.json', level: 'task', projectDir: '/tmp' }`.
   - Test valid args with phase level: `--level phase` → `{ level: 'phase' }`.
   - Test missing `--state`: assert throws with message containing `--state`.
   - Test missing `--level`: assert throws with message containing `--level`.
   - Test missing `--project-dir`: assert throws with message containing `--project-dir`.
   - Test invalid `--level` value: `--level bogus` → assert throws.
   - Test `require.main === module` guard exists: read file content with `fs.readFileSync`, assert it contains `require.main === module`.

## Contracts & Interfaces

**parseArgs signature:**
```javascript
/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ state: string, level: 'task'|'phase', projectDir: string }}
 * @throws {Error} If --state, --level, or --project-dir is missing; or if --level is invalid
 */
function parseArgs(argv) { /* ... */ }
```

**createReadDocument signature:**
```javascript
/**
 * @param {string} projectDir - Base directory for resolving relative document paths
 * @returns {ReadDocumentFn} A function that reads a document and returns { frontmatter, body } or null
 */
function createReadDocument(projectDir) { /* ... */ }
```

**ReadDocumentFn (from triage-engine.js):**
```javascript
/**
 * @callback ReadDocumentFn
 * @param {string} docPath - Absolute or project-relative path
 * @returns {{ frontmatter: Record<string, any> | null, body: string } | null}
 */
```

**executeTriage (from triage-engine.js):**
```javascript
/**
 * @param {StateJson} state
 * @param {'task'|'phase'} level
 * @param {ReadDocumentFn} readDocument
 * @returns {TriageResult}
 */
function executeTriage(state, level, readDocument) { /* ... */ }
```

**TriageSuccess shape:**
```javascript
{ success: true, level, verdict, action, phase_index, task_index, row_matched, details }
```

**TriageError shape:**
```javascript
{ success: false, level, error, error_code, phase_index, task_index }
```

**CLI output contract:**
- Exit 0 + TriageSuccess JSON on stdout → state.json updated with verdict/action
- Exit 1 + TriageError JSON on stdout → state.json NOT modified
- Exit 1 + stderr `[ERROR] triage: <msg>` → unexpected crash

**State write behavior:**
- Task-level writes: `phases[current_phase].tasks[current_task].review_verdict` and `.review_action`
- Phase-level writes: `phases[current_phase].phase_review_verdict` and `.phase_review_action`
- Also updates `project.updated` timestamp
- Single atomic `JSON.stringify` + `writeFileSync` — no partial writes

**TRIAGE_LEVELS constant:**
```javascript
const TRIAGE_LEVELS = Object.freeze({
  TASK: 'task',
  PHASE: 'phase'
});
```

**Infrastructure imports:**
```javascript
// fs-helpers.js exports:
function readFile(filePath) { /* returns string | null */ }
function exists(filePath) { /* returns boolean */ }

// frontmatter.js exports:
function extractFrontmatter(content) { /* returns { frontmatter: object|null, body: string } */ }
```

## Styles & Design Tokens

N/A — CLI script with no UI.

## Test Requirements

- [ ] `parseArgs` correctly parses `--state`, `--level`, `--project-dir` flags
- [ ] `parseArgs` throws for missing `--state` flag
- [ ] `parseArgs` throws for missing `--level` flag
- [ ] `parseArgs` throws for missing `--project-dir` flag
- [ ] `parseArgs` throws for invalid `--level` value (not `'task'` or `'phase'`)
- [ ] `require.main === module` guard exists in source file
- [ ] `parseArgs` with phase level returns `{ level: 'phase' }`

## Acceptance Criteria

- [ ] File `src/triage.js` exists with shebang `#!/usr/bin/env node` and `'use strict'`
- [ ] CommonJS module: uses `require`/`module.exports`, no ESM
- [ ] `parseArgs()` exported via `module.exports`
- [ ] `createReadDocument()` exported via `module.exports`
- [ ] `if (require.main === module)` guard present with `.catch()` safety net
- [ ] Parses `--state`, `--level`, `--project-dir` flags correctly
- [ ] Validates `--level` is `'task'` or `'phase'` — throws on invalid value
- [ ] Reads `state.json` via `readFile()` from fs-helpers
- [ ] Wires `readDocument` callback using `path.resolve(projectDir, docPath)` + `readFile()` + `extractFrontmatter()`
- [ ] Calls `executeTriage(state, level, readDocument)` from `src/lib/triage-engine.js`
- [ ] On success: writes verdict/action to in-memory state, updates `project.updated`, writes entire state.json atomically with `fs.writeFileSync`
- [ ] On success: emits TriageSuccess JSON to stdout, exits 0
- [ ] On failure: does NOT write to `state.json`, emits TriageError JSON to stdout, exits 1
- [ ] Stderr format on crash: `[ERROR] triage: <message>`
- [ ] File `tests/triage.test.js` exists with `'use strict'` and `node:test` framework
- [ ] `node tests/triage.test.js` passes — all parseArgs tests + guard check
- [ ] `node -c src/triage.js` passes (no syntax errors)
- [ ] All existing test suites still pass — no regressions (138+ tests)

## Constraints

- Do NOT modify `src/lib/triage-engine.js` — it is the domain module; this is the CLI wrapper
- Do NOT modify `src/lib/constants.js`
- Do NOT duplicate immutability checking in the CLI — the triage engine handles it via `IMMUTABILITY_VIOLATION` error code
- Do NOT add npm dependencies — use only Node.js built-ins and existing workspace utilities
- Do NOT create or modify any file other than `src/triage.js` and `tests/triage.test.js`
- Import paths for utilities must use relative paths from `src/` to `.github/skills/validate-orchestration/scripts/lib/utils/`
- Follow the exact same CLI pattern as `src/next-action.js` and `src/validate-state.js`
