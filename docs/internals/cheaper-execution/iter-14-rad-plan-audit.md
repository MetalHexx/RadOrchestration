# Iter 14 — Rad-plan-audit pipeline node

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

> **Scope note**: The *corrective loop* half of the audit — replan path with audit-feedback context fed back into the planner's re-spawn — is split to [iter-18-plan-replan-cycle.md](./iter-18-plan-replan-cycle.md). Iter-14 delivers the audit node, doc, and UI rendering only. Human reads findings at the plan-approval gate and chooses approve or reject; today's blind-reject behavior (`plan_rejected` mutation) stays unchanged in this iteration.

## Overview

The legacy `rad-plan-audit` skill audited the full 5-doc planning corpus (PRD + Research + Design + Architecture + Master Plan) for cross-document cohesion. Under the new pipeline, only two planning docs exist (Requirements + Master Plan), and the explosion script produces per-phase + per-task handoff docs from the Master Plan. This iteration rewrites `rad-plan-audit` as a **first-class pipeline node** that runs between `explode_master_plan` and `request_plan_approval`, producing a structured audit report the human reads at the approval gate.

The audit operates on three dimensions:

- **Cross-document cohesion** — every Requirements ID cited by ≥1 task; every tag citation resolves to a Requirements block.
- **Task well-formedness (structural)** — File Targets present; requirements inlined (block text, not just tag ref); every step ends in ≥1 requirement tag; `code` tasks honor the 4-step RED-GREEN shape; `task_type` declared.
- **Authoring quality (anti-patterns)** — placeholder language; vague directives; "write tests for the above"; "similar to Task N" refs; test-quality anti-patterns; undefined refs; steps describing *what* without *how*.

Framing: TDD / DRY / YAGNI. Each principle maps onto the check categories (TDD → RED-GREEN; DRY → no cross-task "similar to Task N" refs + task handoffs self-contained; YAGNI → no placeholder language + scope matches requirement tags). Mirrors superpowers' `DRY. YAGNI. TDD.` top-line discipline.

The skill operates in **two modes** — *pipeline-spawned* (new action `spawn_plan_auditor` fires post-explosion; the `planner` agent runs in audit mode) and *user-invocable* (operator runs the skill ad-hoc from agent chat for re-audits after hand-edits or legacy-project audits). Both modes share the same 14-check catalog and output format.

## Scope

- **Skill rewrite** — `.claude/skills/rad-plan-audit/SKILL.md` + `references/`:
  - Dual-mode (pipeline-spawned + user-invocable). Mode-specific inputs resolved from spawn context (pipeline) or arguments (user).
  - 14 check catalog: 5 structural + 7 anti-pattern + 2 cross-document.
  - TDD / DRY / YAGNI framing section names the three principles and maps findings to them.
  - Output: `{PROJECT-DIR}/reports/{NAME}-PLAN-AUDIT.md` with frontmatter (`verdict: pass | issues_found`, `max_severity: none | minor | important | critical`) + structured body grouping findings by severity with per-finding location, description, and fix suggestion.
  - Shared authoring rules: references `.claude/skills/rad-create-plans/references/master-plan/workflow.md` (iter-13 adds anti-pattern-awareness rules there) as source of truth for "well-formed." Single spec, two skills (author + audit).
  - Legacy `references/` directory: delete any file covering removed audit modes (PRD audits, Research ↔ Architecture traceability, Design consistency, etc.).

- **New pipeline node** — `plan_audit` between `explode_master_plan` and `request_plan_approval`:
  - New action `spawn_plan_auditor` (Agent spawn, two-step protocol like existing `spawn_*` actions). Spawned agent: `planner` in audit mode — no new agent type.
  - New events: `plan_audit_started` (transitions node status to `in_progress`), `plan_audit_completed --doc-path <path>` (finalizes node; writes `doc_path` + `verdict` + `max_severity` to state).
  - State schema: new `plan_audit` step node with `status`, `doc_path`, `verdict`, `max_severity`.
  - Context enrichment: new branch for `spawn_plan_auditor` resolves Requirements doc + phase docs + task handoff docs from state and passes to agent context.
  - Mutation: `PLAN_AUDIT_COMPLETED` handler — marks node completed, stores doc_path + verdict + max_severity on state (for UI badge consumption).
  - Frontmatter validator: new rule set for `plan_audit_completed` — `verdict` enum (`pass | issues_found`), `max_severity` enum (`none | minor | important | critical`); both required.
  - `default.yml`: insert `plan_audit` step between `explode_master_plan` and `plan_approval_gate`.

