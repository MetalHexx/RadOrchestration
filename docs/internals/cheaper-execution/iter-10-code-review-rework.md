# Iter 10 — Code-review rework (task / phase / final)

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

The `code-review` skill already splits into three subfolders — `task-review/`, `phase-review/`, `final-review/` — each with its own `workflow.md` + `template.md`. This iteration rewrites all three to match the new review semantics: strict FR/NFR/AD/DD conformance against scoped inputs, and diff-based review over commit-SHA ranges (not file-tree snapshots).

Each mode has different inputs:
- **task-review**: reads only the task-handoff doc. Requirements are inlined in that handoff (explosion-script output). The reviewer checks conformance to exactly the inlined FR/NFR/AD/DD tags. No Requirements doc, no Master Plan.
- **phase-review**: reads the Requirements doc, the phase-plan doc (explosion-script output), and a commit-SHA-range diff spanning the phase's first and last task commits. Strict conformance to the phase's requirement tags plus a lightweight quality sweep. Also carries the structured phase summary absorbed from Iter 8.
- **final-review**: reads the Requirements doc and the cumulative branch diff (all commits on the project branch). Strict FR/NFR/AD/DD conformance against every requirement, plus a quality sweep.

Commit SHAs are already available in state.json — `context-enrichment.ts`'s existing `spawn_phase_reviewer` block computes `phase_first_sha` / `phase_head_sha` from task iterations (lines 138-147). `spawn_code_reviewer` computes `head_sha` (lines 221-237). The inputs the reviewer needs are already enriched; this iteration just aligns the skill workflows with what's already being passed.

Any unmet requirement triggers `changes_requested`. The verdict is strict — no "mostly met" middle ground. The ripple into Iter 11 (correction-section amending) closes the loop on how changes get communicated back.

## Scope

- Rewrite `.claude/skills/code-review/task-review/workflow.md`:
  - Input: task-handoff doc path (via existing `handoff_doc` context field from `execute_task` enrichment).
  - Read the inlined FR/NFR/AD/DD tags. For each, check the diff at `head_sha` satisfies the tag's intent.
  - Output: `type: task_review` doc with `verdict: approved | changes_requested | rejected`, per-tag findings.
  - On `changes_requested`: amend the task-handoff with a `## Correction N — YYYY-MM-DD — <short title>` section (Iter 11 formalizes the amending mechanism).
