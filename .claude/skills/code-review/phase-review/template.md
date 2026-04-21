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

## Per-Requirement Audit

<!-- One row per FR/NFR/AD/DD tag listed on the Phase Plan's **Requirements:** line.
     Status enum (phase scope): on-track | drift | regression.
       - on-track: the phase's cumulative contribution to this requirement is
         correct for what the phase's slice was supposed to deliver. Does NOT
         mean the requirement is complete project-wide — just that this
         phase's slice is correct.
       - drift: the cumulative diff deviates from what the Phase Plan says the
         phase should deliver (cross-task contract drift, missing integration,
         etc.). Actioned by orchestrator mediation.
       - regression: the cumulative diff breaks something that previously
         worked. Actioned by orchestrator mediation; flagged critical.
     Severity enum: low | medium | high | none. -->

| Requirement ID | Status | Severity | Finding | Fix Proposal |
|----------------|--------|----------|---------|--------------|
| FR-1 | on-track | none | {Brief note or "—"} | {Brief note or "—"} |
| FR-2 | drift | medium | {What deviates across tasks} | {Concrete fix} |

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

<!-- Aggregate health view. Per-requirement truth lives in the audit table above. -->

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

<!-- Findings from the quality sweep — evaluated against the cumulative diff,
     not the per-task reviews. The implementer's reports are not evidence.
     Lean checks: TODO/FIXME grep, diff-stat aggregation, orphaned scaffolding
     / dead-on-arrival exports, decomposition / file-size / SRP, cross-task
     contract drift, conflicting patterns. -->

| Finding | Severity | Evidence | Suggestion |
|---------|----------|----------|------------|
| {What was found} | low/medium/high | {Concrete evidence from the cumulative diff} | {Specific fix or improvement} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance check." -->

## Files Changed (Phase Total)

| Action | Count | Key Files |
|--------|-------|-----------|
| Created | {NUMBER} | `{path}`, ... |
| Modified | {NUMBER} | `{path}`, ... |

## Issues & Resolutions

<!-- Task-scoped issues from the diff's commit history and how they were resolved
     (including through retries). Distinct from Cross-Task Issues (integration-
     seam-specific) above. -->

| Issue | Severity | Task | Resolution |
|-------|----------|------|------------|
| {Issue} | low | T2 | Resolved via retry |

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

## Recommendations for Next Phase

<!-- Advisory recommendations for the next phase. Distinct from Carry-Forward Items (required handling). -->

- {Recommendation 1}
