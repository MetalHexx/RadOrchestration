---
project: "VALIDATOR"
phase: 1
title: "Core Infrastructure"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-07T19:00:00Z"
---

# Phase 1: Core Infrastructure

## Phase Goal

Establish the complete foundation for the VALIDATOR tool — CLI entry point, all utility modules, the reporter, the discovery context, and one check module (File Structure) — so that running `node validate-orchestration.js` produces a fully formatted, colored report with correct exit codes and all verbosity/color flags working end-to-end.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../VALIDATOR-MASTER-PLAN.md) | Phase 1 scope, exit criteria, execution constraints (max 8 tasks, max 2 retries) |
| [Architecture](../VALIDATOR-ARCHITECTURE.md) | Module map, contracts & interfaces (CheckResult, CheckDetail, DiscoveryContext, ReporterOptions, CLIOptions), file structure, utility contracts (fs-helpers, frontmatter, yaml-parser), internal dependency graph, cross-cutting concerns (error handling, path handling, color/no-color, verbosity) |
| [Design](../VALIDATOR-DESIGN.md) | CLI interface flags/aliases, output layout regions, ANSI color tokens, marker maps, separator maps, no-color fallback tokens, category block structure, final summary bar format, help output mockup, verbosity level behavior, exit code states |

## Task Outline

| # | Task | Dependencies | Est. Files | Handoff Doc |
|---|------|-------------|-----------|-------------|
| T1 | File System Helpers | — | 1 | [Link](../tasks/VALIDATOR-TASK-P01-T01-FS-HELPERS.md) |
| T2 | Frontmatter Extractor | — | 1 | [Link](../tasks/VALIDATOR-TASK-P01-T02-FRONTMATTER.md) |
| T3 | YAML Parser | — | 1 | [Link](../tasks/VALIDATOR-TASK-P01-T03-YAML-PARSER.md) |
| T4 | Reporter Module | — | 1 | [Link](../tasks/VALIDATOR-TASK-P01-T04-REPORTER.md) |
| T5 | File Structure Checks | T1 | 1 | [Link](../tasks/VALIDATOR-TASK-P01-T05-STRUCTURE-CHECK.md) |
| T6 | CLI Entry Point & Integration | T1, T4, T5 | 1 | [Link](../tasks/VALIDATOR-TASK-P01-T06-CLI-ENTRY.md) |

## Task Details

### T1: File System Helpers

**File**: `lib/utils/fs-helpers.js` (CREATE)

**Objective**: Implement the foundational file system utility module that all check modules depend on. Provides safe, never-throwing wrappers around Node.js `fs` and `path` built-ins.

**Key deliverables**:
- `exists(filePath)` — returns boolean, never throws
- `isDirectory(dirPath)` — returns boolean, never throws
- `listFiles(dirPath, suffix?)` — returns filename array (not full paths), empty array on error
- `listDirs(dirPath)` — returns directory name array, empty array on error
- `readFile(filePath)` — returns UTF-8 string or null on failure, never throws

**Acceptance criteria**:
- All 5 functions exported via `module.exports`
- CommonJS format (`require`/`module.exports`)
- Uses only `fs` and `path` built-in modules
- No function ever throws — all return safe defaults on error
- `listFiles` filters by suffix when provided, returns all files when suffix is empty/omitted
- `listDirs` returns only directory entries, not files

---

### T2: Frontmatter Extractor

**File**: `lib/utils/frontmatter.js` (CREATE)

**Objective**: Implement frontmatter extraction from markdown files, supporting both standard `---` delimited blocks and fenced code block formats used by agent/skill files.

**Key deliverables**:
- `extractFrontmatter(fileContent)` — parses frontmatter from raw markdown string
- Handles standard format: content between opening `---` and closing `---` at file start
- Handles fenced format: content inside ` ```chatagent ` or ` ```instructions ` code blocks with `---` delimiters
- Returns `{ frontmatter: Record<string, any> | null, body: string }`
- Parses simple key-value pairs (scalars, simple lists using `- item` on subsequent lines)

**Acceptance criteria**:
- Exported `extractFrontmatter` function via `module.exports`
- Correctly extracts standard `---` delimited frontmatter
- Correctly extracts fenced code block frontmatter
- Returns `{ frontmatter: null, body: fullContent }` when no frontmatter found
- Handles quoted string values (single and double quotes)
- Handles list values (YAML `- item` syntax)
- Never throws — returns null frontmatter on parse failure

---

### T3: YAML Parser

