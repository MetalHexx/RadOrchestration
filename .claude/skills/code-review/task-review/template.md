---
project: "{PROJECT-NAME}"
phase: {PHASE-NUMBER}
task: {TASK-NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|low|medium|high"
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Code Review: Phase {PHASE-NUMBER}, Task {TASK-NUMBER} — {TASK-TITLE}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

## Summary

{2-3 sentences. Overall assessment.}

## Conformance Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅/⚠️/❌ | {Brief note} |
| Design consistency | ✅/⚠️/❌ | {Brief note} |
| Code quality | ✅/⚠️/❌ | {Brief note} |
| Test coverage | ✅/⚠️/❌ | {Brief note} |
| Error handling | ✅/⚠️/❌ | {Brief note} |
| Accessibility | ✅/⚠️/❌ | {Brief note} |
| Security | ✅/⚠️/❌ | {Brief note} |

## Independent Quality Assessment

<!-- Findings from the skeptical pass — evaluating correctness independent of planning documents. -->

| Finding | Severity | Evidence | Suggestion |
|---------|----------|----------|------------|
| {What was found} | low/medium/high | {Concrete evidence from code} | {Specific fix or improvement} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance check." -->

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `{path}` | {lines} | low/medium/high | {Issue} | {Fix suggestion} |

## Positive Observations

- {What was done well}

## Recommendations

- {Recommendation for next task or Planner action}

## Files Reviewed
<!-- Optional. Omit this section entirely if not applicable. -->

| File | Notes |
|------|-------|
| `{path/to/file}` | {brief phrase} |

## Deviations Observed
<!-- Optional. Omit this section entirely if no deviations were observed. Do NOT re-grade acceptance criteria here. Do NOT repeat Issues Found content. -->

- {Brief bullet describing the deviation from the task handoff specification.}
