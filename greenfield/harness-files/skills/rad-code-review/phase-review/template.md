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

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED} — {one-line citation: either "no findings ≥ low severity; all audit rows on-track; all exit criteria met" or "F-N (status, severity)" and any unmet exit criterion}

## Summary

{2-3 sentences. Holistic assessment of the phase. Do NOT paraphrase the Phase Plan or per-task reviews. Describe what the cumulative diff shows across task seams.}

## Scope

<!-- Captures WHAT was reviewed and HOW it was scoped. Populated from workflow step 3. -->

- **Commit range under review**: `{phase_first_sha}..{phase_head_sha}` (or `null — auto-commit off`)
- **Diff command run**: `git diff <phase_first_sha>~1..<phase_head_sha>` (or `git diff HEAD` when either SHA is null)
- **`git diff --stat` output**:
  ```
  {Exact --stat output pasted verbatim. No approximations.}
  ```
- **Untracked files inspected**: `{list paths, or "N/A — auto-commit on"}`

## Test Execution

<!-- Captures THAT tests were run and WHAT they reported. Populated from workflow step 4. -->

- **Test command run**: `{exact command, e.g., "npm test"}`
- **Result**: {N}/{TOTAL} pass, {N} fail, {N} skipped
- **Named test output** (paste verbatim or the runner's summary showing each named test):
  ```
  {Actual captured output. "X tests pass" is NOT acceptable here.}
  ```
- **Build status**: ✅ Pass / ❌ Fail

## Per-Requirement Audit

<!-- One row per FR/NFR/AD/DD tag listed on the Phase Plan's **Requirements:** line.
     Status enum (phase scope): on-track | drift | regression.
       - on-track: the phase's cumulative contribution to this requirement is
         correct for what the phase's slice was supposed to deliver. Does NOT
         mean the requirement is complete project-wide — just that this
         phase's slice is correct. Still requires Evidence.
       - drift: the cumulative diff deviates from what the Phase Plan says the
         phase should deliver (cross-task contract drift, missing integration,
         etc.). Actioned by orchestrator mediation.
       - regression: the cumulative diff breaks something that previously
         worked. Actioned by orchestrator mediation; flagged critical.
     F-ID is stable across this review doc and shared with the Quality Sweep
     table. Numbering resets per review doc.
     Severity enum: low | medium | high | none.
     Evidence: quoted code, diff excerpt, test output, or grep result — never
     paraphrase. -->

| F-ID | Requirement | Status | Severity | File:Line | Evidence | Finding | Fix |
|------|-------------|--------|----------|-----------|----------|---------|-----|
| F-1 | FR-1 | on-track | none | `src/cli.js:40-48` | `{quoted code}` | {What this proves} | — |
| F-2 | FR-2 | drift | medium | `src/a.js:22`, `src/b.js:91` | `{producer vs consumer snippets}` | {What deviates across tasks} | {Concrete fix} |

## Task Results

| # | Task | Status | Retries | Key Outcome |
|---|------|--------|---------|-------------|
| T1 | {Title} | ✅ Complete | 0 | {One-line summary} |
| T2 | {Title} | ✅ Complete | 1 | {One-line summary} |
| T3 | {Title} | ⚠️ Partial | 2 | {One-line summary} |

## Exit Criteria Assessment

| # | Criterion | Verified | Evidence |
|---|-----------|----------|----------|
| 1 | {From phase plan} | ✅/❌ | `{File:Line or test name proving verification, or reason it is unverifiable}` |

## Integration Assessment

<!-- Aggregate health view. Per-requirement truth lives in the audit table above. -->

| Check | Status | Notes |
|-------|--------|-------|
| Modules integrate correctly | ✅/❌ | {Note} |
| No conflicting patterns | ✅/❌ | {Note} |
| Contracts honored across tasks | ✅/❌ | {Note} |
| No orphaned code | ✅/❌ | {Note} |

## Independent Quality Assessment

<!-- Findings from the quality sweep — evaluated against the cumulative diff
     WITH THE PHASE PLAN SET ASIDE. Lean checks (each must be itemized below,
     with evidence, even when clean): TODO/FIXME grep, diff-stat review,
     orphaned-scaffolding grep, decomposition / SRP, cross-task contract
     drift, conflicting patterns. F-IDs continue from the audit table.
     Seam / Scope identifies the cross-task boundary (e.g., T1↔T3, T2→T4) or
     the affected file(s) when within a single task's territory. -->

| F-ID | Severity | File:Line | Seam / Scope | Requirement | Evidence | Finding | Fix |
|------|----------|-----------|--------------|-------------|----------|---------|-----|
| F-3 | medium | `src/a.js:22`, `src/b.js:91` | T1→T3 | FR-2 | `{producer vs consumer snippets}` | {Contract drift across task seam} | {Specific fix} |

### Lean Quality Checks

<!-- Each check MUST be itemized with the command run and its output/result —
     even when clean. A single-sentence collapse ("no issues") is not acceptable. -->

- **TODO/FIXME scan**: Command `{grep -nE 'TODO|FIXME|HACK|XXX' <diff>}` → `{output or "no matches"}`
- **Diff stat review**: {Reference the `--stat` output in the Scope section; flag any file whose growth outpaces the phase's stated scope, or state "no file exceeds expected size"}
- **Orphaned scaffolding**: For each new export `{name}`, command `{grep -rn "{name}" <workspace>}` → `{N callers or "0 callers — dead-on-arrival"}`
- **Decomposition / SRP**: {Assessment per affected file, or "no file grew past reasonable density"}
- **Cross-task contract drift**: {Enumerate any producer→consumer contract pair you probed across task seams; cite the producer File:Line and consumer File:Line, or state "no consumer contradicts a producer across inspected seams"}
- **Conflicting patterns**: {Describe any divergent pattern between two tasks solving similar problems, or state "no conflicting patterns observed"}

### Falsification Paragraph

<!-- Mandatory even when there are zero findings. 2-4 sentences describing the
     cross-task evidence you actively looked for that would have flipped the
     verdict, and confirming whether you found it. -->

{Paragraph: which producer→consumer contracts you inspected, which new exports you grepped for, which patterns you compared across tasks, and whether any cross-task inconsistency emerged.}

## Files Changed (Phase Total)

| Action | Count | Key Files |
|--------|-------|-----------|
| Created | {NUMBER} | `{path}`, ... |
| Modified | {NUMBER} | `{path}`, ... |

## Issues & Resolutions

<!-- Task-scoped issues from the diff's commit history and how they were resolved
     (including through retries). Distinct from cross-task findings above. -->

| Issue | Severity | Task | Resolution |
|-------|----------|------|------------|
| {Issue} | low | T2 | Resolved via retry |

## Corrections Applied

<!-- EMPTY on first-time reviews. On corrective reviews, list what was fixed from the previous review and how. -->
<!-- Leave the section heading in place even when empty so the section is always findable. -->

## Carry-Forward Items

{Items the next phase must address. Empty list is fine.}

- {Item 1}

## Recommendations for Next Phase

<!-- Advisory recommendations for the next phase. Distinct from Carry-Forward Items (required handling).
     Do NOT prescribe work for tasks already planned in the next phase. -->

- {Recommendation 1}
