---
project: "{PROJECT-NAME}"
verdict: "approved|changes_requested|rejected"
severity: "none|low|medium|high"
author: "reviewer-agent"
created: "{ISO-DATE}"
---

# Final Review: {PROJECT-NAME}

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED} — {one-line citation: either "no findings ≥ low severity; all audit rows met" or "F-N (severity)" and any missing requirement IDs}

## Summary

{3-5 sentences. Overall project assessment covering scope delivery, architectural quality, test health, and readiness for merge. Do NOT paraphrase the Requirements doc or per-phase reviews.}

## Scope

<!-- Captures WHAT was reviewed and HOW it was scoped. Populated from workflow step 2. -->

- **Commit range under review**: `{project_base_sha}..{project_head_sha}` (or `null — auto-commit off`)
- **Diff command run**: `git diff <project_base_sha>~1..<project_head_sha>` (or `git diff HEAD` when either SHA is null)
- **`git diff --stat` output**:
  ```
  {Exact --stat output pasted verbatim. No approximations.}
  ```
- **Untracked files inspected**: `{list paths, or "N/A — auto-commit on"}`

## Per-Requirement Audit

<!-- One row per FR/NFR/AD/DD tag in {NAME}-REQUIREMENTS.md.
     Status enum (final scope, strict): met | missing.
       - met: the cumulative project delivers this requirement in full.
         Concrete evidence exists in the diff or working tree. Cite quoted
         code, a test name, or a file range — not paraphrase.
       - missing: the cumulative project does not deliver this requirement,
         or delivers only a partial slice that does not satisfy the
         requirement's acceptance criteria.
     F-ID is stable across this review doc and shared with the Quality Sweep
     table. Severity enum: low | medium | high | none. A `missing` requirement
     is a medium-severity finding at minimum.
     Evidence: quoted code, diff excerpt, or test name — never paraphrase. -->

| F-ID | Requirement | Status | Severity | File:Line | Evidence | Notes |
|------|-------------|--------|----------|-----------|----------|-------|
| F-1 | FR-1 | met | none | `src/foo.ts:12-40` | `{quoted code or test name proving the contract}` | — |
| F-2 | NFR-2 | missing | medium | — | No implementation found in cumulative diff | Needs a handoff or corrective pass |

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

- **Test command run**: `{exact command, e.g., "npm test"}`
- **Result**: {N}/{TOTAL} pass, {N} fail, {N} skipped
- **Named test output** (paste verbatim or the runner's summary showing each named test):
  ```
  {Actual captured output. "X tests pass" is NOT acceptable here.}
  ```
- **Build status**: ✅ Pass / ❌ Fail
- **Coverage**: {X}% (if measurable)

## Independent Quality Assessment

<!-- Findings from the quality sweep — evaluated against the cumulative project
     diff WITH THE REQUIREMENTS DOC SET ASIDE. Lean checks (each must be
     itemized below, with evidence, even when clean): TODO/FIXME grep,
     diff-stat review, orphaned-scaffolding grep, decomposition / SRP,
     cross-phase contract drift. F-IDs continue from the audit table.
     Scope indicates affected phase(s) / module(s). -->

| F-ID | Severity | File:Line | Scope | Evidence | Finding | Fix |
|------|----------|-----------|-------|----------|---------|-----|
| F-3 | medium | `src/a.ts:40`, `src/b.ts:120` | P1→P3 | `{producer vs consumer snippets}` | {Cross-phase contract drift} | {Specific fix} |

### Lean Quality Checks

<!-- Each check MUST be itemized with the command run and its output/result —
     even when clean. A single-sentence collapse ("no issues") is not acceptable. -->

- **TODO/FIXME scan**: Command `{grep -rnE 'TODO|FIXME|HACK|XXX' <project>}` → `{output or "no matches"}`
- **Diff stat review**: {Reference the `--stat` output in the Scope section; flag any file accumulating disproportionate scope across phases, or state "no file exceeds expected size"}
- **Orphaned scaffolding**: For each new export `{name}`, command `{grep -rn "{name}" <project>}` → `{N callers or "0 callers — dead-on-arrival"}`
- **Decomposition / SRP**: {Assessment per multi-phase-touched file, or "no file grew past reasonable density"}
- **Cross-phase integration**: {Enumerate producer→consumer contract pairs you probed across phase boundaries; cite File:Line, or state "no consumer contradicts a producer across inspected boundaries"}

### Falsification Paragraph

<!-- Mandatory even when there are zero findings. 2-4 sentences describing the
     project-level evidence you actively looked for that would have surfaced a
     missing requirement or cross-phase defect, and confirming whether you
     found it. -->

{Paragraph: which requirements you stress-tested against the working tree, which cross-phase contracts you inspected, and whether any gap or drift emerged.}

## Phase Review Summary

| Phase | Verdict | Key Issues | Carry-Forward Items |
|-------|---------|------------|---------------------|
| {Phase N} | approved/changes_requested/rejected | {Summary of key issues} | {Items carried forward} |

## Recommendations

- {Recommendation for the human approver}
- {Additional recommendation}
- {Additional recommendation}
