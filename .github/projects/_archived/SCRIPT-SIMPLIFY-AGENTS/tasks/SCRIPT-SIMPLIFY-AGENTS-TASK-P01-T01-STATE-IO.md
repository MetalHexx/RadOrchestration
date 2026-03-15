---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
task: 1
title: "State I/O Module + Tests"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# State I/O Module + Tests

## Objective

Create `state-io.js` — the filesystem I/O isolation boundary that all other pipeline modules call for reading/writing state, config, and documents. Also create its comprehensive test suite `state-io.test.js`. This module is the sole I/O layer for the new unified pipeline script; every filesystem interaction flows through these five exported functions.

## Context

The pipeline system stores project state in `state.json` (JSON), configuration in `orchestration.yml` (YAML), and planning documents as markdown files with YAML frontmatter. The `state-io.js` module isolates all filesystem access behind a mockable interface (`PipelineIO`) so the pipeline engine can be tested with no disk I/O. Three shared utility modules already exist in the codebase for file reading, YAML parsing, and frontmatter extraction — reuse them directly. Each project directory has a standard subdirectory structure: `phases/`, `tasks/`, `reports/`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib/state-io.js` | ~80–120 lines. Five exports. CommonJS, `'use strict'`. |
| CREATE | `.github/orchestration/scripts/tests/state-io.test.js` | ~150–200 lines. `node:test` + `node:assert`. Real filesystem using temp dirs. |

## Implementation Steps

1. **Create `state-io.js`** at `.github/orchestration/scripts/lib/state-io.js` with the five exported functions defined in the Contracts section below.
2. **Import shared utilities** using the exact relative paths specified in the Dependencies section. Import `readFile` and `exists` from `fs-helpers.js`, `parseYaml` from `yaml-parser.js`, and `extractFrontmatter` from `frontmatter.js`.
3. **Import Node.js built-ins**: `const fs = require('fs');` and `const path = require('path');` for `writeFileSync`, `mkdirSync`, `existsSync`.
4. **Implement `readState(projectDir)`**: Join `projectDir` + `'state.json'`, read with `readFile()` from `fs-helpers`. If `null` (file missing), return `null`. Otherwise `JSON.parse()` the content. If parse fails, throw an `Error` with a descriptive message.
5. **Implement `writeState(projectDir, state)`**: Set `state.project.updated` to `new Date().toISOString()` before writing. Write with `fs.writeFileSync(path.join(projectDir, 'state.json'), JSON.stringify(state, null, 2) + '\n', 'utf-8')`.
6. **Implement `readConfig(configPath)`**: If `configPath` is provided and `exists(configPath)`, read and parse with `readFile` + `parseYaml`. If `configPath` is omitted or the file doesn't exist, attempt auto-discovery by checking `path.join(process.cwd(), '.github', 'orchestration.yml')`. If still not found, return the built-in `DEFAULT_CONFIG` object (see Constants section). Merge the parsed YAML into the defaults to ensure all fields are present.
7. **Implement `readDocument(docPath)`**: If `!exists(docPath)`, throw an `Error` with message `"Document not found: <docPath>"`. Otherwise read with `readFile(docPath)`, then call `extractFrontmatter(content)` and return the result `{ frontmatter, body }`.
8. **Implement `ensureDirectories(projectDir)`**: Create `projectDir`, `path.join(projectDir, 'phases')`, `path.join(projectDir, 'tasks')`, `path.join(projectDir, 'reports')` using `fs.mkdirSync(dir, { recursive: true })`. The `recursive: true` flag makes this a no-op for existing directories.
9. **Create `state-io.test.js`** at `.github/orchestration/scripts/tests/state-io.test.js`. Use `node:test` (`describe`, `it`, `beforeEach`, `afterEach`) and `node:assert/strict`. Use `node:fs` and `node:os` to create and clean up temp directories for each test. Write the tests specified in the Test Requirements section.
10. **Verify** that all tests pass by running `node --test .github/orchestration/scripts/tests/state-io.test.js`.

## Contracts & Interfaces

### Module Exports — `state-io.js`

```javascript
// .github/orchestration/scripts/lib/state-io.js

'use strict';

const fs   = require('fs');
const path = require('path');

// Shared utilities — reuse from validate-orchestration skill
const { readFile, exists } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { parseYaml }        = require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');
const { extractFrontmatter } = require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter');

/**
 * Built-in defaults when orchestration.yml is not found.
 * Matches the structure of orchestration.yml.
 */
const DEFAULT_CONFIG = {
  projects: {
    base_path: '.github/projects',
    naming: 'SCREAMING_CASE'
  },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3
  },
  errors: {
    severity: {
      critical: ['build_failure', 'security_vulnerability', 'architectural_violation', 'data_loss_risk'],
      minor: ['test_failure', 'lint_error', 'review_suggestion', 'missing_test_coverage', 'style_violation']
    },
    on_critical: 'halt',
    on_minor: 'retry'
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true
  }
};

