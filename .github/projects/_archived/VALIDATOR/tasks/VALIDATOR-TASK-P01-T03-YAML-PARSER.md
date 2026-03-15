---
project: "VALIDATOR"
phase: 1
task: 3
title: "YAML Parser"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# YAML Parser

## Objective

Create a lightweight, zero-dependency YAML parser module (`lib/utils/yaml-parser.js`) that converts YAML strings into nested plain JavaScript objects. The parser must handle the exact YAML subset used by the orchestration system's `orchestration.yml` — scalars, lists, nested objects, quoted strings, booleans, integers, and inline comments — without external dependencies.

## Context

The VALIDATOR tool needs to parse `.github/orchestration.yml` to validate configuration values. A full YAML library like `js-yaml` is not available — the project has zero external dependencies. The parser only needs to handle the subset of YAML actually used by the orchestration system: key-value scalars, quoted strings, dash-prefixed lists, indentation-based nesting, booleans, and integers. Advanced YAML features (anchors, aliases, multi-document, flow style, multiline scalars) are out of scope.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `lib/utils/yaml-parser.js` | Lightweight YAML parser — CommonJS module |

## Implementation Steps

1. **Create** `lib/utils/yaml-parser.js` exporting `{ parseYaml }`.
2. **Wrap the entire parser body in a try/catch** — return `null` on any unrecoverable error. The function must never throw.
3. **Pre-process the input**: strip comment-only lines and inline comments (everything after `#` that is not inside a quoted string), remove blank lines, preserve indentation.
4. **Parse line-by-line**, tracking indentation level to build a nested object tree:
   - Detect indentation (number of leading spaces). Support both 2-space and 4-space indent levels.
   - If a line matches `key: value`, store the scalar value under the current object scope.
   - If a line matches `key:` (no value), create a new nested object and push scope.
   - If a line matches `- value`, append to the current array.
   - If a line matches `- key: value` (list of objects), handle appropriately.
5. **Parse scalar values** with type coercion:
   - `true` / `false` (case-sensitive) → JavaScript `boolean`
   - Unquoted integers (e.g., `10`, `0`, `3`) → JavaScript `number`
   - Double-quoted strings (`"..."`) → strip quotes, preserve inner content
   - Single-quoted strings (`'...'`) → strip quotes, preserve inner content
   - Everything else → JavaScript `string`
6. **Handle inline comments**: strip ` # comment` suffixes from value strings (but not from within quotes).
7. **Handle empty values**: a key with no value after the colon (and no nested block following) → empty string `""`.
8. **Return** the fully nested plain object.

## Contracts & Interfaces

```typescript
// lib/utils/yaml-parser.js

/**
 * Parse a YAML string into a nested plain object.
 * Supports: scalars, single/double-quoted strings, arrays (- item),
 * nested objects (indented keys), inline booleans, integers.
 * Does NOT support: anchors, aliases, multi-document, flow style, multiline scalars.
 *
 * @param yamlString - Raw YAML content
 * @returns Parsed object, or null if parsing fails entirely
 */
function parseYaml(yamlString: string): Record<string, any> | null;

module.exports = { parseYaml };
```

**Return type**: A plain nested JavaScript object (no class instances, no Maps). Arrays are JavaScript arrays. All keys are strings. Values are `string | number | boolean | object | array`.

## Styles & Design Tokens

Not applicable — this is a pure data-processing utility with no UI output.

## Test Requirements

- [ ] `parseYaml` returns a nested object when given valid YAML
- [ ] Top-level keys parse correctly (e.g., `version`, `projects`, `limits`, `errors`, `git`, `human_gates`)
- [ ] Nested objects parse at multiple depth levels (e.g., `projects.base_path`, `errors.severity.critical`)
- [ ] String values are JavaScript strings (`version` → `"1.0"`)
- [ ] Quoted strings have quotes stripped (`"1.0"` → `"1.0"`, `".github/projects"` → `".github/projects"`)
- [ ] Integer values are JavaScript numbers (`max_phases: 10` → `10`)
- [ ] Boolean values are JavaScript booleans (`auto_commit: true` → `true`, `after_planning: true` → `true`)
- [ ] Array items using `- item` syntax produce JavaScript arrays (e.g., `errors.severity.critical` → `["build_failure", "security_vulnerability", "architectural_violation", "data_loss_risk"]`)
- [ ] Inline comments are stripped (e.g., `max_phases: 10  # Maximum phases` → value is `10`, not `"10  # Maximum phases"`)
- [ ] Comment-only lines (starting with `#`) are ignored
- [ ] Empty/null input returns `null`
- [ ] Malformed input returns `null` (never throws)
- [ ] The reference YAML below parses into the expected structure (see Reference Test Input section)

