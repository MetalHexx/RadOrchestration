---
project: "VALIDATOR"
phase: 2
task: 6
title: "Integration — Wire All Check Modules"
status: "pending"
skills_required: []
skills_optional: ["run-tests"]
estimated_files: 1
---

# Integration — Wire All Check Modules

## Objective

Replace the six `null` placeholder entries in the `CHECK_MODULES` array of `validate-orchestration.js` with real `require()` imports to the check modules built in T1–T5, so that a full `node validate-orchestration.js` run executes all 7 validation categories end-to-end with zero false positives on the current workspace.

## Context

`validate-orchestration.js` is the CLI entry point created in Phase 1. It defines a `CHECK_MODULES` array with 7 entries — the first (`structure`) is already wired; the remaining 6 have `check: null` and are skipped at runtime. Each check module follows the same async signature `(basePath, context) => Promise<CheckResult[]>` and populates the shared `context` object. The modules must run in order because `cross-references` reads context populated by the preceding 5 modules. The `--category` filter already works — it filters *results* after all checks run.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `validate-orchestration.js` | Replace null placeholders with require() imports; wire into CHECK_MODULES |

## Current File Content

The **entire** current content of `validate-orchestration.js` is below. Use this as the baseline for your modifications:

```javascript
#!/usr/bin/env node
'use strict';

const path = require('path');
const { report, printHelp } = require('./lib/reporter');
const checkStructure = require('./lib/checks/structure');

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Argument Parsing ─────────────────────────────────────────────────────────

/**
 * Parse CLI arguments into an options object.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ help: boolean, noColor: boolean, verbose: boolean, quiet: boolean, category: string|null }}
 */
function parseArgs(argv) {
  const opts = { help: false, noColor: false, verbose: false, quiet: false, category: null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--no-color') {
      opts.noColor = true;
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (arg === '--category' || arg === '-c') {
      opts.category = argv[++i] || null;
    }
  }

  // --quiet overrides --verbose
  if (opts.quiet) {
    opts.verbose = false;
  }

  // Respect NO_COLOR env and non-TTY stdout
  if ((process.env.NO_COLOR && process.env.NO_COLOR !== '') || !process.stdout.isTTY) {
    opts.noColor = true;
  }

  return opts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.category !== null && !CATEGORIES.includes(options.category)) {
    console.error(`Error: Unknown category "${options.category}". Valid categories: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  const basePath = path.resolve(process.cwd());

  const context = {
    agents: new Map(),
    skills: new Map(),
    config: null,
    instructions: [],
    prompts: [],
  };

  const allResults = [];
  for (const mod of CHECK_MODULES) {
    if (mod.check === null) continue;
    const results = await mod.check(basePath, context);
    allResults.push(...results);
  }

  const reportResults = options.category
    ? allResults.filter(r => r.category === options.category)
    : allResults;

  report(reportResults, {
    noColor: options.noColor,
    verbose: options.verbose,
    quiet: options.quiet,
  });

  const failCount = reportResults.filter(r => r.status === 'fail').length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});
```

## Implementation Steps

1. **Add six `require()` imports** at the top of the file (after the existing `checkStructure` require):
   ```javascript
   const checkAgents = require('./lib/checks/agents');
   const checkSkills = require('./lib/checks/skills');
   const checkConfig = require('./lib/checks/config');
   const checkInstructions = require('./lib/checks/instructions');
   const checkPrompts = require('./lib/checks/prompts');
   const checkCrossRefs = require('./lib/checks/cross-refs');
   ```

2. **Replace each `null` in `CHECK_MODULES`** with the corresponding imported function:
   ```javascript
   const CHECK_MODULES = [
     { category: 'structure', check: checkStructure },
     { category: 'agents', check: checkAgents },
     { category: 'skills', check: checkSkills },
     { category: 'config', check: checkConfig },
     { category: 'instructions', check: checkInstructions },
     { category: 'prompts', check: checkPrompts },
     { category: 'cross-references', check: checkCrossRefs },
   ];
   ```

3. **Do NOT change** the `for...of` loop, argument parsing, `report()` call, or exit-code logic — they already handle all 7 categories correctly.

4. **Category filter / prerequisite logic** — no code changes needed here. The existing loop always runs ALL check modules in order (structure → agents → skills → config → instructions → prompts → cross-references). This is correct because `cross-references` needs `context.agents`, `context.skills`, etc. populated by the preceding modules. The `--category` filter already applies after all checks run — it filters `allResults` for reporting only. This means if a user runs `--category cross-references`, all modules still execute (populating context), but only cross-reference results appear in the output. This is the desired behavior.

5. **Run `node validate-orchestration.js`** against the workspace and verify:
   - All 7 categories produce results
   - Exit code is 0 (no false positives on the valid workspace)

6. **Test flag combinations**:
   - `node validate-orchestration.js --verbose` — all detail blocks appear
   - `node validate-orchestration.js --quiet` — only failures shown
   - `node validate-orchestration.js --no-color` — no ANSI escapes
   - `node validate-orchestration.js --category agents` — only agents results
   - `node validate-orchestration.js --category cross-references` — only cross-ref results

7. **If any checks produce false-positive failures** on the valid workspace, investigate and fix the integration (not the check module itself — those are tested individually). Common causes:
   - Wrong `basePath` (must be the workspace root containing `.github/`)
   - Check module expects a directory that doesn't exist yet (e.g., `.github/prompts/` is optional)

## Contracts & Interfaces

Every check module exports a single async function with this signature:

```javascript
/**
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Mutable shared discovery context
 * @returns {Promise<Array<CheckResult>>}
 */
