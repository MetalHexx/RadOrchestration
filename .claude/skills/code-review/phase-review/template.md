---
project: "{PROJECT-NAME}"
phase: {PHASE-NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|low|medium|high"
exit_criteria_met: true
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Phase Review: Phase {PHASE-NUMBER} — {PHASE-TITLE}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

## Summary

{2-3 sentences. Holistic assessment of the phase.}

## Task Results

| # | Task | Status | Retries | Key Outcome |
|---|------|--------|---------|-------------|
| T1 | {Title} | ✅ Complete | 0 | {One-line summary} |
| T2 | {Title} | ✅ Complete | 1 | {One-line summary} |
| T3 | {Title} | ⚠️ Partial | 2 | {One-line summary} |

## Exit Criteria Assessment

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | {From phase plan} | ✅/❌ |

## Integration Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Modules integrate correctly | ✅/❌ | {Note} |
| No conflicting patterns | ✅/❌ | {Note} |
| Contracts honored across tasks | ✅/❌ | {Note} |
| No orphaned code | ✅/❌ | {Note} |

## Cross-Task Issues

| # | Scope | Severity | Issue | Recommendation |
|---|-------|----------|-------|---------------|
| 1 | T1 ↔ T3 | low/medium/high | {Integration issue} | {Fix} |

## Independent Quality Assessment

<!-- Findings from the skeptical pass — evaluating correctness independent of planning documents. -->

| Finding | Severity | Evidence | Suggestion |
|---------|----------|----------|------------|
| {What was found} | low/medium/high | {Concrete evidence from code} | {Specific fix or improvement} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance check." -->

## Files Changed (Phase Total)

| Action | Count | Key Files |
|--------|-------|-----------|
| Created | {NUMBER} | `{path}`, ... |
| Modified | {NUMBER} | `{path}`, ... |

## Issues & Resolutions

<!-- Task-scoped issues from the Code Reviews and how they were resolved (including through retries).
     Distinct from Cross-Task Issues (integration-seam-specific) above. -->

| Issue | Severity | Task | Resolution |
|-------|----------|------|------------|
| {Issue} | minor | T2 | Resolved via retry |

## Test & Build Summary

- **Total tests**: {NUMBER} passing / {NUMBER} total
- **Build**: ✅ Pass / ❌ Fail
- **Coverage**: {X}% (if measurable)

## Corrections Applied

<!-- EMPTY on first-time reviews. On corrective reviews, list what was fixed from the previous review and how. -->
<!-- Leave the section heading in place even when empty so the section is always findable. -->

## Carry-Forward Items

{Items the next phase must address. Empty list is fine.}

- {Item 1}

## Master Plan Adjustment Recommendations

{Does the reviewer recommend adjusting the master plan based on what was learned? Empty list is fine.}

- {Recommendation 1}

## Recommendations for Next Phase

<!-- Advisory recommendations for the next phase. Distinct from Carry-Forward Items (required handling). -->

- {Recommendation 1}
