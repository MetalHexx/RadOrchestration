---
project: "PIPELINE-SIMPLIFICATION"
phase: 1
task: 2
title: "STATE-IO"
status: "pending"
skills_required: ["execute_task"]
skills_optional: []
estimated_files: 2
---

# STATE-IO

## Objective

Create `lib-v3/state-io.js` implementing the `PipelineIO` dependency-injection interface (filesystem-backed) with `writeState` as the sole setter of `project.updated`, plus a factory function `createRealIO()` that bundles all I/O operations into a single injectable object. Create `tests-v3/state-io.test.js` with unit tests covering all exported functions.

## Context

The v3 engine uses dependency injection via the `PipelineIO` interface to decouple all modules from the filesystem. `state-io.js` is the Infrastructure layer module that provides the real (filesystem-backed) implementations. It is a rationalized port of the existing `lib/state-io.js` with one key change: `writeState` is the **sole setter** of `project.updated` — no other module or caller sets this timestamp. The module imports `SCHEMA_VERSION` from the already-completed `lib-v3/constants.js` (T01) for optional schema validation. Shared filesystem and YAML utilities are imported from `validate-orchestration/scripts/lib/utils/`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/state-io.js` | ~130 lines, all I/O functions + `createRealIO()` factory |
| CREATE | `.github/orchestration/scripts/tests-v3/state-io.test.js` | Unit tests for all exported functions |

## Implementation Steps

1. **Create `state-io.js`** at `.github/orchestration/scripts/lib-v3/state-io.js` with `'use strict'` header.

2. **Add imports**:
   - `const fs = require('fs');`
   - `const path = require('path');`
   - `const { readFile, exists } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');`
   - `const { parseYaml } = require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');`
   - `const { extractFrontmatter } = require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter');`
   - `const { SCHEMA_VERSION } = require('./constants');`

3. **Implement `DEFAULT_CONFIG`** — a frozen object with built-in defaults matching `orchestration.yml` structure:
   ```javascript
   const DEFAULT_CONFIG = Object.freeze({
     projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
     limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
     errors: {
       severity: {
         critical: ['build_failure', 'security_vulnerability', 'architectural_violation', 'data_loss_risk'],
         minor: ['test_failure', 'lint_error', 'review_suggestion', 'missing_test_coverage', 'style_violation']
       },
       on_critical: 'halt',
       on_minor: 'retry'
     },
     human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true }
   });
   ```

4. **Implement `readState(projectDir)`**:
   - Build path: `path.join(projectDir, 'state.json')`
   - Call `readFile(statePath)` — returns `string | null`
   - If `null`, return `null`
   - Parse JSON; if parsing fails, throw `new Error('Failed to parse state.json: ' + err.message)`
   - Optionally validate `parsed.$schema === SCHEMA_VERSION` — if mismatch, throw `new Error('Schema version mismatch: expected ' + SCHEMA_VERSION + ', got ' + parsed.$schema)`
   - Return the parsed `StateJson` object

5. **Implement `writeState(projectDir, state)`**:
   - **Set `state.project.updated = new Date().toISOString()`** — this is the SOLE place this timestamp is set
   - Build path: `path.join(projectDir, 'state.json')`
   - Write atomically: `fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8')`

6. **Implement `readConfig(configPath)`**:
   - If `configPath` is provided and `exists(configPath)`, read and parse YAML, merge with defaults via `mergeConfig(parsed)`
   - If `configPath` is not provided, auto-discover at `path.join(process.cwd(), '.github', 'orchestration.yml')`; if found, read/parse/merge
   - If no config file found, return a deep clone of `DEFAULT_CONFIG`: `JSON.parse(JSON.stringify(DEFAULT_CONFIG))`
   - `mergeConfig(parsed)` merges top-level and nested keys: `{ ...DEFAULT_CONFIG, ...parsed, limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) }, human_gates: { ...DEFAULT_CONFIG.human_gates, ...(parsed.human_gates || {}) }, errors: { ...DEFAULT_CONFIG.errors, ...(parsed.errors || {}) }, projects: { ...DEFAULT_CONFIG.projects, ...(parsed.projects || {}) } }`

