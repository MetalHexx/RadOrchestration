# Iter 13 — Rad-plan-audit overhaul

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

The legacy `rad-plan-audit` skill audits the full 5-doc planning corpus (PRD + Research + Design + Architecture + Master Plan) for cross-document cohesion. Under the new pipeline, only two planning docs exist: Requirements and Master Plan. The audit collapses to a single, strict purpose: confirm every FR/NFR/AD/DD in the Requirements doc is cited by at least one task in the Master Plan, and every requirement tag cited in the Master Plan resolves to a block in the Requirements doc.

This iteration rewrites the skill's `SKILL.md` and any `references/` content to exactly this scope. Legacy audit modes — any mode that checked PRD ↔ Design consistency, Research ↔ Architecture traceability, etc. — go. Tests matching those removed audits either delete or rewrite.

The audit runs in two directions:
- **Forward coverage**: every Requirements ID appears in ≥1 Master Plan task. Output: list of uncovered requirements.
- **Backward resolution**: every tag cited in the Master Plan (e.g., `(FR-3)`, `(AD-2)`) exists as a block in Requirements. Output: list of dangling references.

Both lists being empty is the pass condition. Either list populated means the plan has a cohesion gap.

## Scope

- Rewrite `.claude/skills/rad-plan-audit/SKILL.md`:
  - Input contract: `{PROJECT-DIR}/{NAME}-REQUIREMENTS.md` and `{PROJECT-DIR}/{NAME}-MASTER-PLAN.md`.
  - Workflow: parse Requirements (list every `### (FR|NFR|AD|DD)-\d+:` heading), parse Master Plan (grep every `(FR|NFR|AD|DD)-\d+` tag citation across all task step bullets).
  - Forward coverage check: for each Requirements ID, confirm ≥1 citation in Master Plan.
  - Backward resolution check: for each Master Plan tag citation, confirm the tag resolves to a Requirements block.
  - Output format: a structured report doc (or inline stdout) with two sections — "Uncovered Requirements" and "Dangling References." Both empty = pass.
- Review `.claude/skills/rad-plan-audit/references/`: delete any reference subdoc covering legacy audit modes (PRD audits, Design ↔ Requirements consistency, Research traceability). Retain anything relevant to Requirements ↔ Master Plan conformance.
- Update `.claude/skills/rad-plan-audit/SKILL.md` description and invocation examples to reflect the new single purpose.

## Scope Deliberately Untouched

- No pipeline engine changes. `rad-plan-audit` remains a user-invocable skill, not a pipeline-embedded step.
- No changes to the Requirements or Master Plan formats themselves — those are stable from Iters 2 + 4.
- No changes to the explosion script — it produces task-handoff files with inlined tags; this audit reads the Master Plan directly, not the exploded outputs.

## UI Impact

- **Active-project rendering**: none. `rad-plan-audit` is a user-invocable skill, not a pipeline-embedded step. Its output is a standalone report doc; the pipeline's state.json is unaffected.
- **Legacy-project read-only rendering**: none.
- **UI surfaces touched**: none.
- **UI tests**: none required by this iteration.

## Code Surface

- Skill: `.claude/skills/rad-plan-audit/SKILL.md`
- Skill references (audit and prune): `.claude/skills/rad-plan-audit/references/` (inventory during planning; delete legacy mode files)
- Tests:
  - Any existing tests under `.claude/skills/orchestration/scripts/tests/` that reference rad-plan-audit behavior
  - New fixture tests: a Requirements + Master Plan pair where every ID is cited (passes); a pair with one uncovered FR (flags); a pair with one dangling NFR reference in a task step (flags).
- Ripple surfaces:
  - `.claude/skills/orchestration/validate/lib/checks/skills.js` — skill roster still lists rad-plan-audit; no change needed
  - `.claude/skills/orchestration/references/action-event-reference.md` — audit skill invocation documentation
  - `.claude/skills/rad-plan/SKILL.md` if it references `rad-plan-audit` as a post-planning step (verify)

## Dependencies

- **Depends on**: Iter 12 — not strictly, but the pipeline should be stable end-to-end before narrowing the audit skill's scope. An operator invoking the audit during an in-flight refactor shouldn't see behavior drift mid-scope.
- **Blocks**: Iter 14 — the public-facing docs refresh covers mentions of `rad-plan-audit` in docs/ root files; cleaner to overhaul the skill first, then align the docs.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline. Removed legacy-audit-mode tests are expected; new conformance-check tests are added.
- **Fixture test suite** — at least 4 fixtures:
  - Happy path: Requirements (3 FRs, 2 NFRs, 1 AD) × Master Plan citing all 6. Audit passes.
  - Uncovered FR: Requirements includes FR-7; Master Plan never cites it. Audit flags FR-7 as uncovered.
  - Dangling citation: Master Plan cites `(AD-5)` but Requirements has no AD-5. Audit flags AD-5 as dangling.
  - Mixed failure: both above in one pair. Audit flags both.

## Exit Criteria

- Full test suite green vs. baseline.
- `rad-plan-audit/SKILL.md` workflow covers only Requirements ↔ Master Plan conformance; no mentions of PRD, Research, Design, Architecture as audit subjects.
- Fixture tests pass: all four scenarios above produce the expected audit output.
- `.claude/skills/rad-plan-audit/references/` contains no files covering removed legacy audit modes.
- `grep -rn "PRD\|Research Doc\|Design Doc\|Architecture Doc" .claude/skills/rad-plan-audit/` returns zero matches (confirms legacy-mode references are fully cleaned from the skill surface).
- Invoking `rad-plan-audit` on a real finished project (e.g., a rainbow-hello output from the prompt harness) produces a coherent report.

## Open Questions

- **Output format**: structured doc file written to `{PROJECT-DIR}/` or stdout report? Lean file so it can be committed and reviewed; iteration planner decides.
- **Audit invocation**: is `rad-plan-audit` expected to run automatically as part of the pipeline (e.g., after `explode_master_plan`), or strictly user-invoked? Legacy was user-invoked. Recommend keep user-invoked; pipeline's existing validator handles frontmatter, and strict conformance at the pipeline gate would require the audit to be deterministic-enough for a CI-style gate, which it probably isn't yet.
- **Tag citation locations**: Master Plan's tag citations appear in task steps (e.g., `- [ ] **Step 1: Write the failing test (FR-1)**`), phase `**Requirements:**` lines, and potentially task `**Requirements:**` lines. The audit must grep all three. Clarify the exact parsing surface during planning.
- **Multi-project audit**: does the skill handle multiple projects (e.g., audit all projects under a base path)? Legacy scope unclear. Lean: single-project audit; multi-project is a future concern.
