---
project: "VALIDATOR"
phase: 1
task: 6
title: "CLI Entry Point & Integration"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# CLI Entry Point & Integration

## Objective

Replace the existing monolithic `validate-orchestration.js` (725 lines) with a new modular CLI entry point that parses arguments, creates a discovery context, runs registered check modules in order, invokes the reporter, and exits with the correct code. This file wires together all modules built in T1–T5.

## Context

The workspace has an existing `validate-orchestration.js` at the project root — a 725-line monolith that does everything inline. This task **completely replaces** that file with a short, modular entry point. All validation logic, filesystem helpers, and output formatting now live in dedicated modules under `lib/`. Phase 1 wires only the `structure` check module; other categories are null placeholders for Phase 2. The frontmatter and YAML parser utilities are NOT used by the entry point — they are consumed by check modules added in Phase 2.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| REPLACE | `validate-orchestration.js` | Completely overwrite the existing 725-line monolith with the new modular entry point. Read the existing file first to confirm it is the old version, then replace its entire content. |

## Implementation Steps

1. **Add the shebang line** as the very first line: `#!/usr/bin/env node`

2. **Add `'use strict';`** on the next line.

3. **Require dependencies**:
   ```javascript
   const path = require('path');
   const { report, printHelp } = require('./lib/reporter');
   const checkStructure = require('./lib/checks/structure');
   ```
   Do NOT require `fs-helpers`, `frontmatter`, or `yaml-parser` — those are consumed by check modules, not by the entry point.

4. **Define constants** — the CATEGORIES array and CHECK_MODULES registry:
   ```javascript
   const CATEGORIES = ['structure', 'agents', 'skills', 'config', 'instructions', 'prompts', 'cross-references'];

   const CHECK_MODULES = [
     { category: 'structure', check: checkStructure },
     { category: 'agents', check: null },
     { category: 'skills', check: null },
     { category: 'config', check: null },
     { category: 'instructions', check: null },
     { category: 'prompts', check: null },
     { category: 'cross-references', check: null },
   ];
   ```

5. **Implement `parseArgs(argv)` function** that takes `process.argv.slice(2)` and returns a `CLIOptions` object:
   - Walk the argv array from left to right
   - `--help` or `-h` → set `help: true`
   - `--no-color` → set `noColor: true`
   - `--verbose` or `-v` → set `verbose: true`
   - `--quiet` or `-q` → set `quiet: true`
   - `--category` or `-c` → consume the NEXT argument as the category name; set `category: <name>`
   - Default values: `{ help: false, noColor: false, verbose: false, quiet: false, category: null }`
   - After parsing, apply overrides:
     - If `quiet` is true, force `verbose` to false (`--quiet` overrides `--verbose`)
     - If `process.env.NO_COLOR` is set (truthy, non-empty string) OR `process.stdout.isTTY` is falsy, force `noColor` to true

6. **Implement the `main()` async function** containing the core flow:

   a. **Parse arguments**: `const options = parseArgs(process.argv.slice(2));`

   b. **Handle `--help`**: If `options.help`, call `printHelp()`, then `process.exit(0)`.

   c. **Validate `--category`**: If `options.category` is not null and not in `CATEGORIES`, print an error message to stderr: `Error: Unknown category "${options.category}". Valid categories: ${CATEGORIES.join(', ')}` and call `process.exit(1)`.

   d. **Resolve basePath**: `const basePath = path.resolve(process.cwd());`

   e. **Create DiscoveryContext**:
      ```javascript
      const context = {
        agents: new Map(),
        skills: new Map(),
        config: null,
        instructions: [],
        prompts: [],
      };
      ```

   f. **Run check modules** in order, collecting results:
      ```javascript
      const allResults = [];
      for (const mod of CHECK_MODULES) {
        if (mod.check === null) continue;  // skip Phase 2 placeholders
        const results = await mod.check(basePath, context);
        allResults.push(...results);
      }
      ```

   g. **Filter by category** (if `--category` specified):
      ```javascript
      const reportResults = options.category
        ? allResults.filter(r => r.category === options.category)
        : allResults;
      ```

   h. **Invoke reporter**:
      ```javascript
      report(reportResults, {
        noColor: options.noColor,
        verbose: options.verbose,
        quiet: options.quiet,
      });
      ```

   i. **Determine exit code**: Count failures among `reportResults` (results where `status === 'fail'`). If count > 0, `process.exit(1)`. Otherwise `process.exit(0)`.

7. **Call `main()` with a top-level catch**:
   ```javascript
   main().catch((err) => {
     console.error('Unexpected error:', err.message || err);
     process.exit(1);
   });
   ```

8. **Verify the file** has the shebang, 'use strict', requires, constants, parseArgs function, main function, and top-level main().catch() — nothing else. The file should be approximately 80–120 lines.

## Contracts & Interfaces

### CLIOptions (internal to this file)

```typescript
interface CLIOptions {
  help: boolean;
  noColor: boolean;
  verbose: boolean;
  quiet: boolean;
  category: string | null;  // null = run all categories
}
```

### CheckResult (returned by check modules)

```typescript
interface CheckResult {
  /** Category grouping: 'structure' | 'agents' | 'skills' | 'config' | 'instructions' | 'prompts' | 'cross-references' */
  category: string;
  /** Human-readable identifier (e.g., '.github/ directory') */
  name: string;
  /** Outcome of this check */
  status: 'pass' | 'fail' | 'warn';
  /** One-line description of what was checked or what went wrong */
  message: string;
  /** Optional structured detail for verbose/failure output */
  detail?: CheckDetail;
}

interface CheckDetail {
  expected: string;
  found: string;
  context?: string;
}
```

