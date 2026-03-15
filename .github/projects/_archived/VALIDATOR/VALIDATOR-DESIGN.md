---
project: "VALIDATOR"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-07T14:00:00Z"
---

# VALIDATOR — Design

## Design Overview

VALIDATOR is a terminal-only CLI tool — there is no graphical interface. The "user experience" is the terminal output: how validation results are structured, formatted, colored, and summarized so that a developer can instantly assess orchestration health and locate problems. The design defines the CLI interface (flags, help text), output layout (header → categories → summary), ANSI color tokens, information hierarchy across verbosity levels, and accessibility for non-color environments.

## User Flows

### Flow 1: Standard Validation Run (US-1, US-8)

```
Developer runs `node validate-orchestration.js`
  → Tool prints header (name + version)
  → Tool scans .github/ directory
  → For each category: print category header → print per-check results (icon + text)
  → Print category summary (pass/fail/warn counts)
  → After all categories: print final summary bar
  → Exit with code 0 (all pass) or 1 (any fail)
```

The developer scans the final summary bar first. If all green, they move on. If failures exist, they scroll up to the failing category and read the detail lines.

### Flow 2: Filtered Category Run (US-2, US-3, US-4)

```
Developer runs `node validate-orchestration.js --category agents`
  → Tool prints header
  → Tool runs ONLY the "Agents" category checks
  → Prints results for that single category
  → Prints summary (scoped to filtered category)
  → Exit code reflects only the filtered results
```

Used when the developer knows they only changed agent files and wants fast, focused feedback.

### Flow 3: CI Pipeline Run (US-6, US-7)

```
CI step runs `node validate-orchestration.js --no-color`
  → Tool detects --no-color flag (or non-TTY stdout)
  → All ANSI escape codes suppressed
  → Output uses plain-text markers: [PASS], [FAIL], [WARN]
  → Exit code 0 or 1 drives CI pass/fail gate
```

CI logs are readable without ANSI rendering. Exit code is the machine-readable signal.

### Flow 4: Verbose Debugging Run (US-5)

```
Developer runs `node validate-orchestration.js --verbose`
  → Standard output PLUS additional context on every check:
    - File path being checked
    - Expected value vs. actual value
    - Cross-reference resolution details
  → Helps diagnose why a specific check failed
```

### Flow 5: Quiet Summary Run

```
Developer runs `node validate-orchestration.js --quiet`
  → Only the final summary bar is printed (no per-check detail)
  → Exit code still reflects pass/fail
  → Used for scripted checks where only the exit code matters but a one-line summary is helpful
```

### Flow 6: Help Request

```
Developer runs `node validate-orchestration.js --help`
  → Tool prints usage synopsis, available flags, and category names
  → Exits with code 0
```

## Layout & Components

### CLI Interface

