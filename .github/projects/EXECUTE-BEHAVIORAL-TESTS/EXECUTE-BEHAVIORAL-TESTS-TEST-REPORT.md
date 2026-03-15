---
project: "EXECUTE-BEHAVIORAL-TESTS"
type: "test-report"
author: "coder-agent"
created: "2026-03-14"
suites:
  - name: "pipeline-behavioral"
    runner: "node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js"
  - name: "triage-engine"
    runner: "node --test .github/orchestration/scripts/tests/triage-engine.test.js"
  - name: "mutations"
    runner: "node --test .github/orchestration/scripts/tests/mutations.test.js"
  - name: "pipeline-engine"
    runner: "node --test .github/orchestration/scripts/tests/pipeline-engine.test.js"
---

# Test Report: EXECUTE-BEHAVIORAL-TESTS

## Executive Summary

A total of 280 tests were executed across 4 suites. 276 passed and 4 failed — all 4 failures occurred in the `pipeline-engine` suite. The `pipeline-behavioral`, `triage-engine`, and `mutations` suites passed with zero failures. The 4 failing tests share a common root cause: they expect `generate_phase_report` or `gate_task` as the next action after `task_completed` with a complete/no-deviations/no-review report, but the triage engine fix (Row 1 now routes to code review) produces `spawn_code_reviewer` instead. These pipeline-engine test expectations were not updated to match the new Row 1 behavior.

> **Result: FAIL** — 280 tests executed across 4 suites, 276 passed, 4 failed.

## Summary Statistics

### pipeline-behavioral

| Metric  | Count |
|---------|-------|
| Total   | 46    |
| Passed  | 46    |
| Failed  | 0     |
| Skipped | 0     |

### triage-engine

| Metric  | Count |
|---------|-------|
| Total   | 45    |
| Passed  | 45    |
| Failed  | 0     |
| Skipped | 0     |

### mutations

| Metric  | Count |
|---------|-------|
| Total   | 126   |
| Passed  | 126   |
| Failed  | 0     |
| Skipped | 0     |

### pipeline-engine

| Metric  | Count |
|---------|-------|
| Total   | 63    |
| Passed  | 59    |
| Failed  | 4     |
| Skipped | 0     |

### Combined Totals

| Metric  | Count |
|---------|-------|
| Total   | 280   |
| Passed  | 276   |
| Failed  | 4     |
| Skipped | 0     |

## Results Table

