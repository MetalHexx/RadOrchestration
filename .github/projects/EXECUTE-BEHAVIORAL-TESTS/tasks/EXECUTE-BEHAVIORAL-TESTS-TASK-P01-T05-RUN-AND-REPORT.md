---
project: "EXECUTE-BEHAVIORAL-TESTS"
phase: 1
task: 5
title: "Run Tests and Produce Test Report"
status: "pending"
skills_required: ["code", "run-tests"]
skills_optional: []
estimated_files: 1
---

# Run Tests and Produce Test Report

## Objective

Execute the full behavioral test suite and three supplementary test suites, capture the results from each run, and produce a structured markdown test report artifact (`EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`) that a human reviewer can use to triage pass/fail outcomes.

## Context

Four prior tasks have been completed and reviewed: the triage engine fix (Row 1 now routes to code review, Row 1b inserted, rows renumbered 3–12), the mutations guard clarifying comment (Option A — no logic change), the YAML parser array-of-objects fix, and the test expectation updates across ~9 test areas. All fixes are in place. This task runs the suites and captures results — it does NOT modify any source or test files.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| READ | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Primary behavioral test suite — execute via `node --test` |
| READ | `.github/orchestration/scripts/tests/triage-engine.test.js` | Supplementary suite — triage engine unit tests |
| READ | `.github/orchestration/scripts/tests/mutations.test.js` | Supplementary suite — mutations unit tests |
| READ | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Supplementary suite — pipeline engine tests |
| CREATE | `.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` | Structured test report artifact |

## Implementation Steps

1. **Run the primary behavioral test suite** — execute `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` and capture the complete stdout/stderr output. Record total tests, passed, failed, skipped counts, and per-test results (name, status, describe block). Record any failure details (assertion message, expected/actual values, stack trace).

2. **Run the triage engine supplementary suite** — execute `node --test .github/orchestration/scripts/tests/triage-engine.test.js` and capture the complete output. Record the same metrics (total, passed, failed, skipped, per-test results, failure details).

3. **Run the mutations supplementary suite** — execute `node --test .github/orchestration/scripts/tests/mutations.test.js` and capture the complete output. Record the same metrics.

4. **Run the pipeline engine supplementary suite** — execute `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` and capture the complete output. Record the same metrics.

5. **Determine the overall verdict** — if ALL suites have zero failures, the verdict is **PASS**. If ANY suite has one or more failures, the verdict is **FAIL**.

6. **Write the frontmatter** — create the test report file with the YAML frontmatter block (exact format in Contracts section below).

7. **Write the Executive Summary** — a short paragraph stating: how many total tests ran across all suites, how many passed, how many failed, and the binary verdict (**PASS** or **FAIL**).

8. **Write the Summary Statistics** — one table per suite with Total, Passed, Failed, Skipped counts, plus a combined totals row.

9. **Write the Results Table** — one row per test case across all suites, with status icon (✅ or ❌), test name, and describe block / suite name.

10. **Write remaining sections** — Failure Details (one `###` subsection per failure with collapsed stack trace), Environment (Node version, OS, runner command), and Carry-Forward Items.

## Contracts & Interfaces

### Test Report Document Structure

The report file must follow this exact structure:

```markdown
---
project: "EXECUTE-BEHAVIORAL-TESTS"
type: "test-report"
author: "coder-agent"
created: "{ISO-DATE}"
suites:
  - name: "pipeline-behavioral"
    runner: "node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js"
  - name: "triage-engine"
    runner: "node --test .github/orchestration/scripts/tests/triage-engine.test.js"
  - name: "mutations"
    runner: "node --test .github/orchestration/scripts/tests/mutations.test.js"
  - name: "pipeline-engine"
    runner: "node --test .github/orchestration/scripts/tests/pipeline-engine.test.js"
---

# Test Report: EXECUTE-BEHAVIORAL-TESTS

## Executive Summary

{Short paragraph: total tests across all suites, passed, failed, binary verdict}

> **Result: {PASS|FAIL}** — {N} tests executed across 4 suites, {N} passed, {N} failed.

## Summary Statistics

### pipeline-behavioral

| Metric  | Count |
|---------|-------|
| Total   | {N}   |
| Passed  | {N}   |
| Failed  | {N}   |
| Skipped | {N}   |

### triage-engine

| Metric  | Count |
|---------|-------|
| Total   | {N}   |
| Passed  | {N}   |
| Failed  | {N}   |
| Skipped | {N}   |

### mutations

| Metric  | Count |
|---------|-------|
| Total   | {N}   |
| Passed  | {N}   |
| Failed  | {N}   |
| Skipped | {N}   |

### pipeline-engine

| Metric  | Count |
|---------|-------|
| Total   | {N}   |
| Passed  | {N}   |
| Failed  | {N}   |
| Skipped | {N}   |

### Combined Totals

| Metric  | Count |
|---------|-------|
| Total   | {N}   |
| Passed  | {N}   |
| Failed  | {N}   |
| Skipped | {N}   |

## Results Table

| Status | Test Name | Suite / Describe Block |
|--------|-----------|------------------------|
| ✅     | {name}    | {suite / describe}     |
| ❌     | {name}    | {suite / describe}     |

## Failure Details

{Only present if one or more tests failed. One subsection per failure:}

### ❌ {Test Name}

**Suite:** {suite name}
**Describe block:** {parent describe}
**Assertion:** {what was asserted}
**Expected:** {expected value}
**Actual:** {actual value}

<details>
<summary>Stack trace</summary>

{full stack trace from test runner output}

</details>

## Environment

| Property | Value |
|----------|-------|
| Node version | {output of `node --version`} |
| OS | {operating system} |
| Runner | `node --test` (Node.js built-in test runner) |
| Primary suite command | `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` |
| Supplementary commands | See frontmatter `suites` list |

## Carry-Forward Items

- `triage_attempts` counter increments for `spawn_code_reviewer` actions — cosmetic, not functional. The counter resets on advance after code review completes. If retry exhaustion is observed during test runs, document it here.
- Deep YAML nesting is unsupported — the YAML parser fix handles one level of array-of-objects nesting only. Deeply nested structures are explicitly out of scope (NFR-7).
- Context field name mismatch: `plan_path` vs `phase_plan_path` — if any test failures reference this mismatch, document the exact field names and affected code paths here.
- {Add any additional issues observed during test execution that are out of scope for this project.}
```

