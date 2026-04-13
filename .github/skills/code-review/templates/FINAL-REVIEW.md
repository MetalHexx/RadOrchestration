---
project: "{PROJECT-NAME}"
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Final Review: {PROJECT-NAME}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

{One-line rationale.}

## Summary

{3-5 sentences. Overall project assessment covering scope delivery, architectural quality, test health, and readiness for merge.}

## Architectural Integrity

<!-- During corrective reviews, deviations matching previous review items are expected corrections and should not be flagged. -->

| Aspect | Status | Notes |
|--------|--------|-------|
| Module boundaries | ✅/⚠️/❌ | {Assessment} |
| API contracts | ✅/⚠️/❌ | {Assessment} |
| Data flow | ✅/⚠️/❌ | {Assessment} |
| Error propagation | ✅/⚠️/❌ | {Assessment} |
| Dependency graph | ✅/⚠️/❌ | {Assessment} |

## Requirement Coverage

<!-- Evaluate every requirement from the PRD. Each row should map to a specific requirement. -->

| Requirement | Covered? | Evidence | Notes |
|-------------|----------|----------|-------|
| {Requirement from PRD} | ✅/❌ | {Where/how it is implemented} | {Any caveats} |

## Cross-Phase Integration

| Phase Boundary | Status | Issues |
|----------------|--------|--------|
| Phase 1 → Phase 2 | ✅/⚠️/❌ | {Integration issues or "None"} |
| Phase 2 → Phase 3 | ✅/⚠️/❌ | {Integration issues or "None"} |

## Cumulative Test & Build Health

- **Total tests**: {NUMBER} passing / {NUMBER} total
- **Build**: ✅ Pass / ❌ Fail
- **Coverage**: {X}% (if measurable)

## Independent Quality Assessment

<!-- Findings from the skeptical pass — evaluating correctness independent of planning documents. -->
<!-- The Scope column indicates which phase(s)/module(s) are affected by each finding. -->

| Finding | Severity | Scope | Evidence | Suggestion |
|---------|----------|-------|----------|------------|
| {What was found} | none/minor/critical | {Phase(s)/module(s) affected} | {Concrete evidence} | {Specific fix} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance checks." -->

## Phase Review Summary

| Phase | Verdict | Key Issues | Carry-Forward Items |
|-------|---------|------------|---------------------|
| {Phase N} | approved/changes_requested/rejected | {Summary of key issues} | {Items carried forward} |

## Recommendations

- {Recommendation for the human approver}
- {Additional recommendation}
- {Additional recommendation}