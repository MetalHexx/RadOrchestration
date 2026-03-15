---
project: "EXECUTE-BEHAVIORAL-TESTS"
author: "brainstormer-agent"
created: "2026-03-14T00:00:00Z"
---

# EXECUTE-BEHAVIORAL-TESTS — Brainstorming

## Problem Space

The PIPELINE-BEHAVIORAL-TESTS project produces a comprehensive behavioral test suite (`pipeline-behavioral.test.js`) covering end-to-end pipeline execution paths, triage rows, gate modes, and contract changes. But producing the tests is only half the job — someone needs to actually run them, capture what breaks, and document the findings in a form that drives a follow-on fix pass. Currently there is no automated mechanism to execute the suite, parse the results, and produce a structured issue log. Failed tests get lost in raw terminal output, observations (slow tests, suspicious passes, flaky behavior) go unrecorded, and there is no artifact for a human reviewer to triage before authorizing the next round of fixes.

Additionally, the PIPELINE-BEHAVIORAL-TESTS project surfaced three high-severity pipeline bugs (documented in `PIPELINE-BEHAVIORAL-TESTS-ERROR-LOG.md`) that must be fixed before execution produces meaningful results. Running the behavioral suite against known-broken code would generate noise — failures caused by existing bugs rather than behavioral contract violations. The fixes are prerequisite work: fix first, then run, then report.

## Validated Goals

### Goal 1: Fix triage Row 1 code review bypass (Error Log #1)

**Description**: Change triage Row 1 in `triage-engine.js` from returning `{ verdict: null, action: null }` to returning `{ verdict: null, action: "spawn_code_reviewer" }` for clean completed tasks (`complete, no deviations, no review`). Update `applyTaskTriage` in `mutations.js` to stop interpreting null/null as auto-approve — it should only set `review_verdict: approved` when the triage engine explicitly returns that verdict.
**Rationale**: Code review is a mandatory pipeline step. Clean tasks must go through code review like everything else. The current behavior makes the resolver's `spawn_code_reviewer` branch (T11) dead code for the most common task completion path.
**Key considerations**: Triage table value change + mutation handler guard — no structural change to the pipeline flow. Existing tests that assert auto-approval on clean tasks will need their expectations updated.

### Goal 2: Add missing triage row for complete + deviations + no review (Error Log #3)

**Description**: Add a new row to the task triage decision table in `triage-engine.js` matching `report_status=complete, has_deviations=true, review_doc=null` → `{ verdict: null, action: "spawn_code_reviewer" }`.
**Rationale**: Direct gap in the triage table — directly caused by the same design assumption as Error #1. With Goal 1 fixed, this row is the natural companion: both clean and deviated tasks route to code review when no review exists yet.
**Key considerations**: Single row addition. The reviewer sees the deviations and makes the verdict call. The resolver's T11 branch already handles `spawn_code_reviewer`.

### Goal 3: Fix YAML parser to handle arrays of objects (Error Log #2)

**Description**: Update the list-item branch in `yaml-parser.js` to detect when a list item's content contains a colon (key-value pair) and parse it as a nested object instead of a scalar. Handle indented continuation lines as additional keys on the same object.
**Rationale**: The parser currently treats `- id: "T01"` as a scalar string instead of an object `{ id: "T01" }`, making the phase plan pre-read block non-functional. The workaround leaves a known-broken utility in the codebase.
**Key considerations**: Isolated parser fix — no changes to the parser's API or callers. One level of nesting is sufficient for all frontmatter use cases. Deeply nested structures are out of scope.

### Goal 4: Run the full test suite and produce a test report

**Description**: Run the full test suite (`node --test`) against the fixed code. Capture the output and produce a single `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` summarizing what passed, what failed, and the failure details for anything that didn't pass.
**Rationale**: `node --test` native output is sufficient — no custom runner or parser needed. The report is a plain markdown summary written by the Coder after reviewing the terminal output: total tests, pass count, fail count, and a section per failure with the test name, assertion, and stack trace.
**Key considerations**: The report is the terminal artifact. The human reads it and decides whether remaining failures warrant a new fix project.

## Scope Boundaries

### In Scope
- Fix three known pipeline bugs from `PIPELINE-BEHAVIORAL-TESTS-ERROR-LOG.md` (Goals 1–3)
- Run the full test suite via `node --test` after fixes
- Produce a single `EXECUTE-BEHAVIORAL-TESTS-TEST-REPORT.md` summarizing pass/fail results and failure details

### Out of Scope
- Custom test runner scripts or TAP output parsers — native `node --test` output is sufficient
- Observation tagging (slow tests, flaky detection) — out of scope for a fix-and-verify pass
- CI integration or scheduled execution
- Any changes to `pipeline-behavioral.test.js` itself
- Structural changes to the pipeline engine flow — fixes stay within existing architecture (triage table values, missing rows, parser branch)

## Key Constraints

- No new npm dependencies — test suite runs with `node --test` and Node.js built-ins only
- Fixes must not change the pipeline engine's event/action flow — only triage table values, missing rows, and the YAML parser branch
- Test report is plain markdown, written by the Coder from terminal output — no automated parsing scripts
- Output artifact goes in the project folder: `.github/projects/EXECUTE-BEHAVIORAL-TESTS/`



## Summary

EXECUTE-BEHAVIORAL-TESTS fixes three known pipeline bugs from the PIPELINE-BEHAVIORAL-TESTS error log, then runs the full test suite and produces a plain-markdown test report. The fixes are minimal and architecture-consistent: route clean and deviated completed tasks through code review via triage table changes, and add array-of-objects support to the YAML parser. After fixing, `node --test` runs all suites; the Coder documents what passed, what failed, and the failure details in a single report. The human reads the report and decides whether remaining failures warrant a follow-on fix project.
