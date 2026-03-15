---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
task: 6
title: "Pipeline CLI Entry Point + Tests"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Pipeline CLI Entry Point + Tests

## Objective

Create `pipeline.js` — the thin CLI entry point that parses command-line arguments, constructs a `PipelineRequest` and `PipelineIO` from real modules, calls the pipeline engine, prints JSON to stdout, and exits with code 0 or 1. Also create its comprehensive test suite covering argument parsing and end-to-end execution via child process spawning.

## Context

The pipeline engine (`lib/pipeline-engine.js`) is complete and exports `executePipeline(request, io)`. The state I/O module (`lib/state-io.js`) exports the five real filesystem functions that satisfy the `PipelineIO` interface. This task creates the glue between the CLI surface and those two modules — a ~30-line entry point that parses `--event`, `--project-dir`, `--config`, and `--context` flags, wires real I/O, and serializes the result. The existing `next-action.js` script demonstrates the project's CLI conventions (shebang, `require.main === module` guard, `parseArgs` export, `process.stdout.write` for output).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/pipeline.js` | ~30–50 lines including shebang. CLI entry point. |
| CREATE | `.github/orchestration/scripts/tests/pipeline.test.js` | ~200–300 lines. Unit tests for `parseArgs` + E2E tests via `child_process`. |

## Implementation Steps

### pipeline.js

1. Add shebang `#!/usr/bin/env node` on line 1, then `'use strict';` on line 2.

2. Require the two dependencies:
   ```javascript
   const { executePipeline } = require('./lib/pipeline-engine');
   const stateIo = require('./lib/state-io');
   ```

3. Implement `parseArgs(argv)` that accepts `process.argv.slice(2)` and returns `{ event, projectDir, configPath, context }`:
   - Iterate over `argv` with a `for` loop (same pattern as `next-action.js`).
   - `--event <value>` → `event` (string, required).
   - `--project-dir <value>` → `projectDir` (string, required).
   - `--config <value>` → `configPath` (string, optional — `undefined` if omitted).
   - `--context <value>` → parse via `JSON.parse(value)` → `context` (object, optional — `undefined` if omitted). If parsing fails, throw with a clear message: `'Invalid --context JSON: <original error message>'`.
   - After the loop, if `event` is falsy, throw: `'Missing required flag: --event'`.
   - If `projectDir` is falsy, throw: `'Missing required flag: --project-dir'`.
   - Return the parsed object.

4. Implement `main()` (synchronous, not async — the engine is synchronous):
   ```javascript
   function main() {
     const args = parseArgs(process.argv.slice(2));
     const request = {
       event: args.event,
       projectDir: args.projectDir,
       configPath: args.configPath,
       context: args.context
     };
     const io = {
       readState: stateIo.readState,
       writeState: stateIo.writeState,
       readConfig: stateIo.readConfig,
       readDocument: stateIo.readDocument,
       ensureDirectories: stateIo.ensureDirectories
     };
     const result = executePipeline(request, io);
     process.stdout.write(JSON.stringify(result, null, 2) + '\n');
     process.exit(result.success ? 0 : 1);
   }
   ```

5. Add the `require.main === module` guard:
   ```javascript
   if (require.main === module) {
     try {
       main();
     } catch (err) {
       process.stderr.write('[ERROR] pipeline: ' + err.message + '\n');
       process.exit(1);
     }
   }
   ```

6. Export `parseArgs` for unit testing:
   ```javascript
   module.exports = { parseArgs };
   ```

### pipeline.test.js

7. Set up the test file with `node:test` and `node:assert`:
   ```javascript
   const { describe, it, before, after } = require('node:test');
   const assert = require('node:assert/strict');
   const { execFileSync } = require('node:child_process');
   const path = require('node:path');
   const fs = require('node:fs');
   const os = require('node:os');
   const { parseArgs } = require('../pipeline');
   ```

8. Create a `describe('parseArgs', ...)` block with the following unit tests:
   - **Valid: all flags** — `parseArgs(['--event', 'start', '--project-dir', '/tmp/proj', '--config', '/cfg.yml', '--context', '{"key":"val"}'])` returns `{ event: 'start', projectDir: '/tmp/proj', configPath: '/cfg.yml', context: { key: 'val' } }`.
   - **Valid: required flags only** — `parseArgs(['--event', 'task_completed', '--project-dir', '/tmp/proj'])` returns `{ event: 'task_completed', projectDir: '/tmp/proj', configPath: undefined, context: undefined }`.
   - **Missing --event** — `parseArgs(['--project-dir', '/tmp/proj'])` throws with message matching `/Missing required flag: --event/`.
   - **Missing --project-dir** — `parseArgs(['--event', 'start'])` throws with message matching `/Missing required flag: --project-dir/`.
   - **Missing both** — `parseArgs([])` throws with message matching `/Missing required flag/`.
   - **Invalid --context JSON** — `parseArgs(['--event', 'start', '--project-dir', '/tmp/proj', '--context', '{bad json}'])` throws with message matching `/Invalid --context JSON/`.
   - **Empty context object** — `parseArgs(['--event', 'start', '--project-dir', '/tmp/proj', '--context', '{}'])` returns `{ context: {} }` (no throw, context is an empty object).

