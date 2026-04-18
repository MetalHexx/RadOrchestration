# Iter 3 — Remove upstream planning (PRD + Research + Design + Architecture)

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

The legacy pipeline produces four upstream planning documents (PRD, Research, Design, Architecture) before the Master Plan. After Iter 2, the Master Plan replaces the Master Plan artifact and reads from Requirements (once Iter 4 adds it). The four upstream stages no longer serve the pipeline and are removed wholesale — agents, skill workflows, actions, events, mutation-registry entries, context-enrichment entries, and the nodes in `full.yml`.

`full.yml` is stamped deprecated rather than deleted — old completed-project state.json files still reference `template.id: full`, and the file on disk keeps the process editor + UI rendering paths coherent. A new one-line skip in `template-validator.ts` prevents the validator from crashing on the now-orphaned action references inside the deprecated template.

After this iteration: no code path spawns a product-manager, architect, ux-designer, or research agent; no action dispatches to a removed upstream stage; `full.yml` is marked deprecated and validator-skipped; the UI still renders legacy state.json because `NODE_SECTION_MAP` retains its legacy entries.

## Scope

- Delete 4 agent files: `.claude/agents/{product-manager, architect, ux-designer, research}.md`.
- Delete 4 workflow folders: `.claude/skills/rad-create-plans/references/{prd, research, design, architecture}/`.
- Remove from `constants.ts` (`NEXT_ACTIONS` object): `SPAWN_PRD`, `SPAWN_RESEARCH`, `SPAWN_DESIGN`, `SPAWN_ARCHITECTURE`.
- Remove from `constants.ts` (`EVENTS` object): `PRD_STARTED`, `PRD_COMPLETED`, `RESEARCH_STARTED`, `RESEARCH_COMPLETED`, `DESIGN_STARTED`, `DESIGN_COMPLETED`, `ARCHITECTURE_STARTED`, `ARCHITECTURE_COMPLETED`.
- In `mutations.ts`, remove 4 array entries from `planningStartedSteps` (line ~86) and `planningCompletedSteps` (line ~114) — leave `MASTER_PLAN_STARTED` / `MASTER_PLAN_COMPLETED` in place.
- In `context-enrichment.ts:68-74`, remove 4 entries from the `PLANNING_SPAWN_STEPS` record — leave `spawn_master_plan: 'master_plan'`.
- Remove the 4 upstream step nodes from `full.yml` (`prd`, `research`, `design`, `architecture`).
- Stamp `full.yml` with deprecation: add a `status: deprecated` field on the top-level `template:` block and a `# DEPRECATED — ...` banner comment at the top of the file.
- Add net-new deprecated-template skip logic to `template-validator.ts`: if `template.status === 'deprecated'`, log one line and skip the remaining validations for that template. Validator currently has no concept of deprecation.

## Scope Deliberately Untouched

- `frontmatter-validators.ts` — no per-doc-type rules exist; the four event-based rules (`plan_approved`, `phase_plan_created`, `code_review_completed`, `phase_review_completed`) all stay.
- `pre-reads.ts` — generic function; removed events naturally stop being pre-read.
- `scaffold.ts` / `types.ts` — generic; no legacy literals to edit.
- `dag-walker.ts` — generic walker; the line-124 hardcoded `'phase_planning'` reference is an Iter 7 concern (per-phase/task planning removal).
- UI `NODE_SECTION_MAP` (`ui/components/dag-timeline/dag-timeline-helpers.ts:108-120`) and `PLANNING_STEP_ORDER` (`ui/types/state.ts:34-36`) keep their legacy entries so historical state.json still renders.
- Public-facing docs under `/docs/` — deferred to Iter 14.

## UI Impact

- **Active-project rendering**: new projects on `default.yml` won't have `prd` / `research` / `design` / `architecture` step nodes — they were never in `default.yml` (Iter 4 builds it). Nothing new to render.
- **Legacy-project read-only rendering**: completed projects' state.json contains these 4 node ids at top level. The DAG timeline must continue to render them grouped under "Planning." This is the load-bearing read-only guarantee for this iteration.
- **UI surfaces touched**:
  - `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120` (`NODE_SECTION_MAP`) — PRESERVE all 4 legacy entries; do not delete.
  - `ui/types/state.ts:34-36` (`PLANNING_STEP_ORDER`) — this literal union is **actively consumed** by `ui/lib/document-ordering.ts` and `ui/lib/status-derivation.ts` (not v4-legacy-only). The 4 legacy entries MUST stay; deleting them breaks rendering for both legacy and new projects. Confirm during planning that no code path loses the ordering/status info after the engine-level removals.
  - Process editor UI: `ui/components/process-editor/read-only-canvas.tsx` is the insertion point for the deprecated-template filter/label. It's loaded via `ui/app/process-editor/page.tsx`. Add a "deprecated" badge rendering path so `full.yml` shows with visual distinction and can't be selected for new projects.
