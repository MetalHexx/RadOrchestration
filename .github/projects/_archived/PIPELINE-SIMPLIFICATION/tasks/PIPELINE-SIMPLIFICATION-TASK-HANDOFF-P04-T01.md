---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
task: 1
title: "File Swap & Pipeline Entry Point Update"
status: "pending"
skills_required: ["coder"]
skills_optional: ["run-tests"]
estimated_files: 15
---

# File Swap & Pipeline Entry Point Update

## Objective

Execute the directory swap to put v3 modules into production position (`lib-v3/` → `lib/`), update `pipeline.js` to call the v3 engine's `processEvent` API, copy and fix test paths, apply the V13 timestamp carry-forward fix, and verify all 374+ tests pass from the production directories.

## Context

The v3 engine modules live in `.github/orchestration/scripts/lib-v3/` (7 files: `constants.js`, `state-io.js`, `pre-reads.js`, `validator.js`, `mutations.js`, `resolver.js`, `pipeline-engine.js`). The v3 test suite lives in `.github/orchestration/scripts/tests-v3/` (8 test files + `helpers/test-helpers.js`). The current production `lib/` contains v2 modules (7 files including `triage-engine.js`). The current `pipeline.js` calls `executePipeline()` from the v2 engine — the v3 engine exports `processEvent()` with a different function signature. The old `tests/` directory contains 20 test files including `triage-engine.test.js` which has no v3 equivalent.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| RENAME | `.github/orchestration/scripts/lib/` → `.github/orchestration/scripts/lib-old/` | Preserve v2 modules for rollback; T04 will delete |
| RENAME | `.github/orchestration/scripts/lib-v3/` → `.github/orchestration/scripts/lib/` | v3 modules become production |
| MODIFY | `.github/orchestration/scripts/pipeline.js` | Replace `executePipeline` import and call with `processEvent` |
| COPY | `.github/orchestration/scripts/tests-v3/*.test.js` → `.github/orchestration/scripts/tests/` | Overwrite existing; 8 test files |
| COPY | `.github/orchestration/scripts/tests-v3/helpers/` → `.github/orchestration/scripts/tests/helpers/` | Test infrastructure |
| DELETE | `.github/orchestration/scripts/tests/triage-engine.test.js` | No v3 triage module |
| MODIFY | `.github/orchestration/scripts/tests/constants.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/tests/mutations.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Fix require path + remove dead imports |
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/tests/resolver.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/tests/pre-reads.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/tests/validator.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/tests/state-io.test.js` | Fix require path |
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Apply V13 timestamp fix |

## Implementation Steps

1. **Rename `lib/` → `lib-old/`**: Rename the directory `.github/orchestration/scripts/lib/` to `.github/orchestration/scripts/lib-old/`. This preserves the v2 modules (`constants.js`, `mutations.js`, `pipeline-engine.js`, `resolver.js`, `state-io.js`, `state-validator.js`, `triage-engine.js`) for rollback. Do NOT delete — T04 handles cleanup.

