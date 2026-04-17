# Phase Review

Self-contained workflow for phase-level review (Action #11, `spawn_phase_reviewer`). Do not load other review docs — everything you need is below.

## Your Job

You are the backstop. Task reviews already vetted each commit in isolation against its own handoff. Four approved task reviews do not equal a green phase — task reviewers see their commit; you see all of them. Your unique value is what spans tasks: integration, contract drift at task boundaries, exports that never get imported, conflicting patterns across tasks. If the cumulative diff reveals something every task reviewer missed, that's on you to catch.

## Review Mindset

- Task reviews already vetted each commit in isolation. Your job is to see what they couldn't — the seams between tasks.
- Skepticism is required, not optional. Four green task reviews do not equal a green phase. Task reviewers see their commit; you see all of them.
- Every issue raised must include a concrete fix — never flag a problem without offering a path forward.
- Run the tests and verify the build yourself. "The phase report says tests pass" is not evidence.
- Use binary assessments for each finding: ✅ pass, ⚠️ concern, ❌ fail.

## Inputs

| Input | Source | Description |
|-------|--------|-------------|
| PRD | `{NAME}-PRD.md` | Product requirements being validated |
| Architecture | `{NAME}-ARCHITECTURE.md` | Contracts, module map, file structure |
| Design | `{NAME}-DESIGN.md` | Per-component layouts, interaction states, design tokens (if applicable) |
| Master Plan | `{NAME}-MASTER-PLAN.md` | Phase/task structure, exit criteria |
| Phase Plan | `{NAME}-PHASE-{NN}-{TITLE}.md` | Exit criteria, task outline |
| All Code Reviews | `{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` (all tasks) | Per-task review verdicts and issues |
| `phase_first_sha` | Spawn context | First task's initial commit. `null` when auto-commit is off. |
| `phase_head_sha` | Spawn context | Last committed SHA of the phase (corrective-aware). `null` when auto-commit is off. |
| Cumulative diff | `git diff <phase_first_sha>~1..<phase_head_sha>` (fallback: `git diff HEAD` + untracked files when either SHA is null) | Scope for the skeptical pass |
| Source Code | Files produced in this phase | Read only when the diff requires surrounding context |
| Previous Phase Review | `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` | Previous phase review (if corrective — may not exist) |

## Workflow

1. Read the Phase Plan — understand exit criteria and task outline.
2. **Run the cumulative phase diff.** If both `phase_first_sha` and `phase_head_sha` are present, run `git diff <phase_first_sha>~1..<phase_head_sha>`. If either is `null`, fall back to `git diff HEAD` and read any untracked files listed in the phase's Task Handoff File Targets. This diff is the scope for the skeptical pass.
3. Read all Code Reviews for this phase — understand individual task outcomes.
4. Run tests and verify the build passes — do not accept "tests passed" on faith.
5. **Corrective-review check**: If a previous Phase Review exists, read it to identify expected corrections. Deviations from the original plan that address issues in the previous phase review are expected corrections — do NOT flag them.
6. **Conformance pass**: The Phase Plan sets exit criteria — verify each one against what's actually checked in. If a criterion isn't verifiable from the current codebase, mark it failed; do not infer. Assess cross-task integration using the 4-category checklist (see categories below). Do NOT re-verify requirement conformance at task scope — task reviewers already did that. Your unique value is what spans tasks.
7. **Skeptical pass** (Independent Quality Assessment): Read the cumulative phase diff line by line. Don't trust that modules integrate because the code reviews say they do — the code reviews describe per-task intent, the diff shows how the tasks actually fit together. Your job is to find what slipped through the seams between tasks: contract drift where a later task's call site doesn't match an earlier task's new signature; exports that no other task imports; conflicting patterns where T1 and T3 solved similar problems differently. Read full files only when the diff alone is insufficient to confirm a finding.
8. Apply verdict rules (see Verdict Rules section below) — highest severity across both passes determines verdict. Set `exit_criteria_met` frontmatter field to `true` only when ALL exit criteria are verified as met; `false` otherwise.
9. Fill in the output template at [./template.md](./template.md) and save based on corrective status:
    - Normal (first-time): `{PROJECT-DIR}/reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md`
    - Corrective: `{PROJECT-DIR}/reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}-C{corrective_index}.md`

    The `-C{N}` suffix is appended immediately before `.md`. Read `corrective_index` from the event context — do not query the filesystem. The original (non-corrective) review is preserved, not overwritten. (See `rad-create-plans/references/phase-plan/workflow.md` lines 135–150 for the shared pattern.)

## Conformance Checklist Categories

- Integration (modules work together)
- Conflicts (no conflicting patterns)
- Contracts (honored across task boundaries)
- Orphaned code (no unused imports, dead code, leftover scaffolding)

## Code Smells

The following categories are starting points, not an exhaustive checklist. Look beyond these — novel issues are often the most important ones.

| Category | What to look for | Illustrative example |
|----------|-----------------|---------------------|
| Documentation drift | Code behavior does not match documentation | README says the function returns a list, but code returns a single item |
| Null/undefined gaps | Missing null checks on data from external sources | API response field assumed to exist without validation |
| Defensive coding gaps | Missing error handling at system boundaries | No try/catch on file I/O or network calls |
| Silent failures | Errors caught but not surfaced or logged | Empty catch block swallows exception |
| Hardcoded values | Magic numbers, embedded paths, inline config | `timeout = 5000` with no named constant or config |
| Race conditions | Shared state accessed without synchronization | Concurrent file writes to the same path |
| Security boundaries | Unsanitized input, leaked secrets, missing auth | User input concatenated directly into a SQL query |
| Dead code | Unreachable branches, unused exports or imports | Exported function never imported anywhere |
| Implicit coupling | Hidden dependencies between modules | Module A directly reads a file owned by Module B |
| Resource leaks | Opened handles, streams, or connections never closed | File stream opened in function but no cleanup on error path |
| Cross-task contract drift | A consumer in a later task doesn't match a producer's contract from an earlier task | T1 changes a function's return type to `Promise<T>`; T3 still awaits synchronously |
| Dead-on-arrival exports | Exports added in one task that no other task in the phase imports | T1 adds `export function helperX`; grep across T2–T4 diffs shows zero imports |
| Approved-but-integrated-wrong | Every task review was approved, but the cumulative diff reveals the tasks don't fit together | T1 returns ISO date strings; T3 parses dates expecting Unix timestamps — each task review passed against its own handoff |

## Corrective Review Context

A corrective review occurs when reviewing a submission that follows a previous review with a `changes_requested` verdict.

- **Previous review cross-reference**: Read the previous phase review document to identify which issues were raised and which deviations were explicitly requested.
- **Expected corrections rule**: Deviations from the original plan that directly address issues identified in the previous review are **expected corrections** — do NOT flag them as conformance failures.
- **New deviations rule**: Deviations unrelated to the previous review's issues should still be flagged normally through the standard conformance and skeptical passes.

## Quality Standards

- Code compiles and all tests pass — zero tolerance for build or test failures.
- No regressions in existing functionality.
- Error handling covers realistic failure modes, not just the happy path.
- Public APIs and exported interfaces are documented.
- No security vulnerabilities (injection, authentication gaps, exposed secrets).
- Code reviews are evidence, not verdict. A phase of approved task reviews does not mean the phase is approved. If the cumulative diff reveals something every task reviewer missed, that's on you to catch.

## Verdict Rules

The highest-severity finding across both passes (conformance + skeptical) determines the overall verdict.

| Verdict | When to Apply |
|---------|---------------|
| `approved` | No issues found, or only low-severity findings (cosmetic, style) |
| `changes_requested` | At least one medium-severity finding (functional issue, missing coverage) |
| `rejected` | At least one high-severity finding (security vulnerability, data loss risk, architectural violation) |

- Severity levels: **low** (cosmetic, style), **medium** (functional issue, missing coverage), **high** (security vulnerability, data loss risk, architectural violation). The `severity` frontmatter field records the highest finding severity across both passes, or `none` when no findings were raised.
- Skeptical-pass findings use the same severity levels as conformance findings and CAN escalate the verdict.
- During corrective reviews, deviations matching previous review issues are expected corrections and do not affect the verdict.

## Output

- **Template**: [./template.md](./template.md)
- **Save path**:
  - Normal: `{PROJECT-DIR}/reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md`
  - Corrective: `{PROJECT-DIR}/reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}-C{corrective_index}.md`
