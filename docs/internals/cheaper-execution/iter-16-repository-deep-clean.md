# Iter 16 — Repository deep clean

> **Validation Preface**: this iteration is a tail-end audit, not a code change with a fixed scope. The outer planner reaches Iter 16 *after* Iters 0-15 have all landed. The planner's job is to investigate the codebase **as it stands** — fresh — and surface every residue of removed/changed concepts that earlier iterations missed. The companion is intentionally light. The plan file does the heavy lifting.

## Why this exists

The Cheaper Execution Refactor spans many iterations of "delete + ripple as you go" (including the orchestrator-mediation redesign that reshaped corrective cycles mid-flight). Even with disciplined per-iteration cleanup, that much cumulative surface-area drift leaves residue:

- Stale doc framings (the document still reads as if the removed concept exists).
- Dead code paths that no caller exercises.
- Test fixtures encoding shapes that no longer occur in real state.
- Orphaned imports / type literals / config keys.
- Comments referencing removed concepts.
- Cross-references to deleted files / sections.
- Mermaid / ASCII diagrams that didn't get refreshed when the underlying flow changed.
- Skill metadata (descriptions, keywords) describing capabilities that are gone.

This iteration sweeps for all of it before the public-facing docs iteration (Iter 17) refreshes `/docs/`. Cleaning internals first means Iter 17 documents a stable end state.

## Scope (intent — finalized at planning time)

The outer planner for this iteration **investigates the codebase fresh** and produces a self-contained plan file that enumerates findings and corrections. Investigation should cover, at minimum:

- Every concept removed across Iters 0-15 (agents, actions, events, workflows, mutation handlers, validator rules, schema fields, template nodes, doc types, vocabulary).
- Every concept renamed (e.g., execution_plan → master_plan in Iter 2).
- Every behavior whose semantics shifted (e.g., `phase_planning` / `task_handoff` shifted from authoring nodes to doc-carrier nodes after Iter 5/7).
- Documentation that *reads stale* even when no symbol is wrong (framing-stale issues).
- Test fixtures encoding states that won't reoccur.
- Dead code reachable only via removed entry points.

