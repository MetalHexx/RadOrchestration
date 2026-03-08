---
project: "PIPELINE-FEEDBACK"
status: "draft"
author: "product-manager-agent"
created: "2026-03-08T00:00:00Z"
---

# PIPELINE-FEEDBACK — Product Requirements

## Problem Statement

The orchestration system's Tactical Planner plans future work based on factual completion records (task reports) but not on evaluative judgments — code reviews and phase reviews are produced by the Reviewer but are invisible to the Planner because their paths are not tracked in `state.json`. Without a deterministic read path, review verdicts, architectural concerns, and requested changes do not reliably feed forward into subsequent task handoffs or phase plans. The Orchestrator has no mechanical way to verify that triage occurred; compliance is purely instruction-dependent, which means it can be silently skipped.

---

## Goals

- **G-1**: Review verdicts are captured in `state.json` as machine-readable fields for every reviewed task and phase, providing a complete audit trail.
- **G-2**: Triage always runs before planning when a review document is present — the Orchestrator can verify this mechanically via a field-level state check without parsing any document.
- **G-3**: The Orchestrator can self-correct a triage-skip by re-spawning the Planner with an explicit instruction, without requiring human intervention.
- **G-4**: The happy path (Planner follows the triage skill correctly) requires zero additional agent invocations compared to the current pipeline.
- **G-5**: The Planner's triage routing is fully deterministic — every combination of report status, deviations, and review verdict maps to exactly one action via a published decision table.

---

## Non-Goals

- **Planning document feedback loop** — updating PRD, Design, or Architecture documents based on execution findings is explicitly deferred.
- **Per-task mandatory reviews** — this project does not change when reviews are required; the existing two-level model (task code review + phase review) is preserved.
- **Reviewer agent changes** — review document formats, Reviewer behavior, and Reviewer output paths are out of scope.
- **Migration tooling** — no automated migration of existing `state.json` files is required; backward compatibility is achieved through null-treatment policy.
- **Dashboard or UI for review tracking** — the audit trail is state.json fields only.
- **Concurrency or parallelism changes** — the one-task-in-progress constraint is unchanged.

---

## User Stories

| # | As a… | I want to… | So that… | Priority |
|---|--------|------------|----------|----------|
| US-1 | Orchestrator | perform a field-level check on `state.json` to confirm triage ran before advancing | I never need to parse review documents to make routing decisions | P0 |
| US-2 | Orchestrator | automatically re-spawn the Planner with an explicit triage instruction when triage was skipped | the pipeline self-corrects without requiring human intervention | P0 |
| US-3 | Tactical Planner | find review document paths directly in `state.json` rather than constructing or guessing paths | I have a deterministic, auditable read path for every review I must process | P0 |
| US-4 | Tactical Planner | consult a complete, tabular decision table covering every combination of task report status, deviation type, and code review verdict | my routing decisions are never a judgment call | P0 |
| US-5 | Tactical Planner | write my triage verdict and action to `state.json` before producing a handoff or phase plan | the Orchestrator can verify triage ran and the audit trail is complete | P0 |
| US-6 | Human auditor | see both the raw reviewer verdict and the Planner's resolved action in `state.json` for every reviewed task and phase | I can reconstruct exactly what the reviewer said and what the pipeline decided to do with it | P1 |
| US-7 | Human auditor | distinguish between "no review conducted" and "triage was skipped" from state fields alone | I can identify anomalies without reading full review documents | P1 |
| US-8 | Tactical Planner | receive carry-forward items from phase reviews embedded in my triage decision | integration issues and unmet exit criteria are never silently lost between phases | P1 |
| US-9 | Tactical Planner | have a consistent triage read sequence for both Mode 3 (phase planning) and Mode 4 (task handoff) | I always know what to read, in what order, and under what conditions | P1 |
| US-10 | Orchestrator | have the gatekeep check add zero overhead when the Planner follows the triage skill | autonomous execution is not slowed down on the common case | P2 |

