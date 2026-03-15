---
project: "VALIDATOR"
phase: 3
task: 4
title: "CLI Feature Completion"
status: "pending"
skills_required: ["code"]
skills_optional: ["test"]
estimated_files: 3
---

# CLI Feature Completion

## Objective

Verify and complete all CLI interface features — `--help` output, `NO_COLOR` env var, non-TTY auto-detection, `--verbose` detail blocks, `--quiet` mode, `--quiet` overrides `--verbose`, and summary statistics accuracy. Most features are already implemented; this task is primarily VERIFICATION + adding test coverage.

## Context

The CLI entry point (`validate-orchestration.js`) and reporter (`lib/reporter.js`) were built in Phase 1 with full flag parsing, color token maps, verbosity handling, and a `printHelp()` function. Phase 3 T1 (Review Fixes) resolved carry-forward issues. This task verifies all CLI behaviors match the Design specification and adds test coverage for each behavior. Expect minimal code changes — primarily new tests.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `validate-orchestration.js` | Fix only if --help, NO_COLOR, non-TTY, or flag precedence deviates from spec |
| MODIFY | `lib/reporter.js` | Fix only if --help text, verbose detail, or quiet mode deviates from spec |
| MODIFY | `tests/reporter.test.js` | Add test cases for all 7 verification items below |

## Implementation Steps

1. **Verify `--help` output**: Compare the current `printHelp()` output in `lib/reporter.js` against the exact help mockup below. The output must match line-for-line. If any deviation is found, fix `printHelp()`. Add a test that captures `printHelp()` output and asserts it matches the expected text.

2. **Verify `NO_COLOR` env var**: In `validate-orchestration.js`, the `parseArgs()` function already checks `process.env.NO_COLOR`. Verify: when `NO_COLOR` is set to any non-empty value (e.g., `"1"`, `"true"`, `"yes"`), `opts.noColor` becomes `true`. When `NO_COLOR` is unset or empty string, it does not force noColor. Add a test that sets `process.env.NO_COLOR = '1'`, calls `parseArgs([])`, and asserts `noColor === true`. Add a test that sets `process.env.NO_COLOR = ''` and asserts `noColor` is not forced.

3. **Verify non-TTY detection**: In `validate-orchestration.js`, the `parseArgs()` function checks `!process.stdout.isTTY`. Verify: when `isTTY` is falsy, `opts.noColor` becomes `true`. Add a test that mocks `process.stdout.isTTY = false`, calls `parseArgs([])`, and asserts `noColor === true`. Restore `isTTY` after the test.

4. **Verify `--verbose` detail blocks**: In `lib/reporter.js`, the `renderCategoryBlock()` function shows detail blocks when `r.status === 'fail' || verbose`. Verify that in verbose mode, pass and warn checks with `detail` objects also render `Expected:`/`Found:` lines. Add a test that calls `report()` with `{ verbose: true }` and check results that include pass/warn items with `detail` objects — assert the output contains those detail lines.

5. **Verify `--quiet` mode**: In `lib/reporter.js`, the `report()` function checks `if (quiet)` and renders only the summary bar. Verify: no header, no category blocks, only the `RESULT:` summary line flanked by separator lines. Add a test that calls `report()` with `{ quiet: true }` and asserts the output contains `RESULT:` but does NOT contain any category header or check line.

6. **Verify `--quiet` overrides `--verbose`**: In `validate-orchestration.js`, `parseArgs()` sets `opts.verbose = false` when `opts.quiet` is true. Add a test: `parseArgs(['--quiet', '--verbose'])` must return `{ quiet: true, verbose: false }`. Also test reverse order: `parseArgs(['--verbose', '--quiet'])` must return the same.

7. **Verify summary statistics accuracy**: The `countByStatus()` function in `reporter.js` counts pass/fail/warn from results. Add a test with a known set of results (e.g., 5 pass, 2 fail, 1 warn) and assert the summary bar output contains exactly `5 passed  2 failed  1 warning`. Also verify `warnings` (plural) is used when count ≠ 1.

## Contracts & Interfaces

### parseArgs signature (validate-orchestration.js)

```javascript
/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ help: boolean, noColor: boolean, verbose: boolean, quiet: boolean, category: string|null }}
 */
function parseArgs(argv) { ... }
```

NOTE: `parseArgs` is currently not exported. To test it, you must either:
- Export it from `validate-orchestration.js` (preferred: add `module.exports = { parseArgs }` at bottom, guarded by `if (require.main !== module)` for the main() call), OR
- Extract it into a separate module.

Choose the simplest approach: export `parseArgs` alongside the existing entry-point logic. The `main()` call at the bottom should be guarded:

```javascript
if (require.main === module) {
  main().catch((err) => {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  });
}

module.exports = { parseArgs };
```

### report signature (lib/reporter.js)

```javascript
/**
 * @param {Array<CheckResult>} results
 * @param {{ noColor?: boolean, verbose?: boolean, quiet?: boolean }} options
 */
function report(results, options) { ... }
```

### printHelp signature (lib/reporter.js)

```javascript
/**
 * Print the --help usage to stdout. No parameters, no return value.
 */
function printHelp() { ... }
```

### CheckResult shape

