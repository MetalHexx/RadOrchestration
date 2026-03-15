```markdown
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Code Review: Phase {N}, Task {N} — {TASK-TITLE}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

## Summary

{2-3 sentences. Overall assessment.}

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅/⚠️/❌ | {Brief note} |
| Design consistency | ✅/⚠️/❌ | {Brief note} |
| Code quality | ✅/⚠️/❌ | {Brief note} |
| Test coverage | ✅/⚠️/❌ | {Brief note} |
| Error handling | ✅/⚠️/❌ | {Brief note} |
| Accessibility | ✅/⚠️/❌ | {Brief note} |
| Security | ✅/⚠️/❌ | {Brief note} |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `{path}` | {lines} | minor/critical | {Issue} | {Fix suggestion} |

## Positive Observations

- {What was done well}

## Recommendations

- {Recommendation for next task or Planner action}