- **UI tests**:
  - Add a fixture test in `ui/` that renders a captured legacy state.json (pre-refactor, with all 4 upstream planning nodes) and asserts all 4 appear in the Planning section with correct status.
  - Add a test that `full.yml` in the process editor shows with deprecated styling and that the "create new project" flow doesn't offer it.

- Agents: `.claude/agents/{product-manager, architect, ux-designer, research}.md`
- Skill workflows: `.claude/skills/rad-create-plans/references/{prd, research, design, architecture}/` (entire folders)
- Engine:
  - `.claude/skills/orchestration/scripts/lib/constants.ts:42-89` (actions + events)
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:86-120` (planning step arrays)
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:68-74` (`PLANNING_SPAWN_STEPS`)
  - `.claude/skills/orchestration/scripts/lib/template-validator.ts` (net-new deprecated skip)
- Template: `.claude/skills/orchestration/templates/full.yml` (node removals + deprecation stamp)
- Tests (rewrite / delete as needed — iteration planner audits):
  - `.claude/skills/orchestration/scripts/tests/contract/02-event-names.test.ts`, `03-action-contexts.test.ts`, `05-frontmatter-validation.test.ts`, `06-state-mutations.test.ts`, `07-tier-transitions.test.ts`
  - `.claude/skills/orchestration/scripts/tests/engine.test.ts`, `dag-walker.test.ts`, `event-routing-integration.test.ts`, `execution-integration.test.ts`
  - `.claude/skills/orchestration/scripts/tests/context-enrichment.test.ts`
- Ripple surfaces:
  - `.claude/skills/orchestration/validate/lib/checks/agents.js` (expected agent roster)
  - `.claude/skills/rad-create-plans/SKILL.md` (agent-routing table)
  - `.claude/skills/rad-plan/SKILL.md` (drop "Research through Master Plan" phrasing; planning-step listing logic)
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, context, pipeline-guide}.md`

## Dependencies

- **Depends on**: Iter 2 — the `master_plan` slot must already be wired to `@planner` (producing Master Plan) before its upstream dependencies are severed.
- **Blocks**: Iter 4 — cannot cleanly wire the Requirements node on top of the legacy PRD/Research/Design/Architecture chain; those need to be gone first.

## Testing Discipline

- **Baseline first**: before any edits, run the full test suite and save the log to the iteration worktree (`baseline-tests.log`). Note pass/fail totals and the baseline commit SHA.
- **Re-run before exit**: full test suite green; diff against baseline. Deleted legacy tests are expected; any baseline-passing test outside the removed-surface scope that newly fails is a regression and blocks exit.
- Sequence matters inside this iteration: land the `template-validator.ts` deprecation skip + `full.yml` deprecation stamp BEFORE removing the actions. Otherwise intermediate test runs will fail on `full.yml` loading actions that no longer exist.

## Exit Criteria

- Full test suite green vs. baseline (allowing for removed legacy-flow tests).
- `grep -rn "spawn_prd\|spawn_research\|spawn_design\|spawn_architecture" .claude/` returns zero matches outside this design-doc corpus.
- `grep -rn "product-manager\.md\|architect\.md\|ux-designer\.md" .claude/` returns zero references.
- `full.yml` carries `status: deprecated` on its template block; `template-validator.ts` skips it cleanly (no errors during pipeline init).
- UI smoke-check: a pre-existing completed-project state.json (e.g., `DAG-VIEW-5`) still renders with planning-tier nodes grouped under "Planning."
- `rad-plan/SKILL.md` no longer mentions the 4 upstream stages.

## Open Questions

- **Deprecation skip visibility**: should `template-validator.ts`'s deprecated-skip emit a log line (debuggability) or pass silently? Iteration planner decides; log-with-info is safer default.
- **`PLANNING_SPAWN_STEPS` shape**: once only `spawn_master_plan` remains, keeping a Record for one entry feels over-engineered. Leave as-is for Iter 4's `spawn_requirements` addition, or inline? Likely leave — Iter 4 restores the map's usefulness.
- **Legacy test triage**: some tests exercise mixed flows (e.g., a full planning-to-execution happy path). The iteration planner decides per-test whether to delete, rewrite against `default.yml` (post-Iter 9), or preserve for full.yml coverage during the overlap window. Preserve only if it costs less than deletion-plus-replanning.