```javascript
{
  category: string,    // e.g., 'agents'
  status: 'pass' | 'fail' | 'warn',
  name: string,        // identifier (filename, path, etc.)
  message: string,     // human-readable description
  detail?: {           // optional detail block
    expected?: string,
    found?: string,
    context?: string,
  }
}
```

## Styles & Design Tokens

### Design-Specified --help Output (must match exactly)

```
Orchestration Validator v1.0.0

Usage: node validate-orchestration.js [options]

Options:
  -h, --help              Show this help message and exit
  -v, --verbose           Show detailed context for every check
  -q, --quiet             Show only the final summary line
  -c, --category <name>   Run only the named category
      --no-color          Suppress ANSI color codes

Categories:
  structure        .github/ directory structure and required files
  agents           Agent file frontmatter, tools, and body conventions
  skills           Skill directory structure, SKILL.md frontmatter
  config           orchestration.yml field presence and value validation
  instructions     Instruction file frontmatter and applyTo patterns
  prompts          Prompt file frontmatter and tools validation
  cross-references Agent→skill, skill→template, and config→path resolution

Environment:
  NO_COLOR=1       Equivalent to --no-color

Examples:
  node validate-orchestration.js                  Run all checks
  node validate-orchestration.js --category agents  Check agents only
  node validate-orchestration.js --verbose          Detailed output
  node validate-orchestration.js --quiet            Summary only
  node validate-orchestration.js --no-color         CI-friendly output
```

The `→` character is Unicode U+2192 (RIGHTWARDS ARROW). In code: `'\u2192'`.

### ANSI Color Tokens (for reference — reporter.js already has these)

| Token | ANSI Code | Usage |
|-------|-----------|-------|
| `pass` | `\x1b[32m` | Green — pass markers, pass counts |
| `fail` | `\x1b[31m` | Red — fail markers, fail counts |
| `warn` | `\x1b[33m` | Yellow — warn markers, warn counts |
| `boldGreen` | `\x1b[1;32m` | PASS verdict |
| `boldRed` | `\x1b[1;31m` | FAIL verdict |
| `dim` | `\x1b[2m` | Separator lines, box-drawing |
| `reset` | `\x1b[0m` | Terminates any style |

### Summary Bar Format

```
{separator_line}
  RESULT: {PASS|FAIL}  {pipe}  {N} passed  {N} failed  {N} {warning|warnings}
{separator_line}
```

- `warning` (singular) when count is exactly 1; `warnings` (plural) otherwise.

## Test Requirements

- [ ] **T-help**: `printHelp()` output matches the Design-specified help text exactly (line-for-line comparison)
- [ ] **T-nocolor-env**: `parseArgs([])` with `process.env.NO_COLOR = '1'` returns `noColor: true`
- [ ] **T-nocolor-env-empty**: `parseArgs([])` with `process.env.NO_COLOR = ''` does NOT force `noColor: true` (unless non-TTY)
- [ ] **T-nontty**: `parseArgs([])` with `process.stdout.isTTY = false` (or undefined) returns `noColor: true`
- [ ] **T-verbose-detail-pass**: `report()` with `{ verbose: true, noColor: true }` and a pass result with detail — output contains `Expected:` line
- [ ] **T-verbose-detail-warn**: `report()` with `{ verbose: true, noColor: true }` and a warn result with detail — output contains `Expected:` line
- [ ] **T-quiet-only-summary**: `report()` with `{ quiet: true, noColor: true }` — output contains `RESULT:` but not any category header
- [ ] **T-quiet-overrides-verbose**: `parseArgs(['--quiet', '--verbose'])` returns `{ quiet: true, verbose: false }`
- [ ] **T-quiet-overrides-verbose-reverse**: `parseArgs(['--verbose', '--quiet'])` returns `{ quiet: true, verbose: false }`
- [ ] **T-summary-counts**: `report()` with 5 pass, 2 fail, 1 warn results and `{ noColor: true }` — summary line contains `5 passed  2 failed  1 warning`
- [ ] **T-summary-plural**: `report()` with 0 warnings — summary contains `0 warnings` (plural)
- [ ] **T-summary-singular**: `report()` with 1 warning — summary contains `1 warning` (singular, no trailing 's')

## Acceptance Criteria

- [ ] `--help` output matches the Design specification line-for-line
- [ ] `NO_COLOR=1` env var suppresses ANSI codes (equivalent to `--no-color`)
- [ ] Non-TTY stdout (`process.stdout.isTTY` falsy) suppresses ANSI codes automatically
- [ ] `--verbose` mode shows detail blocks for pass and warn checks (not just failures)
- [ ] `--quiet` mode prints only the final summary bar (no header, no categories, no check lines)
- [ ] `--quiet` overrides `--verbose` when both flags are provided
- [ ] Summary bar pass/fail/warn counts are accurate for a given set of results
- [ ] All new tests pass
- [ ] All existing tests continue to pass
- [ ] No lint errors

## Constraints

- Do NOT restructure `reporter.js` — only fix deviations if found; add tests
- Do NOT add new check modules or validation logic
- Do NOT change the behavior of existing check modules
- Do NOT modify any files under `lib/checks/`
- Keep the `parseArgs` export minimal — do not refactor the entire entry point
- Use `noColor: true` in test assertions to avoid ANSI escape code matching complexity
- Restore any mocked globals (`process.env.NO_COLOR`, `process.stdout.isTTY`) after each test
