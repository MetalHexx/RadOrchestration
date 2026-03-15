---
project: "VALIDATOR"
phase: 1
task: 4
title: "Reporter Module"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Reporter Module

## Objective

Create `lib/reporter.js` — the complete output rendering module that owns all ANSI escape sequences, marker strings, box-drawing characters, and verbosity behavior. This module renders `CheckResult[]` arrays to stdout as a structured, colored terminal report. It also provides the `--help` usage text printer.

## Context

VALIDATOR is a zero-dependency Node.js CLI tool that validates `.github/` orchestration files. The reporter is the sole module that writes to stdout and contains ANSI codes — no other module touches stdout or embeds escape sequences. The reporter receives an array of `CheckResult` objects (each with category, name, status, message, and optional detail) plus a `ReporterOptions` object controlling color, verbosity, and quiet mode. It renders a three-region output: header, category blocks, and a final summary bar.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/reporter.js` | Complete reporter module — CommonJS, zero dependencies, uses only `process.stdout` |

## Implementation Steps

1. **Define the ANSI color token map** — an object mapping token names to ANSI SGR escape codes (see Styles & Design Tokens below). When `noColor` is `true`, every token maps to an empty string.

2. **Define the marker map** — an object with `pass`, `fail`, `warn` keys. Color mode: `✓`, `✗`, `⚠`. No-color mode: `[PASS]`, `[FAIL]`, `[WARN]`.

3. **Define the separator map** — an object with `double`, `topLeft`, `bottomLeft`, `vertical`, `horizontal` keys. Color mode: `═`, `┌`, `└`, `│`, `─`. No-color mode: `=`, `---`, `---`, ` ` (space), `-`.

4. **Implement `report(results, options)`**:
   - Resolve token maps based on `options.noColor`.
   - If `options.quiet` is `true`, skip directly to rendering the final summary bar (Region 3). Note: `quiet` overrides `verbose` if both are provided.
   - Otherwise, render Region 1 (header), then group results by category and render each as a Region 2 category block, then render Region 3 (final summary bar).

5. **Implement Region 1 (Header)**:
   - Line 1: `{bold-white}Orchestration Validator v1.0.0{reset}`
   - Line 2: `═` repeated to match header text width (in color mode) or `=` repeated (in no-color mode).

6. **Implement Region 2 (Category Blocks)** — for each unique category in order of appearance:
   - **Category header**: `{dim}{topLeft}{horizontal} {bold-cyan}{CategoryName}{reset}{dim} {horizontal repeated to fill}{reset}`
   - **Check lines**: For each result in this category:
     - `{dim}{vertical}{reset}  {color}{marker}{reset} {name} — {message}`
     - Where `{color}` is `$color-pass`/`$color-fail`/`$color-warn` based on status, and `{marker}` is from the marker map.
   - **Detail blocks**: Render the `detail` sub-block (indented with `{vertical}      ` prefix) when:
     - Status is `fail` (always show detail)
     - `options.verbose` is `true` (show detail for all statuses)
     - Format: `Expected: {detail.expected}` and `Found: {detail.found}`, each on its own line. If `detail.context` exists, add a third line with the context value.
   - **Blank line**: One `{dim}{vertical}{reset}` line before category summary.
   - **Category summary line**: `{dim}{vertical}{reset}  {contextualColor}{CategoryName}: {N} passed, {N} failed, {N} warning(s){reset}`
     - Contextual color: green if 0 failures and 0 warnings, red if any failures, yellow if warnings but no failures.
   - **Category footer**: `{dim}{bottomLeft}{horizontal repeated}{reset}`
   - **Blank line**: One empty line between categories.

7. **Implement Region 3 (Final Summary Bar)**:
   - Line 1: `═` repeated (color) or `=` repeated (no-color) — separator line.
   - Line 2: `  RESULT: {verdict}  {pipe}  {green}{N} passed{reset}  {red}{N} failed{reset}  {yellow}{N} warnings{reset}`
     - `{verdict}`: `{bold-green}PASS{reset}` if 0 failures, `{bold-red}FAIL{reset}` if any failures.
     - `{pipe}`: `│` in color mode, `|` in no-color mode.
   - Line 3: Same `═`/`=` separator line.

8. **Implement `printHelp()`** — prints the exact help text specified below and returns.

9. **Export** `report` and `printHelp` via `module.exports = { report, printHelp }`.

10. **Ensure no throws** — wrap any logic that could error in try/catch; degrade gracefully (e.g., print raw text if formatting fails).

## Contracts & Interfaces

```typescript
// CheckResult — each item in the results array passed to report()
interface CheckResult {
  /** Category grouping: 'structure' | 'agents' | 'skills' | 'config' | 'instructions' | 'prompts' | 'cross-references' */
  category: string;
  /** Human-readable identifier (e.g., 'research.agent.md', 'orchestration.yml — git.strategy') */
  name: string;
  /** Outcome of this check */
  status: 'pass' | 'fail' | 'warn';
  /** One-line description of what was checked or what went wrong */
  message: string;
  /** Optional structured detail for verbose/failure output */
  detail?: CheckDetail;
}