9. Create a `describe('E2E: pipeline.js via child_process', ...)` block:
   - **Before each / setup**: Create a temp directory via `fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'))`. Store as `tmpDir`. Calculate the absolute path to `pipeline.js` as `path.resolve(__dirname, '..', 'pipeline.js')`.
   - **After each / teardown**: Remove `tmpDir` recursively via `fs.rmSync(tmpDir, { recursive: true, force: true })`.

10. Write E2E test: **`--event start` initializes project** —
    - `execFileSync('node', [pipelinePath, '--event', 'start', '--project-dir', tmpDir], { encoding: 'utf-8' })`.
    - Parse stdout as JSON.
    - Assert `result.success === true`.
    - Assert `result.action` is a string (expect `'spawn_research'`).
    - Assert `result.mutations_applied` includes `'project_initialized'`.
    - Assert `result.triage_ran === false`.
    - Assert `result.validation_passed === true`.
    - Assert `fs.existsSync(path.join(tmpDir, 'state.json'))` is true.
    - Assert `fs.existsSync(path.join(tmpDir, 'phases'))` is true.
    - Assert `fs.existsSync(path.join(tmpDir, 'tasks'))` is true.
    - Assert `fs.existsSync(path.join(tmpDir, 'reports'))` is true.
    - Read and parse state.json — assert it has `$schema`, `project.name`, `pipeline.current_tier === 'planning'`.

11. Write E2E test: **`--event start` cold start with existing state** —
    - Write a minimal valid state.json to `tmpDir` (planning tier, research not_started) — use the scaffold shape from step 10.
    - Call pipeline.js with `--event start --project-dir <tmpDir>`.
    - Parse stdout JSON.
    - Assert `result.success === true`.
    - Assert `result.mutations_applied` is an empty array (cold start applies no mutations).
    - Assert `result.action` is a string.

12. Write E2E test: **missing `--event` flag returns exit code 1** —
    - Wrap `execFileSync('node', [pipelinePath, '--project-dir', tmpDir])` in a try/catch.
    - Assert the error is thrown (non-zero exit code).
    - Assert `error.status === 1`.
    - Assert `error.stderr.toString()` contains `'Missing required flag: --event'`.

13. Write E2E test: **missing `--project-dir` flag returns exit code 1** —
    - Same pattern as step 12, but omit `--project-dir`.
    - Assert exit code 1 and stderr message.

14. Write E2E test: **invalid `--context` JSON returns exit code 1** —
    - Call with `--event start --project-dir <tmpDir> --context '{bad}'`.
    - Assert exit code 1 and stderr contains `'Invalid --context JSON'`.

15. Write E2E test: **unknown event returns exit code 1 with error JSON** —
    - First initialize state by calling `--event start --project-dir <tmpDir>`.
    - Then call with `--event nonexistent_event --project-dir <tmpDir>`.
    - Assert exit code 1.
    - Parse stdout — assert `result.success === false` and `result.error` matches `/Unknown event/`.

16. Write E2E test: **stdout is valid JSON on both success and error** —
    - Call with `--event start --project-dir <tmpDir>`.
    - Assert `JSON.parse(stdout)` does not throw.
    - Then call with an unknown event (after state exists).
    - Assert `JSON.parse(stdout)` does not throw (error result is also valid JSON).

## Contracts & Interfaces

### PipelineRequest (input to executePipeline)

```javascript
/**
 * @typedef {Object} PipelineRequest
 * @property {string} event - Event name from the closed vocabulary
 * @property {string} projectDir - Absolute path to project directory
 * @property {string} [configPath] - Path to orchestration.yml (optional, auto-discovered)
 * @property {Object} [context] - Event-specific context payload
 */
```

### PipelineIO (dependency injection interface)

```javascript
/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => Object|null} readState
 * @property {(projectDir: string, state: Object) => void} writeState
 * @property {(configPath: string) => Object} readConfig
 * @property {(docPath: string) => { frontmatter: Object, body: string }} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */
```

Construct PipelineIO from the real `state-io.js` exports:

```javascript
const stateIo = require('./lib/state-io');
const io = {
  readState: stateIo.readState,
  writeState: stateIo.writeState,
  readConfig: stateIo.readConfig,
  readDocument: stateIo.readDocument,
  ensureDirectories: stateIo.ensureDirectories
};
```

