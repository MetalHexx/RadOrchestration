---
project: "{PROJECT-NAME}"
phase: {PHASE-NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
exit_criteria_met: true
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Phase Review: Phase {PHASE-NUMBER} — {PHASE-TITLE}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

## Summary

{2-3 sentences. Holistic assessment of the phase.}

## Integration Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Modules integrate correctly | ✅/❌ | {Note} |
| No conflicting patterns | ✅/❌ | {Note} |
| Contracts honored across tasks | ✅/❌ | {Note} |
| No orphaned code | ✅/❌ | {Note} |

## Exit Criteria Verification

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | {From phase plan} | ✅/❌ |

## Independent Quality Assessment

<!-- Findings from the skeptical pass — evaluating correctness independent of planning documents. -->

| Finding | Severity | Evidence | Suggestion |
|---------|----------|----------|------------|
| {What was found} | low/medium/high | {Concrete evidence from code} | {Specific fix or improvement} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance check." -->

## Cross-Task Issues

| # | Scope | Severity | Issue | Recommendation |
|---|-------|----------|-------|---------------|
| 1 | T1 ↔ T3 | minor | {Integration issue} | {Fix} |

## Test & Build Summary

- **Total tests**: {NUMBER} passing / {NUMBER} total
- **Build**: ✅ Pass / ❌ Fail
- **Coverage**: {X}% (if measurable)

## Recommendations for Next Phase

- {Recommendation 1}