### DiscoveryContext (created by entry point, passed to check modules)

```typescript
interface DiscoveryContext {
  agents: Map<string, AgentInfo>;
  skills: Map<string, SkillInfo>;
  config: Record<string, any> | null;
  instructions: InstructionInfo[];
  prompts: PromptInfo[];
}
```

In Phase 1, only `structure` check runs. It does NOT populate any DiscoveryContext fields — the context is passed through but unused. Phase 2 check modules will populate `agents`, `skills`, `config`, `instructions`, and `prompts`.

### Reporter module signatures (lib/reporter.js — already implemented in T4)

```javascript
/**
 * Render validation results to stdout.
 * @param {CheckResult[]} results - All CheckResult objects to report
 * @param {{ noColor: boolean, verbose: boolean, quiet: boolean }} options
 */
function report(results, options) { ... }

/**
 * Print the --help usage text to stdout. No arguments.
 */
function printHelp() { ... }

module.exports = { report, printHelp };
```

### checkStructure signature (lib/checks/structure.js — already implemented in T5)

```javascript
/**
 * Validate .github/ directory structure.
 * @param {string} basePath - Absolute path to the workspace root
 * @param {DiscoveryContext} context - Shared discovery context (unused by structure check)
 * @returns {Promise<CheckResult[]>} Array of CheckResult objects with category 'structure'
 */
module.exports = async function checkStructure(basePath, context) { ... };
```

This function returns an array of CheckResult objects. Example output (7 results, one per required directory/file):

```javascript
[
  { category: 'structure', name: '.github/ directory', status: 'pass', message: '.github/ directory exists' },
  { category: 'structure', name: '.github/agents/ directory', status: 'pass', message: '.github/agents/ directory exists' },
  // ... etc
]
```

### fs-helpers signatures (lib/utils/fs-helpers.js — NOT used by this file, listed for reference only)

**Do NOT require fs-helpers in the entry point.** It is used internally by check modules.

## Styles & Design Tokens

Not applicable — the entry point does not render any output directly. All output goes through `reporter.report()` and `reporter.printHelp()`.

## Test Requirements

- [ ] Running `node validate-orchestration.js` executes without error and produces output to stdout
- [ ] Running `node validate-orchestration.js --help` prints help text and exits with code 0
- [ ] Running `node validate-orchestration.js --no-color` produces output without ANSI escape codes
- [ ] Running `node validate-orchestration.js --verbose` produces output with detail blocks for passing checks
- [ ] Running `node validate-orchestration.js --quiet` produces only the final summary bar
- [ ] Running `node validate-orchestration.js --category structure` produces output for the structure category only
- [ ] Running `node validate-orchestration.js --category invalid` prints an error message and exits with code 1
- [ ] When all structure checks pass, exit code is 0
- [ ] When any structure check fails, exit code is 1
- [ ] `--quiet --verbose` together results in quiet mode only (quiet overrides verbose)
- [ ] Setting `NO_COLOR=1` environment variable suppresses ANSI color codes

## Acceptance Criteria

- [ ] File `validate-orchestration.js` exists at workspace root and starts with `#!/usr/bin/env node`
- [ ] File uses `'use strict';`
- [ ] File requires `path`, `./lib/reporter`, and `./lib/checks/structure` — no other local requires
- [ ] `CATEGORIES` array contains exactly: `['structure', 'agents', 'skills', 'config', 'instructions', 'prompts', 'cross-references']`
- [ ] `CHECK_MODULES` registry has 7 entries; only `structure` has a non-null check function
- [ ] `parseArgs` correctly handles `--help`/`-h`, `--no-color`, `--verbose`/`-v`, `--quiet`/`-q`, `--category`/`-c <name>`
- [ ] `--quiet` overrides `--verbose` when both are provided
- [ ] `--no-color` activates when `process.env.NO_COLOR` is set (non-empty) OR `process.stdout.isTTY` is falsy
- [ ] `--help` calls `printHelp()` and exits 0 — does not run any checks
- [ ] `--category` with an invalid name prints error to stderr and exits 1
- [ ] DiscoveryContext is created with `agents: new Map(), skills: new Map(), config: null, instructions: [], prompts: []`
- [ ] Check modules run in CHECK_MODULES order; null entries are skipped
- [ ] Results are filtered by category when `--category` is specified before passing to `report()`
- [ ] `report()` is called with `{ noColor, verbose, quiet }` options object
- [ ] Exit code is 0 when no results have `status === 'fail'`, 1 when any do
- [ ] Top-level `main().catch()` handles unexpected errors: prints message to stderr and exits 1
- [ ] File is approximately 80–120 lines (not 725) — confirms monolith was replaced
- [ ] No lint errors

## Constraints

- Do NOT import or require `fs` directly — the entry point does not do filesystem operations
- Do NOT import `lib/utils/fs-helpers.js`, `lib/utils/frontmatter.js`, or `lib/utils/yaml-parser.js` — those are used by check modules internally
- Do NOT write to stdout directly (no `console.log` for output) — all user-facing output goes through `reporter.report()` or `reporter.printHelp()`. Exception: the top-level error handler may use `console.error` for unexpected errors
- Do NOT add any check logic in the entry point — all validation logic belongs in `lib/checks/` modules
- Do NOT use `process.exit()` inside `parseArgs` — it is a pure function that returns an options object
- Do NOT modify any files in `lib/` — they are already implemented and tested (T1–T5)
- The existing `validate-orchestration.js` is being REPLACED, not modified — write the entire file from scratch