- **Orchestration skill updates** — `.claude/skills/orchestration/`:
  - `SKILL.md` — orchestrator roster picks up new action + events.
  - `references/action-event-reference.md` — new action row; new event rows.
  - `references/pipeline-guide.md` — flow notes acknowledging new node position.
  - `references/document-conventions.md` — filename pattern row for `{NAME}-PLAN-AUDIT.md`.

- **UI rendering** — `ui/`:
  - New node rendering in `/projects` DAG timeline, between `explode_master_plan` and `plan_approval_gate`. Mirrors `requirements` / `master_plan` node shape.
  - New step row in `/process-editor` step list.
  - Doc-link rendering (clickable link to `{NAME}-PLAN-AUDIT.md`, same pattern as existing planning doc links).
  - Tri-color severity badge on the `plan_audit` step:
    - **Green**: `verdict: pass` (no findings)
    - **Yellow**: `verdict: issues_found` with `max_severity: minor` or `important`
    - **Red**: `verdict: issues_found` with `max_severity: critical`
  - Badge component: reuse `ui/components/badges/severity-badge.tsx` or compose a thin `plan-audit-badge.tsx` wrapper — iteration planner decides.
  - Legacy projects without `plan_audit` node render gracefully (no regression).

## Check Catalog (14 dimensions)

**Structural (5)** — mechanical; `critical` severity by default:

1. File Targets section present on every task handoff.
2. Requirements inlined (full block text, not just tag reference) on every task.
3. Every task step ends in ≥1 requirement tag (FR-N / NFR-N / AD-N / DD-N).
4. `code` tasks have the 4-step RED-GREEN shape (write failing test → run & confirm fail → implement → run & confirm pass) per `rad-create-plans/references/master-plan/workflow.md:132–140`.
5. Every task declares `task_type` (`code` / `doc` / `config` / `infra`).

**Anti-pattern (7)** — semantic; `important` or `minor` severity (iteration planner assigns per check):

1. Placeholder language ("TBD", "TODO", "implement later", "will be figured out", "fill in details").
2. Vague directives without specifics ("add appropriate error handling", "handle edge cases").
3. "Write tests for the above" without actual test code / commands.
4. "Similar to Task N" references (violates the self-contained handoff contract iter-13 locks).
5. Test-quality anti-patterns in task-authored test shapes — test-only methods in production code, opaque mocks, assertions that only verify mock behavior. Mirrors iter-13's executor-facing gate (preventive at authoring time).
6. Undefined references — task cites a function / file / type not in its File Targets or a prior task's outputs.
7. Steps describing *what* without *how* — missing code snippets / commands where the task is a `code` task.

**Cross-document (2)** — `critical` severity:

1. Forward coverage: every Requirements ID (FR-N / NFR-N / AD-N / DD-N) cited by ≥1 task step or phase `**Requirements:**` line.
2. Backward resolution: every tag citation in phase docs + task handoffs resolves to a Requirements block.

## Scope Deliberately Untouched

- **Auto-correct / inline plan edits** — audit is report-only. Human reads findings at the approval gate and decides approve or reject.
- **Replan event + context carry-forward** — split to [iter-18-plan-replan-cycle.md](./iter-18-plan-replan-cycle.md). Today's `plan_rejected` behavior (blind re-author; see `mutations.ts:1218`) stays unchanged in iter-14.
- **Explosion-fidelity check** (Master Plan ↔ exploded docs divergence) — covered by `explode-master-plan.ts`'s own tests. Out of audit scope.
- **Authoring-time preventive rules** — iter-13 lands those in `rad-create-plans/references/master-plan/workflow.md`. Iter-14 references that file as spec; no edits to it from iter-14.
- **Iteration / retry cap on re-audits** — audit loops through the human approval gate; no automatic re-audit loop needs a cap.

