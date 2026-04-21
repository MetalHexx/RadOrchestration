# Task Review

Self-contained workflow for task-level code review (Action #6, `spawn_code_reviewer`). Do not load other review docs — everything you need is below.

## Review Mindset

- Skepticism is required, not optional. Reviewers who assume good work miss real bugs.
- Every issue raised must include a concrete fix — never flag a problem without offering a path forward.
- Run the tests and verify the build yourself; do not accept "tests passed" on faith.
- Before recommending a new feature, test, or abstraction, verify it's actually needed. Grep the codebase for real usage. Don't invent work.
- Use binary assessments for each finding: ✅ pass, ⚠️ concern, ❌ fail.

## Inputs

Task Review reads only the inputs below — do NOT load the PRD, Architecture, Design, or Master Plan. The Task Handoff is the complete conformance contract; the diff is the scope for the skeptical pass.

| Input | Source | Description |
|-------|--------|-------------|
| Task Handoff | `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | Task requirements, contracts, acceptance criteria (complete conformance contract) |
| `head_sha` | Spawn context | Commit hash of the just-made task commit. `null` when `source_control.auto_commit` is `never`. |
| Diff | `git diff <head_sha>~1..<head_sha>` (or `git diff HEAD` + untracked files when `head_sha` is null) | The actual change under review — scope for the skeptical pass |
| Source files | Files listed in Task Handoff's File Targets | Read only when the diff requires surrounding context |

## Workflow

1. Read the Task Handoff — this is the complete conformance contract. Every FR-N, NFR-N, AD-N, and DD-N element that applies to this task is inlined there. Do not load other planning documents.
2. **Scope the diff**: if `head_sha` is provided in spawn context, run `git diff <head_sha>~1..<head_sha>`. Otherwise (auto-commit is off) run `git diff HEAD` and read any untracked files listed in the Task Handoff's File Targets.
3. Run tests and verify the build passes — do not accept "tests passed" on faith.
4. **Conformance pass**: Compare the implementation against the Task Handoff using the 7-category checklist (see categories below). Core question: "Did we build what we intended?" Verify that the implementation satisfies the FR-N, NFR-N, AD-N, and DD-N elements inlined in the Task Handoff. Read full files from File Targets when the diff alone is insufficient to confirm conformance (e.g., to verify an export survived or a signature is still correct).
5. **Skeptical pass** (Independent Quality Assessment): Read the diff line by line. Don't trust that it works because the handoff says it should — the handoff describes intent, the diff shows reality. Find what the implementer missed: bugs, edge cases, silent failures, defensive gaps. Apply code-smell detection without anchoring to the plan. Read full files only when the diff requires surrounding context.
6. Apply verdict rules (see Verdict Rules section below) — highest severity across both passes determines verdict.
7. Fill in the output template at [./template.md](./template.md) and save based on corrective status:
    - Normal (first-time): `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md`
    - Corrective: `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}-C{corrective_index}.md`

    The `-C{N}` suffix is appended immediately before `.md`. Read `corrective_index` from the event context — do not query the filesystem. The original (non-corrective) review is preserved, not overwritten. (See `orchestration/references/document-conventions.md` → "Corrective Filename Suffix" for the shared pattern.)

## Conformance Checklist Categories

- Architectural consistency
- Design consistency
- Code quality
- Test coverage
- Error handling
- Accessibility
- Security

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
| Scope creep | Changes touching files outside the Task Handoff's File Targets | Edit to an unrelated helper "while I was there" |
| Undocumented diff | Lines changed without a purpose tied to the task objective | Refactor of formatting or naming mixed into a functional change |

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

## Output

- **Template**: [./template.md](./template.md)
- **Save path**:
  - Normal: `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md`
  - Corrective: `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}-C{corrective_index}.md`