2. **Rename `lib-v3/` → `lib/`**: Rename `.github/orchestration/scripts/lib-v3/` to `.github/orchestration/scripts/lib/`. After this step, `lib/` contains the 7 v3 modules: `constants.js`, `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, `validator.js`.

3. **Update `pipeline.js`**: Replace the entire file content with the updated version shown in the Contracts section below. Key changes:
   - Change `require('./lib/pipeline-engine')` from importing `executePipeline` to importing `processEvent` and `scaffoldInitialState`
   - Change the `main()` function: instead of calling `executePipeline({ event, projectDir, configPath, context }, io)`, call `processEvent(args.event, args.projectDir, args.context || {}, io, args.configPath)`
   - Keep `parseArgs` function unchanged
   - Keep the CLI interface unchanged: `--event`, `--project-dir`, `--config`, `--context` flags
   - Keep JSON stdout output and exit code behavior

4. **Copy test files from `tests-v3/` → `tests/`**: Copy all 8 `.test.js` files from `tests-v3/` into `tests/`, overwriting any same-named files. Also copy the `helpers/` subdirectory (containing `test-helpers.js`). Do NOT delete `tests-v3/` — T04 handles cleanup. The files to copy:
   - `constants.test.js`
   - `mutations.test.js`
   - `pipeline-engine.test.js`
   - `pipeline-behavioral.test.js`
   - `resolver.test.js`
   - `pre-reads.test.js`
   - `state-io.test.js`
   - `validator.test.js`
   - `helpers/test-helpers.js`

5. **Delete `tests/triage-engine.test.js`**: Remove the old v2 triage engine test file. No triage module exists in v3.

6. **Update require paths in all copied test files**: In each of the 8 test files copied to `tests/`, replace all `require('../lib-v3/` references with `require('../lib/`. The specific replacements per file:
   - `constants.test.js`: `require('../lib-v3/constants.js')` → `require('../lib/constants.js')`
   - `mutations.test.js`: `require('../lib-v3/mutations')` → `require('../lib/mutations')`
   - `pipeline-engine.test.js`: `require('../lib-v3/pipeline-engine')` → `require('../lib/pipeline-engine')`
   - `pipeline-behavioral.test.js`: `require('../lib-v3/pipeline-engine')` → `require('../lib/pipeline-engine')`
   - `resolver.test.js`: `require('../lib-v3/resolver.js')` → `require('../lib/resolver.js')`
   - `pre-reads.test.js`: `require('../lib-v3/pre-reads.js')` → `require('../lib/pre-reads.js')`
   - `validator.test.js`: `require('../lib-v3/validator.js')` → `require('../lib/validator.js')`
   - `state-io.test.js`: `require('../lib-v3/state-io')` → `require('../lib/state-io')`

7. **Clean up dead imports in `tests/pipeline-engine.test.js`**: Remove `processAndAssert` and `deepClone` from the test-helpers destructure. These imports are unused (carry-forward from P03). The current import block is:
   ```javascript
   const {
     createDefaultConfig,
     createMockIO,
     createBaseState,
     createExecutionState,
     createReviewState,
     processAndAssert,
     deepClone,
   ```
   Remove the `processAndAssert,` and `deepClone,` lines.

8. **Apply V13 timestamp fix in `lib/pipeline-engine.js`**: In the `processEvent` function, add `proposed.state.project.updated = new Date().toISOString();` between the mutation call and the `validateTransition` call. The current code reads:
   ```javascript
   const proposed = mutationFn(deepClone(currentState), preReadResult.context, config);
   
   const errors = validateTransition(currentState, proposed.state, config);
   ```
   Insert the timestamp update between these two lines:
   ```javascript
   const proposed = mutationFn(deepClone(currentState), preReadResult.context, config);
   
   // V13 fix: ensure project.updated advances before validation
   proposed.state.project.updated = new Date().toISOString();
   
   const errors = validateTransition(currentState, proposed.state, config);
   ```
   This eliminates the V13 monotonicity check failure and removes the need for `stripTimestamp()` / `backdateTimestamp()` workarounds in tests.

9. **Run full test suite**: Execute all tests in `tests/` directory. All 374+ tests must pass with 0 failures. Run from the `.github/orchestration/scripts/` directory using: `node --test tests/*.test.js`

## Contracts & Interfaces

### Updated `pipeline.js` — Full File Content

The Coder must update `pipeline.js` to match this exact structure:

```javascript
#!/usr/bin/env node
'use strict';

const { processEvent, scaffoldInitialState } = require('./lib/pipeline-engine');
const stateIo = require('./lib/state-io');

function parseArgs(argv) {
  let event, projectDir, configPath, context;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--event' && i + 1 < argv.length) { event = argv[++i]; }
    else if (argv[i] === '--project-dir' && i + 1 < argv.length) { projectDir = argv[++i]; }
    else if (argv[i] === '--config' && i + 1 < argv.length) { configPath = argv[++i]; }
    else if (argv[i] === '--context' && i + 1 < argv.length) {
      try { context = JSON.parse(argv[++i]); }
      catch (e) { throw new Error('Invalid --context JSON: ' + e.message); }
    }
  }
  if (!event) throw new Error('Missing required flag: --event');
  if (!projectDir) throw new Error('Missing required flag: --project-dir');
  return { event, projectDir, configPath, context };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const io = {
    readState: stateIo.readState,
    writeState: stateIo.writeState,
    readConfig: stateIo.readConfig,
    readDocument: stateIo.readDocument,
    ensureDirectories: stateIo.ensureDirectories,
  };
  const result = processEvent(args.event, args.projectDir, args.context || {}, io, args.configPath);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  try { main(); }
  catch (err) { process.stderr.write('[ERROR] pipeline: ' + err.message + '\n'); process.exit(1); }
}

module.exports = { parseArgs };
```

**Key differences from current `pipeline.js`:**

| Aspect | Current (v2) | Updated (v3) |
|--------|-------------|-------------|
| Import | `const { executePipeline } = require('./lib/pipeline-engine')` | `const { processEvent, scaffoldInitialState } = require('./lib/pipeline-engine')` |
| Call signature | `executePipeline({ event, projectDir, configPath, context }, io)` | `processEvent(args.event, args.projectDir, args.context \|\| {}, io, args.configPath)` |
| Context default | None | `args.context \|\| {}` (v3 engine expects object, not undefined) |
| IO object format | Single-line | Multi-line (readability) |

### `processEvent` Function Signature

```javascript
/**
 * @param {string} event - pipeline event name
 * @param {string} projectDir - absolute path to project directory
 * @param {Object} context - event-specific context from Orchestrator
 * @param {PipelineIO} io - dependency-injected I/O
 * @param {string} [configPath] - path to orchestration.yml; auto-discovers if omitted
 * @returns {PipelineResult}
 */
function processEvent(event, projectDir, context, io, configPath)
```

### PipelineResult — Output Contract (unchanged)

```javascript
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS values when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error info on failure
 * @property {string[]} mutations_applied - human-readable mutation descriptions; empty on failure
 */
```

### PipelineIO — DI Interface

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

### CLI Contract (must remain unchanged)

```
node pipeline.js --event <event> --project-dir <dir> [--config <path>] [--context <json>]
```

- `--event` (required): pipeline event name
- `--project-dir` (required): path to project directory
- `--config` (optional): path to orchestration.yml
- `--context` (optional): JSON string with event-specific context
- **stdout**: JSON `PipelineResult` object
- **exit code**: 0 on success, 1 on failure
- **stderr**: Error messages on uncaught exceptions

## Styles & Design Tokens

Not applicable — this is a CLI/infrastructure task with no UI components.

## Test Requirements

- [ ] All 8 v3 test files run successfully from `tests/` with `../lib/` require paths
- [ ] `tests/triage-engine.test.js` does not exist
- [ ] `pipeline.js` parses `--event`, `--project-dir`, `--config`, `--context` flags correctly (existing `parseArgs` tests still pass)
- [ ] `processEvent` is called with positional args `(event, projectDir, context, io, configPath)` — not the v2 options-object pattern
- [ ] V13 invariant check passes without test workarounds — `proposed.state.project.updated` is always a fresh ISO timestamp before validation
- [ ] Full suite: 374+ tests pass, 0 failures

## Acceptance Criteria

- [ ] `lib-old/` directory exists at `.github/orchestration/scripts/lib-old/` containing 7 v2 modules (`constants.js`, `mutations.js`, `pipeline-engine.js`, `resolver.js`, `state-io.js`, `state-validator.js`, `triage-engine.js`)
- [ ] `lib/` directory at `.github/orchestration/scripts/lib/` contains the 7 v3 modules (`constants.js`, `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, `validator.js`)
- [ ] `pipeline.js` imports `processEvent` and `scaffoldInitialState` from `./lib/pipeline-engine`
- [ ] `pipeline.js` calls `processEvent(event, projectDir, context, io, configPath)` with positional arguments
- [ ] CLI contract unchanged: `--event`, `--project-dir`, `--config`, `--context` flags; JSON stdout; exit code 0/1
- [ ] `tests/` directory contains all 8 v3 test files and `helpers/test-helpers.js`
- [ ] All test file `require` paths use `../lib/` (not `../lib-v3/`)
- [ ] `tests/triage-engine.test.js` does not exist
- [ ] Dead imports (`processAndAssert`, `deepClone`) removed from `tests/pipeline-engine.test.js`
- [ ] V13 timestamp fix applied: `proposed.state.project.updated = new Date().toISOString()` appears between mutation and validateTransition in `lib/pipeline-engine.js`
- [ ] All tests pass (374+ tests, 0 failures)
- [ ] Build succeeds (all modules importable via `require()`)

## Constraints

- Do NOT delete `lib-old/` — T04 handles cleanup
- Do NOT delete `tests-v3/` — T04 handles cleanup
- Do NOT modify any v3 module other than `pipeline-engine.js` (for the V13 fix only)
- Do NOT change the `parseArgs` function in `pipeline.js`
- Do NOT change the CLI flag names, JSON output format, or exit code behavior
- Do NOT add new dependencies — the project uses zero external dependencies
- Do NOT modify `state.json` — only the pipeline script writes state
- Do NOT modify any files outside `.github/orchestration/scripts/`
