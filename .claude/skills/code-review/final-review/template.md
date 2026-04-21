---
project: "{PROJECT-NAME}"
verdict: "approved|changes_requested|rejected"
severity: "none|low|medium|high"
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Final Review: {PROJECT-NAME}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED}

{One-line rationale.}

## Summary

{3-5 sentences. Overall project assessment covering scope delivery, architectural quality, test health, and readiness for merge.}

## Per-Requirement Audit

<!-- One row per FR/NFR/AD/DD tag in {NAME}-REQUIREMENTS.md.
     Status enum (final scope, strict): met | missing.
       - met: the cumulative project delivers this requirement in full.
         Concrete evidence exists in the diff or working tree.
       - missing: the cumulative project does not deliver this requirement,
         or delivers only a partial slice that does not satisfy the
         requirement's acceptance criteria.
     Severity enum: low | medium | high | none. A `missing` requirement is a
     medium-severity finding at minimum. -->

| Requirement ID | Status | Severity | Evidence | Notes |
|----------------|--------|----------|----------|-------|
| FR-1 | met | none | `src/foo.ts` implements the contract | — |
| NFR-2 | missing | medium | No implementation found in cumulative diff | Needs a handoff or corrective pass |

## Architectural Integrity

| Aspect | Status | Notes |
|--------|--------|-------|
| Module boundaries | ✅/⚠️/❌ | {Assessment} |
| API contracts | ✅/⚠️/❌ | {Assessment} |
| Data flow | ✅/⚠️/❌ | {Assessment} |
| Error propagation | ✅/⚠️/❌ | {Assessment} |
| Dependency graph | ✅/⚠️/❌ | {Assessment} |

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

<!-- Findings from the quality sweep — evaluated against the cumulative project
     diff, not the per-phase reviews. The implementer's reports are not
     evidence. Scope column indicates affected phase(s)/module(s). -->

| Finding | Severity | Scope | Evidence | Suggestion |
|---------|----------|-------|----------|------------|
| {What was found} | low/medium/high | {Phase(s)/module(s) affected} | {Concrete evidence from the cumulative diff} | {Specific fix} |

<!-- If no independent findings, replace the table with: "No issues found beyond conformance checks." -->

## Phase Review Summary

| Phase | Verdict | Key Issues | Carry-Forward Items |
|-------|---------|------------|---------------------|
| {Phase N} | approved/changes_requested/rejected | {Summary of key issues} | {Items carried forward} |

## Recommendations

- {Recommendation for the human approver}
- {Additional recommendation}
- {Additional recommendation}
