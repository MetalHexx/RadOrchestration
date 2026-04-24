# Template Architecture Refactor — Context & Ideas

> Captured during the BETTER-PLAN-DOCS-6 brainstorming session (2026-04-15). This is a reference document for a future TEMPLATE-ARCHITECTURE project series — not a planning artifact for BETTER-PLAN-DOCS.

## Background

The orchestration pipeline uses YAML template files (`full.yml`, `quick.yml`) to define the DAG of nodes that a project executes. Templates are composable — nodes can be added or removed to create lighter or heavier pipelines. During the BETTER-PLAN-DOCS-6 brainstorm, we identified that the relationship between template topology and document creation is under-specified. Specifically:

- **What nodes are required vs. optional?** There's no formal contract. Template authors must intuit which nodes can be safely removed.
- **What implicit couplings exist?** The `for_each_task` loop reads its `tasks` array from the `phase_planning` node's output doc. If `phase_planning` is absent but `task_loop` is present, the pipeline stalls silently.
- **How does document thickness adapt?** P5 introduced adaptive thickness for the Master Plan (thin when `phase_planning` exists, thick when it doesn't). But the "absent" case may not be achievable without pipeline code changes, since `for_each_task` can't resolve its source.
- **quick.yml is effectively dead.** It predates the BETTER-PLAN-DOCS series conventions and needs a full rewrite.

## Proposed Minimum Template Skeleton

The following nodes would be **required in every template**. Optional nodes add depth (richer planning, more review) but the skeleton is the invariant structure.

### Pipeline Node Inventory

| Node | Kind | Category | Proposed | Notes |
|---|---|---|---|---|
| `prd` | step | Planning | **Optional** | Upstream planning depth knob |
| `research` | step | Planning | **Optional** | Upstream planning depth knob |
| `design` | step | Planning | **Optional** | Upstream planning depth knob |
| `architecture` | step | Planning | **Optional** | Upstream planning depth knob |
| `master_plan` | step | Planning | **Required** | Always need a plan. Variable thickness absorbs missing upstream docs. |
| `plan_approval_gate` | gate | Gate | **Required** | Approval flow — config-driven (can auto-approve) |
| `gate_mode_selection` | gate | Gate | **Required** | Execution mode selection — config-driven |
| `phase_loop` | for_each_phase | Loop | **Required** | Always iterate phases — even single-phase projects use the loop |
| `phase_planning` | step | Phase body | **Required** | Produces the doc that feeds `for_each_task`. Variable thickness. |
| `task_loop` | for_each_task | Loop | **Required** | Always iterate tasks within phases |
| `task_handoff` | step | Task body | **Required** | Always produce a handoff for the coding agent |
| `task_executor` | step | Task body | **Required** | Always execute the task |
| `code_review` | step | Task body | **Optional** | Review depth knob |
| `commit_gate` | conditional | Task body | **Required** | Config-driven (`source_control.auto_commit`) |
| `task_gate` | gate | Task body | **Required** | Config-driven (execution mode) |
| `phase_report` | step | Phase body | **Optional** | Review depth knob |
| `phase_review` | step | Phase body | **Optional** | Review depth knob (produces review doc) |
| `phase_gate` | gate | Phase body | **Required** | Config-driven (execution mode) |
| `final_review` | step | Post-loop | **Optional** | Review depth knob |
| `pr_gate` | conditional | Post-loop | **Required** | Config-driven (`source_control.auto_pr`) |
| `final_approval_gate` | gate | Post-loop | **Required** | Config-driven |

### Key Principles

1. **Gates and conditionals are always present** — their behavior is driven by project configuration, not template composition. A lightweight pipeline doesn't delete `commit_gate`; it sets `source_control.auto_commit: never` and the conditional branch skips.

2. **Loops are always present** — even a single-phase, single-task project uses `for_each_phase` and `for_each_task`. The Master Plan's `total_phases: 1` and the Phase Plan's `tasks: [{id: T01, title: ...}]` drive the iteration count.

3. **Optional nodes are depth knobs** — they add richer planning (upstream docs) or richer review (code review, phase report, final review). Removing them makes the pipeline faster and lighter without breaking the structural skeleton.

4. **Document thickness adapts to topology** — when upstream planning docs are absent, the Master Plan absorbs their concerns (free-form input mode from P5). When `phase_planning` produces a thin Phase Plan, the Task Handoff creator works from less pre-digested context. Thickness is a spectrum, not a binary.

## The Coupling Constraint

The `for_each_task` loop has a hard dependency on `phase_planning`:

```yaml
- id: task_loop
  kind: for_each_task
  source_doc_ref: "$.current_phase.doc_path"  # resolves to phase_planning's output
  tasks_field: tasks
  depends_on: [phase_planning]
```

This means:
- `phase_planning` must exist whenever `task_loop` exists
- `phase_planning` must produce a document with a `tasks` frontmatter array
- The pipeline engine does not support alternative source resolution paths

This coupling is currently implicit — the engine returns `null` (stall) if `source_doc_ref` can't resolve. Making this an explicit, validated constraint is part of this project's scope.

## Frontmatter Pipeline Contracts

These frontmatter fields are consumed by the DAG engine for control flow:

| Document | Field | Type | Consumer | Event |
|---|---|---|---|---|
| Master Plan | `total_phases` | positive integer | `for_each_phase` expansion | `plan_approved` |
| Phase Plan | `tasks` | non-empty array of `{id, title}` | `for_each_task` expansion | `phase_plan_created` |
| Code Review | `verdict` | `"approved"` / `"changes_requested"` / `"rejected"` | Gate evaluation | `code_review_completed` |
| Phase Review | `verdict` | string | Gate evaluation | `phase_review_completed` |
| Phase Review | `exit_criteria_met` | boolean | Informational | `phase_review_completed` |

Task Handoff frontmatter is NOT validated — all fields are metadata for the coding agent.

## Open Questions for the TEMPLATE-ARCHITECTURE Series

1. **Should the engine validate template composition?** Reject templates at load time if required nodes are missing, rather than stalling silently at runtime.
2. **Should `for_each_task` support alternative source paths?** E.g., reading task arrays from the Master Plan when `phase_planning` is absent. This would decouple the two nodes but add engine complexity.
3. **How many template variants are needed?** Full, quick, and minimal? Or is the minimum skeleton + optional nodes enough to cover all use cases?
4. **Should gates auto-approve by default when their prerequisite step is absent?** E.g., `phase_gate` auto-approves when `phase_review` doesn't exist (no review doc to evaluate).
5. **Template authoring guide** — does the system need documentation for creating custom templates, or is the node inventory + required/optional contract sufficient?

## Relationship to BETTER-PLAN-DOCS

This work is intentionally separated from BETTER-PLAN-DOCS because:

- **BETTER-PLAN-DOCS** focuses on *document quality* — how planning documents are created, structured, and linked. It targets `full.yml` as the only valid template today.
- **TEMPLATE-ARCHITECTURE** focuses on *pipeline topology* — which nodes are required, how templates compose, and what constraints govern valid configurations.

The mega skill work in BETTER-PLAN-DOCS benefits any template topology. Once TEMPLATE-ARCHITECTURE establishes the formal skeleton, the mega skill may need a follow-up pass to handle new template variants — but that's an incremental addition, not a redesign.
