---
project: "PIPELINE-HOTFIX"
total_phases: 3
status: "draft"
author: "architect-agent"
created: "2026-03-13T00:00:00Z"
---

# PIPELINE-HOTFIX — Master Plan

## Executive Summary

The unified pipeline engine introduced by the SCRIPT-SIMPLIFY-AGENTS refactor has 6 bugs — 2 critical, 2 medium, 2 minor — that prevent any project from completing an end-to-end execution cycle. The bugs span mutation handlers (phase initialization, triage auto-approve), the resolver (internal vs. external action boundaries), skill template vocabulary (task report status), and the pipeline engine (internal action handling). This project applies targeted fixes to all 6 bugs, adds a defensive unmapped-action guard, creates a `log-error` skill for structured Orchestrator error logging, writes regression tests covering every failure scenario, and sweeps all affected documentation and instruction files. The work is organized into 3 phases: pipeline engine fixes with regression tests, skill and agent updates, and a documentation sweep.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [PIPELINE-HOTFIX-BRAINSTORMING.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-BRAINSTORMING.md) | ✅ |
| Research Findings | [PIPELINE-HOTFIX-RESEARCH-FINDINGS.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [PIPELINE-HOTFIX-PRD.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md) | ✅ |
| Design | [PIPELINE-HOTFIX-DESIGN.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md) | ✅ |
| Architecture | [PIPELINE-HOTFIX-ARCHITECTURE.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional requirements that drive phasing — see [PIPELINE-HOTFIX-PRD.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md) for the full set.

- **FR-1 / FR-2**: When `plan_approved` is processed, the engine reads `total_phases` from master plan frontmatter and `handlePlanApproved` initializes `execution.phases[]` with the correct number of `not_started` entries — refs: [PRD FR-1, FR-2](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-1-phase-initialization-on-plan-approval-error-1--critical)
- **FR-4**: When a task is `in_progress` with a `handoff_doc` but no `report_doc`, the resolver returns `execute_task` — refs: [PRD FR-4](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-2-resolver-returns-correct-action-for-in-progress-tasks-error-2--medium)
- **FR-9 / FR-10**: Auto-approve clean task and phase reports when triage returns null/null verdict/action and a report exists — refs: [PRD FR-9, FR-10](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-4-auto-approve-clean-reports-on-triage-nullnull-error-4--critical)
- **FR-12 / FR-13 / FR-14**: The pipeline engine handles `advance_phase` internally, bounds the re-resolve loop to 1 iteration, and keeps `current_phase` at the last valid index on last-phase completion — refs: [PRD FR-12–14](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-5-internal-phase-advancement-error-5--medium-also-fixes-error-6)
- **FR-15**: Unmapped action guard — the engine validates every resolved action against the 18-action external vocabulary and returns a hard error for unmapped actions — refs: [PRD FR-15](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#unmapped-action-guard)
- **FR-16 / FR-19**: Create `log-error` skill; Orchestrator auto-logs on `success: false` — refs: [PRD FR-16, FR-19](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#error-logging-skill)
- **NFR-1**: All 4 preserved library test suites (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`) pass unmodified — refs: [PRD NFR-1](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#non-functional-requirements)

## Key Technical Decisions (from Architecture)

Curated architectural decisions that constrain implementation — see [PIPELINE-HOTFIX-ARCHITECTURE.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md) for full contracts and interfaces.

- **Master plan pre-read follows existing pattern**: The `plan_approved` pre-read replicates the `task_completed` → task report pre-read pattern exactly — reads document via `io.readDocument()`, extracts frontmatter, injects into context. Mutations stay pure; I/O stays isolated in the engine. — refs: [Architecture Fix 1](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-1-handleplanapproved--updated-mutation-mutationsjs)
- **Resolver conditional split on `in_progress`**: The `resolveTaskLifecycle` `in_progress` branch splits on `handoff_doc` / `report_doc` presence — `execute_task` when handoff exists but no report, `update_state_from_task` when both exist. — refs: [Architecture Fix 2](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-2-resolvetasklifecycle--conditional-in_progress-resolverjs)
- **Triage table unchanged; callers handle null/null**: Row 1 still returns `(null, null)`. The `applyTaskTriage` and `applyPhaseTriage` functions translate null/null + existing report into auto-approval. — refs: [Architecture Fix 4](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-4-applytasktriage-auto-approve-mutationsjs)
- **Internal `advance_phase` with bounded re-resolve**: The engine handles `advance_phase` by applying phase advancement mutations, re-validating, and re-resolving. The loop is bounded to 1 internal iteration — a second internal action triggers a hard error. — refs: [Architecture Fix 5](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-5-internal-advance_phase-handling-pipeline-enginejs)
- **`EXTERNAL_ACTIONS` set as unmapped action guard**: A `Set<string>` of 18 external actions defined at module scope in `pipeline-engine.js`. Any resolved action not in this set after internal handling triggers a hard error (exit 1). — refs: [Architecture Fix 5](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-5-internal-advance_phase-handling-pipeline-enginejs)
- **Status normalization is minimal and defensive**: Only 2 synonyms (`pass` → `complete`, `fail` → `failed`). All other unknown values produce a hard error. The skill template fix addresses the root cause; normalization is the safety net. — refs: [Architecture Fix 3](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-3-status-normalization-pipeline-enginejs)
- **Zero new dependencies**: CommonJS + Node.js built-ins only. No new files in the module dependency graph — all fixes land in existing modules. `PHASE_STATUSES` is a new import in `pipeline-engine.js`. — refs: [Architecture Dependencies](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#dependencies)

## Key Design Constraints (from Design)

Curated design decisions that affect implementation — see [PIPELINE-HOTFIX-DESIGN.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md) for full data flows and state lifecycle diagrams.

- **Phase entry initialization template**: Each `execution.phases[]` entry initializes with `status: 'not_started'`, empty `tasks: []`, `current_task: 0`, all doc fields `null`, `triage_attempts: 0`, `human_approved: false`. — refs: [Design DF-1](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#df-1-master-plan-pre-read-for-plan_approved-error-1)
- **Auto-approve only when report exists**: The null/null auto-approve path in `applyTaskTriage` requires `task.report_doc` to be truthy (proof of execution). Without a report, the original skip behavior is preserved. Same pattern for `applyPhaseTriage` with `phase.phase_report`. — refs: [Design SL-1, SL-2](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#sl-1-corrected-task-state-lifecycle-after-errors-2-3-4)
- **`current_phase` capped at last valid index**: On last-phase advancement, `current_phase` stays at the last array index; `execution.status = 'complete'` is the completion signal, not index overflow. This preserves V1 validator correctness. — refs: [Design DF-3](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#df-3-internal-advance_phase-re-resolve-loop-error-5)
- **Error log is append-only**: Each entry is a numbered `## Error N:` section. The Orchestrator appends; no agent rewrites existing entries. Frontmatter tracks `entry_count` and `last_updated`. — refs: [Design EL-1](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#el-1-name-error-logmd-document-structure)
- **Hard errors for all new failure conditions**: Missing `total_phases`, unknown report status after normalization, unmapped actions, re-resolve loop exceeded — all produce exit code 1 with descriptive error messages. No silent failures. — refs: [Design DF-1, DF-2, DF-3, DF-4](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#data-flow-designs)
- **Fix dependency**: Error 4 (auto-approve) must be implemented before Error 5 (advance_phase) — phase advancement is only reached after triage produces an approved verdict. Errors 1, 2, 3 are independent. — refs: [Architecture Fix Dependency Graph](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-dependency-graph)

## Phase Outline

### Phase 1: Pipeline Engine Fixes & Regression Tests

**Goal**: Fix all 6 bugs in `pipeline-engine.js`, `mutations.js`, and `resolver.js`, add the unmapped action guard, and write regression tests covering every failure scenario.

**Scope**:
- **Error 1**: Add master plan pre-read in `pipeline-engine.js` + update `handlePlanApproved` in `mutations.js` to initialize `execution.phases[]` from `context.total_phases` + add `total_phases` to master plan template frontmatter — refs: [Architecture Fix 1](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-1-handleplanapproved--updated-mutation-mutationsjs), [PRD FR-1, FR-2, FR-3](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-1-phase-initialization-on-plan-approval-error-1--critical)
- **Error 2**: Fix `resolveTaskLifecycle` conditional in `resolver.js` — return `execute_task` for in-progress tasks with handoff but no report — refs: [Architecture Fix 2](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-2-resolvetasklifecycle--conditional-in_progress-resolverjs), [PRD FR-4, FR-5](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-2-resolver-returns-correct-action-for-in-progress-tasks-error-2--medium)
- **Error 3**: Add status normalization in `pipeline-engine.js` task report pre-read (`pass` → `complete`, `fail` → `failed`, unknown → hard error) + reinforce `generate-task-report` SKILL.md and template vocabulary — refs: [Architecture Fix 3](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-3-status-normalization-pipeline-enginejs), [PRD FR-6, FR-7, FR-8](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-3-task-report-status-vocabulary-error-3--minor)
- **Error 4**: Add auto-approve path in `applyTaskTriage` and `applyPhaseTriage` in `mutations.js` for null/null with report present — refs: [Architecture Fix 4](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-4-applytasktriage-auto-approve-mutationsjs), [PRD FR-9, FR-10, FR-11](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-4-auto-approve-clean-reports-on-triage-nullnull-error-4--critical)
- **Errors 5 + 6**: Add internal `advance_phase` handling in `pipeline-engine.js` with bounded re-resolve loop + define `EXTERNAL_ACTIONS` set + add unmapped action guard — refs: [Architecture Fix 5](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-5-internal-advance_phase-handling-pipeline-enginejs), [PRD FR-12, FR-13, FR-14, FR-15](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#bug-fix-5-internal-phase-advancement-error-5--medium-also-fixes-error-6)
- **Regression tests**: All tests RT-1 through RT-13 in `mutations.test.js` and `pipeline-engine.test.js` + update existing skip-case test — refs: [Architecture Test Architecture](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#test-architecture), [PRD FR-20–FR-27](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#regression-tests)

**Exit Criteria**:
- [ ] All 4 preserved test suites pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] All new regression tests (RT-1 through RT-13) pass
- [ ] Pipeline processes `plan_approved` → phases initialized → `execute_task` → `task_completed` (with normalization) → auto-approve → `advance_phase` → internal handling → next external action, without stalls or routing errors
- [ ] Unmapped action guard returns hard error for any non-external action after internal handling

**Phase Doc**: [phases/PIPELINE-HOTFIX-PHASE-01-ENGINE-FIXES.md](.github/projects/PIPELINE-HOTFIX/phases/PIPELINE-HOTFIX-PHASE-01-ENGINE-FIXES.md) *(created at execution time)*

---

### Phase 2: Skill Creation & Agent Updates

**Goal**: Create the `log-error` skill and update the Orchestrator agent definition to reference it with auto-log-on-failure instructions. Also update the `generate-task-report` skill vocabulary and the `create-master-plan` template frontmatter.

**Scope**:
- Create `.github/skills/log-error/SKILL.md` with skill definition and workflow — refs: [Architecture log-error Skill Structure](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#log-error-skill-structure), [PRD FR-16, FR-17, FR-18](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#error-logging-skill)
- Create `.github/skills/log-error/templates/ERROR-LOG.md` with error log document template — refs: [Architecture ERROR-LOG.md Template](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#error-logmd-template), [Design EL-1, EL-2](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#el-1-name-error-logmd-document-structure)
- Update `.github/agents/orchestrator.agent.md` to reference `log-error` skill and add auto-log on `success: false` to error handling section — refs: [Architecture Orchestrator Agent Update](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#orchestrator-agent-update), [PRD FR-19](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#error-logging-skill)
- Update `.github/skills/generate-task-report/SKILL.md` — add explicit vocabulary constraint block — refs: [Architecture Fix 3 Skill](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-3-task-report-skill--reinforced-vocabulary-skillmd)
- Update `.github/skills/generate-task-report/templates/TASK-REPORT.md` — reinforce status field comment — refs: [Architecture Fix 3 Skill](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-3-task-report-skill--reinforced-vocabulary-skillmd)
- Update `.github/skills/create-master-plan/templates/MASTER-PLAN.md` — add `total_phases` frontmatter field — refs: [Architecture Fix 1 Template](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-1-master-plan-template--new-frontmatter-field)

**Exit Criteria**:
- [ ] `log-error` skill directory exists at `.github/skills/log-error/` with valid `SKILL.md` and `templates/ERROR-LOG.md`
- [ ] Orchestrator agent definition references `log-error` skill and error handling section includes auto-log instructions
- [ ] `generate-task-report` SKILL.md includes explicit vocabulary constraint block
- [ ] `generate-task-report` template frontmatter comment reinforces `complete | partial | failed` constraint
- [ ] `create-master-plan` template frontmatter includes `total_phases: {NUMBER}` field

**Phase Doc**: [phases/PIPELINE-HOTFIX-PHASE-02-SKILLS-AGENTS.md](.github/projects/PIPELINE-HOTFIX/phases/PIPELINE-HOTFIX-PHASE-02-SKILLS-AGENTS.md) *(created at execution time)*

---

### Phase 3: Documentation & Instruction File Updates

**Goal**: Update all documentation, instruction files, and skill instructions to accurately describe the system after all code and skill changes are applied. Every update describes current system behavior only — no references to prior behavior.

**Scope**:
- `docs/scripts.md` — restructure action vocabulary to distinguish internal vs. external actions, document internal action handling pattern and unmapped action guard — refs: [Architecture EXTERNAL_ACTIONS](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-5-internal-advance_phase-handling-pipeline-enginejs)
- `docs/pipeline.md` — describe master plan pre-read, status normalization, auto-approve for null/null triage, internal action loop — refs: [Design DF-1, DF-2, DF-3](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#data-flow-designs)
- `docs/agents.md` — document Orchestrator's `log-error` skill — refs: [PRD FR-19](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md#error-logging-skill)
- `docs/skills.md` — add `log-error` skill entry — refs: [Architecture log-error Skill](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#log-error-skill-structure)
- `docs/project-structure.md` — add `ERROR-LOG.md` as a project artifact — refs: [Design EL-1](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md#el-1-name-error-logmd-document-structure)
- `README.md` — update project files list, mention error logging — refs: [Brainstorming Idea 8](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-BRAINSTORMING.md#idea-8-documentation-and-instruction-file-updates)
- `.github/copilot-instructions.md` — add `ERROR-LOG.md` to project files list — refs: [Brainstorming Idea 8](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-BRAINSTORMING.md#idea-8-documentation-and-instruction-file-updates)
- `.github/instructions/project-docs.instructions.md` — add `ERROR-LOG.md` ownership (sole writer: Orchestrator) — refs: [Brainstorming Idea 8](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-BRAINSTORMING.md#idea-8-documentation-and-instruction-file-updates)
- `.github/skills/create-master-plan/SKILL.md` — document `total_phases` as a required frontmatter field in the instructions — refs: [Architecture Fix 1 Template](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md#fix-1-master-plan-template--new-frontmatter-field)

**Exit Criteria**:
- [ ] All 9 files listed above are updated
- [ ] No documentation references prior behavior, migration steps, or "before/after" language
- [ ] `total_phases` is documented as a required field in the `create-master-plan` skill instructions
- [ ] `ERROR-LOG.md` appears in project structure docs, copilot instructions, and project-docs instructions
- [ ] `log-error` skill appears in skills documentation and agents documentation
- [ ] Action vocabulary in `docs/scripts.md` clearly distinguishes internal actions (handled by engine) from external actions (routed to agents)

**Phase Doc**: [phases/PIPELINE-HOTFIX-PHASE-03-DOCUMENTATION.md](.github/projects/PIPELINE-HOTFIX/phases/PIPELINE-HOTFIX-PHASE-03-DOCUMENTATION.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml` — this project uses 3)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Max consecutive review rejections**: 3 (from `orchestration.yml`)
- **Git strategy**: `single_branch`, prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: After planning (master plan review) — hard default; execution mode: `ask`; after final review — hard default
- **Error severity**: Critical errors halt pipeline; minor errors auto-retry via corrective tasks

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Auto-approve logic in `applyTaskTriage`/`applyPhaseTriage` might incorrectly advance tasks that should have been reviewed | High | Auto-approve only activates when triage returns null/null AND report exists — Row 1 already requires `complete` + no deviations + no review doc. Regression tests (RT-7, RT-8, RT-9) verify exact conditions. | Coder / Reviewer |
| Bounded re-resolve loop (max 1 iteration) might not be sufficient for future complex state transitions | Medium | Current analysis shows only `advance_phase` triggers re-resolve. If future internal actions are added, the bound can be increased. Hard error on exceeding the bound makes issues immediately visible. | Architect |
| Status normalization might mask genuine skill template issues by silently correcting wrong values | Low | Normalization is limited to 2 obvious synonyms (`pass` → `complete`, `fail` → `failed`). All other unknown values produce a hard error. The skill template fix addresses root cause. | Coder |
| Existing skip-case test update changes the meaning of an established test — could introduce subtle test coverage gaps | Low | The old test asserted behavior for a case that was buggy. The new test asserts correct behavior. The null/null-without-report case is tested separately (RT-8). | Reviewer |
| 10+ documentation files need updates in Phase 3 — risk of missed files or inconsistent descriptions | Medium | Phase 3 scope list is exhaustive and tracked via exit criteria checklist. Each file update is small. Phase review verifies completeness. | Tactical Planner / Reviewer |
