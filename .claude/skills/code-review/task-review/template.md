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

## Per-Requirement Audit

<!-- One row per FR/NFR/AD/DD tag inlined in the Task Handoff.
     Status enum (task scope): on-track | drift | regression.
       - on-track: the diff's contribution to this requirement is correct for
         what the task's slice was supposed to deliver. Does NOT mean the
         requirement is complete project-wide — just that this task's slice
         is correct.
       - drift: the diff deviates from what the Task Handoff says the task
         should deliver. Actioned by orchestrator mediation.
       - regression: the diff breaks something that previously worked.
         Actioned by orchestrator mediation; flagged critical.
     Severity enum: low | medium | high | none. -->

| Requirement ID | Status | Severity | Finding | Fix Proposal |
|----------------|--------|----------|---------|--------------|
| FR-1 | on-track | none | {Brief note or "—"} | {Brief note or "—"} |
| FR-2 | drift | medium | {What deviates} | {Concrete fix} |

## Conformance Checklist

<!-- Aggregate health view. Per-requirement truth lives in the audit table above. -->

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

<!-- Findings from the quality sweep — evaluated against the diff, not the plan.
     Lean checks: TODO/FIXME grep, diff-stat, orphaned scaffolding, decomposition /
     file-size / single-responsibility. Remember: the implementer's report is not
     evidence. The diff is. -->

| Finding | Severity | Evidence | Suggestion |
|---------|----------|----------|------------|
| {What was found} | low/medium/high | {Concrete evidence from the diff} | {Specific fix or improvement} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance check." -->

## Issues Found

<!-- Merged view of conformance + quality-sweep findings with file/line context.
     Highest severity across both passes wins for the overall verdict. -->

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