### Runner Commands (Exact)

```bash
# Primary suite
node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js

# Supplementary suites
node --test .github/orchestration/scripts/tests/triage-engine.test.js
node --test .github/orchestration/scripts/tests/mutations.test.js
node --test .github/orchestration/scripts/tests/pipeline-engine.test.js
```

### Node --test Output Format

The native `node --test` runner outputs TAP-like results to stdout. Key patterns to capture:

- `# tests {N}` — total test count
- `# pass {N}` — passed count
- `# fail {N}` — failed count
- `# skipped {N}` — skipped count
- `ok {N} - {test name}` — individual passing test
- `not ok {N} - {test name}` — individual failing test (followed by YAML diagnostic block with assertion details and stack trace)
- `# Subtest: {describe block name}` — marks the start of a describe block

Parse stdout for these patterns to populate the report tables. If the output format differs from this (e.g., newer Node versions use a different format), adapt by capturing whatever structured output is available.

## Styles & Design Tokens

Not applicable — this task produces a markdown document, not a UI component. Use standard markdown formatting (headings, tables, code blocks, `<details>` elements).

## Test Requirements

- [ ] `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` executes to completion without runner crash
- [ ] `node --test .github/orchestration/scripts/tests/triage-engine.test.js` executes to completion without runner crash
- [ ] `node --test .github/orchestration/scripts/tests/mutations.test.js` executes to completion without runner crash
- [ ] `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` executes to completion without runner crash
- [ ] All four suite outputs are captured (stdout and stderr)
- [ ] Test counts in the report match actual runner output

## Acceptance Criteria

- [ ] All four test suites executed to completion (no runner crashes or unhandled exceptions)
- [ ] `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` exists at `.github/projects/EXECUTE-BEHAVIORAL-TESTS/EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`
- [ ] Report frontmatter contains: `project`, `type: "test-report"`, `author: "coder-agent"`, `created` (ISO date), `suites` (list of 4 suite entries with name and runner command)
- [ ] Executive Summary contains total/pass/fail counts matching actual combined runner output
- [ ] Executive Summary contains a binary verdict: **PASS** (zero failures across all suites) or **FAIL** (one or more failures in any suite)
- [ ] Summary Statistics section has one table per suite plus a Combined Totals table, each with Total/Passed/Failed/Skipped rows
- [ ] Results Table has one row per test case across all suites with ✅ or ❌ status icon, test name, and suite/describe block
- [ ] Every test failure has a Failure Details subsection with: test name, suite, describe block, assertion description, expected value, actual value, and collapsed `<details>` stack trace
- [ ] Environment section contains Node version, OS, and runner commands
- [ ] Carry-Forward Items section is present and includes at minimum: `triage_attempts` counter behavior, deep YAML nesting limitation, and `plan_path` vs `phase_plan_path` field name mismatch
- [ ] No source files or test files were modified — only the report file was created
- [ ] Report uses standard markdown only (headings, tables, code blocks, `<details>` elements)

## Constraints

- **READ-ONLY execution**: Do NOT modify any source files, test files, configuration files, or any file other than the test report. This task creates exactly one file: `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md`.
- **No external test frameworks**: Use only the native `node --test` runner. Do NOT install or use TAP parsers, Jest, Mocha, or any other test framework.
- **No custom scripts**: Do NOT create helper scripts, output parsers, or automation tools. Run the commands directly and parse the output manually.
- **No npm dependencies**: Do NOT run `npm install` or add any packages.
- **Accurate reporting**: Test counts and results in the report MUST match the actual runner output. Do NOT fabricate, estimate, or round test counts. If a suite has 47 tests, report 47 — not "approximately 45".
- **Report all failures**: Every single test failure must appear in the Failure Details section. Do NOT summarize or group failures — each gets its own subsection.
- **Preserve carry-forward items**: The three known carry-forward issues (triage_attempts counter, deep YAML nesting, plan_path vs phase_plan_path) must appear in the report even if no failures are observed related to them. Add any additional issues discovered during execution.