**File**: `lib/utils/yaml-parser.js` (CREATE)

**Objective**: Implement a lightweight YAML parser for `orchestration.yml` that handles the exact YAML subset used by the orchestration system — scalars, lists, nested objects, and quoted strings — without external dependencies.

**Key deliverables**:
- `parseYaml(yamlString)` — parses a YAML string into a nested plain object
- Supports: scalar values, single/double-quoted strings, arrays (`- item`), nested objects (indentation-aware), inline booleans (`true`/`false`), integers
- Does NOT need to support: anchors, aliases, multi-document, flow style, multiline scalars

**Acceptance criteria**:
- Exported `parseYaml` function via `module.exports`
- Correctly parses `orchestration.yml` from this workspace into a nested object
- Handles 2-space and 4-space indentation levels
- Handles quoted strings (preserves content, strips quotes)
- Handles boolean values (`true`/`false` → JavaScript booleans)
- Handles integer values (e.g., `10` → JavaScript number)
- Returns `null` if parsing fails entirely — never throws
- No external dependencies

---

### T4: Reporter Module

**File**: `lib/reporter.js` (CREATE)

**Objective**: Implement the complete output rendering module that owns all ANSI escape sequences, marker strings, box-drawing characters, and verbosity behavior. No other module should write to stdout or embed ANSI codes.

**Key deliverables**:
- `report(results, options)` — renders CheckResult[] to stdout per ReporterOptions
- `printHelp()` — prints the --help usage text to stdout
- ANSI color token map: `$color-pass` (`\x1b[32m`), `$color-fail` (`\x1b[31m`), `$color-warn` (`\x1b[33m`), `$color-category-header` (`\x1b[1;36m`), `$color-bold-white` (`\x1b[1;37m`), `$color-bold-red` (`\x1b[1;31m`), `$color-bold-green` (`\x1b[1;32m`), `$color-dim` (`\x1b[2m`), `$reset` (`\x1b[0m`)
- Marker map: color mode `✓`/`✗`/`⚠`, no-color mode `[PASS]`/`[FAIL]`/`[WARN]`
- Separator map: color mode `═`/`┌`/`└`/`│`/`─`, no-color mode `=`/`---`/`---`/` `/`-`
- Region 1: Header — bold white tool name + version, double-line separator
- Region 2: Category blocks — header with box-drawing, check lines with markers, detail blocks (always on fail; verbose-only on pass/warn), category summary line, footer
- Region 3: Final summary bar — double-line borders, PASS (bold green) or FAIL (bold red) verdict, color-coded counts
- Quiet mode: only final summary bar
- No-color mode: all tokens → empty strings, ASCII markers and separators
- Help output: matches Design specification mockup exactly

**Acceptance criteria**:
- `report` and `printHelp` exported via `module.exports`
- Color mode output matches Design mockup structure (header, category blocks, summary bar)
- No-color mode uses `[PASS]`/`[FAIL]`/`[WARN]` markers and ASCII separators
- Quiet mode outputs only the final summary bar
- Verbose mode shows detail blocks for all checks (not just failures)
- Default mode shows detail blocks only for failures
- Category summary line uses contextual color (green if all pass, red if any fail, yellow if warnings only)
- Final summary verdict: `RESULT: PASS` (bold green) when 0 failures, `RESULT: FAIL` (bold red) when any failures
- Help text matches Design `--help` output mockup

---

### T5: File Structure Checks

**File**: `lib/checks/structure.js` (CREATE)

**Objective**: Implement the first check module — File Structure — which verifies that the required `.github/` directories and files exist. This validates the end-to-end check module contract (async function receiving basePath and context, returning CheckResult[]).

**Key deliverables**:
- Default export: `async function checkStructure(basePath, context)` → `CheckResult[]`
- Checks for existence of:
  - `.github/` directory
  - `.github/agents/` directory
  - `.github/skills/` directory
  - `.github/instructions/` directory
  - `.github/prompts/` directory
  - `.github/orchestration.yml` file
  - `.github/copilot-instructions.md` file
- Each check produces a CheckResult with category `'structure'`, appropriate name, status, message, and detail
- Uses `fs-helpers` functions (exists, isDirectory) — no direct `fs` imports

**Acceptance criteria**:
- Exports an async function matching the check module contract signature
- Returns a CheckResult for each required directory/file (7 checks minimum)
- Pass results have status `'pass'` and descriptive message
- Fail results have status `'fail'`, descriptive message, and a `detail` object with `expected` and `found` fields
- All results have `category: 'structure'`
- Uses `require('../utils/fs-helpers')` — no direct `fs` module usage
- Function never throws — wraps logic in try/catch, returns fail result on error

