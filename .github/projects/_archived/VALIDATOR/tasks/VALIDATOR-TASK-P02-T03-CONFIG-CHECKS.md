---
project: "VALIDATOR"
phase: 2
task: 3
title: "Config Checks"
status: "pending"
skills_required: ["generate-task-report"]
skills_optional: ["run-tests"]
estimated_files: 2
---

# Config Checks

## Objective

Create `lib/checks/config.js` — the config validation check module that reads `.github/orchestration.yml`, parses it with the YAML parser, validates all required sections and fields, enforces enum constraints and type rules, checks severity list overlap, enforces human gate hard gates, and populates `context.config` with the parsed configuration object. Create `tests/config.test.js` with comprehensive test coverage.

## Context

This is Phase 2, Task 3 of the VALIDATOR project. The project is a zero-dependency Node.js CLI validator for `.github/` orchestration files. Phase 1 built core infrastructure: `fs-helpers.js` (file discovery), `frontmatter.js`, `yaml-parser.js` (YAML parsing), `reporter.js`, `structure.js`, and the CLI entry point. Tasks 1 and 2 of this phase created `agents.js` and `skills.js` — follow their patterns for consistency. This module uses `yaml-parser.js` (not `frontmatter.js`) because `orchestration.yml` is a pure YAML file, not a markdown file with frontmatter. The module must conform to the `CheckFunction` contract and populate `context.config`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/checks/config.js` | Config validation check module |
| CREATE | `tests/config.test.js` | Test suite using `node:test` with mocked dependencies |

## Implementation Steps

1. **Create `lib/checks/config.js`** — require `path`, `fs-helpers` (`readFile`), and `yaml-parser` (`parseYaml`).

2. **Define constants** at the top of the module:
   ```javascript
   const CATEGORY = 'config';

   const REQUIRED_SECTIONS = ['version', 'projects', 'limits', 'errors', 'human_gates', 'git'];

   const REQUIRED_LIMIT_FIELDS = ['max_phases', 'max_tasks_per_phase', 'max_retries_per_task', 'max_consecutive_review_rejections'];

   const ENUM_RULES = {
     'projects.naming': ['SCREAMING_CASE', 'lowercase', 'numbered'],
     'errors.on_critical': ['halt', 'report_and_continue'],
     'errors.on_minor': ['retry', 'halt', 'skip'],
     'git.strategy': ['single_branch', 'branch_per_phase', 'branch_per_task'],
     'human_gates.execution_mode': ['ask', 'phase', 'task', 'autonomous']
   };
   ```

3. **Export async function `checkConfig(basePath, context)`** that:
   - Resolves `configPath = path.join(basePath, '.github', 'orchestration.yml')`
   - Calls `readFile(configPath)` — if null, return a single `fail` result (`"Could not read orchestration.yml"`) and set `context.config = null`
   - Calls `parseYaml(content)` — if null, return a single `fail` result (`"Failed to parse orchestration.yml"`) and set `context.config = null`
   - Stores the parsed object: `context.config = config`
   - Runs validation steps 4–9, collecting results
   - Returns all collected results
   - Wraps entire body in try/catch — on unexpected error, return a single `fail` result (never crash)

4. **Validate required sections** (FR-9):
   - For each entry in `REQUIRED_SECTIONS`, check that `config[section]` exists and is not `undefined`/`null`
   - If missing → push `fail` result: name=`"orchestration.yml"`, message=`"Missing required section: ${section}"`, detail: expected=`"Section '${section}' present"`, found=`"Section missing"`

5. **Validate version** (FR-10):
   - Check `config.version === '1.0'` (exact string match)
   - If not → push `fail`: message=`"Invalid version"`, detail: expected=`"1.0"`, found=`String(config.version)`
   - If correct → push `pass`: message=`"Valid version"`

6. **Validate enum fields** (FR-10):
   - For each key in `ENUM_RULES`:
     - Parse the dotted key to navigate the config object (e.g., `'projects.naming'` → `config.projects.naming`)
     - If the parent section is missing, skip (already caught by step 4)
     - If the value is not in the allowed list → push `fail`: name=`"orchestration.yml — ${key}"`, message=`"Invalid value for ${key}"`, detail: expected=`"One of: ${allowed.join(', ')}"`, found=`String(value)`
     - If valid → push `pass`: message=`"Valid ${key}"`

7. **Validate limit fields** (FR-10):
   - If `config.limits` exists, for each field in `REQUIRED_LIMIT_FIELDS`:
     - Get `value = config.limits[field]`
     - Check: value must exist, `typeof value` must resolve to a number (use `Number.isInteger()` or check it's a whole number > 0, since yaml-parser returns numbers as JavaScript numbers), and `value > 0`
     - If missing → push `fail`: message=`"Missing required limit: ${field}"`
     - If not a positive integer → push `fail`: message=`"Invalid limit value: ${field}"`, detail: expected=`"Positive integer"`, found=`String(value)`
     - If valid → push `pass`: message=`"Valid limit: ${field}"`

8. **Check severity overlap** (FR-11):
   - If `config.errors` and `config.errors.severity` exist:
     - Get `critical = config.errors.severity.critical || []` and `minor = config.errors.severity.minor || []`
     - Compute overlap: items that appear in both arrays
     - If overlap is non-empty → push `fail`: message=`"Severity list overlap detected"`, detail: expected=`"No overlap between critical and minor lists"`, found=`"Overlapping items: ${overlap.join(', ')}"`, context=`"critical ∩ minor must be empty"`
     - If no overlap → push `pass`: message=`"No severity list overlap"`

9. **Enforce human gate hard gates** (FR-12):
   - If `config.human_gates` exists:
     - Check `config.human_gates.after_planning === true` — if not → push `fail`: message=`"Human gate violation: after_planning must be true"`, detail: expected=`"true"`, found=`String(config.human_gates.after_planning)`
     - Check `config.human_gates.after_final_review === true` — if not → push `fail`: message=`"Human gate violation: after_final_review must be true"`, detail: expected=`"true"`, found=`String(config.human_gates.after_final_review)`
     - If both true → push `pass`: message=`"Human gate hard gates enforced"`

10. **Create `tests/config.test.js`** with comprehensive test coverage (see Test Requirements below). Use Node.js built-in `node:test` and `node:assert` modules. Mock `fs-helpers` and `yaml-parser` functions to avoid real file system access.

## Contracts & Interfaces

### CheckResult (every check function returns an array of these)

```javascript
// CheckResult object shape
{
  /** Category: 'config' for this module */
  category: 'config',
  /** Human-readable identifier — typically 'orchestration.yml' or 'orchestration.yml — <field-path>' */
  name: string,
  /** Outcome */
  status: 'pass' | 'fail' | 'warn',
  /** One-line description */
  message: string,
  /** Optional detail for verbose/failure output */
  detail: { expected: string, found: string, context?: string } | undefined
}
```

### CheckDetail

```javascript
{
  /** What the validator expected */
  expected: string,
  /** What was actually found */
  found: string,
  /** Optional additional context */
  context: string | undefined
}
```

### DiscoveryContext (mutable context passed through pipeline)

```javascript
{
  agents: Map,        // Populated by checkAgents (already done)
  skills: Map,        // Populated by checkSkills (already done)
  config: null,       // ← This module populates this: parsed orchestration.yml object or null
  instructions: [],   // Populated by checkInstructions (later)
  prompts: []         // Populated by checkPrompts (later)
}
```

### CheckFunction signature (module.exports)

```javascript
/**
 * @param {string} basePath - Absolute path to workspace root (parent of .github/)
 * @param {object} context  - Shared DiscoveryContext
 * @returns {Promise<object[]>} Array of CheckResult objects
 */