**Command**: `node validate-orchestration.js [options]`

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--help` | `-h` | boolean | `false` | Show usage information and exit |
| `--no-color` | — | boolean | `false` | Suppress ANSI color codes in output |
| `--verbose` | `-v` | boolean | `false` | Show additional detail for every check |
| `--quiet` | `-q` | boolean | `false` | Show only the final summary line |
| `--category <name>` | `-c` | string | (all) | Run only the named category |

**Valid category names**: `structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-references`

**Flag precedence**: `--quiet` overrides `--verbose` if both are provided. `--no-color` is independent of verbosity.

**Environment variables**:
- `NO_COLOR=1` — equivalent to `--no-color` flag (per https://no-color.org convention)

### Output Layout — Full Run (Default Mode)

The output is a vertical stream of text organized into regions:

```
┌─────────────────────────────────────────────────────┐
│  REGION 1: Header                                   │
│  ─ Tool name, version                               │
├─────────────────────────────────────────────────────┤
│  REGION 2: Category Block (repeated per category)   │
│  ─ Category header line                             │
│  ─ Check result lines (one per check)               │
│  ─ Category summary line                            │
│  ─ Blank line separator                             │
├─────────────────────────────────────────────────────┤
│  REGION 3: Final Summary Bar                        │
│  ─ Total pass/fail/warn counts                      │
│  ─ Overall verdict                                  │
└─────────────────────────────────────────────────────┘
```

### Region 1: Header

```
Orchestration Validator v1.0.0
══════════════════════════════
```

- Line 1: Tool name and version in **bold white**
- Line 2: Double-line separator using `═` (U+2550), same width as header text

### Region 2: Category Block

Each category follows this structure:

```
┌─ Agents ─────────────────────────────────
│  ✓ orchestrator.agent.md — required frontmatter fields present
│  ✓ orchestrator.agent.md — tools array contains valid entries
│  ✗ research.agent.md — missing required field: argument-hint
│      Expected: non-empty string
│      Found: (field absent)
│  ⚠ coder.agent.md — description length 42 chars (recommended: 50–300)
│
│  Agents: 6 passed, 1 failed, 1 warning
└──────────────────────────────────────────
```

**Category header line**: Box-drawing top-left corner `┌─`, category name in **bold cyan**, padded dash line to fill width.

**Check result lines**:
- `│  ✓` (green) for pass
- `│  ✗` (red) for fail
- `│  ⚠` (yellow) for warning
- Followed by: filename or identifier, em dash `—`, check description

**Verbose detail lines** (only with `--verbose`, or always shown for failures):
- Indented under the check line with `│      ` prefix
- `Expected: {what should be}` line
- `Found: {what was actually found}` line
- Additional context where relevant (e.g., valid values list)

**Category summary line**: `│  {Category}: {N} passed, {N} failed, {N} warning(s)` in the category's contextual color (green if all pass, red if any fail, yellow if only warnings).

**Category footer**: Box-drawing bottom-left `└` with dash line.

**Blank line**: One empty line separates categories.

### Region 3: Final Summary Bar

```
══════════════════════════════════════════
  RESULT: PASS  │  25 passed  0 failed  2 warnings
══════════════════════════════════════════
```

Or on failure:

```
══════════════════════════════════════════
  RESULT: FAIL  │  22 passed  3 failed  2 warnings