- Rewrite `.claude/skills/code-review/phase-review/workflow.md` (carries over from Iter 8's absorption):
  - Inputs: Requirements doc path, phase-plan doc path, `phase_first_sha`, `phase_head_sha` (all already in context via existing enrichment).
  - Build diff: `git diff <phase_first_sha>^..<phase_head_sha>`.
  - For each `FR-N` / `NFR-N` / `AD-N` / `DD-N` tag scoped to the phase (resolved from the phase-plan's `**Requirements:**` line + task inlining), confirm the diff satisfies it.
  - Lightweight quality sweep on the diff: TODOs left behind, obvious bugs, orphaned scaffolding.
  - Output: `type: phase_review` doc with `verdict`, `exit_criteria_met`, structured phase summary (per Iter 8), per-requirement findings.
- Rewrite `.claude/skills/code-review/final-review/workflow.md`:
  - Inputs: Requirements doc path, project branch base SHA + head SHA (may need new enrichment — see Open Questions).
  - Build diff: `git diff <base>..<head>` covering the entire project branch.
  - For every requirement in the Requirements doc, confirm the cumulative diff satisfies it. Any miss → `changes_requested`.
  - Quality sweep on the cumulative diff.
  - Output: `type: final_review` doc with `verdict`, per-requirement findings.
- Update each skill's `template.md` (output doc template) to match the new sections and frontmatter.
- Update `.claude/skills/code-review/SKILL.md` to describe the three modes and their input surfaces.

## Scope Deliberately Untouched

- The corrective-cycle MECHANISM (how `changes_requested` produces a corrective iteration in state.json) — that's Iter 12. Iter 10 only amends the handoff with a correction section; Iter 11 formalizes the amending; Iter 12 wires the append-task behavior.
- Frontmatter validator rules for `code_review_completed` / `phase_review_completed` — existing rules (`verdict` non-null; `exit_criteria_met` non-null) still apply. The docs' structured content grows, but the validated fields don't change yet.
- Executor skill — Iter 11 is separate.
- `rad-plan-audit` — still the legacy behavior; Iter 13 overhauls it.

## UI Impact

- **Active-project rendering**: review `doc_path` links (task-review, phase-review, final-review) continue to render. Review doc frontmatter gains new structured fields (per-requirement findings); any UI that previews the doc content sees richer markdown but no structural node-shape change.
- **Frontmatter contract preservation**: the `verdict` field is already surfaced by the UI as a badge (`ui/components/badges/review-verdict-badge.tsx` per the badge inventory). The rewritten review templates MUST keep `verdict` at the same frontmatter position with the same enum values (`approved` / `changes_requested` / `rejected`) to preserve this badge's rendering. Net additions to frontmatter are fine; changing or moving `verdict` is not.
- **Legacy-project read-only rendering**: legacy review docs render with the old format. UI reads `verdict` field from frontmatter (existing contract) — unchanged.
- **UI surfaces touched**:
  - None in the DAG timeline itself (node shapes preserved).
  - `ui/components/badges/review-verdict-badge.tsx` — no change required as long as the `verdict` field contract is preserved per above.
  - If the UI renders any review-doc summary inline beyond the verdict badge, audit those components for the new per-requirement findings shape.
- **UI tests**:
  - Verdict-badge rendering test: legacy review doc + new review doc both produce the correct badge. Confirms frontmatter contract preserved.
  - If review-doc inline rendering tests exist (`ui/components/**/*review*`), update them for the new frontmatter/body shape.
  - Fixture test: legacy review doc format renders unchanged.
  - If no inline-review rendering exists beyond the badge, no further UI test changes needed — the doc_path link just points at a markdown file which the UI treats opaquely.

## Code Surface

- Skill workflows (rewrite):
  - `.claude/skills/code-review/task-review/workflow.md` + `template.md`
  - `.claude/skills/code-review/phase-review/workflow.md` + `template.md`
  - `.claude/skills/code-review/final-review/workflow.md` + `template.md`
  - `.claude/skills/code-review/SKILL.md`
- Engine (review-time enrichment already exists; verify no changes needed):
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:132-154` (spawn_phase_reviewer — post-Iter-8 simplification)
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:221-237` (spawn_code_reviewer — head_sha already computed)
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:93` (spawn_final_reviewer — in EMPTY_CONTEXT_ACTIONS currently; may need head_sha enrichment added — see Open Questions)
- Fixtures: review-mode test fixtures with commit-SHA-range inputs live under `.claude/skills/orchestration/scripts/tests/fixtures/`. Add a `git-fixture` helper if one doesn't exist for synthesizing test commit ranges.
- Tests:
  - `.claude/skills/orchestration/scripts/tests/contract/05-frontmatter-validation.test.ts` (verdict checks)
  - Integration tests that exercise spawn_code_reviewer / spawn_phase_reviewer / spawn_final_reviewer
- Ripple surfaces:
  - `.claude/skills/rad-review-cycle/SKILL.md` — phrasing updates if it references "review reports" as separate artifacts (Iter 11's correction-section change makes this implicit, but the review-cycle skill's own vocabulary may drift)
  - `.claude/skills/orchestration/references/action-event-reference.md` — update the review step entries
  - `.claude/skills/rad-create-plans/SKILL.md` — if review docs are listed as "rad-created" doc types (they may or may not be; verify)

## Dependencies

- **Depends on**: Iter 9 — `default.yml` in place with full phase/task loop wiring, so end-to-end review flow has a pipeline to run on.
- **Blocks**: Iter 11 — the executor rework (correction-mode reading) assumes the code-reviewer amends the task-handoff with correction sections, which Iter 10 establishes.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline.
- **Review-mode fixtures**: each mode (task/phase/final) needs at least two fixture pairs — one that should flag `changes_requested` (deliberately broken diff) and one that should produce `approved` (clean diff). Six fixtures minimum across the three modes.

## Exit Criteria

- Full test suite green vs. baseline.
- Each of the three review-mode workflows, run against its "broken" fixture, returns `verdict: changes_requested` with per-requirement findings.
- Each review-mode workflow, run against its "clean" fixture, returns `verdict: approved`.
- Final-review doc output contains at least one finding per FR/NFR/AD/DD in the fixture's Requirements doc (proving full conformance sweep).
- Phase-review doc output contains both the absorbed phase-summary section AND the conformance verdict (Iter 8's consolidation is still intact).
- Task-review amends the task-handoff with a `## Correction N — YYYY-MM-DD — <title>` section on `changes_requested`.

## Open Questions

- **Final-review SHA enrichment**: `spawn_final_reviewer` is currently in `EMPTY_CONTEXT_ACTIONS` (`context-enrichment.ts:93`). It may need enrichment to pass base + head SHAs for the cumulative diff. Iteration planner decides: either add a new enrichment block OR have the final-reviewer skill derive SHAs from git + state.json unaided.
- **Correction-section ownership boundary**: task-review amends the handoff in Iter 10. But Iter 11 formalizes the correction-section mechanism (executor reads them; template reserves a location). Does Iter 10's amending need to match that template convention, or can it be "author as you like; Iter 11 standardizes"? Recommend Iter 10 lands the format agreement (Correction heading pattern) so Iter 11 has a stable contract.
- **Quality sweep scope**: how deep should the "lightweight quality sweep" go? TODO-grep + diff-stat review vs. semantic analysis? Lean minimal; strict conformance is the primary signal.
- **Phase-review diff range correctness**: `phase_first_sha` from the first task's commit may miss any phase-setup commits that land before the first task. Audit during iteration — the current enrichment assumes first-task-commit == phase-start-commit, which is usually true but not guaranteed.
