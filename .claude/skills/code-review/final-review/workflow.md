# Final Review

Self-contained workflow for project-level final review (Action #6, `spawn_final_reviewer`). Do not load other review docs — everything you need is below.

## Review Mindset

- **The implementer's reports are not evidence.** Per-phase reviews describe per-phase intent. You review **the cumulative project diff**. Run the tests yourself. Open the files yourself. A green column of phase reviews does not mean the project is complete.
- Act as a professional code reviewer — focus on correctness, maintainability, and strict conformance to the project's requirements.
- Use binary assessments for checklist cells: ✅ pass, ⚠️ concern, ❌ fail. Use the strict status enum (`met | missing`) for per-requirement audit rows.
- Every finding must include a concrete fix — never flag a problem without offering a path forward.

## Inputs

Final Review reads only the inputs below. There is no PRD, Architecture, or Design document in the cheaper-execution pipeline (those upstream docs were deleted in iter-3). The Requirements doc is the complete conformance contract; the cumulative project diff is the scope for the skeptical pass.

| Input | Source | Description |
|-------|--------|-------------|
| Requirements | `{NAME}-REQUIREMENTS.md` | FR/NFR/AD/DD ledger. Source for the per-requirement audit table — every tag in the Requirements doc gets a row. |
| `project_base_sha` | Spawn context | First chronological commit across the project (first task's initial commit across all phases). `null` when auto-commit is off. |
| `project_head_sha` | Spawn context | Last committed SHA across the project (includes corrective commits at both task scope and phase scope). `null` when auto-commit is off. |
| Cumulative project diff | `git diff <project_base_sha>~1..<project_head_sha>` (fallback: `git diff HEAD` + untracked files when either SHA is null) | The actual change set under review — scope for both the conformance pass and the quality sweep. |
| `state.json` | Pipeline state file | Source for phase/task structure metadata used in the Phase Summary table. |
| Source files | Full project source tree | Read only when the cumulative diff requires surrounding context to verify a finding. |

## Workflow

1. **Read the Requirements doc** — enumerate every FR/NFR/AD/DD tag. Each one will get a row in the per-requirement audit table. At final scope, every requirement must be `met` or `missing`; there is no "on-track" intermediate state — the project is either complete against the requirement or it isn't.
2. **Run the cumulative project diff.** If both `project_base_sha` and `project_head_sha` are present, run `git diff <project_base_sha>~1..<project_head_sha>`. If either is `null` (auto-commit is off), fall back to `git diff HEAD` and read any untracked files in the project.
3. **Run the tests and verify the build.** Do not accept "tests passed" from any per-phase report on faith.
4. **Conformance pass (first)** — the strict per-requirement audit. For every FR/NFR/AD/DD tag in the Requirements doc, evaluate the cumulative project diff and write one audit-table row:
   - **`met`** — the cumulative project delivers this requirement in full. Concrete evidence exists in the diff or working tree.
   - **`missing`** — the cumulative project does not deliver this requirement, or delivers only a partial slice that does not satisfy the requirement's acceptance criteria.

   Use the 5-aspect architectural checklist (below) as a secondary aggregate view — the audit table is the per-requirement source of truth.

5. **Quality sweep (second)** — the Independent Quality Assessment. Evaluate project-level correctness independent of the planning docs (which describe intent, not correctness). Include a `Scope` column in findings to indicate affected phase(s) / module(s). Focus areas: bugs, edge cases, defensive gaps, documentation-code drift. Apply code-smell detection, security checks, and performance review without anchoring to the plan. **Lean quality checks**:
   - **TODO / FIXME scan** across the project tree.
   - **Diff stat** aggregated across all phases.
   - **Orphaned scaffolding / dead-on-arrival exports** across the project.
   - **Decomposition / file-size / single-responsibility** for any file that grew across multiple phases.
   - **Cross-phase integration** — contract drift across phase boundaries.

   Findings from this pass merge into the same table as conformance findings — highest severity wins.

6. **Apply verdict rules** (see Verdict Rules section below) — highest severity across both passes determines verdict. Verdict enum is unchanged: `approved | changes_requested | rejected`. A single `missing` requirement is a medium-severity finding at minimum.

7. **Fill in the output template** at [./template.md](./template.md) and save to `{PROJECT-DIR}/reports/{NAME}-FINAL-REVIEW.md`.

## Stateless Contract (Iter 10/11/12)

Final Review is **stateless**. You read the Requirements doc, the cumulative project diff, and `state.json`. You do not read any prior final review doc, prior orchestrator addendum, or prior corrective attempt. Final-review corrective cycles are not wired in iter-12 — the verdict you emit is strict and final. Treat the diff under review as the sole source of truth.

## Focus Areas

Secondary aggregate health view for the Architectural Integrity table in the template. The per-requirement audit is the primary source of truth.

- Architectural integrity (module boundaries, API contracts, data flow, error propagation, dependency graph)
- Requirement coverage
- Cross-phase integration
- Cumulative test & build health

## Code Smells

The following categories are starting points, not an exhaustive checklist. Look beyond these — novel issues are often the most important ones.

| Category | What to look for | Illustrative example |
|----------|-----------------|---------------------|
| Documentation drift | Code behaviour does not match documentation | README says the function returns a list, but code returns a single item |
| Null/undefined gaps | Missing null checks on data from external sources | API response field assumed to exist without validation |
| Defensive coding gaps | Missing error handling at system boundaries | No try/catch on file I/O or network calls |
| Silent failures | Errors caught but not surfaced or logged | Empty catch block swallows exception |
| Hardcoded values | Magic numbers, embedded paths, inline config | `timeout = 5000` with no named constant or config |
| Race conditions | Shared state accessed without synchronization | Concurrent file writes to the same path |
| Security boundaries | Unsanitized input, leaked secrets, missing auth | User input concatenated directly into a SQL query |
| Dead code | Unreachable branches, unused exports or imports | Exported function never imported anywhere |
| Implicit coupling | Hidden dependencies between modules | Module A directly reads a file owned by Module B |
| Resource leaks | Opened handles, streams, or connections never closed | File stream opened in function but no cleanup on error path |
| Cross-phase integration | Contract drift across phase boundaries | Phase 1 exposes `getColors(): string[]`; Phase 3's consumer awaits `Promise<string[]>` |
| Dead-on-arrival exports | Project-wide exports no caller imports | `export function helperX` added mid-project but never referenced anywhere |
| Decomposition / file-size | A single file accumulates scope across phases | A 30-line helper grows to 400 lines by the final phase |
| Single-responsibility | A module picks up orthogonal concerns across phases | Config module silently becomes the schema validator |
| TODO/FIXME left behind | Placeholder markers committed without follow-up | `// TODO: handle null case` with no tracking issue |

## Quality Standards

- Code compiles and all tests pass — zero tolerance for build or test failures.
- No regressions in existing functionality.
- Error handling covers realistic failure modes, not just the happy path.
- Public APIs and exported interfaces are documented.
- No security vulnerabilities (injection, authentication gaps, exposed secrets).

## Verdict Rules

The highest-severity finding across both passes (conformance + quality sweep) determines the overall verdict. Verdict enum is unchanged from prior iterations.

| Verdict | When to Apply |
|---------|---------------|
| `approved` | No issues found, or only low-severity findings (cosmetic, style), AND every requirement row is `met`. |
| `changes_requested` | At least one medium-severity finding (functional issue, missing coverage), OR at least one `missing` row in the audit table. |
| `rejected` | At least one high-severity finding (security vulnerability, data loss risk, architectural violation). |

- **Severity** levels: **low** (cosmetic, style), **medium** (functional issue, missing coverage), **high** (security vulnerability, data loss risk, architectural violation), **none** (no findings).
- **Status** semantics (audit table): `missing` always escalates the verdict to at least `changes_requested`.
- Quality-sweep findings use the same severity levels as conformance findings and CAN escalate the verdict.

## Output

- **Template**: [./template.md](./template.md)
- **Save path**: `{PROJECT-DIR}/reports/{NAME}-FINAL-REVIEW.md`
