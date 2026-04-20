# Iter 15 — Repository deep clean

> **Validation Preface**: this iteration is a tail-end audit, not a code change with a fixed scope. The outer planner reaches Iter 15 *after* Iters 0-14 have all landed. The planner's job is to investigate the codebase **as it stands** — fresh — and surface every residue of removed/changed concepts that earlier iterations missed. The companion is intentionally light. The plan file does the heavy lifting.

## Why this exists

The Cheaper Execution Refactor spans 14 active iterations of "delete + ripple as you go." Even with disciplined per-iteration cleanup, 14 iterations of cumulative surface-area drift leave residue:

- Stale doc framings (the document still reads as if the removed concept exists).
- Dead code paths that no caller exercises.
- Test fixtures encoding shapes that no longer occur in real state.
- Orphaned imports / type literals / config keys.
- Comments referencing removed concepts.
- Cross-references to deleted files / sections.
- Mermaid / ASCII diagrams that didn't get refreshed when the underlying flow changed.
- Skill metadata (descriptions, keywords) describing capabilities that are gone.

This iteration sweeps for all of it before the public-facing docs iteration (Iter 16) refreshes `/docs/`. Cleaning internals first means Iter 16 documents a stable end state.

## Scope (intent — finalized at planning time)

The outer planner for this iteration **investigates the codebase fresh** and produces a self-contained plan file that enumerates findings and corrections. Investigation should cover, at minimum:

- Every concept removed across Iters 0-14 (agents, actions, events, workflows, mutation handlers, validator rules, schema fields, template nodes, doc types, vocabulary).
- Every concept renamed (e.g., execution_plan → master_plan in Iter 2).
- Every behavior whose semantics shifted (e.g., `phase_planning` / `task_handoff` shifted from authoring nodes to doc-carrier nodes after Iter 5/7).
- Documentation that *reads stale* even when no symbol is wrong (framing-stale issues).
- Test fixtures encoding states that won't reoccur.
- Dead code reachable only via removed entry points.

**Investigation approach is deliberately open.** Word-level grep is necessary but insufficient — string search misses framing-stale docs and implicit-assumption code. The outer planner is encouraged to dispatch specialized parallel subagents (one per major repo area) to read code/docs end-to-end and exercise judgment, not just pattern-match. This was the approach used during Iter 7 planning and it caught issues grep alone missed (e.g., `rad-create-plans/SKILL.md`'s "most routes vs planner exception" framing being stale after `tactical-planner` deletion).

**Inner-session scope**: apply the planner's enumerated findings AND look for additional tidying opportunities discovered while editing each surface. Don't be timid about small consistency fixes within touched files (renames, comment updates, dead-import removals) — that's the iteration's purpose.

## Scope Deliberately Untouched

- `/docs/` and root-level `README.md` — Iter 16 owns the public-facing docs refresh. Cleaning internals first means Iter 16 documents a stable end state.
- `archive/` — inactive; not refactor-relevant.
- Anything in `node_modules/`.
- New feature work — pure cleanup iteration, no behavior changes.

## UI Impact

- Active-project rendering: should not change. If the audit surfaces UI cleanup (stale comments, dead branches, unused types), apply it without changing rendered output.
- Legacy-project rendering: must continue to render unchanged. Add a regression test against a pre-Iter-15 state.json fixture confirming this if any UI code is touched.
- Manual browser smoke (REQUIRED if any `ui/` files are touched): boot dev server against the user's real workspace; confirm no rendering regressions; zero new console errors.

## Code Surface

Determined at planning time. Likely includes (but is not limited to):

- `.claude/skills/orchestration/scripts/lib/**` — engine internals.
- `.claude/skills/orchestration/scripts/tests/**` (incl. `tests/fixtures/`) — test surface + fixture audit.
- `.claude/skills/*/SKILL.md` + `.claude/skills/**/references/**/*.md` + `.claude/agents/*.md` — skill docs and agent definitions cross-consistency.
- `ui/**` — UI consumers of state.json.
- `installer/**` + `.claude/skills/orchestration/{config,schemas,validate}/**` — config, schemas, validators.
- `.agents/**` + `prompt-tests/**` + root configs — external tooling, harness fixtures, hidden CI/hooks.

## Dependencies

- **Depends on**: Iters 0-14 all landed and verified. Cleanup can only sweep what's already been removed.
- **Blocks**: Iter 16 — public docs refresh consumes the cleaned codebase as its source of truth.

## Testing Discipline

- **Baseline first**: full suite + log + SHA. This iteration may delete tests for removed surfaces; net counts may drop.
- **Re-run before exit**: full suite green; diff against baseline. Removed-test deltas are expected and logged; any baseline-passing test for a *retained* behavior must still pass.
- **Cross-tree run**: all three test trees (orchestration/scripts vitest; ui node-test; installer node-test).
- **Manual smoke**: required if `ui/` is touched. Real workspace, not synthetic fixture.

## Exit Criteria

- Full test suite green vs. baseline.
- Codebase carries no residue (string OR semantic) from anything removed/changed across Iters 0-14, modulo `/docs/` (Iter 16) and `archive/`.
- All cross-references resolve. No dangling links.
- Skill / agent / reference docs read coherently in a post-refactor world (framing aligned, not just symbol-correct).
- Test fixtures encode only states that occur in the post-refactor pipeline.

## Open Questions — to resolve at planning time

- **Subagent army or sequential investigation?** The Iter 7 planning used 6 parallel agents per major repo area. Iter 15 will likely use the same pattern (or expand it) but the planner can right-size based on the residue actually expected.
- **How to handle judgment-call findings?** Some cleanup will be obviously correct; some will be 50/50 (e.g., "is this comment stale or just historically accurate?"). The plan file should distinguish "apply" from "surface for user judgment."
- **Bookend test** — should the iteration end with a fresh independent agent reading the cleaned codebase to confirm coherence, or just trust the in-iteration audit + tests? Decide at planning time based on how much was touched.