**Investigation approach is deliberately open.** Word-level grep is necessary but insufficient — string search misses framing-stale docs and implicit-assumption code. The outer planner is encouraged to dispatch specialized parallel subagents (one per major repo area) to read code/docs end-to-end and exercise judgment, not just pattern-match. This was the approach used during Iter 7 planning and it caught issues grep alone missed (e.g., `rad-create-plans/SKILL.md`'s "most routes vs planner exception" framing being stale after `tactical-planner` deletion).

**Inner-session scope**: apply the planner's enumerated findings AND look for additional tidying opportunities discovered while editing each surface. Don't be timid about small consistency fixes within touched files (renames, comment updates, dead-import removals) — that's the iteration's purpose.

## Scope Deliberately Untouched

- `/docs/*.md` (root public-facing) and root-level `README.md` — Iter 17 owns the public-facing docs refresh. Cleaning internals first means Iter 17 documents a stable end state.
- `docs/internals/CHEAPER-EXECUTION-REFACTOR.md`, `CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`, `CORRECTIVE-CYCLES-REDESIGN.md`, and everything under `docs/internals/cheaper-execution/` — these are the refactor's own authoring notes; they're maintained by the refactor itself, not swept as residue.
- `archive/` — inactive; not refactor-relevant.
- Anything in `node_modules/`.
- New feature work — pure cleanup iteration, no behavior changes.

## Scope Explicitly Included (scope-gap closers)

- **`docs/internals/*.md` (non-refactor-authoring files)** — e.g., `scripts.md`, `system-architecture.md`, `validation.md`, `dependency-model.md`, `template-architecture-refactor.md`, etc. These document stable system behavior and have drifted as earlier iterations removed actions/events/agents without rippling. Iter 17 explicitly excludes internals; this iteration is the natural home. Audit against current code; remove stale references to deleted actions (`spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `create_phase_plan`, `create_task_handoff`, `generate_phase_report`), deleted events (`phase_planning_started`, `phase_plan_created`, `task_handoff_started`, `task_handoff_created`), and deleted agents (`product-manager`, `architect`, `ux-designer`, `research`, `tactical-planner`).

- **V4 legacy sunset** — greenfield posture (decided 2026-04-20 during Iter 8 planning): no v4 state.json files need readable-migration support. Delete the entire v4-to-v5 migration surface, rename the `$schema` identifier from `orchestration-state-v4` to `orchestration-state-v5` everywhere, and prune v4 vestiges from docs + types + tests. Targets:
  - **Delete**: `.claude/skills/orchestration/scripts/migrate-to-v5.ts` + its dedicated tests (`scripts/tests/migrate-to-v5.test.ts`, `scripts/tests/migrated-state-integration.test.ts`). Also delete `scripts/fix-ghost-v5.ts` (imports `migrateState` from the migrator; its whole purpose is upgrading v4 state).
  - **Delete**: `.claude/skills/orchestration/schemas/legacy/` (contains only `state-v4.schema.json`). Prune the `schemas/legacy/` directory itself.
  - **`$schema` rename** across every remaining surface — UI type literal at `ui/types/state.ts` (`$schema: 'orchestration-state-v4'` → `'orchestration-state-v5'`), all UI test fixtures (`ui/lib/fs-reader-v5.test.ts`, `ui/lib/fs-reader-discover.test.ts`, `ui/lib/document-ordering.test.ts`, `ui/hooks/use-projects.test.ts`), and any public-doc references (`docs/configuration.md`, `docs/source-control.md`). Public-docs updates happen here, not in Iter 17, since the identifier is a data-shape concern not a narrative concern.
  - **Vocabulary scrub**: `.claude/skills/orchestration/SKILL.md` drops the `schemas/state-v4.schema.json` + `scripts/migrate-to-v5.ts` bullets. `.claude/skills/orchestration/scripts/tests/contract/01-cli-parameters.test.ts` drops v4-specific assertions. Grep the repo for `v4`, `V4`, `state-v4`, `orchestration-state-v4`, `migrate-to-v5`, `migrateState`, `fix-ghost-v5` — each match is either deleted or (for inline string identifiers) renamed to v5.
  - **Consider renaming** `orchestration-state-v5.schema.json` + `ui/lib/fs-reader-v5.test.ts` to drop the version suffix entirely, given the additive-schema-strategy policy locked in the root design doc (no v5→v6 bump planned). Decide at iteration-planning time; either "keep v5 suffix as historical tag" or "drop to `orchestration-state.schema.json` / `fs-reader.test.ts`" is defensible. **Do not** rename the `$schema` identifier on a different trajectory than the filename — those two stay aligned.
  - **Testing posture**: deleting the migrator drops ~900+ lines of migration-specific test coverage. Net count drop is expected and logged; no baseline-passing test for *retained* behavior may fail. The migration-adjacent integration test (`migrated-state-integration.test.ts`) dies with the migrator; any coverage it provided for v5-shape behavior (not migration-specific) gets inventoried at planning time and relocated if load-bearing.

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
- `docs/internals/*.md` (non-refactor-authoring files) — stable-behavior internal docs accumulated drift across Iters 0–15 without iteration-time ripples. Known stale at iteration start: `scripts.md` (pipeline actions/events table references removed symbols); expect others to surface during investigation.

## Dependencies

- **Depends on**: Iters 0-15 all landed and verified. Cleanup can only sweep what's already been removed.
- **Blocks**: Iter 17 — public docs refresh consumes the cleaned codebase as its source of truth.
- **V4 sunset note**: the v4 legacy sunset (added 2026-04-20) is independent of Iters 0-15 and could in principle land earlier. It's folded here because (a) the deep-clean iteration is the right home for repository-wide identifier renames and (b) `migrate-to-v5.ts` is load-bearing for any pre-Iter-16 state.json on disk that still carries the v4 `$schema` string. Doing both in one iteration avoids a mid-refactor mismatch where the schema files say v5 but live state.json still says v4.

## Testing Discipline

- **Baseline first**: full suite + log + SHA. This iteration may delete tests for removed surfaces; net counts may drop.
- **Re-run before exit**: full suite green; diff against baseline. Removed-test deltas are expected and logged; any baseline-passing test for a *retained* behavior must still pass.
- **Cross-tree run**: all three test trees (orchestration/scripts vitest; ui node-test; installer node-test).
- **Manual smoke**: required if `ui/` is touched. Real workspace, not synthetic fixture.

## Exit Criteria

- Full test suite green vs. baseline.
- Codebase carries no residue (string OR semantic) from anything removed/changed across Iters 0-15, modulo `/docs/` (Iter 17) and `archive/`.
- All cross-references resolve. No dangling links.
- Skill / agent / reference docs read coherently in a post-refactor world (framing aligned, not just symbol-correct).
- Test fixtures encode only states that occur in the post-refactor pipeline.

## Open Questions — to resolve at planning time

- **Subagent army or sequential investigation?** The Iter 7 planning used 6 parallel agents per major repo area. Iter 16 will likely use the same pattern (or expand it) but the planner can right-size based on the residue actually expected.
- **How to handle judgment-call findings?** Some cleanup will be obviously correct; some will be 50/50 (e.g., "is this comment stale or just historically accurate?"). The plan file should distinguish "apply" from "surface for user judgment."
- **Bookend test** — should the iteration end with a fresh independent agent reading the cleaned codebase to confirm coherence, or just trust the in-iteration audit + tests? Decide at planning time based on how much was touched.