async function checkXxx(basePath, context) { ... }
```

**CheckResult** shape (returned by every check module):

```javascript
/**
 * @typedef {Object} CheckResult
 * @property {string} category  - One of CATEGORIES (e.g., 'agents', 'skills')
 * @property {string} name      - Human-readable check name
 * @property {'pass'|'fail'|'warn'} status - Result status
 * @property {string} message   - Summary message
 * @property {object} [detail]  - Optional detail object (shown in --verbose)
 * @property {string} [detail.expected] - What was expected
 * @property {string} [detail.found]    - What was found
 * @property {string} [detail.context]  - Additional context
 */
```

**Module exports** (each file's `module.exports`):

| Module | File | Export |
|--------|------|--------|
| `checkStructure` | `lib/checks/structure.js` | `module.exports = checkStructure` (named function) |
| `checkAgents` | `lib/checks/agents.js` | `module.exports = checkAgents` (named function) |
| `checkSkills` | `lib/checks/skills.js` | `module.exports = checkSkills` (named function) |
| `checkConfig` | `lib/checks/config.js` | `module.exports = async function checkConfig(basePath, context) { ... }` (anonymous inline) |
| `checkInstructions` | `lib/checks/instructions.js` | `module.exports = checkInstructions` (named function) |
| `checkPrompts` | `lib/checks/prompts.js` | `module.exports = checkPrompts` (named function) |
| `checkCrossRefs` | `lib/checks/cross-refs.js` | `module.exports = async function checkCrossRefs(basePath, context) { ... }` (anonymous inline) |

**Shared context object** (mutable, passed to every check module):

```javascript
const context = {
  agents: new Map(),       // Map<filename, AgentInfo> — populated by checkAgents
  skills: new Map(),       // Map<folderName, SkillInfo> — populated by checkSkills
  config: null,            // parsed orchestration.yml object — populated by checkConfig
  instructions: [],        // Array<InstructionInfo> — populated by checkInstructions
  prompts: [],             // Array<PromptInfo> — populated by checkPrompts
};
```

**report() signature** (already wired, no changes needed):

```javascript
/**
 * @param {CheckResult[]} results
 * @param {{ noColor: boolean, verbose: boolean, quiet: boolean }} options
 */
function report(results, options) { ... }
```

## Test Requirements

- [ ] `node validate-orchestration.js` runs end-to-end with exit code 0 on the current workspace
- [ ] Output includes results from all 7 categories: structure, agents, skills, config, instructions, prompts, cross-references
- [ ] `--category structure` shows only structure results
- [ ] `--category agents` shows only agents results
- [ ] `--category skills` shows only skills results
- [ ] `--category config` shows only config results
- [ ] `--category instructions` shows only instructions results
- [ ] `--category prompts` shows only prompts results
- [ ] `--category cross-references` shows only cross-references results (all modules still run for context)
- [ ] `--verbose` flag shows detail blocks for all categories
- [ ] `--quiet` flag suppresses non-failure output
- [ ] `--no-color` flag produces output with no ANSI escape sequences
- [ ] `--help` still prints usage and exits 0

## Acceptance Criteria

- [ ] `CHECK_MODULES` array contains zero `null` entries — all 7 categories have a `check` function
- [ ] `node validate-orchestration.js` exits 0 on the current valid workspace (zero false positives)
- [ ] Output covers all 7 categories when run without `--category`
- [ ] `--category <name>` works for all 7 category names
- [ ] `--verbose`, `--quiet`, `--no-color` flags all work correctly with the full check suite
- [ ] No new files created — only `validate-orchestration.js` is modified
- [ ] All existing tests still pass (`node --test tests/`)

## Constraints

- Do NOT modify any check module (`lib/checks/*.js`) — only modify `validate-orchestration.js`
- Do NOT change the `parseArgs()` function
- Do NOT change the `report()` call signature or import
- Do NOT reorder the `CHECK_MODULES` array — the order matters (cross-references must run last)
- Do NOT add new CLI flags or features — this is strictly a wiring task
- Do NOT change the `context` object shape — it is already correct
- If a check module produces unexpected failures on the valid workspace, document them in the task report but do NOT modify the check module code