/**
 * Read and parse state.json from a project directory.
 * @param {string} projectDir - Absolute path to project directory
 * @returns {Object|null} Parsed state object, or null if file does not exist
 * @throws {Error} If file exists but cannot be parsed as JSON
 */
function readState(projectDir) { /* ... */ }

/**
 * Write state.json to a project directory.
 * Updates project.updated timestamp before writing.
 * Uses writeFileSync for atomic (non-interleaved) writes.
 * @param {string} projectDir - Absolute path to project directory
 * @param {Object} state - State object to write
 * @returns {void}
 */
function writeState(projectDir, state) { /* ... */ }

/**
 * Read and parse orchestration.yml.
 * Auto-discovers config file if path omitted.
 * Falls back to built-in DEFAULT_CONFIG if file not found.
 * @param {string} [configPath] - Path to orchestration.yml; auto-discovers if omitted
 * @returns {Object} Parsed config object (always has limits, human_gates, errors, projects keys)
 */
function readConfig(configPath) { /* ... */ }

/**
 * Read a markdown document and extract frontmatter.
 * @param {string} docPath - Absolute path to markdown document
 * @returns {{ frontmatter: Object|null, body: string }}
 * @throws {Error} If document not found
 */
function readDocument(docPath) { /* ... */ }

/**
 * Create project directory structure.
 * No-op for directories that already exist.
 * @param {string} projectDir - Absolute path to project directory
 * @returns {void}
 */
function ensureDirectories(projectDir) { /* ... */ }

module.exports = { readState, writeState, readConfig, readDocument, ensureDirectories, DEFAULT_CONFIG };
```

### Function Behavior Specifications

#### `readState(projectDir)`
- Compute `statePath = path.join(projectDir, 'state.json')`
- Call `readFile(statePath)` from `fs-helpers` (returns `string|null`, never throws)
- If result is `null`: return `null`
- Otherwise: `JSON.parse(content)` — if parse fails, re-throw with message `"Failed to parse state.json: <originalError.message>"`
- Returns: the parsed JavaScript object

#### `writeState(projectDir, state)`
- Set `state.project.updated = new Date().toISOString()`
- Compute `statePath = path.join(projectDir, 'state.json')`
- Call `fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8')`
- Returns: `void`

#### `readConfig(configPath)`
- If `configPath` is truthy and `exists(configPath)` is `true`:
  - Read with `readFile(configPath)`, parse with `parseYaml(content)`
  - If parsing returns `null`, return `DEFAULT_CONFIG`
  - Otherwise, merge parsed config with defaults: `{ ...DEFAULT_CONFIG, ...parsed, limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) }, human_gates: { ...DEFAULT_CONFIG.human_gates, ...(parsed.human_gates || {}) }, errors: { ...DEFAULT_CONFIG.errors, ...(parsed.errors || {}) }, projects: { ...DEFAULT_CONFIG.projects, ...(parsed.projects || {}) } }`
- If `configPath` is falsy, attempt auto-discovery:
  - Try `path.join(process.cwd(), '.github', 'orchestration.yml')`
  - If `exists()`: read, parse, merge with defaults (same as above)
  - If not found: return a deep copy of `DEFAULT_CONFIG`
- Returns: the config object (always has `limits`, `human_gates`, `errors`, `projects` keys)

#### `readDocument(docPath)`
- If `!exists(docPath)`: throw `new Error("Document not found: " + docPath)`
- Read with `readFile(docPath)`
- If content is `null` (unexpected read failure): throw `new Error("Failed to read document: " + docPath)`
- Call `extractFrontmatter(content)` — returns `{ frontmatter: Object|null, body: string }`
- Return the result as-is

#### `ensureDirectories(projectDir)`
- For each dir in `[projectDir, path.join(projectDir, 'phases'), path.join(projectDir, 'tasks'), path.join(projectDir, 'reports')]`:
  - Call `fs.mkdirSync(dir, { recursive: true })`
- Returns: `void`

### Dependencies (Exact Import Paths)

From `.github/orchestration/scripts/lib/state-io.js`:

```javascript
// Shared utilities (three levels up from lib/ to .github/, then into skills/)
const { readFile, exists } = require('../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { parseYaml }        = require('../../../skills/validate-orchestration/scripts/lib/utils/yaml-parser');
const { extractFrontmatter } = require('../../../skills/validate-orchestration/scripts/lib/utils/frontmatter');
```

From `.github/orchestration/scripts/tests/state-io.test.js`:

```javascript
// Module under test (one level up from tests/ to scripts/, then into lib/)
const { readState, writeState, readConfig, readDocument, ensureDirectories, DEFAULT_CONFIG } = require('../lib/state-io');
```

### Shared Utility API Reference

These are the exact function signatures of the shared utilities you will `require()`. **Do NOT modify these files.**

**`fs-helpers.js` exports:**
- `exists(filePath: string) → boolean` — returns `true` if path exists, `false` otherwise; never throws
- `readFile(filePath: string) → string|null` — returns file content as UTF-8 string, or `null` if file doesn't exist / can't be read; never throws