## Acceptance Criteria

- [ ] `lib/utils/yaml-parser.js` exists and exports `{ parseYaml }`
- [ ] `parseYaml` is a function accepting a string and returning an object or null
- [ ] Correctly parses the reference `orchestration.yml` content (see below) into a nested object matching the expected structure
- [ ] Handles 2-space and 4-space indentation levels
- [ ] Handles quoted strings — both single and double quotes — preserving content and stripping quotes
- [ ] Handles boolean values: `true` → `true`, `false` → `false`
- [ ] Handles integer values: `10` → `10` (number, not string)
- [ ] Handles arrays: `- "item"` → `["item"]`
- [ ] Strips inline comments (content after unquoted `#`)
- [ ] Returns `null` on empty/null/undefined input — never throws
- [ ] Returns `null` on completely malformed input — never throws
- [ ] CommonJS module format (`module.exports = { parseYaml }`)
- [ ] Zero external dependencies — no `require` of anything outside this file
- [ ] No `fs` or `path` imports — pure string-in, object-out
- [ ] All tests pass
- [ ] No lint errors

## Constraints

- Do NOT use any external npm packages — zero dependencies
- Do NOT import `fs`, `path`, or any Node.js built-in modules — this is a pure string parser
- Do NOT support YAML anchors (`&`), aliases (`*`), multi-document (`---` separators), flow style (`{key: value}`), or multiline scalars (`|`, `>`)
- Do NOT throw exceptions — always return `null` on failure
- Do NOT use `eval()`, `new Function()`, or any dynamic code execution
- Do NOT modify the input string's data — parse only

## Reference Test Input

The following is the **exact content** of `.github/orchestration.yml` that this parser must handle correctly. Use this as the primary test input to verify parser correctness.

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

# ─── Notes ─────────────────────────────────────────────────────────
# Model selection is configured per-agent in .agent.md frontmatter.
# See .github/agents/*.agent.md → `model` field.
```

### Expected Parse Output

When parsing the reference YAML above, `parseYaml(yamlString)` must produce an object equivalent to:

```javascript
{
  version: "1.0",
  projects: {
    base_path: ".github/projects",
    naming: "SCREAMING_CASE"
  },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3
  },
  errors: {
    severity: {
      critical: [
        "build_failure",
        "security_vulnerability",
        "architectural_violation",
        "data_loss_risk"
      ],
      minor: [
        "test_failure",
        "lint_error",
        "review_suggestion",
        "missing_test_coverage",
        "style_violation"
      ]
    },
    on_critical: "halt",
    on_minor: "retry"
  },
  git: {
    strategy: "single_branch",
    branch_prefix: "orch/",
    commit_prefix: "[orch]",
    auto_commit: true
  },
  human_gates: {
    after_planning: true,
    execution_mode: "ask",
    after_final_review: true
  }
}
```

## Edge Cases

The parser must also handle these edge patterns correctly:

**1. Inline comments after values:**
```yaml
max_phases: 10    # This is a comment
```
Expected: `max_phases` → `10` (number), comment stripped.

**2. Empty values (key with no value):**
```yaml
description:
```
Expected: `description` → `""` (empty string), unless followed by indented lines (then treat as nested object).

**3. Quoted strings containing special characters:**
```yaml
commit_prefix: "[orch]"
branch_prefix: "orch/"
naming: "SCREAMING_CASE"
```
Expected: Quotes stripped, inner content preserved exactly — `"[orch]"` → `"[orch]"`, `"orch/"` → `"orch/"`.

**4. Nested structures at multiple depth levels (3 levels):**
```yaml
errors:
  severity:
    critical:
      - "build_failure"
      - "security_vulnerability"
```
Expected: `errors.severity.critical` → `["build_failure", "security_vulnerability"]`

**5. Comment-only lines and decorative comments:**
```yaml
# ─── Section Header ───────────────────────────────────────────────
# Plain comment
```
Expected: Completely ignored, do not create keys or values.

**6. Boolean case-sensitivity:**
```yaml
enabled: true
disabled: false
label: "true"
```
Expected: `enabled` → `true` (boolean), `disabled` → `false` (boolean), `label` → `"true"` (string, because it's quoted).

**7. Mixed indentation — 2-space at one level, 4-space visual alignment:**
```yaml
projects:
  base_path: ".github/projects"          # long trailing comment with spaces
```
Expected: Correctly parsed despite trailing whitespace before comment. The indent is 2 spaces for `base_path`.