// CheckDetail — structured context attached to a CheckResult
interface CheckDetail {
  /** What the validator expected */
  expected: string;
  /** What was actually found */
  found: string;
  /** Optional additional context */
  context?: string;
}

// ReporterOptions — display mode flags passed to report()
interface ReporterOptions {
  /** Suppress ANSI color codes */
  noColor: boolean;
  /** Show detail blocks for all checks, not just failures */
  verbose: boolean;
  /** Show only the final summary bar (overrides verbose if both true) */
  quiet: boolean;
}

// Exported API
function report(results: CheckResult[], options: ReporterOptions): void;
function printHelp(): void;
module.exports = { report, printHelp };
```

## Styles & Design Tokens

### ANSI Color Token Map

Implement as a plain object. When `noColor` is `true`, every value becomes `''`.

| Token Name | ANSI Code | Rendered As | Usage |
|------------|-----------|-------------|-------|
| `pass` | `\x1b[32m` | Green text | Pass markers (`✓`), pass counts |
| `fail` | `\x1b[31m` | Red text | Fail markers (`✗`), fail counts |
| `warn` | `\x1b[33m` | Yellow text | Warning markers (`⚠`), warning counts |
| `categoryHeader` | `\x1b[1;36m` | Bold cyan | Category name in header line |
| `boldWhite` | `\x1b[1;37m` | Bold white | Tool name in header |
| `boldRed` | `\x1b[1;31m` | Bold red | `FAIL` verdict |
| `boldGreen` | `\x1b[1;32m` | Bold green | `PASS` verdict |
| `dim` | `\x1b[2m` | Dim text | Box-drawing lines, detail lines |
| `reset` | `\x1b[0m` | Reset all | Terminates any active ANSI style |

### Marker Map

| Key | Color Mode Value | No-Color Mode Value |
|-----|-----------------|-------------------|
| `pass` | `✓` | `[PASS]` |
| `fail` | `✗` | `[FAIL]` |
| `warn` | `⚠` | `[WARN]` |

### Separator Map

| Key | Color Mode Value | No-Color Mode Value |
|-----|-----------------|-------------------|
| `double` | `═` (U+2550) | `=` |
| `topLeft` | `┌` (U+250C) | `---` |
| `bottomLeft` | `└` (U+2514) | `---` |
| `vertical` | `│` (U+2502) | ` ` (space) |
| `horizontal` | `─` (U+2500) | `-` |
| `pipe` | `│` (U+2502) | `|` |

### No-Color Category Header/Footer Format

- Color mode header: `┌─ CategoryName ─────────────────────────────────`
- No-color header: `--- CategoryName ---`
- Color mode footer: `└──────────────────────────────────────────────────`
- No-color footer: `---`

### No-Color Check Line Format

- Color mode: `│  ✓ name — message`
- No-color: `  [PASS] name — message`

(No vertical bar prefix in no-color mode — use two leading spaces instead.)

## Output Mockups

### Region 1: Header

**Color mode:**
```
Orchestration Validator v1.0.0
══════════════════════════════════════════════════
```
- Line 1: bold white text, then reset
- Line 2: `═` repeated (suggest 50 characters), dim color

**No-color mode:**
```
Orchestration Validator v1.0.0
==============================================
```
- `=` characters, no ANSI codes

### Region 2: Category Block — Color Mode (default verbosity, with failures)

```
┌─ Agents ─────────────────────────────────────────
│  ✓ orchestrator.agent.md — required frontmatter fields present
│  ✓ orchestrator.agent.md — tools array valid
│  ✗ research.agent.md — missing required field: argument-hint
│      Expected: non-empty string value
│      Found: field absent
│  ⚠ coder.agent.md — description length is 42 chars
│
│  Agents: 14 passed, 2 failed, 1 warning
└──────────────────────────────────────────────────
```

**Rules:**
- Detail blocks (Expected/Found) always shown for `fail` results.
- Detail blocks shown for `warn` and `pass` only in `--verbose` mode.
- Category summary uses contextual color: green (all pass), red (any fail), yellow (warnings only, no fails).

### Region 2: Category Block — No-Color Mode

```
--- Agents ---
  [PASS] orchestrator.agent.md — required frontmatter fields present
  [FAIL] research.agent.md — missing required field: argument-hint
      Expected: non-empty string value
      Found: field absent
  [WARN] coder.agent.md — description length is 42 chars

  Agents: 14 passed, 2 failed, 1 warning
---
```

### Region 2: Verbose Mode (pass checks also show detail)

```
┌─ Agents ─────────────────────────────────────────
│  ✓ orchestrator.agent.md — required frontmatter fields present
│      Checked: name, description, tools, agents
│      File: .github/agents/orchestrator.agent.md
│  ✓ orchestrator.agent.md — tools array valid
│      Tools: read, search, agent
│      File: .github/agents/orchestrator.agent.md
│  ...
```

In verbose mode, `detail.expected` and `detail.found` are printed for every check that has a `detail` object — not just failures.

### Region 3: Final Summary Bar — PASS

**Color mode:**
```
══════════════════════════════════════════════════
  RESULT: PASS  │  25 passed  0 failed  2 warnings
══════════════════════════════════════════════════
```
- `RESULT: PASS` in bold green
- `25 passed` in green, `0 failed` in red, `2 warnings` in yellow
- Pipe separator `│`

**No-color mode:**
```
==============================================
  RESULT: PASS  |  25 passed  0 failed  2 warnings
==============================================
```

### Region 3: Final Summary Bar — FAIL

**Color mode:**
```
══════════════════════════════════════════════════
  RESULT: FAIL  │  22 passed  3 failed  2 warnings
══════════════════════════════════════════════════
```
- `RESULT: FAIL` in bold red

### Quiet Mode

Only the final summary bar is rendered (Region 3). No header, no category blocks.

```
══════════════════════════════════════════════════
  RESULT: FAIL  │  88 passed  3 failed  1 warning
══════════════════════════════════════════════════
```

### Help Output (`printHelp()`)

Print the following text exactly to stdout:

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

## Verbosity Behavior Summary

| Mode | Header | Category Blocks | Detail on Pass/Warn | Detail on Fail | Summary Bar |
|------|--------|----------------|---------------------|----------------|-------------|
| Default | ✓ | ✓ | No | Yes (always) | ✓ |
| `--verbose` | ✓ | ✓ | Yes | Yes | ✓ |
| `--quiet` | No | No | No | No | ✓ (only this) |

**Precedence**: If both `--quiet` and `--verbose` are `true`, treat as quiet (quiet overrides verbose).

## Test Requirements

- [ ] `report([...passResults], { noColor: false, verbose: false, quiet: false })` writes header, category block(s), and summary bar to stdout
- [ ] `report([...mixedResults], { noColor: false, verbose: false, quiet: false })` shows detail blocks for fail results only
- [ ] `report([...results], { noColor: false, verbose: true, quiet: false })` shows detail blocks for all results that have a `detail` property
- [ ] `report([...results], { noColor: false, verbose: false, quiet: true })` outputs only the summary bar (no header, no categories)
- [ ] `report([...results], { noColor: false, verbose: true, quiet: true })` outputs only the summary bar (quiet overrides verbose)
- [ ] `report([...results], { noColor: true, verbose: false, quiet: false })` uses `[PASS]`/`[FAIL]`/`[WARN]` markers, `---` separators, `=` borders, no ANSI codes
- [ ] Summary bar shows `RESULT: PASS` when 0 failures, `RESULT: FAIL` when any failures
- [ ] Category summary line uses green when all pass, red when any fail, yellow when warnings only
- [ ] `printHelp()` prints the exact help text specified above
- [ ] No ANSI escape codes appear in output when `noColor` is `true`

## Acceptance Criteria

- [ ] `lib/reporter.js` exists and exports `{ report, printHelp }`
- [ ] `report` accepts `(CheckResult[], ReporterOptions)` and writes formatted output to stdout
- [ ] Color mode output uses the exact ANSI token values specified (`\x1b[32m`, `\x1b[31m`, etc.)
- [ ] No-color mode output contains zero ANSI escape sequences
- [ ] No-color mode uses `[PASS]`/`[FAIL]`/`[WARN]` markers and ASCII separators
- [ ] Header renders tool name in bold white with double-line separator
- [ ] Category blocks render with box-drawing header/footer, check lines, and category summary
- [ ] Detail blocks render `Expected:`/`Found:` lines, indented under the check line
- [ ] Detail blocks appear always for failures, and only in verbose mode for pass/warn
- [ ] Category summary line uses contextual color (green/red/yellow per worst result)
- [ ] Final summary bar shows double-line borders, verdict, and color-coded counts
- [ ] `RESULT: PASS` (bold green) when 0 failures; `RESULT: FAIL` (bold red) when any failures
- [ ] Quiet mode outputs only the final summary bar
- [ ] Quiet overrides verbose when both are true
- [ ] `printHelp()` outputs the exact help text specified in the mockup
- [ ] CommonJS module format (`module.exports = { report, printHelp }`)
- [ ] Zero external dependencies — uses only `process.stdout.write` or `console.log`
- [ ] Module never throws — degrades gracefully on unexpected input

## Constraints

- Do NOT import or require any external npm packages
- Do NOT read files or access the file system — this module only formats and prints data it receives
- Do NOT use `process.stdout.isTTY` inside the reporter — TTY detection is handled by the CLI entry point, which sets `noColor` accordingly
- Do NOT hardcode a terminal width — separator lines should use a fixed reasonable width (50 characters recommended)
- Do NOT reference any external planning documents (Architecture, Design, PRD, etc.)
- Do NOT add any interactive prompts or user input handling