---

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|-------------|----------|-------|
| FR-01 | Each task entry in `state.json` must add three new fields: `review_doc` (path to the Code Review document, or null if no review yet), `review_verdict` (raw verdict transcribed from the review: `approved`, `changes_requested`, `rejected`, or null if not yet triaged), and `review_action` (Planner's resolved decision: `advanced`, `corrective_task_issued`, `halted`, or null if not yet triaged). | P0 | `review_verdict` values must match the existing Reviewer frontmatter enum exactly — no mapping or translation. |
| FR-02 | Each phase entry in `state.json` must add three new fields: `phase_review` (path to the Phase Review document, or null), `phase_review_verdict` (`approved`, `changes_requested`, `rejected`, or null), and `phase_review_action` (`advanced`, `corrective_tasks_issued`, `halted`, or null). | P0 | Mirrors FR-01 at phase granularity. |
| FR-03 | The `state.json` schema version identifier must be updated to reflect the new schema, allowing future tooling to distinguish old from new state files. | P1 | Informational only — no migration is required. |
| FR-04 | Tactical Planner Mode 2 (Update State) must be explicitly extended to cover two new write operations: (a) write `task.review_doc` to state.json after the Orchestrator reports that a code review has been completed; (b) write `phase.phase_review` to state.json after the Orchestrator reports that a phase review has been completed. | P0 | Preserves sole-writer rule. The Reviewer saves the document; the Planner records the path. |
| FR-05 | A new `triage-report` skill must be created for the Tactical Planner. The skill must define: (a) the read sequence for the Mode 4 context (task-level triage); (b) the read sequence for the Mode 3 context (phase-level triage); (c) a complete task-level decision table covering all combinations of task report status (`complete`, `partial`, `failed`), deviation presence and type, and code review verdict (`approved`, `changes_requested`, `rejected`, null); (d) a complete phase-level decision table covering all combinations of phase review verdict and exit-criteria assessment outcome; (e) the two outputs of triage: updated verdict/action fields in state.json, and the Planner's next action (advance / corrective handoff / halt signal). The skill produces no separate document. | P0 | Decision table must be exhaustive — every possible input combination maps to exactly one action. No rows with "use judgment." |
| FR-06 | Tactical Planner Mode 3 (Create Phase Plan) must include a mandatory triage step, executed after reading all input documents and before producing the Phase Plan document. The triage step must: (1) check whether `phase.phase_review` is non-null in state.json; (2) if non-null, read the Phase Review document; (3) execute the phase-level decision table from the `triage-report` skill; (4) write `phase_review_verdict` and `phase_review_action` to state.json; (5) then produce the Phase Plan document whose content reflects the triage outcome. | P0 | Triage and planning occur in the same Planner invocation — no separate spawn required. |
| FR-07 | Tactical Planner Mode 4 (Create Task Handoff) must include a mandatory triage step, executed after reading all input documents and before producing the Task Handoff document. The triage step must: (1) check whether `task.review_doc` is non-null in state.json for the relevant completed task; (2) if non-null, read the Code Review document; (3) execute the task-level decision table from the `triage-report` skill; (4) write `review_verdict` and `review_action` to state.json; (5) then produce the Task Handoff document (or corrective handoff, or halt signal) as directed by the triage decision. | P0 | Corrective Task Handoff sub-flow (current agent file lines 127–134) is subsumed into the triage step — not a separate parallel path. |
| FR-08 | The Orchestrator's execution loop must add a task-level gatekeep check: after the Planner records `task.review_doc` via Mode 2 and the Orchestrator re-reads state.json, the Orchestrator must check the invariant `task.review_doc != null AND task.review_verdict == null`. If the invariant is true, the Orchestrator must re-spawn the Planner with an explicit triage instruction that names the review document path before allowing the pipeline to advance to the next task. | P0 | Re-spawn instruction must be explicit: name the review_doc path, name the field to write, and direct the Planner to continue with its planned handoff after triage. |
| FR-09 | The Orchestrator's execution loop must add a phase-level gatekeep check: after the Planner records `phase.phase_review` via Mode 2 and the Orchestrator re-reads state.json, the Orchestrator must check the invariant `phase.phase_review != null AND phase.phase_review_verdict == null`. If true, re-spawn the Planner with an explicit phase triage instruction before advancing to the next phase. | P0 | Symmetric with FR-08 at phase granularity. |
| FR-10 | Backward compatibility: any `state.json` file missing the new fields (`review_doc`, `review_verdict`, `review_action`, `phase_review`, `phase_review_verdict`, `phase_review_action`) must be treated as if all absent fields are null. No absent field may cause a pipeline error or trigger the gatekeep invariant. | P0 | The invariant `null != null` evaluates to false — a legacy file with both fields absent must not trigger a re-spawn. |

---

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|-------------|
| NFR-01 | Performance | Triage must add zero additional agent invocations on the happy path. When the Planner follows the triage skill correctly (verdict written before producing handoff), the Orchestrator's gatekeep check reads two fields and continues without spawning any additional agent. |
| NFR-02 | Determinism | The triage decision table must be exhaustive and unambiguous. Every combination of inputs (report status × deviation type × review verdict) must map to exactly one action. No row may require the Planner to exercise discretion or judgment. |
| NFR-03 | Auditability | Both `review_verdict` (raw reviewer output) and `review_action` (Planner's resolved decision) must be recorded in state.json for every review that is triaged. These fields must remain immutable after being written — a subsequent triage of a different task must not overwrite a previous task's fields. |
| NFR-04 | Integrity — Sole Writer | The Tactical Planner is the sole writer of all new state.json fields. No other agent — including the Reviewer and the Orchestrator — may write `review_doc`, `review_verdict`, `review_action`, `phase_review`, `phase_review_verdict`, or `phase_review_action`. |
| NFR-05 | Backward Compatibility | The null-treatment policy for absent fields must be honored by the Orchestrator, the Tactical Planner, and any tooling that reads state.json. A legacy state file must run through the updated pipeline without errors or spurious gatekeep re-spawns. |
| NFR-06 | Reliability — Gatekeep | The Orchestrator's gatekeep check must be a pure field-level comparison on state.json values. It must not read, parse, or interpret any review document. All routing information needed by the Orchestrator must be available in state.json fields alone. |
| NFR-07 | Safety — Re-spawn Limit | The Orchestrator must not re-spawn the Planner for triage infinitely. If the triage invariant remains true after a re-spawn (verdict still null), the pipeline must halt with an explicit error rather than looping. |

---

## Assumptions

- **A-1**: Review document paths follow the established Reviewer convention: Code Review at `reports/CODE-REVIEW-P{NN}-T{NN}.md`, Phase Review at `reports/PHASE-REVIEW-P{NN}.md`. The Planner can verify and record these paths without constructing them heuristically.
- **A-2**: Review document frontmatter uses a `verdict` field with values exactly matching the set `approved | changes_requested | rejected`. The Planner transcribes this value verbatim into `review_verdict` — no mapping or normalization is required.
- **A-3**: The Orchestrator's spawn mechanism can pass structured, path-aware instructions to the Planner (e.g., "the review doc is at `{path}`, read it and write the verdict"). This is consistent with the existing spawn pattern documented in the Orchestrator agent.
- **A-4**: Only one task is in progress across the entire project at any time (the existing sequential execution constraint). Triage decisions about corrective tasks can therefore be made without concurrency concerns.
- **A-5**: The Tactical Planner is capable of reading review documents and extracting the verdict and issue list from frontmatter and body content, consistent with its existing Mode 5 behavior (which already reads all code reviews for a phase).
- **A-6**: Existing `state.json` files lack the new fields entirely (not present with null values). The null-treatment policy applies to field absence, not just null values.

---

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R-1 | Tactical Planner skips the triage step despite the Mode 3/4 instructions | High — review findings don't feed forward; pipeline advances on incomplete information | Orchestrator gatekeep (FR-08, FR-09) catches the skip via the state field invariant and re-spawns with an explicit instruction |
| R-2 | Orchestrator gatekeep re-spawns the Planner, but the Planner fails to complete triage again (e.g., review doc is unreadable) | High — infinite re-spawn loop blocks the pipeline | NFR-07 requires a re-spawn limit; if the invariant is still true after one re-spawn, the pipeline halts with an explicit blocker |
| R-3 | Review document is missing or at an unexpected path when the Planner attempts to read it during triage | Medium — triage cannot complete, verdict cannot be written | Planner should report a specific error (doc not found at path in state.json) and signal the Orchestrator to halt rather than silently skip |
| R-4 | `review_verdict` enum values in new state fields diverge from Reviewer frontmatter values (e.g., casing differences) | Medium — Orchestrator gatekeep may misread state; routing decisions corrupt | FR-01 explicitly requires the enum values to match the Reviewer frontmatter exactly; the `triage-report` skill must specify verbatim transcription |
| R-5 | Schema version bump breaks existing tooling that reads state.json | Low — the bump is informational; null-treatment policy handles field absence | FR-10 (backward compat) and FR-03 (schema version is informational only) address this; no migration is required |
| R-6 | Triage decision table has gaps — an input combination not covered causes the Planner to improvise | Medium — routing becomes non-deterministic for that combination | FR-05 requires the decision table to be exhaustive; review during Architecture phase must verify no uncovered combinations |

---

## Open Questions Resolved

**OQ-1: Should `review_verdict` carry the raw reviewer verdict only, or also a Planner-resolved action field?**

**Resolution: Both fields are required.** `review_verdict` captures the raw reviewer verdict transcribed from the review document — it is the input to the triage decision table and the signal the Orchestrator's gatekeep reads. `review_action` captures the Planner's resolved decision — the operational outcome of applying the decision table (e.g., verdict was `changes_requested`, but retries were exhausted so action became `halted`). These serve different audiences: `review_verdict` serves the Orchestrator (routing signal) and `review_action` serves human auditors and future planners (audit trail). Keeping them separate allows the two to diverge meaningfully and preserves a complete record of both what the reviewer said and what the pipeline did in response.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Triage invariant violation rate (gatekeep fires) | 0% on steady-state runs after initial stabilization | Count of Orchestrator triage re-spawns per pipeline run; should trend to zero once Planner instruction is stable |
| Review verdict capture rate (task-level) | 100% of reviewed tasks have non-null `review_verdict` in state.json after pipeline completion | Inspect state.json: count tasks with non-null `review_doc`; all must have non-null `review_verdict` |
| Review verdict capture rate (phase-level) | 100% of reviewed phases have non-null `phase_review_verdict` in state.json after pipeline completion | Inspect state.json: count phases with non-null `phase_review`; all must have non-null `phase_review_verdict` |
| Happy-path agent invocation count | No increase in total agent spawns per task cycle compared to baseline | Count spawns per task cycle in runs where Planner follows triage skill correctly |
| Audit trail completeness | Both `review_verdict` and `review_action` populated for every triaged review (null for neither) | Inspect state.json: no task or phase where `review_verdict != null AND review_action == null` |
| Backward compatibility | Zero pipeline errors when running an existing (legacy) state.json through the updated pipeline | Test run against a pre-existing state.json missing the new fields; pipeline must complete without errors |