module.exports = async function checkConfig(basePath, context) { ... };
```

### yaml-parser API (from `lib/utils/yaml-parser.js`)

```javascript
const { parseYaml } = require('../utils/yaml-parser');

// parseYaml(yamlString: string): object | null
// Parses a YAML string into a nested plain object.
// Supports: scalars, single/double-quoted strings, arrays (- item),
// nested objects (indented keys), inline booleans, integers.
// Does NOT support: anchors, aliases, multi-document, flow style, multiline scalars.
// Returns null if parsing fails entirely.
```

### fs-helpers API (from `lib/utils/fs-helpers.js`)

```javascript
const { readFile } = require('../utils/fs-helpers');

// readFile(filePath: string): string | null — file content as UTF-8, or null if unreadable. Never throws.
```

## Reference: Full `orchestration.yml` Content

The module validates the file `.github/orchestration.yml`. Its complete content is:

```yaml
# .github/orchestration.yml
# Orchestration System Configuration
# -----------------------------------

version: "1.0"

# ─── Project Storage ───────────────────────────────────────────────
projects:
  base_path: ".github/projects"          # Where project folders are created
  naming: "SCREAMING_CASE"               # SCREAMING_CASE | lowercase | numbered

# ─── Pipeline Limits (Scope Guards) ───────────────────────────────
limits:
  max_phases: 10                         # Maximum phases per project
  max_tasks_per_phase: 8                 # Maximum tasks per phase
  max_retries_per_task: 2                # Auto-retries before escalation
  max_consecutive_review_rejections: 3   # Reviewer rejects before human escalation

