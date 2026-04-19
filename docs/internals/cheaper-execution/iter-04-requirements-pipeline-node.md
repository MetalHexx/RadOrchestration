# Iter 4 — Requirements pipeline node

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → amend this companion directly (commit message carries the reason). Do NOT touch the progress tracker during planning — that doc is for execution outcomes only. Do not plan on stale assumptions.

## Overview

Iter 1 shipped the Requirements workflow under `rad-create-plans` but never wired it into the pipeline. Iter 3 removed the four legacy upstream stages that the master_plan step used to depend on. This iteration adds the one new upstream step that replaces all four: `requirements`, produced by `@planner`.

The wiring touches the same engine surfaces Iter 3 drained: `constants.ts` gets a new action + events, the planning mutation arrays in `mutations.ts` get a new entry, `context-enrichment.ts` gets a new `PLANNING_SPAWN_STEPS` entry, and a new `frontmatter-validators.ts` rule enforces `requirement_count > 0` on the `requirements_completed` event. A partial `default.yml` is seeded with just three nodes (`requirements` → `master_plan` → `plan_approval_gate`) — enough for a fresh project to drive planning end-to-end; execution-phase wiring lands in Iter 9.

The `@planner` router already has a `create_requirements` row from Iter 1 — it needs a rename or dual-route so the orchestrator's new `spawn_requirements` action resolves correctly. The brainstorm skill's memory references also update here so the brainstormer's "what planning docs exist" mental model catches up with Requirements + Master Plan being the new canonical pair.

## Scope

- Add to `constants.ts`:
  - `NEXT_ACTIONS.SPAWN_REQUIREMENTS: 'spawn_requirements'`
  - `EVENTS.REQUIREMENTS_STARTED: 'requirements_started'`
  - `EVENTS.REQUIREMENTS_COMPLETED: 'requirements_completed'`
- In `mutations.ts`, add a `[EVENTS.REQUIREMENTS_STARTED, 'requirements']` entry to `planningStartedSteps` (now ~line 87 post-Iter-3) and a matching entry to `planningCompletedSteps` (now ~line 111). The loops registering handlers pick the new event up for free.
- **Mechanical relocation**: move the `graph.status = 'in_progress'` side-effect off `MASTER_PLAN_STARTED` and onto `REQUIREMENTS_STARTED`. Iter 3 relocated this hook from the (then-deleted) `RESEARCH_STARTED` to `MASTER_PLAN_STARTED` because master_plan became the new first planning step; the same logic now demands the hook live on the new first planning step (requirements). Without this, no event sets `graph.status` to `in_progress` until master_plan starts — leaving the requirements step's runtime status incoherent. Same one-line move pattern as Iter 3.
- In `context-enrichment.ts:68-74`, add `spawn_requirements: 'requirements'` to the `PLANNING_SPAWN_STEPS` record.
- Add a new rule in `frontmatter-validators.ts` for `requirements_completed`: require `requirement_count` to be a positive integer.
- Update `.claude/agents/planner.md` router (lines 33–36): **rename** the existing `create_requirements` row to `spawn_requirements`. Do not dual-route — `create_requirements` was an Iter-1-time placeholder that predates the `spawn_*` convention re-established by Iter 3 (the only surviving `spawn_*` action there is `spawn_master_plan`). Single-route keeps the agent's contract minimal.
- Create `.claude/skills/orchestration/templates/default.yml` with three top-level step nodes: `requirements`, `master_plan` (reusing existing action/events), `plan_approval_gate`. Template is deliberately partial; Iter 5 adds `explode_master_plan`, Iter 7+9 add the loops and closing stages.
- Add `requirements` → `Planning` entry to UI `NODE_SECTION_MAP` (`ui/components/dag-timeline/dag-timeline-helpers.ts:108-120`).
- UI type updates in `ui/types/state.ts`: add `'requirements'` to the `PlanningStepName` union (line 10) **and** to the `PLANNING_STEP_ORDER` readonly array (lines 34–36). Both are needed — the union lives one definition above the array; companion's "Code Surface" line range only covered the array. Consumers `ui/lib/document-ordering.ts` and `ui/lib/status-derivation.ts` import via the union, so updating the union keeps the type-checked consumers consistent.

