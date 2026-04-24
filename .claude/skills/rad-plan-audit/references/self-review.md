# Self-Review — Planner-Time Audit

Run this before saving your planning document. You are checking your own
output for accuracy against the codebase and cohesion with the upstream
doc. This is a checklist you run yourself — not a subagent dispatch.

## Scope

The planning set has exactly two documents: Requirements and Master
Plan. Pick the row that matches what you're writing.

| You are writing | Upstream | Focus on |
|-----------------|----------|----------|
| Requirements | Brainstorming doc *(if present)* | §2.3 terminology; **§2.4 decision encapsulation (must not have forward references to Master Plan, phase plan, task handoff; no deferred-work verbs; no conditional decisions);** structural rules from `.claude/skills/rad-create-plans/references/requirements/workflow.md` step 7 (block shape, tags, no placeholders). |
| Master Plan | Requirements doc | Part 1 (codebase accuracy), §2.1 (coverage), §2.3 (terminology) |

## Workflow

1. **Read upstream.** Read the Requirements doc (when writing the Master
   Plan) or the Brainstorming doc if one exists (when writing
   Requirements).

2. **Read existing source.** For every claim your doc makes about code
   that already exists — file paths, interface shapes, command names —
   read the real source. Planned additions are not in scope.

3. **Apply the rubric.** Walk the focus pillars listed for your doc type
   against the live rubric at [audit-rubric.md](./audit-rubric.md). The
   calibration clause applies — only flag issues that would block a
   coder.

4. **Fix inline before saving. No re-review.** If you find issues, fix
   them in place and save. Do not dispatch a reviewer, do not write a
   report. If you find a Requirements ID that no task covers, add the
   task (or correct the phase breakdown). If you find a phantom tag,
   delete or correct it.

## Master Plan — Part 3 emphasis

Part 3 (Buildability) is the highest-value pass for Master Plan
self-review because it fully determines whether the plan is executable. Before saving, confirm:

- Every FR / NFR / AD / DD in the Requirements doc appears in at least
  one task's `**Requirements:**` line.
- Every tag cited anywhere in the Master Plan resolves to an ID block in
  the Requirements doc.
- Every step ends with at least one `(FR-N)` / `(NFR-N)` / `(AD-N)` /
  `(DD-N)` tag.
- Every `code`-type task has exactly four RED-GREEN steps.
- No `TBD` / `TODO` / `similar to` / `as needed` language anywhere.
- Is there anything that would cause a coder to ask you mid-build, "Wait, what does this mean?" If so, clarify it before saving.
- If there is anything missing from the plan that would cause the plan to fail, add or remove it before saving.
