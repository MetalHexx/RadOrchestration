---
project: "STATE-TRANSITION-SCRIPTS"
phase: 2
task: 4
title: "Next-Action CLI Entry Point"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# Next-Action CLI Entry Point

## Objective

Create `src/next-action.js` — the CLI entry point that reads `state.json` (and optionally `orchestration.yml`), calls the `resolveNextAction()` pure function, and emits the resulting `NextActionResult` JSON to stdout.

## Context

`src/lib/resolver.js` exports `resolveNextAction(state, config?)` — a pure function returning a `NextActionResult`. This task wraps that function with CLI argument parsing, file I/O, and error handling, following the same pattern as the existing `src/validate-state.js`. The Orchestrator agent will invoke this script via the terminal and parse its stdout JSON output.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/next-action.js` | CLI entry point wrapping `resolveNextAction()` |

## Implementation Steps

1. **Create file** with shebang `#!/usr/bin/env node` and `'use strict'`.
2. **Import dependencies**:
   - `{ readFile, exists }` from `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js`
   - `{ parseYaml }` from `../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js`
   - `{ resolveNextAction }` from `./lib/resolver.js`
3. **Implement `parseArgs(argv)`**: Parse `--state <path>` (required) and `--config <path>` (optional) flags from `argv` array. Throw `Error` with usage message if `--state` is missing.
4. **Implement `async function main()`**:
   a. Call `parseArgs(process.argv.slice(2))`.
   b. Check if `--state` file exists using `exists(statePath)`. If NOT, emit `init_project` action JSON to stdout and exit 0 (this is not an error — it means no project exists yet).
   c. Read `state.json` with `readFile(statePath)`. If null, write error to stderr, exit 1.
   d. Parse JSON with `JSON.parse()`. On `SyntaxError`, write error to stderr, exit 1.
   e. If `--config` was provided and file exists, read and parse it with `parseYaml(readFile(configPath))`. If config file doesn't exist, ignore (config is optional).
   f. Call `resolveNextAction(state, config)`.
   g. Write `JSON.stringify(result, null, 2) + '\n'` to stdout.
   h. Exit 0.
5. **Add `if (require.main === module)` guard** calling `main().catch()` with stderr error writing and exit 1.
6. **Export `parseArgs`** via `module.exports = { parseArgs }` for testability.

## Contracts & Interfaces

### `parseArgs` signature

```javascript
/**
 * Parse CLI arguments for --state and --config flags.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ state: string, config: string|null }}
 * @throws {Error} If --state is missing
 */
function parseArgs(argv) { /* ... */ }
```

### `resolveNextAction` signature (imported from `src/lib/resolver.js`)

```javascript
/**
 * @param {StateJson|null|undefined} state - Parsed state.json object
 * @param {OrchestratorConfig} [config] - Parsed orchestration.yml (optional)
 * @returns {NextActionResult}
 */
function resolveNextAction(state, config) { /* ... */ }
```

### `NextActionResult` shape (output on stdout)

```javascript
{
  action: string,       // NEXT_ACTIONS enum value
  context: {
    tier: string|null,
    phase_index: number|null,
    task_index: number|null,
    phase_id: string|null,
    task_id: string|null,
    details: string
  }
}
```

### `init_project` shortcut output (when state file does not exist)

```json
{
  "action": "init_project",
  "context": {
    "tier": null,
    "phase_index": null,
    "task_index": null,
    "phase_id": null,
    "task_id": null,
    "details": "No state.json provided; initializing new project"
  }
}
```

This is the same output as `resolveNextAction(null)` — the script calls the resolver with `null` when the state file doesn't exist.

### Error output format (stderr)

```
[ERROR] next-action: <message>
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — valid JSON written to stdout |
| `1` | Error — diagnostic message written to stderr |

### Reference implementation pattern (from `src/validate-state.js`)

```javascript
#!/usr/bin/env node
'use strict';

const { readFile } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { validateTransition } = require('./lib/state-validator');

function parseArgs(argv) {
  let current = null;
  let proposed = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--current' && i + 1 < argv.length) {
      current = argv[i + 1]; i++;
    } else if (argv[i] === '--proposed' && i + 1 < argv.length) {
      proposed = argv[i + 1]; i++;
    }
  }
  if (!current) { throw new Error('Usage: validate-state --current <path> --proposed <path>\nMissing required flag: --current'); }
  if (!proposed) { throw new Error('Usage: validate-state --current <path> --proposed <path>\nMissing required flag: --proposed'); }
  return { current, proposed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // ... read files, parse JSON, call domain function ...
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`[ERROR] validate-state: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { parseArgs };
```

## Styles & Design Tokens

N/A — CLI script with no UI.

## Test Requirements

- [ ] `node src/next-action.js --state <valid-state-path>` emits valid JSON to stdout with `action` and `context` fields
- [ ] `node src/next-action.js --state <nonexistent-path>` emits `init_project` JSON and exits 0
- [ ] `node src/next-action.js` (no flags) writes error to stderr and exits 1
- [ ] `parseArgs(['--state', 'path.json'])` returns `{ state: 'path.json', config: null }`
- [ ] `parseArgs(['--state', 'path.json', '--config', 'config.yml'])` returns both paths

## Acceptance Criteria

- [ ] File `src/next-action.js` exists and is valid JavaScript (`node -c` exits 0)
- [ ] Shebang `#!/usr/bin/env node` on line 1
- [ ] `'use strict'` on line 2
- [ ] CommonJS module (`require`/`module.exports`)
- [ ] `parseArgs()` exported via `module.exports = { parseArgs }`
- [ ] `if (require.main === module)` guard present
- [ ] `--state <path>` flag is required — missing flag throws Error with usage message
- [ ] `--config <path>` flag is optional — omission does not cause error
- [ ] Non-existent state file returns `init_project` action JSON to stdout, exits 0 (not an error)
- [ ] Valid state file produces correct `NextActionResult` JSON on stdout
- [ ] Exit code 0 on success, 1 on error
- [ ] Errors write `[ERROR] next-action: <message>` to stderr
- [ ] No regressions: `node tests/constants.test.js`, `node tests/state-validator.test.js` still pass
- [ ] All tests pass
- [ ] Build succeeds

## Constraints

- Do NOT modify `src/lib/resolver.js` — only import from it
- Do NOT modify `src/lib/constants.js`
- Do NOT modify `src/validate-state.js`
- Do NOT introduce any npm dependencies — use only Node.js built-ins and existing workspace utilities
- Do NOT duplicate `fs-helpers.js`, `yaml-parser.js` — import from existing paths
- Follow the exact CLI pattern established by `src/validate-state.js`
- The script must be a thin CLI wrapper — all routing logic lives in `src/lib/resolver.js`
