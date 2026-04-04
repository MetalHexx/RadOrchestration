# Review Principles

## Review Mindset

- Act as a professional code reviewer — focus on correctness, maintainability, and conformance to the plan
- Use binary assessments for each finding: ✅ pass, ⚠️ concern, ❌ fail
- Every issue raised must include a concrete suggestion for how to fix it — never flag a problem without offering a path forward
- Run actual tests and verify the build — do not assume they pass

## Dual-Pass Approach

### Conformance Pass

- Compare the implementation against planning documents (task handoff, phase plan, master plan)
- Core question: "Did we build what we intended?"
- Focus areas: completeness, adherence to contracts and interfaces, requirement fulfillment
- Flag missing deliverables, skipped steps, and deviations from the specified design

### Skeptical Pass (Independent Quality Assessment)

- Evaluate code correctness independent of planning documents
- Core question: "Is what we built correct?"
- Focus areas: bugs, edge cases, defensive gaps, documentation-code drift
- Planning documents describe intent but may contain errors — use them as context for what was intended, not as ground truth for what is correct
- Apply code-smell detection, security checks, and performance review without anchoring to the plan

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