| Status | Test Name | Suite / Describe Block |
|--------|-----------|------------------------|
| ✅ | walks through all 15 pipeline steps from start → display_complete | pipeline-behavioral / Behavioral: Full Happy Path |
| ✅ | walks through 2 phases × 2 tasks to completion | pipeline-behavioral / Behavioral: Multi-Phase Multi-Task |
| ✅ | Row 1: complete, no deviations, no review_doc → spawn code reviewer → spawn_code_reviewer | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 3: complete, no deviations, verdict=approved → advance → generate_phase_report | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 4: complete, has_deviations=true, deviation_type=minor, verdict=approved → advance → generate_phase_report | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 5: complete, has_deviations=true, deviation_type=architectural, verdict=approved → advance → generate_phase_report | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 6: complete, verdict=changes_requested → corrective → create_corrective_handoff | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 7: complete, verdict=rejected → halt → display_halted | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 8: partial, no review_doc → auto-approve → generate_phase_report | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 9: partial, verdict=changes_requested → corrective → create_corrective_handoff | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 10: partial, verdict=rejected → halt → display_halted | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 11: failed, severity=minor, retries < max → corrective → create_corrective_handoff | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Row 12: failed, severity=critical → halt → display_halted | pipeline-behavioral / Behavioral: Task Triage |
| ✅ | Phase Row 2: approved, exit_criteria_met=true, non-last phase → advance → create_phase_plan | pipeline-behavioral / Behavioral: Phase Triage |
| ✅ | Phase Row 2: approved, exit_criteria_met=true, last phase → advance → spawn_final_reviewer | pipeline-behavioral / Behavioral: Phase Triage |
| ✅ | Phase Row 3: approved, exit_criteria_met=false → advance with carry-forward → create_phase_plan | pipeline-behavioral / Behavioral: Phase Triage |
| ✅ | Phase Row 4: changes_requested → corrective_tasks_issued → create_phase_plan | pipeline-behavioral / Behavioral: Phase Triage |
| ✅ | Phase Row 5: rejected → halted → display_halted | pipeline-behavioral / Behavioral: Phase Triage |
| ✅ | autonomous mode: task auto-advances after triage approval — no gate returned | pipeline-behavioral / Behavioral: Human Gate Modes |
| ✅ | task mode: triage approves task → gate_task, then gate_approved → create_task_handoff | pipeline-behavioral / Behavioral: Human Gate Modes |
| ✅ | phase mode: phase triage approves → gate_phase, then gate_approved advances phase | pipeline-behavioral / Behavioral: Human Gate Modes |
| ✅ | ask mode: task auto-advances, no execution-tier gate returned | pipeline-behavioral / Behavioral: Human Gate Modes |
| ✅ | gate_rejected: pipeline transitions to halted with active blocker | pipeline-behavioral / Behavioral: Human Gate Modes |
| ✅ | single corrective cycle: task fails minor → corrective handoff → succeeds → phase report | pipeline-behavioral / Behavioral: Retry & Corrective Cycles |
| ✅ | retry exhaustion: task retries at max → fails again → halted | pipeline-behavioral / Behavioral: Retry & Corrective Cycles |
| ✅ | task rejected by reviewer → halted | pipeline-behavioral / Behavioral: Halt Paths |
| ✅ | task critical failure → halted | pipeline-behavioral / Behavioral: Halt Paths |
| ✅ | phase rejected by reviewer → halted | pipeline-behavioral / Behavioral: Halt Paths |
| ✅ | gate_rejected → halted with active blocker | pipeline-behavioral / Behavioral: Halt Paths |
| ✅ | new project (no state) → spawn_research with 1 write | pipeline-behavioral / Behavioral: Cold-Start Resume |
| ✅ | mid-execution task in_progress with handoff → execute_task (zero writes) | pipeline-behavioral / Behavioral: Cold-Start Resume |
| ✅ | between phases (phase 0 complete, phase 1 not_started) → create_phase_plan (zero writes) | pipeline-behavioral / Behavioral: Cold-Start Resume |
| ✅ | halted project → display_halted (zero writes) | pipeline-behavioral / Behavioral: Cold-Start Resume |
| ✅ | completed project → display_complete (zero writes) | pipeline-behavioral / Behavioral: Cold-Start Resume |
| ✅ | phase_plan_created with non-existent file → error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | phase_plan_created with missing tasks field → error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | phase_plan_created with empty tasks array → error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | task_completed with report missing has_deviations → error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | task_completed with report missing deviation_type → error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | readDocument null-return path — task report not found → structured error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | createProjectAwareReader both-paths-null — phase plan not found → structured error | pipeline-behavioral / Behavioral: Pre-Read Failures |
| ✅ | tasks array from phase plan flows into state | pipeline-behavioral / Behavioral: Frontmatter-Driven Flows |
| ✅ | has_deviations/deviation_type drive correct triage row (Row 4: minor, approved → advance) | pipeline-behavioral / Behavioral: Frontmatter-Driven Flows |
| ✅ | exit_criteria_met=true drives Phase Row 2 (approved → advance → create_phase_plan) | pipeline-behavioral / Behavioral: Frontmatter-Driven Flows |
| ✅ | exit_criteria_met=false drives Phase Row 3 (approved → advance with carry-forward → create_phase_plan) | pipeline-behavioral / Behavioral: Frontmatter-Driven Flows |
| ✅ | exit_criteria_met absent from phase review → triage error | pipeline-behavioral / Behavioral: Frontmatter-Driven Flows |
| ✅ | Row 1: complete, no deviations, no review — spawn code reviewer | triage-engine / Task-Level Decision Table |
| ✅ | Row 1b: complete, deviations, no review — spawn code reviewer | triage-engine / Task-Level Decision Table |
| ✅ | Row 3: complete, no deviations, approved — advance | triage-engine / Task-Level Decision Table |
| ✅ | Row 4: complete, minor deviations, approved — advance | triage-engine / Task-Level Decision Table |
| ✅ | Row 5: complete, architectural deviations, approved — advance | triage-engine / Task-Level Decision Table |
| ✅ | Row 6: complete, changes requested — corrective task | triage-engine / Task-Level Decision Table |
| ✅ | Row 7: complete, rejected — halt | triage-engine / Task-Level Decision Table |
| ✅ | Row 8: partial, no review — skip triage | triage-engine / Task-Level Decision Table |
| ✅ | Row 9: partial, changes requested — corrective task | triage-engine / Task-Level Decision Table |
| ✅ | Row 10: partial, rejected — halt | triage-engine / Task-Level Decision Table |
| ✅ | Row 11: failed, minor severity, retries available — corrective task (no review doc) | triage-engine / Task-Level Decision Table |
| ✅ | Row 11: failed, minor severity, retries available — verdict sourced from review doc | triage-engine / Task-Level Decision Table |
| ✅ | Row 12: failed, critical severity — halt | triage-engine / Task-Level Decision Table |
| ✅ | Row 12: failed, minor severity, retries exhausted — halt | triage-engine / Task-Level Decision Table |
| ✅ | Row 12: failed, null severity — halt | triage-engine / Task-Level Decision Table |
| ✅ | minor severity, retries 0, max 2 → corrective_task_issued | triage-engine / checkRetryBudget |
| ✅ | minor severity, retries 1, max 2 → corrective_task_issued | triage-engine / checkRetryBudget |
| ✅ | minor severity, retries 2, max 2 → halted (at max) | triage-engine / checkRetryBudget |
| ✅ | minor severity, retries 3, max 2 → halted (above max) | triage-engine / checkRetryBudget |
| ✅ | critical severity, retries 0, max 2 → halted | triage-engine / checkRetryBudget |
| ✅ | null severity, retries 0, max 2 → halted | triage-engine / checkRetryBudget |
| ✅ | Phase Row 1: no phase review — skip triage | triage-engine / Phase-Level Decision Table |
| ✅ | Phase Row 2: approved, exit_criteria_met true — advance | triage-engine / Phase-Level Decision Table |
| ✅ | Phase Row 3: approved, exit_criteria_met partial — advance with carry-forward | triage-engine / Phase-Level Decision Table |
| ✅ | Phase Row 4: changes requested — corrective tasks (plural) | triage-engine / Phase-Level Decision Table |
| ✅ | Phase Row 5: rejected — halt | triage-engine / Phase-Level Decision Table |
| ✅ | DOCUMENT_NOT_FOUND: task report missing | triage-engine / Error Cases |
| ✅ | DOCUMENT_NOT_FOUND: code review missing | triage-engine / Error Cases |
| ✅ | DOCUMENT_NOT_FOUND: phase review missing | triage-engine / Error Cases |
| ✅ | INVALID_VERDICT: unrecognized task-level verdict | triage-engine / Error Cases |
| ✅ | INVALID_VERDICT: unrecognized phase-level verdict | triage-engine / Error Cases |
| ✅ | IMMUTABILITY_VIOLATION: task already has review_verdict | triage-engine / Error Cases |
| ✅ | IMMUTABILITY_VIOLATION: phase already has phase_review_verdict | triage-engine / Error Cases |
| ✅ | INVALID_LEVEL: bad level string | triage-engine / Error Cases |
| ✅ | INVALID_STATE: null state | triage-engine / Error Cases |
| ✅ | INVALID_STATE: missing execution.phases | triage-engine / Error Cases |
| ✅ | has_deviations: true with deviation_type minor triggers Row 4 | triage-engine / Edge Cases |
| ✅ | exit_criteria_met: true → Row 2 | triage-engine / Edge Cases > exit_criteria_met variants → Row 2 (all met) |
| ✅ | exit_criteria_met: undefined → MISSING_REQUIRED_FIELD error | triage-engine / Edge Cases > exit_criteria_met: undefined/null → MISSING_REQUIRED_FIELD error |
| ✅ | exit_criteria_met: null → MISSING_REQUIRED_FIELD error | triage-engine / Edge Cases > exit_criteria_met: undefined/null → MISSING_REQUIRED_FIELD error |
| ✅ | exit_criteria_met: "all" → Row 3 | triage-engine / Edge Cases > exit_criteria_met: "all" → Row 3 (string is not true) |
| ✅ | exit_criteria_met: false → Row 3 | triage-engine / Edge Cases > exit_criteria_met variants → Row 3 (partial) |
| ✅ | exit_criteria_met: "partial" → Row 3 | triage-engine / Edge Cases > exit_criteria_met variants → Row 3 (partial) |
| ✅ | Task Row 5 action is singular corrective_task_issued | triage-engine / Edge Cases |
| ✅ | Phase Row 4 action is plural corrective_tasks_issued | triage-engine / Edge Cases |
| ✅ | has exactly 18 entries | mutations / MUTATIONS record |
| ✅ | every handler is a named function | mutations / MUTATIONS record |
| ✅ | all 18 handlers return { state, mutations_applied } with mutations_applied as string[] | mutations / MUTATIONS record |
| ✅ | returns a function for 'research_completed' | mutations / getMutation |
| ✅ | returns a function for 'prd_completed' | mutations / getMutation |
| ✅ | returns a function for 'design_completed' | mutations / getMutation |
| ✅ | returns a function for 'architecture_completed' | mutations / getMutation |
| ✅ | returns a function for 'master_plan_completed' | mutations / getMutation |
| ✅ | returns a function for 'plan_approved' | mutations / getMutation |
| ✅ | returns a function for 'plan_rejected' | mutations / getMutation |
| ✅ | returns a function for 'phase_plan_created' | mutations / getMutation |
| ✅ | returns a function for 'task_handoff_created' | mutations / getMutation |
| ✅ | returns a function for 'task_completed' | mutations / getMutation |
| ✅ | returns a function for 'code_review_completed' | mutations / getMutation |
| ✅ | returns a function for 'phase_report_created' | mutations / getMutation |
| ✅ | returns a function for 'phase_review_completed' | mutations / getMutation |
| ✅ | returns a function for 'gate_approved' | mutations / getMutation |
| ✅ | returns a function for 'gate_rejected' | mutations / getMutation |
| ✅ | returns a function for 'final_review_completed' | mutations / getMutation |
| ✅ | returns a function for 'final_approved' | mutations / getMutation |
| ✅ | returns a function for 'final_rejected' | mutations / getMutation |
| ✅ | returns undefined for 'start' | mutations / getMutation |
| ✅ | returns undefined for 'unknown_event' | mutations / getMutation |
| ✅ | returns undefined for empty string | mutations / getMutation |
| ✅ | returns { shouldTriage: true, level: 'task' } for 'task_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: true, level: 'task' } for 'code_review_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: true, level: 'phase' } for 'phase_review_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'research_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'prd_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'design_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'architecture_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'master_plan_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'plan_approved' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'plan_rejected' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'phase_plan_created' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'task_handoff_created' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'phase_report_created' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'gate_approved' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'gate_rejected' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'final_review_completed' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'final_approved' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'final_rejected' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'start' | mutations / needsTriage |
| ✅ | returns { shouldTriage: false, level: null } for 'unknown_event' | mutations / needsTriage |
| ✅ | sets planning.steps.research.status to complete and output to doc_path | mutations / research_completed |
| ✅ | returns non-empty mutations_applied | mutations / research_completed |
| ✅ | sets planning.steps.prd.status to complete and output to doc_path | mutations / prd_completed |
| ✅ | returns non-empty mutations_applied | mutations / prd_completed |
| ✅ | sets planning.steps.design.status to complete and output to doc_path | mutations / design_completed |
| ✅ | returns non-empty mutations_applied | mutations / design_completed |
| ✅ | sets planning.steps.architecture.status to complete and output to doc_path | mutations / architecture_completed |
| ✅ | returns non-empty mutations_applied | mutations / architecture_completed |
| ✅ | sets planning.steps.master_plan.status to complete and output to doc_path | mutations / master_plan_completed |
| ✅ | sets planning.status to complete | mutations / master_plan_completed |
| ✅ | returns non-empty mutations_applied | mutations / master_plan_completed |
| ✅ | sets planning.human_approved to true | mutations / plan_approved |
| ✅ | sets pipeline.current_tier to execution | mutations / plan_approved |
| ✅ | sets execution.status to in_progress | mutations / plan_approved |
| ✅ | returns mutations_applied with 5 entries | mutations / plan_approved |
| ✅ | RT-1: initializes execution.phases array with total_phases entries, each not_started | mutations / plan_approved |
| ✅ | sets phase_number, title, and total_tasks on each phase with context.phases | mutations / plan_approved |
| ✅ | falls back title to Phase N when context.phases is absent | mutations / plan_approved |
| ✅ | sets pipeline.current_tier to halted | mutations / plan_rejected |
| ✅ | pushes 'Plan rejected by human' to errors.active_blockers | mutations / plan_rejected |
| ✅ | increments errors.total_halts by 1 | mutations / plan_rejected |
| ✅ | sets phase.phase_doc to context.plan_path | mutations / phase_plan_created |
| ✅ | sets phase.status to in_progress when phase was not_started | mutations / phase_plan_created |
| ✅ | does NOT change phase.status when phase is already in_progress | mutations / phase_plan_created |
| ✅ | initializes phase.tasks from context.tasks with correct defaults | mutations / phase_plan_created |
| ✅ | sets task_number, last_error, and severity on each task | mutations / phase_plan_created |
| ✅ | sets phase.total_tasks and phase.current_task = 0 | mutations / phase_plan_created |
| ✅ | sets task.handoff_doc to context.handoff_path | mutations / task_handoff_created |
| ✅ | sets task.status to in_progress | mutations / task_handoff_created |
| ✅ | clears task.review_doc, task.review_verdict, task.review_action to null | mutations / task_handoff_created |
| ✅ | sets task.report_doc to context.report_path | mutations / task_completed |
| ✅ | sets task.severity to context.report_severity when provided | mutations / task_completed |
| ✅ | does NOT set task.severity when context.report_severity is null | mutations / task_completed |
| ✅ | does NOT set task.severity when context.report_severity is undefined | mutations / task_completed |
| ✅ | does NOT change task.status (status set by triage, not this handler) | mutations / task_completed |
| ✅ | sets task.review_doc to context.review_path | mutations / code_review_completed |
| ✅ | does NOT set task.review_verdict or task.review_action (set by triage) | mutations / code_review_completed |
| ✅ | sets phase.phase_report to context.report_path | mutations / phase_report_created |
| ✅ | sets phase.phase_review to context.review_path | mutations / phase_review_completed |
| ✅ | does NOT set phase.phase_review_verdict or phase.phase_review_action (set by triage) | mutations / phase_review_completed |
| ✅ | increments phase.current_task by 1 when gate_type is task | mutations / gate_approved (task gate) |
| ✅ | resets execution.triage_attempts to 0 | mutations / gate_approved (task gate) |
| ✅ | sets phase.status to complete when gate_type is phase | mutations / gate_approved (phase gate) |
| ✅ | sets phase.human_approved to true | mutations / gate_approved (phase gate) |
| ✅ | increments execution.current_phase by 1 when more phases remain | mutations / gate_approved (phase gate) |
| ✅ | resets execution.triage_attempts to 0 | mutations / gate_approved (phase gate) |
| ✅ | when all phases done: sets pipeline.current_tier to review and execution.status to complete | mutations / gate_approved (phase gate) |
| ✅ | when more phases remain: does NOT change pipeline.current_tier | mutations / gate_approved (phase gate) |
| ✅ | sets pipeline.current_tier to halted | mutations / gate_rejected |
| ✅ | pushes blocker message containing the gate type to errors.active_blockers | mutations / gate_rejected |
| ✅ | increments errors.total_halts by 1 | mutations / gate_rejected |
| ✅ | sets final_review.report_doc to context.review_path | mutations / final_review_completed |
| ✅ | sets final_review.status to complete | mutations / final_review_completed |
| ✅ | sets final_review.human_approved to true | mutations / final_approved |
| ✅ | sets pipeline.current_tier to complete | mutations / final_approved |
| ✅ | sets pipeline.current_tier to halted | mutations / final_rejected |
| ✅ | pushes 'Final review rejected by human' to errors.active_blockers | mutations / final_rejected |
| ✅ | increments errors.total_halts by 1 | mutations / final_rejected |
| ✅ | RT-8: null/null without report_doc → skip (zero mutations, state unchanged) | mutations / applyTaskTriage |
| ✅ | RT-7: null/null with report_doc → auto-approve (status complete, verdict approved, action advanced) | mutations / applyTaskTriage |
| ✅ | advanced: sets task.review_verdict, task.review_action, task.status to complete | mutations / applyTaskTriage |
| ✅ | advanced: resets execution.triage_attempts to 0 | mutations / applyTaskTriage |
| ✅ | advanced: mutations_applied includes entries for verdict, action, status, and triage_attempts reset | mutations / applyTaskTriage |
| ✅ | corrective_task_issued: sets task.status to failed, increments task.retries and errors.total_retries | mutations / applyTaskTriage |
| ✅ | halted: sets task.status to halted, pipeline to halted, increments total_halts, pushes blocker | mutations / applyTaskTriage |
| ✅ | triage_attempts increment: starts at 0, becomes 1 after non-skip triage | mutations / applyTaskTriage |
| ✅ | triage_attempts default-to-0: when execution.triage_attempts is undefined, defaults to 0 then increments to 1 | mutations / applyTaskTriage |
| ✅ | RT-8 analog: null/null without phase_report → skip (zero mutations, state unchanged) | mutations / applyPhaseTriage |
| ✅ | RT-9: null/null with phase_report → auto-approve (verdict approved, action advanced) | mutations / applyPhaseTriage |
| ✅ | advanced: sets phase.phase_review_verdict, phase.phase_review_action | mutations / applyPhaseTriage |
| ✅ | advanced: resets execution.triage_attempts to 0 | mutations / applyPhaseTriage |
| ✅ | corrective_tasks_issued: sets phase.phase_review_verdict and phase.phase_review_action, increments triage_attempts | mutations / applyPhaseTriage |
| ✅ | halted: sets phase.status to halted, pipeline to halted, increments total_halts, pushes blocker | mutations / applyPhaseTriage |
| ✅ | triage_attempts increment: starts at 0, becomes 1 after non-skip triage | mutations / applyPhaseTriage |
| ✅ | triage_attempts default-to-0: when execution.triage_attempts is undefined, defaults to 0 then increments to 1 | mutations / applyPhaseTriage |
| ✅ | strips workspace-relative prefix when present | mutations / normalizeDocPath |
| ✅ | passes through already project-relative paths (idempotent) | mutations / normalizeDocPath |
| ✅ | passes through root-level project files unchanged | mutations / normalizeDocPath |
| ✅ | strips prefix from root-level doc with full path | mutations / normalizeDocPath |
| ✅ | returns null when docPath is null | mutations / normalizeDocPath |
| ✅ | returns undefined when docPath is undefined | mutations / normalizeDocPath |
| ✅ | returns empty string when docPath is empty string | mutations / normalizeDocPath |
| ✅ | no state + start event → scaffolds state, returns spawn_research | pipeline-engine / Init Path |
| ✅ | existing planning-tier state + start → returns correct next action, zero writes | pipeline-engine / Cold Start |
| ✅ | existing execution-tier state + start → resolves correct action for execution | pipeline-engine / Cold Start |
| ✅ | research_completed → sets research step to complete | pipeline-engine / Planning Events |
| ✅ | prd_completed → sets prd step to complete | pipeline-engine / Planning Events |
| ✅ | design_completed → sets design step to complete | pipeline-engine / Planning Events |
| ✅ | architecture_completed → sets architecture step to complete | pipeline-engine / Planning Events |
| ✅ | master_plan_completed → sets master_plan step to complete and planning status | pipeline-engine / Planning Events |
| ✅ | plan_approved → transitions tier to execution | pipeline-engine / Planning Events |
| ✅ | plan_rejected → halts pipeline with active blocker | pipeline-engine / Planning Events |
| ✅ | phase_plan_created → sets phase_doc and initializes tasks | pipeline-engine / Execution Events |
| ✅ | task_handoff_created → sets task to in_progress, clears review fields | pipeline-engine / Execution Events |
| ❌ | task_completed → sets report_doc, triggers triage, enriches from pre-read | pipeline-engine / Execution Events |
| ✅ | code_review_completed → sets review_doc, triggers triage, sets verdict/action | pipeline-engine / Execution Events |
| ✅ | phase_report_created → sets phase_report on the phase | pipeline-engine / Execution Events |
| ✅ | phase_review_completed → sets phase_review, triggers triage, sets verdict/action | pipeline-engine / Execution Events |
| ✅ | gate_approved (task) → advances current_task, resets triage_attempts | pipeline-engine / Gate Events |
| ✅ | gate_approved (phase) → completes phase, advances current_phase, resets triage_attempts | pipeline-engine / Gate Events |
| ✅ | gate_rejected → halts pipeline with active blocker | pipeline-engine / Gate Events |
| ✅ | gate_approved (phase) on last phase → transitions to review, current_phase stays in bounds | pipeline-engine / Gate Events |
| ✅ | final_review_completed → sets report_doc and status to complete | pipeline-engine / Final Review Events |
| ✅ | final_approved → completes pipeline | pipeline-engine / Final Review Events |
| ✅ | final_rejected → halts pipeline | pipeline-engine / Final Review Events |
| ❌ | task_completed → skip triage (Row 1): complete, no deviations, no review | pipeline-engine / Triage Flow |
| ✅ | task_completed → corrective (Row 10): failed report with minor severity | pipeline-engine / Triage Flow |
| ✅ | phase_review_completed → phase-level triage advance | pipeline-engine / Triage Flow |
| ✅ | increments on triage with non-skip result | pipeline-engine / triage_attempts Lifecycle |
| ✅ | resets to 0 on gate_approved | pipeline-engine / triage_attempts Lifecycle |
| ✅ | triage_attempts > 1 → returns display_halted without running triage | pipeline-engine / triage_attempts Lifecycle |
| ✅ | init sets triage_attempts to 0 | pipeline-engine / triage_attempts Lifecycle |
| ✅ | unknown event → error result with descriptive message | pipeline-engine / Error Paths |
| ✅ | no state + non-start event → error result | pipeline-engine / Error Paths |
| ✅ | validation failure → error result, state NOT written after failure | pipeline-engine / Error Paths |
| ✅ | task_completed enriches context with frontmatter fields from pre-read | pipeline-engine / Task Report Pre-Read |
| ✅ | task_completed with missing report document → returns error result | pipeline-engine / Task Report Pre-Read |
| ✅ | task_completed with missing has_deviations → returns error result | pipeline-engine / Task Report Pre-Read |
| ✅ | task_completed with missing deviation_type → returns error result | pipeline-engine / Task Report Pre-Read |
| ✅ | RT-1: plan_approved pre-read reads total_phases and initializes phases | pipeline-engine / Regression: Master Plan Pre-Read (RT-1, RT-2, RT-3) |
| ✅ | RT-2: plan_approved with missing total_phases returns error | pipeline-engine / Regression: Master Plan Pre-Read (RT-1, RT-2, RT-3) |
| ✅ | RT-2b: plan_approved with non-integer total_phases returns error | pipeline-engine / Regression: Master Plan Pre-Read (RT-1, RT-2, RT-3) |
| ✅ | RT-3: in_progress task with handoff but no report resolves to execute_task | pipeline-engine / Regression: Master Plan Pre-Read (RT-1, RT-2, RT-3) |
| ❌ | RT-5: status normalization pass → complete (pipeline succeeds through gate) | pipeline-engine / Regression: Status Normalization (RT-5, RT-6) |
| ✅ | RT-6: status normalization banana → error | pipeline-engine / Regression: Status Normalization (RT-5, RT-6) |
| ✅ | RT-10: advance_phase non-last phase → create_phase_plan, current_phase incremented | pipeline-engine / Regression: Internal advance_phase Handling (RT-10, RT-11, RT-12) |
| ✅ | RT-11: advance_phase last phase → spawn_final_reviewer, current_phase stays at last index | pipeline-engine / Regression: Internal advance_phase Handling (RT-10, RT-11, RT-12) |
| ✅ | RT-12: V1 validation passes after last-phase advancement (current_phase in bounds) | pipeline-engine / Regression: Internal advance_phase Handling (RT-10, RT-11, RT-12) |
| ❌ | RT-13: advance_task handled internally → advances current_task and re-resolves | pipeline-engine / Regression: Internal advance_task Handling (RT-13) |
| ✅ | normalizes context.doc_path from workspace-relative to project-relative | pipeline-engine / normalizeContextPaths |
| ✅ | normalizes context.plan_path from workspace-relative to project-relative | pipeline-engine / normalizeContextPaths |
| ✅ | normalizes context.report_path from workspace-relative to project-relative | pipeline-engine / normalizeContextPaths |
| ✅ | normalizes context.handoff_path from workspace-relative to project-relative | pipeline-engine / normalizeContextPaths |
| ✅ | normalizes context.review_path from workspace-relative to project-relative | pipeline-engine / normalizeContextPaths |
| ✅ | leaves already project-relative paths unchanged (idempotent) | pipeline-engine / normalizeContextPaths |
| ✅ | does not modify context keys that are not in the PATH_KEYS list | pipeline-engine / normalizeContextPaths |
| ✅ | handles null/undefined path values in context without throwing | pipeline-engine / normalizeContextPaths |
| ✅ | prd_completed with workspace-relative doc_path stores project-relative path in state | pipeline-engine / Integration: Path Normalization in executePipeline |
| ✅ | task_completed with workspace-relative report_path: pre-read succeeds AND stored path is project-relative | pipeline-engine / Integration: Path Normalization in executePipeline |
| ✅ | task_completed with already project-relative report_path continues to work (idempotent) | pipeline-engine / Integration: Path Normalization in executePipeline |
| ✅ | returns the document when path resolves directly | pipeline-engine / createProjectAwareReader |
| ✅ | falls back to project-relative path when direct resolution fails | pipeline-engine / createProjectAwareReader |
| ✅ | returns null for null/empty docPath | pipeline-engine / createProjectAwareReader |
| ✅ | returns null when both resolutions fail | pipeline-engine / createProjectAwareReader |
| ✅ | task_completed with project-relative report_doc in state succeeds through triage | pipeline-engine / Integration: createProjectAwareReader in triage path |

