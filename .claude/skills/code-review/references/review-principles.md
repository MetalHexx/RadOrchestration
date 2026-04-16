# Review Principles

## Review Mindset

- Skepticism is required, not optional. Reviewers who assume good work miss real bugs.
- Every issue raised must include a concrete fix — never flag a problem without offering a path forward.
- Run the tests and verify the build yourself; do not accept "tests passed" on faith.
- Before recommending a new feature, test, or abstraction, verify it's actually needed. Grep the codebase for real usage. Don't invent work.
- Use binary assessments for each finding: ✅ pass, ⚠️ concern, ❌ fail.

## Dual-Pass Approach

### Conformance Pass

- **Task Review**: Compare the implementation against the **Task Handoff**. The handoff inlines every FR-N, NFR-N, AD-N, and DD-N element that applies to this task — it is the complete conformance contract. Do not load the PRD, Architecture, Design, or Master Plan for task-scope conformance.
- **Phase Review / Final Review**: Compare against the Phase Plan (phase mode) or Master Plan + PRD (final mode) per the inputs listed for those modes in SKILL.md.
- Core question: "Did we build what we intended?"
- Focus areas: completeness, adherence to contracts and interfaces, requirement fulfillment.
- Flag missing deliverables, skipped steps, and deviations from the specified design.

### Skeptical Pass (Independent Quality Assessment)

- **Scope (Task Review)**: Read the diff. When a `head_sha` is provided in spawn context, run `git diff <head_sha>~1..<head_sha>`. Otherwise, `git diff HEAD` plus any untracked files in the Task Handoff's File Targets.
- Read the diff line by line. Don't trust that it works because the handoff says it should — the handoff describes intent, the diff shows reality.
- Your job is to find what the implementer missed: bugs, edge cases, silent failures, defensive gaps. Apply code-smell detection without anchoring to the plan.
- Read full files only when the diff requires surrounding context.
- Core question: "Is what we built correct?"

## Corrective Review Context

A corrective review occurs when reviewing a submission that follows a previous review with a `changes_requested` verdict. This guidance applies identically to all review modes (task, phase, final).

- **Previous review cross-reference**: Read the previous review document (and corrective task handoff, when present in task mode) to identify which issues were raised and which deviations were explicitly requested
- **Expected corrections rule**: Deviations from the original plan that directly address issues identified in the previous review are **expected corrections** — do NOT flag them as conformance failures
- **New deviations rule**: Deviations unrelated to the previous review's issues should still be flagged normally through the standard conformance and skeptical passes

## Quality Standards

- Code compiles and all tests pass — zero tolerance for build or test failures
- No regressions in existing functionality
- Error handling covers realistic failure modes, not just the happy path
- Public APIs and exported interfaces are documented
- No security vulnerabilities (injection, authentication gaps, exposed secrets)

## Verdict Application

- **Severity levels**: low (cosmetic, style), medium (functional issue, missing coverage), high (security vulnerability, data loss risk, architectural violation)
- **Verdict mapping summary**: The highest-severity finding across both passes (conformance + skeptical) determines the overall verdict
- **Skeptical findings rule**: Findings from the skeptical pass use the same severity levels as conformance findings and CAN escalate the overall verdict
- The detailed verdict table (approved / changes_requested / rejected criteria) is defined in the code-review SKILL.md — not duplicated here.