## UI Impact

- **Active-project rendering**: new `plan_audit` DAG node renders in `/projects` timeline between `explode_master_plan` and `plan_approval_gate`. Clickable doc link. Tri-color severity badge reflects `verdict` + `max_severity` frontmatter.
- **Process-editor**: new row for `plan_audit` step in the `/process-editor` step list (enable/disable toggle follows existing pattern for other pipeline steps).
- **Legacy-project rendering**: legacy `state.json` without `plan_audit` node renders without regression — the DAG timeline omits the node; no missing-node warnings.
- **UI surfaces touched**:
  - New or extended DAG node component under `ui/components/dashboard/`.
  - New or extended `/process-editor` step row.
  - Badge component — reuse `severity-badge.tsx` or compose `plan-audit-badge.tsx`.
- **UI tests**:
  - Badge rendering: all four state combinations (pass → green; minor → yellow; important → yellow; critical → red).
  - DAG node render with clickable doc link.
  - Legacy-project fixture (no `plan_audit` node) renders without errors.

## Code Surface

- Skill: `.claude/skills/rad-plan-audit/SKILL.md` + `references/`
- Engine (`.claude/skills/orchestration/scripts/lib/`):
  - `constants.ts` — add ACTION entry + EVENT entries
  - `context-enrichment.ts` — add enrichment branch for `spawn_plan_auditor`
  - `mutations.ts` — add `PLAN_AUDIT_COMPLETED` handler
  - `frontmatter-validators.ts` — add `plan_audit_completed` rule set
  - `actions.ts` — add action type
  - `events.ts` — add event type literals
  - `engine.ts` / walker — wire new node into DAG traversal
- State schema: `.claude/skills/orchestration/schemas/` — new node kind (if a new node kind is warranted; otherwise reuse `step` kind)
- Config template: `.claude/skills/orchestration/config/default.yml` — new step between `explode_master_plan` and `plan_approval_gate`
- Orchestration references:
  - `.claude/skills/orchestration/SKILL.md`
  - `.claude/skills/orchestration/references/action-event-reference.md`
  - `.claude/skills/orchestration/references/pipeline-guide.md`
  - `.claude/skills/orchestration/references/document-conventions.md`
- Ripple surfaces (read-only):
  - `.claude/skills/rad-create-plans/references/master-plan/workflow.md` — iter-13 adds preventive authoring rules; iter-14 references the same file as audit spec (no edits from iter-14)
- UI (`ui/`):
  - DAG timeline component
  - `/process-editor` step list component
  - Badge component (new or extended)
  - Document-ordering / doc-link renderer (confirm `plan_audit` doc path surfaces correctly)
- Tests:
  - `scripts/tests/constants.test.ts` — new action + event constants
  - `scripts/tests/context-enrichment.test.ts` — new enrichment branch
  - `scripts/tests/mutations.test.ts` — new mutation handler
  - `scripts/tests/contract/05-frontmatter-validation.test.ts` — new rule set (`verdict` + `max_severity` enums)
  - `scripts/tests/contract/02-event-names.test.ts` — new event names
  - `scripts/tests/engine.test.ts` / `event-routing-integration.test.ts` — pipeline routing (`explode_master_plan` → `plan_audit` → `plan_approval_gate`)
  - New audit-fixture tests under `.claude/skills/orchestration/scripts/tests/fixtures/plan-audit/` — at least 6 fixture pairs spanning cross-document / structural / anti-pattern dimensions; each dimension has one `pass` case + one `issues_found` case.
  - Grep-based contract test: SKILL.md body retains key language blocks (dual-mode description, 14-check catalog, TDD/DRY/YAGNI framing, reports/ output path).
  - UI tests: badge rendering + DAG node render + legacy compatibility.
- Prompt harness:
  - New `prompt-tests/plan-audit-e2e/` fixture exercises the node end-to-end — runner drives a project through explosion → plan_audit spawn → audit doc written → verdict surfaces in state → `plan_approval_gate` renders badge correctly. Inaugural baseline captured at iteration exit.

