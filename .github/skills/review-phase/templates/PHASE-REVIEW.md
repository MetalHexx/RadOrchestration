---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
exit_criteria_met: true             # REQUIRED boolean — true if all phase exit criteria verified, false otherwise
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Phase Review: Phase {N} — {PHASE-TITLE}

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

## Cross-Task Issues

| # | Scope | Severity | Issue | Recommendation |
|---|-------|----------|-------|---------------|
| 1 | T1 ↔ T3 | minor | {Integration issue} | {Fix} |

## Test & Build Summary

- **Total tests**: {N} passing / {N} total
- **Build**: ✅ Pass / ❌ Fail
- **Coverage**: {X}% (if measurable)

## Recommendations for Next Phase

- {Recommendation 1}