## Failure Details

### ❌ task_completed → sets report_doc, triggers triage, enriches from pre-read

**Suite:** pipeline-engine
**Describe block:** Execution Events
**Assertion:** `result.next_action` should equal `generate_phase_report`
**Expected:** `generate_phase_report`
**Actual:** `spawn_code_reviewer`

<details>
<summary>Stack trace</summary>

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  actual expected

  'spawgenerate_codphase_revieweport'

    at TestContext.<anonymous> (C:\dev\orchestration\v3\.github\orchestration\scripts\tests\pipeline-engine.test.js:464:12)
    at Test.runInAsyncScope (node:async_hooks:214:14)
    at Test.run (node:internal/test_runner/test:1106:25)
    at Suite.processPendingSubtests (node:internal/test_runner/test:788:18)
    at Test.postRun (node:internal/test_runner/test:1235:19)
    at Test.run (node:internal/test_runner/test:1163:12)
    at async Suite.processPendingSubtests (node:internal/test_runner/test:788:7) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'spawn_code_reviewer',
  expected: 'generate_phase_report',
  operator: 'strictEqual',
  diff: 'simple'
}
```

</details>

### ❌ task_completed → skip triage (Row 1): complete, no deviations, no review

**Suite:** pipeline-engine
**Describe block:** Triage Flow
**Assertion:** `result.next_action` should equal `generate_phase_report`
**Expected:** `generate_phase_report`
**Actual:** `spawn_code_reviewer`

<details>
<summary>Stack trace</summary>

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  actual expected

  'spawgenerate_codphase_revieweport'

    at TestContext.<anonymous> (C:\dev\orchestration\v3\.github\orchestration\scripts\tests\pipeline-engine.test.js:781:12)
    at Test.runInAsyncScope (node:async_hooks:214:14)
    at Test.run (node:internal/test_runner/test:1106:25)
    at Test.start (node:internal/test_runner/test:1003:17)
    at node:internal/test_runner/test:1514:71
    at node:internal/per_context/primordials:464:82
    at new Promise (<anonymous>)
    at new SafePromise (node:internal/per_context/primordials:433:3)
    at node:internal/per_context/primordials:464:9
    at Array.map (<anonymous>) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'spawn_code_reviewer',
  expected: 'generate_phase_report',
  operator: 'strictEqual',
  diff: 'simple'
}
```