# ─── Error Handling ────────────────────────────────────────────────
errors:
  severity:
    critical:                            # Fail-fast → stop pipeline → human
      - "build_failure"
      - "security_vulnerability"
      - "architectural_violation"
      - "data_loss_risk"
    minor:                               # Auto-retry via corrective task
      - "test_failure"
      - "lint_error"
      - "review_suggestion"
      - "missing_test_coverage"
      - "style_violation"
  on_critical: "halt"                    # halt | report_and_continue
  on_minor: "retry"                      # retry | halt | skip

# ─── Git Strategy ──────────────────────────────────────────────────
git:
  strategy: "single_branch"             # single_branch | branch_per_phase | branch_per_task
  branch_prefix: "orch/"                # Prefix for orchestration branches
  commit_prefix: "[orch]"               # Prefix for commit messages
  auto_commit: true                     # Agents commit after task completion

# ─── Human Gate Defaults ───────────────────────────────────────────
human_gates:
  after_planning: true                   # Always gate after master plan (hard default)
  execution_mode: "ask"                  # ask | phase | task | autonomous
  after_final_review: true               # Always gate after final review (hard default)
```

### Expected Parse Structure

After `parseYaml()`, the config object should look like:

```javascript
{
  version: '1.0',
  projects: {
    base_path: '.github/projects',
    naming: 'SCREAMING_CASE'
  },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3
  },
  errors: {
    severity: {
      critical: ['build_failure', 'security_vulnerability', 'architectural_violation', 'data_loss_risk'],
      minor: ['test_failure', 'lint_error', 'review_suggestion', 'missing_test_coverage', 'style_violation']
    },
    on_critical: 'halt',
    on_minor: 'retry'
  },
  git: {
    strategy: 'single_branch',
    branch_prefix: 'orch/',
    commit_prefix: '[orch]',
    auto_commit: true
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true
  }
}
```

## Validation Rules Summary

| Rule | Field Path | Valid Values | FR |
|------|-----------|-------------|-----|
| Required sections | top-level keys | `version`, `projects`, `limits`, `errors`, `human_gates`, `git` | FR-9 |
| Version | `version` | Exactly `"1.0"` | FR-10 |
| Naming convention | `projects.naming` | `SCREAMING_CASE`, `lowercase`, `numbered` | FR-10 |
| Critical error action | `errors.on_critical` | `halt`, `report_and_continue` | FR-10 |
| Minor error action | `errors.on_minor` | `retry`, `halt`, `skip` | FR-10 |
| Git strategy | `git.strategy` | `single_branch`, `branch_per_phase`, `branch_per_task` | FR-10 |
| Execution mode | `human_gates.execution_mode` | `ask`, `phase`, `task`, `autonomous` | FR-10 |
| Max phases | `limits.max_phases` | Positive integer | FR-10 |
| Max tasks per phase | `limits.max_tasks_per_phase` | Positive integer | FR-10 |
| Max retries per task | `limits.max_retries_per_task` | Positive integer | FR-10 |
| Max consecutive rejections | `limits.max_consecutive_review_rejections` | Positive integer | FR-10 |
| Severity overlap | `errors.severity.critical` ∩ `errors.severity.minor` | Must be empty (∅) | FR-11 |
| After-planning gate | `human_gates.after_planning` | Must be `true` | FR-12 |
| After-final-review gate | `human_gates.after_final_review` | Must be `true` | FR-12 |

## Styles & Design Tokens

Not applicable — this is a backend CLI module with no UI.

## Test Requirements

Create `tests/config.test.js` using `node:test` (built-in) with `describe`/`it` blocks. Mock `fs-helpers` and `yaml-parser` modules (same mocking pattern as `tests/agents.test.js` and `tests/skills.test.js`).

- [ ] `checkConfig` exports an async function
- [ ] File not found (readFile returns null) → 1 fail result ("Could not read orchestration.yml"), `context.config` is null
- [ ] Parse failure (parseYaml returns null) → 1 fail result ("Failed to parse orchestration.yml"), `context.config` is null
- [ ] Valid config (all sections, correct values) → all pass results, `context.config` populated with parsed object
- [ ] Missing required section (e.g., no `limits` key) → fail result for that section
- [ ] Missing multiple sections → fail result for each missing section
- [ ] Invalid version (`"2.0"` instead of `"1.0"`) → fail with expected="1.0", found="2.0"
- [ ] Valid version (`"1.0"`) → pass result
- [ ] Invalid enum: `projects.naming = "camelCase"` → fail with expected="One of: SCREAMING_CASE, lowercase, numbered", found="camelCase"
- [ ] Valid enum: `projects.naming = "SCREAMING_CASE"` → pass result
- [ ] Invalid enum: `errors.on_critical = "ignore"` → fail result
- [ ] Invalid enum: `errors.on_minor = "crash"` → fail result
- [ ] Invalid enum: `git.strategy = "rebase"` → fail result
- [ ] Invalid enum: `human_gates.execution_mode = "manual"` → fail result
- [ ] All valid enums → pass results for each enum field
- [ ] Missing limit field → fail result
- [ ] Limit value is 0 → fail (not positive)
- [ ] Limit value is negative → fail
- [ ] Limit value is a string → fail
- [ ] Limit value is a float (e.g., 3.5) → fail (not integer)
- [ ] All valid limits (positive integers) → pass results for each
- [ ] Severity overlap: one item in both critical and minor lists → fail with overlapping items listed
- [ ] No severity overlap → pass result
- [ ] `after_planning` is false → fail ("Human gate violation: after_planning must be true")
- [ ] `after_final_review` is false → fail ("Human gate violation: after_final_review must be true")
- [ ] Both gates true → pass result
- [ ] All results have `category: 'config'`
- [ ] Function never throws — wraps errors in try/catch, returns fail result
- [ ] `context.config` is populated with the parsed config object on success

## Acceptance Criteria

- [ ] `lib/checks/config.js` exists and exports an async function matching `CheckFunction` signature
- [ ] Reads `.github/orchestration.yml` using `readFile` from `fs-helpers`
- [ ] Parses content using `parseYaml` from `yaml-parser`
- [ ] Missing or unreadable file produces `fail` result (no crash)
- [ ] YAML parse failure produces `fail` result (no crash)
- [ ] All 6 required top-level sections validated — missing sections produce `fail`
- [ ] `version` must equal `"1.0"` exactly — wrong value produces `fail`
- [ ] All 5 enum fields validated against their allowed value sets — invalid values produce `fail` with expected values listed
- [ ] All 4 limit fields validated as positive integers — non-positive or non-integer values produce `fail`
- [ ] Severity list overlap (critical ∩ minor ≠ ∅) produces `fail` with overlapping items
- [ ] Human gate hard gates (`after_planning`, `after_final_review`) must be `true` — violations produce `fail`
- [ ] `context.config` is populated with the parsed config object on successful parse
- [ ] `context.config` is set to `null` on read/parse failure
- [ ] All tests pass (`node --test tests/config.test.js`)
- [ ] No lint errors
- [ ] Module requires cleanly (`node -e "require('./lib/checks/config')"`)

## Constraints

- Do NOT import or require any external npm packages — only Node.js built-ins and project utility modules
- Do NOT modify any existing files — only create the two new files
- Do NOT use `frontmatter.js` — `orchestration.yml` is a pure YAML file, use `yaml-parser.js`
- Do NOT read from `context.agents`, `context.skills`, or any other context section — this module only writes to `context.config`
- Follow the same code style and patterns as `lib/checks/agents.js` and `lib/checks/skills.js` (category constant, helper functions, try/catch wrapper, result building)
- Use `path.join()` for ALL path construction — no string concatenation with `/`
- For the `parseYaml` return value, note that `yaml-parser` returns numbers as JavaScript numbers (not strings) and booleans as JavaScript booleans (not strings) — this means `config.limits.max_phases` will be `10` (number), `config.human_gates.after_planning` will be `true` (boolean), and `config.version` will be `'1.0'` (string, because it's quoted in YAML)