---

### T6: CLI Entry Point & Integration

**File**: `validate-orchestration.js` (CREATE — replaces existing monolithic file)

**Objective**: Implement the CLI entry point that ties everything together — argument parsing, DiscoveryContext creation, check orchestration loop, reporter invocation, and exit code logic. This task validates the full end-to-end pipeline.

**Key deliverables**:
- CLI argument parsing from `process.argv`: `--help`/`-h`, `--no-color`, `--verbose`/`-v`, `--quiet`/`-q`, `--category`/`-c <name>`
- `--quiet` overrides `--verbose` if both provided
- `--no-color` also activates when `process.env.NO_COLOR` is set or `process.stdout.isTTY` is falsy
- `--help` prints help via `reporter.printHelp()` and exits with code 0
- DiscoveryContext initialization: `{ agents: new Map(), skills: new Map(), config: null, instructions: [], prompts: [] }`
- Check orchestration loop: run registered check modules in category order, collect all CheckResult[] arrays
- Phase 1 wires only `structure` check — other slots are placeholders (`null` or commented stubs) for Phase 2
- Category filter: if `--category` is provided, filter results before reporting (Phase 1 supports `structure` only)
- Invoke `reporter.report(results, options)` with collected results
- Exit code: 0 if no failures, 1 if any failures
- Top-level try/catch for unexpected errors — print error and exit with code 1

**Acceptance criteria**:
- Running `node validate-orchestration.js` produces a colored report with File Structure category
- `--no-color` produces plain-text output with `[PASS]`/`[FAIL]`/`[WARN]` markers
- `--verbose` shows detail blocks for all check results
- `--quiet` shows only the final summary bar
- `--help` prints usage information and exits with code 0
- Exit code is 0 when all structure checks pass, 1 when any fail
- DiscoveryContext object is created and passed to check modules
- Check modules execute in defined category order
- Top-level error handler catches unexpected errors gracefully
- `--quiet` overrides `--verbose` when both are provided
- `NO_COLOR` environment variable suppresses color output
- Non-TTY stdout suppresses color output

## Execution Order

```
T1 (File System Helpers)
 ├→ T5 (File Structure Checks — depends on T1)
 │   └→ T6 (CLI Entry Point — depends on T1, T4, T5)
 │
T2 (Frontmatter Extractor)  ← parallel-ready with T1, T3, T4
T3 (YAML Parser)             ← parallel-ready with T1, T2, T4
T4 (Reporter Module)
 └→ T6 (CLI Entry Point — depends on T1, T4, T5)
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6

*Note: T1, T2, T3, and T4 are parallel-ready (no mutual dependencies). T2 and T3 are standalone utility modules not wired into the Phase 1 pipeline but are in-scope for Phase 1 to establish the foundation for Phase 2. T5 depends on T1. T6 depends on T1, T4, and T5.*

## Phase Exit Criteria

- [ ] Running `node validate-orchestration.js` produces a colored report with File Structure category checks
- [ ] `--no-color` flag produces plain-text output with `[PASS]`/`[FAIL]`/`[WARN]` markers and ASCII separators
- [ ] `--verbose` flag shows detail blocks for all check results
- [ ] `--quiet` flag shows only the final summary bar
- [ ] `--help` flag prints usage information and exits with code 0
- [ ] Exit code is 0 when all structure checks pass, 1 when any fail
- [ ] Reporter renders header, category block, and final summary bar correctly in all modes
- [ ] All 6 tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Custom YAML parser complexity** (Risk #1 from Master Plan): The YAML parser (T3) must handle nested objects and indentation correctly for `orchestration.yml`. Mitigation: define the exact subset to support; return `null` on failure rather than crash. Full validation of parser output happens in Phase 2 when the config check module wires it in.
- **Reporter output matching Design mockups**: The reporter (T4) is the most complex module in Phase 1 — it must produce output matching multiple mockup formats across 4 modes (default, verbose, quiet, no-color). Mitigation: implement one mode at a time; test against the Design mockup examples.
- **Integration wiring in T6**: The entry point must correctly wire argument parsing → context creation → check dispatch → reporter → exit code. If earlier tasks have contract mismatches, T6 will surface them. Mitigation: all contracts are defined in the Architecture with TypeScript-like signatures.