</details>

### ❌ RT-5: status normalization pass → complete (pipeline succeeds through gate)

**Suite:** pipeline-engine
**Describe block:** Regression: Status Normalization (RT-5, RT-6)
**Assertion:** `result.next_action` should equal `gate_task`
**Expected:** `gate_task`
**Actual:** `spawn_code_reviewer`

<details>
<summary>Stack trace</summary>

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  actual expected

  'spgawn_codte_reviewertask'

    at TestContext.<anonymous> (C:\dev\orchestration\v3\.github\orchestration\scripts\tests\pipeline-engine.test.js:1228:12)
    at Test.runInAsyncScope (node:async_hooks:214:14)
    at Test.run (node:internal/test_runner/test:1106:25)
    at Test.start (node:internal/test_runner/test:1003:17)
    at node:internal/test_runner/test:1514:71
    at node:internal/per_context/primordials:464:82
    at new Promise (<anonymous>)
    at new SafePromise (node:internal/per_context/primordials:433:3)
    at node:internal/per_context/primordials:464:9
    at Array.map (<anonymous>) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'spawn_code_reviewer',
  expected: 'gate_task',
  operator: 'strictEqual',
  diff: 'simple'
}
```

</details>

### ❌ RT-13: advance_task handled internally → advances current_task and re-resolves

**Suite:** pipeline-engine
**Describe block:** Regression: Internal advance_task Handling (RT-13)
**Assertion:** `result.next_action` should equal `generate_phase_report`
**Expected:** `generate_phase_report`
**Actual:** `spawn_code_reviewer`

<details>
<summary>Stack trace</summary>

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  actual expected

  'spawgenerate_codphase_revieweport'

    at TestContext.<anonymous> (C:\dev\orchestration\v3\.github\orchestration\scripts\tests\pipeline-engine.test.js:1457:12)
    at Test.runInAsyncScope (node:async_hooks:214:14)
    at Test.run (node:internal/test_runner/test:1106:25)
    at Test.start (node:internal/test_runner/test:1003:17)
    at node:internal/test_runner/test:1514:71
    at node:internal/per_context/primordials:464:82
    at new Promise (<anonymous>)
    at new SafePromise (node:internal/per_context/primordials:433:3)
    at node:internal/per_context/primordials:464:9
    at Array.map (<anonymous>) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'spawn_code_reviewer',
  expected: 'generate_phase_report',
  operator: 'strictEqual',
  diff: 'simple'
}
```

