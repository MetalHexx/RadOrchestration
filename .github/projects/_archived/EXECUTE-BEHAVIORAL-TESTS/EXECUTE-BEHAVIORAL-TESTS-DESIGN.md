---
project: "EXECUTE-BEHAVIORAL-TESTS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-14T00:00:00Z"
---

# EXECUTE-BEHAVIORAL-TESTS — Design

## Design Overview

This is a backend/infrastructure project with no graphical user interface. The "user experience" is the developer and reviewer experience: fix three pipeline bugs, run the behavioral test suite, and produce a structured markdown test report. The design focuses on the test report document structure — how results are organized so a human reviewer can quickly triage pass/fail outcomes — and on ensuring code fixes follow existing codebase conventions.

## User Flows

### Flow 1: Human Reviewer Triages Test Report

```
Open test report → Read summary statistics → Scan pass/fail verdict → If failures exist: read per-failure details → Decide follow-on action
```

The reviewer opens `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`, reads the top-level summary (total/pass/fail counts and overall verdict), then drills into per-failure sections only if failures exist. Each failure section provides enough context (test name, assertion, stack trace) to understand the issue without re-running tests locally.

### Flow 2: Developer Applies Bug Fixes

```
Read task handoff → Apply triage table changes → Apply mutation handler guard → Apply YAML parser fix → Update test expectations → Run test suite → Generate report
```

The developer applies three targeted fixes (triage Row 1, new Row 2, YAML parser) following existing code patterns, updates test expectations that assert old buggy behavior, runs the full suite, and produces the test report artifact.

## Layout & Components

### Test Report Document (`EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`)

This is a markdown document, not a UI view. "Layout" means document sections and information hierarchy.

| Section | Content | Purpose |
|---------|---------|---------|
| Frontmatter | YAML: project name, date, author, status | Machine-readable metadata; consistent with other project artifacts |
| Executive Summary | 2-3 sentence plain-English verdict | Reviewer can stop here if everything passed |
| Summary Statistics | Total / Pass / Fail / Skip counts | Quick numeric overview |
| Results Table | Per-test row: name, status (pass/fail), duration | Scannable overview of all tests |
| Failure Details | One subsection per failure: test name, assertion, expected vs. actual, stack trace | Deep-dive for triage; only present if failures exist |
| Environment | Node version, OS, test runner command | Reproducibility context |
| Carry-Forward Items | Known issues not addressed in this project | Prevents false expectations about project scope |

### Section Specifications

#### Frontmatter

```yaml
---
project: "EXECUTE-BEHAVIORAL-TESTS"
type: "test-report"
author: "coder-agent"
created: "{ISO-DATE}"
suite: "pipeline-behavioral"
runner: "node --test"
---
```

#### Executive Summary

A short paragraph stating: how many tests ran, how many passed, how many failed, and a binary verdict — **PASS** (zero failures) or **FAIL** (one or more failures). Example:

> **Result: PASS** — 45 tests executed, 45 passed, 0 failed. All behavioral contracts verified after bug fixes.

Or:

> **Result: FAIL** — 45 tests executed, 42 passed, 3 failed. See Failure Details below for triage.

#### Summary Statistics

A compact table:

| Metric | Count |
|--------|-------|
| Total  | 45    |
| Passed | 45    |
| Failed | 0     |
| Skipped | 0    |

#### Results Table

One row per test case, grouped by `describe` block. Use checkmarks and crosses for scannability:

| Status | Test Name | Describe Block |
|--------|-----------|----------------|
| ✅ | complete, no deviations, no review_doc → spawn code reviewer | Task Triage |
| ✅ | complete, deviations, no review → spawn code reviewer | Task Triage |
| ❌ | some failing test name | Some Block |

#### Failure Details

One `###` subsection per failure. Each includes:

```markdown
### ❌ {Test Name}

**Describe block:** {parent describe}
**Assertion:** {what was asserted}
**Expected:** {expected value}
**Actual:** {actual value}

<details>
<summary>Stack trace</summary>

{full stack trace from test runner}

</details>
```