### PipelineResult (success — stdout JSON)

```json
{
  "success": true,
  "action": "<NEXT_ACTION enum value>",
  "context": { "phase": 0, "task": 0, "message": "..." },
  "mutations_applied": ["project_initialized"],
  "triage_ran": false,
  "validation_passed": true
}
```

### PipelineResult (error — stdout JSON on exit code 1)

```json
{
  "success": false,
  "error": "Unknown event: bad_event",
  "event": "bad_event",
  "state_snapshot": null,
  "mutations_applied": [],
  "validation_passed": null
}
```

### executePipeline signature

```javascript
const { executePipeline } = require('./lib/pipeline-engine');

// Synchronous — returns PipelineResult directly
const result = executePipeline(request, io);
```

### parseArgs signature (exported for testing)

```javascript
/**
 * Parse CLI arguments.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ event: string, projectDir: string, configPath?: string, context?: Object }}
 * @throws {Error} If required flags missing or context is invalid JSON
 */
function parseArgs(argv) { ... }

module.exports = { parseArgs };
```

## Styles & Design Tokens

Not applicable — CLI infrastructure code. No visual components.

## Test Requirements

### parseArgs unit tests

- [ ] Valid invocation with all four flags returns correct parsed object
- [ ] Valid invocation with only required flags returns `configPath: undefined, context: undefined`
- [ ] Missing `--event` throws with message containing `'Missing required flag: --event'`
- [ ] Missing `--project-dir` throws with message containing `'Missing required flag: --project-dir'`
- [ ] Missing both required flags throws with message containing `'Missing required flag'`
- [ ] Invalid `--context` JSON throws with message containing `'Invalid --context JSON'`
- [ ] Empty context object `'{}'` parses successfully to `{}`

### E2E tests (child_process)

- [ ] `--event start` with no state.json initializes project: stdout is valid JSON, `success: true`, `action` is `'spawn_research'`, `mutations_applied` includes `'project_initialized'`, state.json and subdirectories are created on disk
- [ ] `--event start` with existing state.json returns success with empty `mutations_applied` (cold start)
- [ ] Missing `--event` flag produces exit code 1 with stderr error message
- [ ] Missing `--project-dir` flag produces exit code 1 with stderr error message
- [ ] Invalid `--context` JSON produces exit code 1 with stderr error message
- [ ] Unknown event (with existing state.json) produces exit code 1, stdout contains error JSON with `success: false`
- [ ] Stdout is always valid JSON (both success and error cases)

## Acceptance Criteria

- [ ] `parseArgs` correctly parses all four CLI flags (`--event`, `--project-dir`, `--config`, `--context`)
- [ ] Missing `--event` produces clear error message and exit code 1
- [ ] Missing `--project-dir` produces clear error message and exit code 1
- [ ] Invalid `--context` JSON produces clear error message including `'Invalid --context JSON'`
- [ ] `pipeline.js --event start` with no state.json initializes project and returns valid JSON on stdout with `success: true`
- [ ] `pipeline.js --event start` with existing state.json performs cold start and returns valid JSON on stdout
- [ ] Unknown event returns exit code 1 with structured error JSON on stdout
- [ ] stdout contains ONLY JSON (no diagnostic text mixed in)
- [ ] stderr receives diagnostic/error text (not stdout)
- [ ] Exit code 0 on success, exit code 1 on error
- [ ] `parseArgs` is exported from `pipeline.js` via `module.exports`
- [ ] `require.main === module` guard prevents `main()` from running on `require()`
- [ ] All E2E tests use real filesystem (temp directories) — no mocks
- [ ] All existing preserved lib test suites still pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] All tests pass when run with `node --test`
- [ ] No npm dependencies — Node.js built-ins only (`node:test`, `node:assert`, `node:child_process`, `node:path`, `node:fs`, `node:os`)
- [ ] Build succeeds — no syntax errors, all require() paths resolve

## Constraints

- Do NOT modify any existing file — this task only creates two new files
- Do NOT make `main()` async — `executePipeline` is synchronous
- Do NOT use `console.log` — use `process.stdout.write` for JSON output and `process.stderr.write` for diagnostics
- Do NOT add any npm dependencies — use only Node.js built-in modules
- Do NOT import from `next-action.js` — it is a legacy script being replaced
- Do NOT duplicate pipeline-engine logic in the CLI — `pipeline.js` is a thin wrapper only
- Keep `pipeline.js` under 50 lines (including shebang and blank lines)
- Use `'use strict'` at the top of both files
- Use CommonJS (`require`/`module.exports`) — no ES modules
- E2E tests must clean up temp directories after each test (use `after` hook)
- Do NOT test mutation logic or triage — those are covered by `mutations.test.js` and `pipeline-engine.test.js`
