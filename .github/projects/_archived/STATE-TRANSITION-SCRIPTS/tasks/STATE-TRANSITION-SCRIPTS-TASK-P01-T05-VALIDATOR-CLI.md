---
project: "STATE-TRANSITION-SCRIPTS"
phase: 1
task: 5
title: "Validator CLI Entry Point"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# Validator CLI Entry Point

## Objective

Create `src/validate-state.js` — the CLI entry point for the State Transition Validator. This script parses `--current` and `--proposed` flags, reads both JSON files, calls `validateTransition()`, emits a structured JSON result to stdout, and exits with code `0` (valid) or `1` (invalid).

## Context

`src/lib/state-validator.js` already exports `validateTransition(current, proposed)` returning `{ valid: true, invariants_checked: 15 }` or `{ valid: false, invariants_checked: 15, errors: [...] }`. The CLI wrapper wires filesystem I/O to this pure function. The utility `readFile(path)` from the workspace's fs-helpers returns file content as a string or `null` on failure (never throws). This is the last task in Phase 1 — all constants and validator logic are already implemented and tested.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/validate-state.js` | CLI entry point — shebang, CommonJS, `parseArgs` export, `main()` with `.catch()` |

## Implementation Steps

1. Add shebang `#!/usr/bin/env node` as the first line, then `'use strict';`
2. Import `readFile` from `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers`
3. Import `validateTransition` from `./lib/state-validator`
4. Implement `parseArgs(argv)` — scan `argv` array for `--current` and `--proposed` flags, return `{ current, proposed }`. Throw an `Error` with a usage message if either flag is missing or has no value.
5. Implement `async function main()`:
   a. Call `parseArgs(process.argv.slice(2))`
   b. Call `readFile(args.current)` — if `null`, write `[ERROR] validate-state: Cannot read current state file: <path>` to stderr and `process.exit(1)`
   c. Call `readFile(args.proposed)` — if `null`, write `[ERROR] validate-state: Cannot read proposed state file: <path>` to stderr and `process.exit(1)`
   d. Parse both with `JSON.parse()` — wrap in try/catch; on parse error write `[ERROR] validate-state: Invalid JSON in <path>: <message>` to stderr and `process.exit(1)`
   e. Call `validateTransition(currentObj, proposedObj)`
   f. Write `JSON.stringify(result, null, 2)` to stdout
   g. Call `process.exit(result.valid ? 0 : 1)`
6. Add `if (require.main === module) { main().catch(err => { ... }); }` guard:
   - In the `.catch()`: write `[ERROR] validate-state: <err.message>` to stderr, then `process.exit(1)`
7. Export `parseArgs` via `module.exports = { parseArgs };`

## Contracts & Interfaces

### `parseArgs` signature

```javascript
/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ current: string, proposed: string }}
 * @throws {Error} If --current or --proposed is missing
 */
function parseArgs(argv) { /* ... */ }
```

### `validateTransition` (already implemented — consumed, not created)

```javascript
/**
 * @param {StateJson} current - The current (committed) state.json object
 * @param {StateJson} proposed - The proposed (uncommitted) state.json object
 * @returns {ValidationResult}
 */

// ValidationResult is one of:
// { valid: true, invariants_checked: 15 }
// { valid: false, invariants_checked: 15, errors: InvariantError[] }

// InvariantError:
// { invariant: "V1"–"V15", message: string, severity: "critical" }
```

### `readFile` (already implemented — consumed, not created)

```javascript
/**
 * @param {string} filePath
 * @returns {string|null} File content or null if not found. Never throws.
 */
function readFile(filePath) { /* ... */ }
```

### stdout success output (valid transition)

```json
{
  "valid": true,
  "invariants_checked": 15
}
```

### stdout failure output (invalid transition)

```json
{
  "valid": false,
  "invariants_checked": 15,
  "errors": [
    {
      "invariant": "V6",
      "message": "Multiple tasks have status 'in_progress': P1-T1, P1-T2",
      "severity": "critical"
    }
  ]
}
```

### stderr format (crashes / bad input)

```
[ERROR] validate-state: <message>
```

## Styles & Design Tokens

Not applicable — CLI script, no UI.

## Test Requirements

- [ ] `parseArgs(['--current', 'a.json', '--proposed', 'b.json'])` returns `{ current: 'a.json', proposed: 'b.json' }`
- [ ] `parseArgs([])` throws an `Error` mentioning `--current`
- [ ] `parseArgs(['--current', 'a.json'])` throws an `Error` mentioning `--proposed`
- [ ] `parseArgs(['--proposed', 'b.json'])` throws an `Error` mentioning `--current`
- [ ] Flag order does not matter: `['--proposed', 'b.json', '--current', 'a.json']` works
- [ ] End-to-end: `node src/validate-state.js --current <valid-state> --proposed <valid-state>` exits `0` with valid JSON on stdout
- [ ] End-to-end: calling with a proposed state containing an invariant violation exits `1` with `"valid": false` in stdout JSON

## Acceptance Criteria

- [ ] `src/validate-state.js` exists and starts with `#!/usr/bin/env node` followed by `'use strict';`
- [ ] `require('./src/validate-state.js')` does NOT execute `main()` (the `require.main === module` guard prevents it)
- [ ] `parseArgs` is exported via `module.exports` and is callable from tests
- [ ] `node src/validate-state.js --current <valid> --proposed <valid>` emits `{ "valid": true, "invariants_checked": 15 }` to stdout and exits `0`
- [ ] `node src/validate-state.js --current <valid> --proposed <invalid>` emits `{ "valid": false, ... }` to stdout and exits `1`
- [ ] Missing `--current` or `--proposed` flag writes `[ERROR] validate-state: ...` to stderr and exits `1`
- [ ] Unreadable file path writes `[ERROR] validate-state: Cannot read ...` to stderr and exits `1`
- [ ] Invalid JSON in either file writes `[ERROR] validate-state: Invalid JSON ...` to stderr and exits `1`
- [ ] stdout contains ONLY the `JSON.stringify(result, null, 2)` output — no other `console.log` calls
- [ ] File uses CommonJS (`require`/`module.exports`), not ES modules
- [ ] No lint errors, no syntax errors
- [ ] `node src/validate-state.js` (no flags) exits `1` with usage error on stderr

## Constraints

- Do NOT modify `src/lib/state-validator.js` — consume it as-is
- Do NOT modify `src/lib/constants.js` — consume it as-is
- Do NOT add any npm dependencies — use only Node.js built-ins and the workspace `readFile` utility
- Do NOT write to `state.json` — this script is read-only
- Do NOT use `console.log()` anywhere except the single final `JSON.stringify` write to stdout
- Do NOT use ES module syntax (`import`/`export`) — use CommonJS only
- Do NOT add color or formatting to output — plain JSON on stdout, plain text on stderr
