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

## Verdict: {APPROVED | CHANGES REQUESTED | REJECTED} — {one-line citation: either "no findings ≥ low severity; all audit rows on-track" or "F-N (status, severity)" naming the driving finding(s)}

## Summary

{2-3 sentences. Overall assessment. Do NOT paraphrase the Task Handoff's Execution Notes or prescribed content. Describe what the diff shows, not what the handoff prescribed.}

## Scope

<!-- Captures WHAT was reviewed and HOW it was scoped. Populated from workflow step 2. -->

- **Commit under review**: `{head_sha}` (or `null — auto-commit off`)
- **Diff command run**: `git diff <head_sha>~1..<head_sha>` (or `git diff HEAD` when SHA is null)
- **`git diff --stat` output**:
  ```
  {Exact --stat output pasted verbatim. No approximations, no "~14 lines".}
  ```
- **Untracked files inspected**: `{list paths, or "N/A — auto-commit on"}`
- **File Targets gate** (from Task Handoff):
  - Declared targets: `{path1}`, `{path2}`, ...
  - Targets modified as declared: ✅ / ❌ {if ❌, list which ones were not modified — each becomes a finding}
  - Files modified outside declared targets: ✅ none / ❌ `{path}` {each out-of-scope file is a scope-creep finding}

## Test Execution

<!-- Captures THAT tests were run and WHAT they reported. Populated from workflow step 4. -->

- **Test command run**: `{exact command, e.g., "npm test"}`
- **Result**: {N}/{TOTAL} pass, {N} fail, {N} skipped
- **Named test output** (paste verbatim or the runner's summary showing each named test):
  ```
  {Actual captured output showing named tests — e.g., "✔ colorize > wraps chars", "✔ cli > positional argument …". "8 tests pass" is NOT acceptable here.}
  ```
- **Build status**: ✅ Pass / ❌ Fail {if fail, paste the error}

## Per-Requirement Audit

<!-- One row per FR/NFR/AD/DD tag inlined in the Task Handoff.
     Status enum (task scope): on-track | drift | regression.
       - on-track: the diff's contribution to this requirement is correct for
         what the task's slice was supposed to deliver. Does NOT mean the
         requirement is complete project-wide — just that this task's slice
         is correct. Still requires Evidence — a file range or code quote
         proving the slice is correct.
       - drift: the diff deviates from what the Task Handoff says the task
         should deliver. Actioned by orchestrator mediation.
       - regression: the diff breaks something that previously worked.
         Actioned by orchestrator mediation; flagged critical.
     F-ID is stable across this review doc and shared with the Quality Sweep
     table. Numbering resets per review doc (corrective reviews start at F-1).
     Severity enum: low | medium | high | none.
     Evidence: quoted code, diff excerpt, test output, or grep result — never
     paraphrase. Use "—" only for on-track rows where the evidence is the
     absence of drift across the File:Line range cited. -->

| F-ID | Requirement | Status | Severity | File:Line | Evidence | Finding | Fix |
|------|-------------|--------|----------|-----------|----------|---------|-----|
| F-1 | FR-1 | on-track | none | `src/cli.js:40-48` | `{quoted code snippet or diff line}` | {What this proves} | — |
| F-2 | FR-2 | drift | medium | `src/cli.js:22` | `{quoted code contradicting handoff}` | {What deviates} | {Concrete fix} |

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

<!-- Findings from the quality sweep — evaluated against the diff WITH THE HANDOFF
     SET ASIDE. Lean checks (each must be itemized below, with evidence, even
     when clean): TODO/FIXME grep, diff-stat review, orphaned-scaffolding grep,
     decomposition / file-size / SRP. F-IDs continue from the audit table.
     Requirement column is optional (use "—" when the finding is genuinely
     unbounded to a specific requirement). -->

| F-ID | Severity | File:Line | Requirement | Evidence | Finding | Fix |
|------|----------|-----------|-------------|----------|---------|-----|
| F-3 | low | `src/cli.js:60` | — | `{quoted code or grep result}` | {What was found} | {Specific fix} |

### Lean Quality Checks

<!-- Each check MUST be itemized with the command run and its output/result —
     even when clean. A single-sentence collapse ("no issues") is not acceptable. -->

- **TODO/FIXME scan**: Command `{grep -nE 'TODO|FIXME|HACK|XXX' <diff or file list>}` → `{output or "no matches"}`
- **Diff stat review**: {Reference the `--stat` output in the Scope section; flag any disproportionate file, or state "no file exceeds expected size for stated scope"}
- **Orphaned scaffolding**: For each new export `{name}`, command `{grep -rn "{name}" <workspace>}` → `{output: N callers or "0 callers — dead-on-arrival"}`
- **Decomposition / SRP**: {Assessment per affected file, or "no file grew past reasonable density"}

### Falsification Paragraph

<!-- Mandatory even when there are zero findings. 2-4 sentences describing the
     evidence you actively looked for that would have flipped the verdict, and
     confirming whether you found it. This is your independence declaration. -->

{Paragraph: what null-handling gaps, silent failures, error paths, contract mismatches, or test-coverage holes you specifically probed; which lines/functions you inspected; and whether you found any. Do NOT substitute a generic "I looked carefully" — be specific about what you probed.}

## Positive Observations

<!-- OPTIONAL and GATED. A positive observation MUST describe behavior that
     exceeded the task's acceptance criteria — NOT behavior that merely met
     them, and NEVER behavior deferred to a later task reframed as "graceful
     degradation". If you cannot write a positive that meets this bar, omit
     the section entirely. -->

- {What was done that exceeds the criteria.}

## Recommendations

<!-- Limited to (a) follow-ups that fix issues this task left behind, or (b)
     notes the Planner should act on. Do NOT prescribe work for future tasks
     that are already planned — the plan is the plan's job. If there are no
     recommendations in scope, omit the section. -->

- {Recommendation.}

## Files Reviewed
<!-- Optional. Omit this section entirely if not applicable. -->

| File | Notes |
|------|-------|
| `{path/to/file}` | {brief phrase} |