## Scope Deliberately Untouched

- `pre-reads.ts` — generic; the new event gets read by the existing `preRead` function when dispatched. A `requirements_completed`-specific pre-read block is only needed if the Requirements doc's frontmatter needs inspection beyond what the new rule covers — likely not.
- Phase/task loop nodes — still absent from `default.yml`; added in Iter 9.
- `full.yml` — untouched. It's deprecated as of Iter 3.
- Public docs — deferred to Iter 14.

## UI Impact

- **Active-project rendering**: new `requirements` node appears in the DAG timeline at the top of the pipeline, grouped under "Planning." Must render with correct status transitions (not_started → in_progress → completed) and with `doc_path` link once completed.
- **Legacy-project read-only rendering**: unchanged. Legacy projects don't have a `requirements` node; adding one to `NODE_SECTION_MAP` is purely additive and doesn't affect legacy rendering.
- **UI surfaces touched**:
  - `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120` (`NODE_SECTION_MAP`) — add `requirements: 'Planning'` entry.
  - `ui/types/state.ts:34-36` (`PLANNING_STEP_ORDER`) — add `'requirements'` to the literal union. Consumed by `ui/lib/document-ordering.ts` and `ui/lib/status-derivation.ts`; omitting this breaks ordering / status derivation for active projects with the new node.
  - Left-hand project list panel — no change. `pipeline.current_tier` values are unchanged; a project in the `requirements` step still reports `current_tier: 'planning'`.
- **UI tests**:
  - Add a fixture test rendering a scratch state.json with `requirements` node present; assert it groups under Planning and renders status correctly.
  - Add a status-transition test covering `requirements_started` → `requirements_completed` event flow's UI reflection.
- **Manual browser smoke (REQUIRED, not optional)**: once the UI changes have landed, the inner session must build and run the UI (`cd ui && npm run build && npm run dev`), open the dev server in a browser, and visually verify:
  1. A scratch / fixture project carrying a `requirements` node renders it in the DAG timeline grouped under "Planning," ordered before `master_plan`.
  2. Status transitions render correctly across `not_started → in_progress → completed`.
  3. A pre-existing legacy completed project (any state.json without a `requirements` node) still renders cleanly — no missing-node warnings, no layout regressions.
  4. No new console errors or warnings vs. the baseline.
  Capture a screenshot or short note of the verified state in the iteration's commit / PR description. The UI-test fixture coverage is necessary but not sufficient; this manual smoke is what catches rendering regressions that pass typecheck + unit tests.

## Code Surface

- Engine:
  - `.claude/skills/orchestration/scripts/lib/constants.ts` (actions + events)
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:86-120` (planning arrays)
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:68-74` (`PLANNING_SPAWN_STEPS`)
  - `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts` (new rule)