The `<details>` collapse keeps the report scannable — reviewers see the assertion summary without scrolling through stack traces unless they need them.

#### Carry-Forward Items

Bulleted list of known issues observed during testing that are out of scope. Example:

- `triage_attempts` counter increments for `spawn_code_reviewer` actions (cosmetic, not functional)
- Deep YAML nesting unsupported (documented non-goal)

## States & Interactions

Since this is a document (not a UI), "states" means the possible report outcomes:

| Report State | Condition | Visual Treatment |
|-------------|-----------|-----------------|
| All Pass | 0 failures | Executive summary shows **PASS** in bold. No Failure Details section. |
| Partial Fail | 1+ failures | Executive summary shows **FAIL** in bold. Failure Details section present with one subsection per failure. |
| Suite Error | Test runner itself fails (e.g., syntax error) | Executive summary notes the runner error. No Results Table. Error output included in a code block. |

## Developer Experience Conventions

These are not UI components — they are code pattern conventions the fixes must follow, derived from the research findings.

### Triage Decision Table Pattern

New or modified rows must follow the existing pattern:

| Convention | Example | Source |
|-----------|---------|--------|
| Numbered comment above each row | `// ── Row 2: complete, deviations, no review — spawn code reviewer ──` | All 11 existing rows use this pattern |
| `makeSuccess()` with 7 args | `makeSuccess(TRIAGE_LEVELS.TASK, verdict, action, phaseIndex, taskIndex, rowNumber, details)` | Existing `makeSuccess` calls |
| Descriptive detail string | `'Row 2: complete, deviations, no review — spawn code reviewer'` | Matches row comment |
| First-match-wins order | New row for `complete + deviations + no review` must appear before rows requiring `review_doc` | Rows 3–6 require `task.review_doc` |
| Constants for enum values | `REVIEW_VERDICTS.APPROVED`, not string `'approved'` | All existing rows use constants |

### Mutation Handler Guard Pattern

The null/null auto-approve guard in `applyTaskTriage` must be updated to check for an explicit `approved` verdict rather than matching on null/null:

| Convention | Requirement |
|-----------|------------|
| Preserve Row 7 behavior | Partial reports (null verdict, null action, `report_doc` present) must still auto-approve |
| Use constants | `REVIEW_VERDICTS.APPROVED` for comparison, not string literals |
| No new branches | The fix modifies existing guard logic, does not add new if/else branches to the routing |

### YAML Parser Pattern

The list-item fix must follow the existing parser architecture:

| Convention | Requirement |
|-----------|------------|
| Use existing `findKeyColon()` | Detect key-value pairs in list items using the same colon-detection function used elsewhere in the parser |
| Use existing `parseScalar()` | Parse values after the colon using the same scalar parser |
| Preserve scalar list behavior | `- item` without a colon must still produce a scalar string |
| Stack-based approach | Continuation lines (indented deeper) add properties to the current object, consistent with the parser's indent-tracking model |

### Test Expectation Update Pattern

Updated test assertions must follow existing test conventions:

| Convention | Requirement |
|-----------|------------|
| `node:assert/strict` | Use `assert.strictEqual`, `assert.deepStrictEqual` — same as all existing assertions |
| Assert on canonical fields | `result.action`, `task.review_verdict`, `task.review_action`, `task.status` — same fields asserted in other row tests |
| `withStrictDates` wrapper | Any tests with date-sensitive logic must stay wrapped |
| No new test infrastructure | No new helpers, utilities, or describe blocks |

## Accessibility

Not applicable — this project produces a markdown document and backend code fixes. There are no interactive UI elements, no keyboard navigation targets, no screen reader considerations, and no color contrast requirements.

The test report uses standard markdown (headings, tables, code blocks, `<details>` elements) which are natively accessible in any markdown renderer.

## Responsive Behavior

Not applicable — the test report is a markdown document rendered by whatever viewer the reviewer uses (GitHub, VS Code, terminal). No breakpoints or layout adaptation needed.

## Design System Additions

None. No new design tokens, UI components, or visual patterns are introduced. The test report uses standard markdown conventions consistent with other project artifacts in the orchestration system.