7. **Implement `readDocument(docPath)`**:
   - If `!exists(docPath)`, return `null`
   - Call `readFile(docPath)` — if `null`, return `null`
   - Call `extractFrontmatter(content)` and return the result `{ frontmatter, body }`

8. **Implement `ensureDirectories(projectDir)`**:
   - Create directories: `projectDir`, `projectDir/phases`, `projectDir/tasks`, `projectDir/reports`
   - Use `fs.mkdirSync(dir, { recursive: true })` for each

9. **Implement `createRealIO()`** — factory that returns an object conforming to the `PipelineIO` interface:
   ```javascript
   function createRealIO() {
     return { readState, writeState, readConfig, readDocument, ensureDirectories };
   }
   ```

10. **Export**: `module.exports = { readState, writeState, readConfig, readDocument, ensureDirectories, createRealIO, DEFAULT_CONFIG };`

## Contracts & Interfaces

### PipelineIO — The DI Boundary (from Architecture)

```javascript
/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => StateJson | null} readState
 * @property {(projectDir: string, state: StateJson) => void} writeState
 * @property {(configPath?: string) => Config} readConfig
 * @property {(docPath: string) => ParsedDocument | null} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */
```

### ParsedDocument

```javascript
/**
 * @typedef {Object} ParsedDocument
 * @property {Object | null} frontmatter
 * @property {string} body
 */
```

### StateJson (v3 schema — defined in constants.js)

```javascript
/**
 * @typedef {Object} StateJson
 * @property {'orchestration-state-v3'} $schema
 * @property {ProjectMeta} project
 * @property {Planning} planning
 * @property {Execution} execution
 */
```

### Config

```javascript
/**
 * @typedef {Object} Config
 * @property {Object} limits
 * @property {number} limits.max_phases
 * @property {number} limits.max_tasks_per_phase
 * @property {number} limits.max_retries_per_task
 * @property {Object} human_gates
 * @property {string} human_gates.execution_mode - one of HUMAN_GATE_MODES
 * @property {boolean} human_gates.after_final_review
 */
```

### SCHEMA_VERSION (from constants.js)

```javascript
const SCHEMA_VERSION = 'orchestration-state-v3';
```

### Utility Import Signatures

```javascript
// From validate-orchestration/scripts/lib/utils/fs-helpers.js
readFile(filePath: string) → string | null    // Never throws
exists(filePath: string) → boolean            // Never throws

// From validate-orchestration/scripts/lib/utils/yaml-parser.js
parseYaml(yamlString: string) → Record<string, any> | null

// From validate-orchestration/scripts/lib/utils/frontmatter.js
extractFrontmatter(fileContent: string) → { frontmatter: Record<string, any> | null, body: string }
```

## Styles & Design Tokens

Not applicable — this is a non-UI infrastructure module. No design tokens apply.

## Test Requirements