</details>

## Environment

| Property | Value |
|----------|-------|
| Node version | v24.11.0 |
| OS | Windows |
| Runner | `node --test` (Node.js built-in test runner) |
| Primary suite command | `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` |
| Supplementary commands | See frontmatter `suites` list |

## Carry-Forward Items

- `triage_attempts` counter increments for `spawn_code_reviewer` actions — cosmetic, not functional. The counter resets on advance after code review completes. If retry exhaustion is observed during test runs, document it here. **No retry exhaustion was observed during this run.**
- Deep YAML nesting is unsupported — the YAML parser fix handles one level of array-of-objects nesting only. Deeply nested structures are explicitly out of scope (NFR-7). **No YAML nesting failures observed.**
- Context field name mismatch: `plan_path` vs `phase_plan_path` — if any test failures reference this mismatch, document the exact field names and affected code paths here. **No field name mismatch failures observed in this run.**
- **4 pipeline-engine test expectations not updated for Row 1 triage fix**: The triage engine fix (Task T01) changed Row 1 behavior from auto-advance to `spawn_code_reviewer`. The `pipeline-behavioral` and `triage-engine` suites were updated (Task T04), but 4 tests in `pipeline-engine.test.js` still expect the old behavior (`generate_phase_report` or `gate_task` instead of `spawn_code_reviewer`). Affected tests: `task_completed → sets report_doc, triggers triage, enriches from pre-read` (line 464), `task_completed → skip triage (Row 1)` (line 781), `RT-5: status normalization pass → complete` (line 1228), `RT-13: advance_task handled internally` (line 1457). These test expectations need to be updated to expect `spawn_code_reviewer` as the next action when a task completes with no review document.
