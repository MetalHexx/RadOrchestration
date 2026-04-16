# Final Review

Self-contained workflow for project-level final review (Action #12, `spawn_final_reviewer`). Do not load other review docs — everything you need is below.

## Review Mindset

- Act as a professional code reviewer — focus on correctness, maintainability, and conformance to the plan.
- Use binary assessments for each finding: ✅ pass, ⚠️ concern, ❌ fail.
- Every issue raised must include a concrete suggestion for how to fix it — never flag a problem without offering a path forward.
- Run actual tests and verify the build — do not assume they pass.

## Inputs

| Input | Source | Description |
|-------|--------|-------------|
| PRD | `{NAME}-PRD.md` | Product requirements being validated |
| Architecture | `{NAME}-ARCHITECTURE.md` | Contracts, module map, file structure |
| Design | `{NAME}-DESIGN.md` | Per-component layouts, interaction states, design tokens (if applicable) |
| Master Plan | `{NAME}-MASTER-PLAN.md` | Phase/task structure, exit criteria |
| All Phase Reviews | `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` (all phases) | Phase verdicts, cross-task issues, carry-forward items |
| Source Code | All project source files | Full codebase to review |
| Previous Final Review | `{NAME}-FINAL-REVIEW.md` | Previous final review (if corrective — may not exist) |

## Workflow

1. Read the Master Plan — understand the full project scope and phase structure.
2. Read all Phase Reviews — understand per-phase outcomes and carry-forward items.
3. Read the full codebase produced by the project.
4. **Corrective-review check**: If a previous Final Review exists, read it to identify expected corrections. Deviations from the original plan that address issues in the previous final review are expected corrections — do NOT flag them.
5. **Conformance pass**: Assess architectural integrity (5-aspect checklist — see below), requirement coverage (from PRD), cross-phase integration, and cumulative test/build health. Core question: "Did we build what we intended?"
6. **Skeptical pass** (Independent Quality Assessment):
   - Evaluate project-level correctness independent of planning documents.
   - Include `Scope` column in findings to indicate affected phase(s)/module(s).
   - Core question: "Is what we built correct?"
   - Focus areas: bugs, edge cases, defensive gaps, documentation-code drift.
   - Planning documents describe intent but may contain errors — use them as context for what was intended, not as ground truth for what is correct.
   - Apply code-smell detection, security checks, and performance review without anchoring to the plan.
7. Apply verdict rules (see Verdict Rules section below) — highest severity across both passes determines verdict.
8. Fill in the output template at [./template.md](./template.md) and save to `{PROJECT-DIR}/{NAME}-FINAL-REVIEW.md`.

## Focus Areas

- Architectural integrity (module boundaries, API contracts, data flow, error propagation, dependency graph)
- Requirement coverage
- Cross-phase integration
- Cumulative test & build health

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

## Corrective Review Context

A corrective review occurs when reviewing a submission that follows a previous review with a `changes_requested` verdict.

- **Previous review cross-reference**: Read the previous final review document to identify which issues were raised and which deviations were explicitly requested.
- **Expected corrections rule**: Deviations from the original plan that directly address issues identified in the previous review are **expected corrections** — do NOT flag them as conformance failures.
- **New deviations rule**: Deviations unrelated to the previous review's issues should still be flagged normally through the standard conformance and skeptical passes.

## Quality Standards

- Code compiles and all tests pass — zero tolerance for build or test failures.
- No regressions in existing functionality.
- Error handling covers realistic failure modes, not just the happy path.
- Public APIs and exported interfaces are documented.
- No security vulnerabilities (injection, authentication gaps, exposed secrets).

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
- **Save path**: `{PROJECT-DIR}/{NAME}-FINAL-REVIEW.md`