- [ ] **readState — missing file**: Call `readState` on a non-existent directory → returns `null`
- [ ] **readState — valid state.json**: Write a valid v3 JSON file, call `readState` → returns parsed object with correct `$schema`, `project`, `planning`, `execution` keys
- [ ] **readState — invalid JSON**: Write malformed JSON to state.json, call `readState` → throws `Error` with message containing `'Failed to parse state.json'`
- [ ] **readState — schema mismatch**: Write JSON with `$schema: 'orchestration-state-v2'`, call `readState` → throws `Error` with message containing `'Schema version mismatch'`
- [ ] **writeState — sets project.updated**: Call `writeState` with a state object, then read back the file → `project.updated` is a valid ISO timestamp
- [ ] **writeState — is sole setter of project.updated**: Call `writeState` with `project.updated` set to a past date → after write, `project.updated` has been overwritten with a current timestamp
- [ ] **writeState — produces valid JSON**: Call `writeState`, then `JSON.parse` on the written file content → no errors, 2-space indentation, trailing newline
- [ ] **readConfig — with valid YAML file**: Write a config YAML, call `readConfig(path)` → returns merged config with all keys from defaults plus overrides
- [ ] **readConfig — missing file**: Call `readConfig` with a non-existent path → returns `DEFAULT_CONFIG` values
- [ ] **readConfig — partial config**: Write YAML with only `limits.max_phases: 5`, call `readConfig` → returned config has `max_phases: 5` but all other defaults intact
- [ ] **readDocument — valid markdown with frontmatter**: Write markdown with `---` frontmatter, call `readDocument` → returns `{ frontmatter: { ... }, body: '...' }`
- [ ] **readDocument — missing file**: Call `readDocument` on non-existent path → returns `null`
- [ ] **readDocument — markdown without frontmatter**: Write plain markdown, call `readDocument` → returns `{ frontmatter: null, body: '...' }`
- [ ] **ensureDirectories — creates project subdirectories**: Call `ensureDirectories(tmpDir)` → directories `tmpDir/`, `tmpDir/phases/`, `tmpDir/tasks/`, `tmpDir/reports/` all exist
- [ ] **ensureDirectories — idempotent**: Call `ensureDirectories` twice on same dir → no error on second call
- [ ] **createRealIO — returns PipelineIO-conforming object**: Call `createRealIO()` → returned object has all 5 properties: `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories`, all of which are functions
- [ ] **DEFAULT_CONFIG — has expected structure**: Verify `DEFAULT_CONFIG` has `projects`, `limits`, `human_gates`, `errors` keys with correct defaults

## Acceptance Criteria

- [ ] `state-io.js` is created at `.github/orchestration/scripts/lib-v3/state-io.js`
- [ ] `writeState` is the sole setter of `project.updated` — the timestamp is set inside `writeState` before writing, not by the caller
- [ ] `readState` returns `null` for missing file, parsed `StateJson` otherwise
- [ ] `readState` validates `$schema` matches `SCHEMA_VERSION` (`'orchestration-state-v3'`)
- [ ] `readDocument` returns `{ frontmatter, body }` or `null`
- [ ] `readConfig` merges parsed YAML with `DEFAULT_CONFIG` defaults; returns full defaults when no file exists
- [ ] `createRealIO()` returns an object conforming to the `PipelineIO` interface (all 5 methods present and callable)
- [ ] `ensureDirectories` creates `phases/`, `tasks/`, `reports/` subdirectories
- [ ] `state-io.test.js` is created at `.github/orchestration/scripts/tests-v3/state-io.test.js`
- [ ] All tests pass via `node --test tests-v3/state-io.test.js` (run from `.github/orchestration/scripts/`)
- [ ] Module is importable without errors: `node -e "require('./.github/orchestration/scripts/lib-v3/state-io.js')"`
- [ ] No lint errors or syntax errors

## Constraints

- Do NOT modify `lib-v3/constants.js` or any existing file — only create the two new files
- Do NOT add external dependencies — use only `node:fs`, `node:path`, `node:test`, `node:assert/strict`, and the shared utilities from `validate-orchestration/scripts/lib/utils/`
- Do NOT set `project.updated` anywhere except inside `writeState` — this is the core rationalization
- Do NOT import from `lib/state-io.js` (the old module) — this is a fresh implementation in `lib-v3/`
- Tests must use real filesystem (via `node:fs` and `os.tmpdir()`) — no mock I/O needed for testing the I/O module itself
- Keep the module under ~130 lines (excluding comments/JSDoc)
- Use `'use strict'` at the top of both files
- Use `node:test` (`describe`, `it`) and `node:assert/strict` for all tests — zero external test dependencies