══════════════════════════════════════════
```

- Double-line border top and bottom using `═`
- `RESULT: PASS` in **bold green** or `RESULT: FAIL` in **bold red**
- Pipe separator `│`
- Individual counts: passed (green), failed (red), warnings (yellow)

### New Components

Since VALIDATOR is a CLI tool, "components" are output formatting functions — not UI components. These are the logical output units the Architect and Coder will implement:

| Component | Props / Inputs | Design Tokens | Description |
|-----------|---------------|--------------|-------------|
| `Header` | `toolName: string`, `version: string` | `$color-bold-white`, `$separator-double` | Prints the tool name/version header block |
| `CategoryBlock` | `name: string`, `checks: CheckResult[]` | `$color-category-header`, `$color-pass`, `$color-fail`, `$color-warn` | Prints a full category section with header, check lines, and category summary |
| `CheckLine` | `status: pass\|fail\|warn`, `file: string`, `message: string`, `detail?: {expected, found}` | `$color-pass`, `$color-fail`, `$color-warn` | Prints a single check result line |
| `DetailBlock` | `expected: string`, `found: string`, `context?: string` | `$color-dim` | Prints indented expected/found detail lines (verbose mode, or always on failure) |
| `CategorySummary` | `name: string`, `passed: int`, `failed: int`, `warnings: int` | Contextual color based on worst result | Prints the per-category summary counts |
| `FinalSummary` | `passed: int`, `failed: int`, `warnings: int` | `$color-pass`, `$color-fail`, `$color-warn`, `$color-bold-white`, `$separator-double` | Prints the final summary bar with verdict |
| `HelpText` | (none) | `$color-bold-white` | Prints the `--help` usage message |

## Design Tokens Used

All design tokens are ANSI SGR escape sequences. The `$reset` token terminates any active styling.

| Token | ANSI Code | Rendered As | Usage |
|-------|-----------|-------------|-------|
| `$color-pass` | `\x1b[32m` | Green text | Pass check markers (`✓`), pass counts |
| `$color-fail` | `\x1b[31m` | Red text | Fail check markers (`✗`), fail counts, FAIL verdict |
| `$color-warn` | `\x1b[33m` | Yellow text | Warning markers (`⚠`), warning counts |
| `$color-category-header` | `\x1b[1;36m` | Bold cyan text | Category name in category header line |
| `$color-bold-white` | `\x1b[1;37m` | Bold white text | Tool name in header, PASS verdict |
| `$color-bold-red` | `\x1b[1;31m` | Bold red text | FAIL verdict |
| `$color-bold-green` | `\x1b[1;32m` | Bold green text | PASS verdict |
| `$color-dim` | `\x1b[2m` | Dim text | Detail lines (expected/found), box-drawing lines |
| `$reset` | `\x1b[0m` | Reset all | Terminates any active ANSI style |

### Plain-Text Fallback Tokens (--no-color mode)

When `--no-color` is active or stdout is not a TTY, all ANSI tokens resolve to empty strings. Visual markers change:

| Color Mode Marker | No-Color Mode Marker | Meaning |
|-------------------|---------------------|---------|
| `✓` (green) | `[PASS]` | Check passed |
| `✗` (red) | `[FAIL]` | Check failed |
| `⚠` (yellow) | `[WARN]` | Warning |
| Bold cyan header | `--- Agents ---` | Category header |
| `═══` lines | `===` lines | Section separators |

### Separator Characters

| Token | Character | Unicode | Usage |
|-------|-----------|---------|-------|
| `$separator-double` | `═` | U+2550 | Header and final summary borders |
| `$box-top-left` | `┌` | U+250C | Category block top-left corner |
| `$box-bottom-left` | `└` | U+2514 | Category block bottom-left corner |
| `$box-vertical` | `│` | U+2502 | Category block left margin, summary pipe separator |
| `$box-horizontal` | `─` | U+2500 | Category header/footer fill |

### No-Color Separator Fallback

When `--no-color` is active, box-drawing characters degrade to ASCII:

| Color Mode | No-Color Mode |
|-----------|--------------|
| `┌─ Agents ─────` | `--- Agents ---` |
| `│  ✓ ...` | `  [PASS] ...` |
| `└─────` | `---` |
| `═══` | `===` |

## States & Interactions

Since VALIDATOR is a non-interactive CLI tool (it runs once and exits), "states" refer to the tool's output modes and the visual treatment of each check result status.

| Component | State | Visual Treatment |
|-----------|-------|-----------------|
| `CheckLine` | Pass | Green `✓` prefix, normal-weight text, single line |
| `CheckLine` | Fail | Red `✗` prefix, normal-weight text, single line. Detail block always shown below (expected/found) |
| `CheckLine` | Warning | Yellow `⚠` prefix, normal-weight text, single line. Detail block shown only in `--verbose` mode |
| `CategoryBlock` | All Pass | Category summary line in green |
| `CategoryBlock` | Has Failures | Category summary line in red |
| `CategoryBlock` | Warnings Only | Category summary line in yellow |
| `FinalSummary` | All Pass | `RESULT: PASS` in bold green, green border context |
| `FinalSummary` | Has Failures | `RESULT: FAIL` in bold red |
| `Header` | Always | Bold white tool name, dim double-line separator |
| `DetailBlock` | Failure context | Dim text, indented, shows Expected/Found values |
| `DetailBlock` | Verbose context | Same as failure context but also shown for pass/warn checks |
| Tool (overall) | `--quiet` mode | Only `FinalSummary` is printed — no categories, no check lines |
| Tool (overall) | `--verbose` mode | All checks show `DetailBlock` (not just failures) |
| Tool (overall) | Default mode | Pass/warn checks show single line; fail checks show line + detail |

### Exit Code States

| Condition | Exit Code | Summary Verdict |
|-----------|-----------|----------------|
| All checks pass (0 failures, 0+ warnings) | `0` | `RESULT: PASS` |
| Any check fails (1+ failures) | `1` | `RESULT: FAIL` |
| `--help` flag provided | `0` | (no summary — help text only) |

## Accessibility

Since VALIDATOR is a terminal tool, accessibility focuses on supporting non-visual terminal access (screen readers), non-ANSI terminals, and color-blind users.

| Requirement | Implementation |
|-------------|---------------|
| **No reliance on color alone** | Every status is conveyed by text marker (`✓`/`✗`/`⚠` in color mode; `[PASS]`/`[FAIL]`/`[WARN]` in no-color mode) — meaning is clear without color |
| **`--no-color` flag** | Suppresses all ANSI escape codes; uses ASCII-only markers and separators. Critical for screen readers that read raw escape codes aloud |
| **`NO_COLOR` environment variable** | Respects the `NO_COLOR` convention (any non-empty value). Equivalent to `--no-color` flag |
| **Non-TTY auto-detection** | When stdout is not a TTY (piped or redirected), automatically suppress ANSI codes as if `--no-color` were passed |
| **Meaningful text without decoration** | All output is understandable as plain text — category names, check descriptions, expected/found values are human-readable words, not symbols |
| **Consistent output structure** | Category blocks and check lines follow a rigid, predictable structure so screen reader users can navigate by pattern |
| **Error context is textual** | Failure details use labeled lines (`Expected:`, `Found:`) not positional/columnar formatting that screen readers may scramble |
| **No interactive prompts** | The tool never waits for user input — runs to completion and exits. Compatible with all automation and assistive tooling |
| **Exit code as machine signal** | The exit code (0/1) provides an unambiguous pass/fail signal independent of any output formatting |

## Responsive Behavior

Terminal "responsiveness" means adapting to different terminal widths. VALIDATOR targets a minimum width of 60 columns and a standard width of 80 columns.

| Terminal Width | Layout Behavior |
|---------------|----------------|
| ≥ 80 columns (standard) | Full layout as designed — box-drawing characters, padded category headers, separator lines extend to 50 characters |
| 60–79 columns | Same structure, shorter separator lines. Category header fill adapts to width. No content truncation |
| < 60 columns | No special adaptation — output may wrap. This is acceptable for a developer tool; no content is lost, just visual alignment |

**Line wrapping strategy**: Check result lines are not artificially truncated. If a check description + file path exceeds the terminal width, the terminal's native line wrapping applies. This is acceptable because:
1. Most check descriptions are short (< 60 chars including the file name)
2. Truncation would hide information that developers need
3. Verbose detail lines (Expected/Found) may be long but are always on their own line

## Example Output Mockups

### Default Mode — All Passing

```
Orchestration Validator v1.0.0
══════════════════════════════════════════════════

┌─ File Structure ─────────────────────────────────
│  ✓ .github/ directory exists
│  ✓ .github/agents/ directory exists
│  ✓ .github/skills/ directory exists
│  ✓ .github/instructions/ directory exists
│  ✓ .github/prompts/ directory exists
│  ✓ .github/orchestration.yml exists
│  ✓ .github/copilot-instructions.md exists
│
│  File Structure: 7 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Agents ─────────────────────────────────────────
│  ✓ orchestrator.agent.md — required frontmatter fields present
│  ✓ orchestrator.agent.md — tools array valid
│  ✓ orchestrator.agent.md — agents array matches known subagents
│  ✓ research.agent.md — required frontmatter fields present
│  ✓ research.agent.md — tools array valid
│  ...
│
│  Agents: 18 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Skills ─────────────────────────────────────────
│  ✓ create-prd/ — SKILL.md exists
│  ✓ create-prd/ — name matches folder
│  ✓ create-prd/ — templates/ directory exists
│  ...
│
│  Skills: 35 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Configuration ──────────────────────────────────
│  ✓ orchestration.yml — version is "1.0"
│  ✓ orchestration.yml — projects.naming is valid enum
│  ✓ orchestration.yml — all limits are positive integers
│  ✓ orchestration.yml — git.strategy is valid enum
│  ✓ orchestration.yml — human_gates.after_planning is true
│  ✓ orchestration.yml — human_gates.after_final_review is true
│  ✓ orchestration.yml — no severity overlap between critical and minor
│  ...
│
│  Configuration: 12 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Instructions ───────────────────────────────────
│  ✓ project-docs.instructions.md — frontmatter present
│  ✓ project-docs.instructions.md — applyTo field present
│  ✓ state-management.instructions.md — frontmatter present
│  ✓ state-management.instructions.md — applyTo field present
│
│  Instructions: 4 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Prompts ────────────────────────────────────────
│  ✓ configure-system.prompt.md — description field present
│  ✓ configure-system.prompt.md — tools array valid
│
│  Prompts: 2 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Cross-References ───────────────────────────────
│  ✓ orchestrator.agent.md — all agents[] entries match real agent files
│  ✓ research.agent.md — skill references resolve to existing skills
│  ✓ create-prd/SKILL.md — template links resolve to files on disk
│  ...
│
│  Cross-References: 15 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

══════════════════════════════════════════════════
  RESULT: PASS  │  93 passed  0 failed  0 warnings
══════════════════════════════════════════════════
```

### Default Mode — With Failures and Warnings

```
Orchestration Validator v1.0.0
══════════════════════════════════════════════════

┌─ File Structure ─────────────────────────────────
│  ✓ .github/ directory exists
│  ✓ .github/agents/ directory exists
│  ✓ .github/skills/ directory exists
│  ✓ .github/instructions/ directory exists
│  ✓ .github/prompts/ directory exists
│  ✓ .github/orchestration.yml exists
│  ✓ .github/copilot-instructions.md exists
│
│  File Structure: 7 passed, 0 failed, 0 warnings
└──────────────────────────────────────────────────

┌─ Agents ─────────────────────────────────────────
│  ✓ orchestrator.agent.md — required frontmatter fields present
│  ✓ orchestrator.agent.md — tools array valid
│  ✗ research.agent.md — missing required field: argument-hint
│      Expected: non-empty string value
│      Found: field absent
│  ✗ research.agent.md — deprecated tool name detected
│      Expected: toolset name (e.g., "web") or namespaced tool (e.g., "web/fetch")
│      Found: "fetchWebpage" — deprecated, use "web/fetch" instead
│  ⚠ coder.agent.md — description length is 42 chars
│      Recommended: 50–300 characters for optimal Copilot discovery
│
│  Agents: 14 passed, 2 failed, 1 warning
└──────────────────────────────────────────────────

┌─ Configuration ──────────────────────────────────
│  ✓ orchestration.yml — version is "1.0"
│  ✗ orchestration.yml — invalid enum value for git.strategy
│      Expected: one of [single_branch, branch_per_phase, branch_per_task]
│      Found: "feature_branch"
│  ✓ orchestration.yml — all limits are positive integers
│  ...
│
│  Configuration: 10 passed, 1 failed, 0 warnings
└──────────────────────────────────────────────────

...

══════════════════════════════════════════════════
  RESULT: FAIL  │  88 passed  3 failed  1 warning
══════════════════════════════════════════════════
```

### Verbose Mode (--verbose)

Same as default but pass/warn checks also show detail:

```
┌─ Agents ─────────────────────────────────────────
│  ✓ orchestrator.agent.md — required frontmatter fields present
│      Checked: name, description, tools, agents
│      File: .github/agents/orchestrator.agent.md
│  ✓ orchestrator.agent.md — tools array valid
│      Tools: read, search, agent
│      File: .github/agents/orchestrator.agent.md
│  ✓ orchestrator.agent.md — agents array matches known subagents
│      Agents: Research, Product Manager, UX Designer, Architect, Tactical Planner, Coder, Reviewer
│      File: .github/agents/orchestrator.agent.md
│  ...
```

### Quiet Mode (--quiet)

```
══════════════════════════════════════════════════
  RESULT: FAIL  │  88 passed  3 failed  1 warning
══════════════════════════════════════════════════
```

Only the final summary bar is printed. No categories, no check lines.

### No-Color Mode (--no-color)

```
Orchestration Validator v1.0.0
==============================================

--- File Structure ---
  [PASS] .github/ directory exists
  [PASS] .github/agents/ directory exists
  [PASS] .github/skills/ directory exists
  [PASS] .github/instructions/ directory exists
  [PASS] .github/prompts/ directory exists
  [PASS] .github/orchestration.yml exists
  [PASS] .github/copilot-instructions.md exists

  File Structure: 7 passed, 0 failed, 0 warnings
---

--- Agents ---
  [PASS] orchestrator.agent.md — required frontmatter fields present
  [FAIL] research.agent.md — missing required field: argument-hint
      Expected: non-empty string value
      Found: field absent
  [WARN] coder.agent.md — description length is 42 chars
      Recommended: 50–300 characters for optimal Copilot discovery

  Agents: 14 passed, 2 failed, 1 warning
---

...

==============================================
  RESULT: FAIL  |  88 passed  3 failed  1 warning
==============================================
```

Box-drawing characters replaced with ASCII. Unicode markers replaced with bracketed text labels. Pipe separator `│` replaced with ASCII `|`.

### Help Output (--help)

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

## Information Architecture

### Category Ordering

Categories are printed in dependency order — structural checks first, cross-references last:

| Order | Category | Rationale |
|-------|----------|-----------|
| 1 | File Structure | Must confirm files exist before checking their content |
| 2 | Agents | Core orchestration files; most frequently edited |
| 3 | Skills | Second most common edit target |
| 4 | Configuration | Single file but high-impact; depends on nothing else |
| 5 | Instructions | Small set, low change frequency |
| 6 | Prompts | Small set, new validation area |
| 7 | Cross-References | Depends on all prior categories having loaded their inventories |

### Check Ordering Within Categories

Within each category, checks are ordered:

1. **Existence checks** first (does the file/directory exist?)
2. **Structural checks** next (does frontmatter parse? are required sections present?)
3. **Value checks** last (are field values valid? enums correct? constraints met?)

This ordering means early failures explain later failures — if a file doesn't exist, the developer understands why its frontmatter check also failed.

### Verbosity Levels

| Level | What Is Shown | Use Case |
|-------|--------------|----------|
| `--quiet` | Final summary bar only | Quick pass/fail check in scripts |
| Default | All check lines (single line each) + detail blocks on failures only | Standard developer workflow |
| `--verbose` | All check lines + detail blocks on every check (pass, fail, warn) | Debugging unexpected results; understanding what the validator checked |

### Error Message Format

Every failure check line follows this pattern:

```
✗ {identifier} — {what is wrong}
    Expected: {what the validator wanted to see}
    Found: {what was actually found, or "(field absent)", or "(file missing)"}
```

Every warning check line follows:

```
⚠ {identifier} — {what is suboptimal}
    {Context line explaining the recommendation}
```

The `{identifier}` is the most specific relevant name: a filename for file-level checks (e.g., `research.agent.md`), a section path for config checks (e.g., `orchestration.yml — git.strategy`), or a cross-reference path for link checks (e.g., `create-prd/SKILL.md → ./templates/PRD.md`).

## Design System Additions

VALIDATOR introduces no visual design system (it is a CLI tool). The ANSI color tokens defined above are the equivalent of a "design system" for terminal output. They are implemented as a simple token map object in code — when `--no-color` is active, every token maps to an empty string.

| Type | Name | Value | Rationale |
|------|------|-------|-----------|
| Token Map | `colors` | Object mapping token names → ANSI codes | Centralizes all color logic; swap to empty strings for no-color mode |
| Marker Map | `markers` | Object mapping `pass`/`fail`/`warn` → display string | `✓`/`✗`/`⚠` in color mode; `[PASS]`/`[FAIL]`/`[WARN]` in no-color mode |
| Separator Map | `separators` | Object mapping separator names → characters | Box-drawing in color mode; ASCII dashes/equals in no-color mode |