## Dependencies

- **Depends on**: iter-13. Iter-14 inherits iter-13's invariants (tag-on-every-step, 4-step RED-GREEN, File Targets mandatory, test-quality anti-patterns rejected) as audit checks. The preventive counterpart at `rad-create-plans/references/master-plan/workflow.md` (iter-13) must land first so iter-14 can reference it as spec.
- **Blocks**: iter-17 — public-docs refresh covers `rad-plan-audit`; cleaner for iter-14's overhaul to complete first so docs reflect the final shape.
- **Forward pointer**: [iter-18-plan-replan-cycle.md](./iter-18-plan-replan-cycle.md) — replan event + context carry-forward lands there, depending on iter-14's audit doc + state fields.

## Testing Discipline

- **Baseline first**: full suite + log + SHA across all three trees (scripts, ui, installer).
- **Re-run before exit**: full suite green; diff against baseline; no baseline-passing test regresses.
- **Fixture test suite** — at least 6 pairs under `scripts/tests/fixtures/plan-audit/`:
  - **Cross-document**: happy path (all tags covered + resolved) + broken (uncovered FR, dangling NFR citation).
  - **Structural**: happy path (all 5 invariants honored) + broken (missing File Targets on a task, missing step tag, `code` task lacking RED-GREEN shape).
  - **Anti-pattern**: happy path (clean authoring) + broken (placeholder language + vague directives + undefined ref + test-quality anti-pattern across multiple tasks).
- **Contract tests**: grep-based assertion that SKILL.md body retains key language blocks — dual-mode description, 14-check catalog, TDD/DRY/YAGNI framing, `reports/` output path. Catches prose drift in the future.
- **Prompt harness**: `plan-audit-e2e/` fixture runs green; inaugural baseline captured; verdict + max_severity surface correctly in state; UI badge renders the expected color.
- **UI smoke** (per orchestrator-guide requirement for `ui/`-touching iterations): browser verification of new DAG node + badge colors across all four state combinations + doc link clickability + legacy-project render stability.

## Writing Discipline

The SKILL.md rewrite must be **high-signal and cohesive** — not dense, repetitive, or over-bulleted. Collapse overlapping rules rather than listing each. If a rule is implied by another rule already present, it does not need its own bullet. Applies to the planner's SKILL.md output, not to this companion doc. (Carried over from iter-13.)

## Exit Criteria

- Full test suite green vs. baseline across all three trees.
- New pipeline node wired end-to-end: action + events + enrichment + mutation + validator + state schema + `default.yml` step. Pipeline routes correctly: `explode_master_plan` → `plan_audit` → `plan_approval_gate`.
- `rad-plan-audit/SKILL.md` rewrite covers 14 check dimensions with TDD / DRY / YAGNI framing and dual-mode (pipeline-spawned + user-invocable) support.
- `rad-plan-audit/references/` cleaned of files covering removed legacy audit modes. `grep -rn "PRD\|Research Doc\|Design Doc\|Architecture Doc" .claude/skills/rad-plan-audit/` returns zero matches.
- Audit doc at `{PROJECT-DIR}/reports/{NAME}-PLAN-AUDIT.md` with frontmatter `verdict` + `max_severity`; structured body groups findings by severity with per-finding location, description, and fix suggestion.
- Fixture tests: 6+ pairs pass. Broken fixtures produce `issues_found` with correct severity; clean fixtures produce `pass`.
- UI renders new DAG node with clickable doc-link and tri-color severity badge (green / yellow / red). All four frontmatter state combinations map to the expected color. Legacy projects render without regression.
- Orchestration skill references updated: `SKILL.md`, `action-event-reference.md`, `pipeline-guide.md`, `document-conventions.md`.
- Grep-based contract test covering SKILL.md key language blocks passes.
- `plan-audit-e2e/` prompt-harness fixture runs green; inaugural baseline committed.
- SKILL.md rewrite honors the Writing Discipline directive (high-signal, cohesive, not dense / repetitive) — verified during reviewer pass.
- Forward pointer to [iter-18-plan-replan-cycle.md](./iter-18-plan-replan-cycle.md) present for the replan-cycle half.