- Templates: `.claude/skills/orchestration/templates/default.yml` (new file, partial)
- Agent routing: `.claude/agents/planner.md`
- UI: `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120`
- Ripple surfaces (verified at plan time — only items marked **edit needed** require touching):
  - **edit needed** — `.claude/skills/brainstorm/references/project-memory.md:26-36` (priority list still names PRD / Architecture / Research Findings — replace with Requirements + Master Plan as the canonical pair)
  - **edit needed** — `.claude/skills/brainstorm/templates/BRAINSTORMING.md:13` (comment reads `PRD > Master Plan > Brainstorming`; reframe as `Requirements > Master Plan > Brainstorming`)
  - **edit needed** — `.claude/skills/brainstorm/references/project-series.md:57` (one-line mention; `(PRD if it exists, else BRAINSTORMING)` → include Requirements)
  - **edit needed** — `.claude/skills/orchestration/references/action-event-reference.md` (insert a `spawn_requirements` row above the existing `spawn_master_plan` row at line 12 in the action table; insert matching `requirements_started` / `requirements_completed` event rows in the events table)
  - **edit needed** — `.claude/skills/orchestration/references/pipeline-guide.md` — scan for any agent-prompt example referencing "Master Plan" as the first planning artifact and add a corresponding "Create the Requirements doc…" example sibling. Plan-time grep at iteration time to confirm exact lines.
  - **no edit required** — `.claude/skills/orchestration/references/document-conventions.md:13` (already lists `Requirements | (root) | {NAME}-REQUIREMENTS.md`)
  - **no edit required** — `.claude/skills/orchestration/references/context.md:57` (already mentions Requirements + Master Plan as canonical planning pair)
  - **no edit required** — `.claude/skills/orchestration/validate/lib/checks/config.js` (generic structural validator — no hardcoded action/event roster)
  - **no edit required** — `.claude/skills/rad-plan/SKILL.md:27-29` (Step 2 reads template YAML dynamically; auto-discovers `requirements` once `default.yml` exists)

## Dependencies

- **Depends on**: Iter 3 — the legacy upstream stages + their actions/events must be gone before introducing the new stage cleanly.
- **Blocks**: Iter 5 — the explosion script runs after `master_plan`; `master_plan` needs its new upstream dependency (requirements) in place first.

## Testing Discipline

- **Baseline first**: run the full test suite; save the log; note baseline SHA.
- **Re-run before exit**: full suite green; diff against baseline. Tests added for the new action / event / mutation / validator-rule should be the only meaningful additions; any baseline-passing test newly failing is a regression.
- Add a focused test: a fresh scratch project dispatches `spawn_requirements`, walks to `master_plan`, fires `master_plan_completed`, and reaches `plan_approval_gate`. This is the iteration's happy-path smoke.

## Exit Criteria

- Full test suite green vs. baseline.
- New action `spawn_requirements` + events `requirements_started` / `requirements_completed` present in `constants.ts` and exercised by at least one mutation test + one event-routing test.
- `validateFrontmatter('requirements_completed', …)` rejects a doc missing `requirement_count` and accepts one with `requirement_count: 3`.
- `@planner` with `spawn_requirements` dispatch writes `{NAME}-REQUIREMENTS.md` to the project dir with valid frontmatter.
- Scratch project drives `requirements` → `master_plan` → `plan_approval_gate` end-to-end under `default.yml`.
- UI renders the new `requirements` node in the "Planning" section alongside `master_plan`.
- **Manual browser smoke completed**: UI built + dev server run; new requirements node verified visually in a fresh project; legacy state.json verified to still render without regressions; PR description records the verification (screenshot or terse note).
- Brainstorm skill memory refs point at Requirements + Master Plan, not the legacy five-doc set.

## Open Questions

All resolved at plan time:

- **Action name convention** — RESOLVED: rename Iter-1 router row `create_requirements` → `spawn_requirements`. No dual-routing. Codified in Scope above. Reason: `spawn_*` is the live convention (see `spawn_master_plan`); `create_*` is reserved for execution-loop synthesized artifacts (`create_phase_plan`, `create_task_handoff`).
- **Pre-read for `requirements_completed`** — RESOLVED: no special-case needed. `preRead()` in `pre-reads.ts` runs `validateFrontmatter(event, …)` generically; the new validator rule registered in `frontmatter-validators.ts` is auto-picked-up. The `plan_approved` special-case is unique because it derives `doc_path` from `graph.nodes.master_plan.doc_path` — no analogous derivation exists for requirements.
- **Partial `default.yml` validation** — RESOLVED: validator allows it. `template-validator.ts` enforces no-cycles / no-dangling-refs / reachable nodes / valid kinds — none of those forbid a 3-node `step → step → gate` chain. No validator changes required.