**`yaml-parser.js` exports:**
- `parseYaml(yamlString: string) → Record<string, any>|null` — parses YAML string into a plain object; returns `null` if parsing fails entirely

**`frontmatter.js` exports:**
- `extractFrontmatter(fileContent: string) → { frontmatter: Record<string, any>|null, body: string }` — extracts YAML frontmatter from markdown content; `frontmatter` is `null` if no valid frontmatter found

## Styles & Design Tokens

Not applicable — this is a Node.js backend module with no UI.

## Test Requirements

All tests use `node:test` (`describe`, `it`, `beforeEach`, `afterEach`) and `node:assert/strict`. Tests use real filesystem operations with temporary directories created via `fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-test-'))`. Each test group creates a fresh temp dir in `beforeEach` and cleans it up in `afterEach` using `fs.rmSync(tmpDir, { recursive: true, force: true })`.

### `readState` tests

- [ ] Returns parsed state object when `state.json` exists with valid JSON
- [ ] Returns `null` when `state.json` does not exist (no throw)
- [ ] Throws when `state.json` exists but contains invalid JSON (verify error message includes "Failed to parse")

### `writeState` tests

- [ ] Writes `state.json` to the project directory with 2-space indented JSON + trailing newline
- [ ] Updates `state.project.updated` to a valid ISO 8601 timestamp before writing
- [ ] Written file can be read back and parsed as valid JSON matching the input (except updated timestamp)
- [ ] Overwrites existing `state.json` content

### `readConfig` tests

- [ ] Reads and parses config from an explicit path when file exists
- [ ] Auto-discovers `orchestration.yml` at `process.cwd() + '/.github/orchestration.yml'` when no path provided (NOTE: this test may need to mock `process.cwd()` or skip if CWD doesn't have the file — use a conditional skip or test with explicit path only)
- [ ] Returns `DEFAULT_CONFIG` when config path is omitted and auto-discovery fails
- [ ] Returns `DEFAULT_CONFIG` when explicit path doesn't exist
- [ ] Merges parsed YAML config with defaults (missing keys filled from defaults)
- [ ] Returns `DEFAULT_CONFIG` when YAML file is empty or unparseable

### `readDocument` tests

- [ ] Returns `{ frontmatter, body }` for a markdown file with valid YAML frontmatter
- [ ] Returns `{ frontmatter: null, body }` for a markdown file without frontmatter
- [ ] Throws with "Document not found" message when file doesn't exist

### `ensureDirectories` tests

- [ ] Creates `projectDir/`, `phases/`, `tasks/`, `reports/` when none exist
- [ ] Is idempotent — calling twice on the same directory does not throw or change structure
- [ ] All four directories exist after the call (verify with `fs.existsSync`)

### Test File Structure

```javascript
// .github/orchestration/scripts/tests/state-io.test.js

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const {
  readState,
  writeState,
  readConfig,
  readDocument,
  ensureDirectories,
  DEFAULT_CONFIG
} = require('../lib/state-io');

describe('readState', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-test-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns parsed state when state.json exists', () => { /* ... */ });
  it('returns null when state.json does not exist', () => { /* ... */ });
  it('throws when state.json contains invalid JSON', () => { /* ... */ });
});

// ... similar describe blocks for writeState, readConfig, readDocument, ensureDirectories
```

## Acceptance Criteria

- [ ] `state-io.js` exports exactly 5 functions: `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories` (plus `DEFAULT_CONFIG`)
- [ ] `readState` returns `null` for missing file, parsed object for valid JSON, throws for invalid JSON
- [ ] `writeState` sets `project.updated` to ISO timestamp and writes 2-space indented JSON with trailing newline
- [ ] `readConfig` returns valid config from explicit path, auto-discovery, or built-in defaults
- [ ] `readDocument` returns `{ frontmatter, body }` for existing files, throws for missing files
- [ ] `ensureDirectories` creates all 4 directories idempotently
- [ ] All imports resolve correctly (shared utilities from `validate-orchestration`, Node.js built-ins)
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests/state-io.test.js`
- [ ] No lint errors, no syntax errors
- [ ] Module is CommonJS with `'use strict'` at top
- [ ] Zero npm dependencies — only Node.js built-ins and existing shared utilities

## Constraints

- **Do NOT modify** any existing file — only CREATE the two new files
- **Do NOT modify** `fs-helpers.js`, `yaml-parser.js`, `frontmatter.js`, or any other shared utility
- **Do NOT modify** `constants.js`, `resolver.js`, `state-validator.js`, or `triage-engine.js`
- **Do NOT install** any npm packages — use only Node.js built-in modules
- **Do NOT use** `async/await` or Promises — all functions are synchronous (matching existing codebase convention)
- **Do NOT export** internal helper functions — only the 5 public API functions + `DEFAULT_CONFIG`
- **Do NOT add** a shebang line to `state-io.js` — it is a library module, not a CLI entry point
- Use `'use strict'` as the first statement
- Use CommonJS `require()` / `module.exports` — no ES modules
