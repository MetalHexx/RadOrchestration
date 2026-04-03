---
name: code-review
description: 'Review code, phases, and projects for quality, correctness, and conformance. Supports three modes: task review (Action #9), phase review (Action #11), and final review (Action #12). Each mode uses a dual-pass approach — conformance checking against planning documents followed by an independent quality assessment.'
---

# Code Review

Consolidated review skill supporting three modes: task, phase, and final. The reviewer agent loads this skill to route to the appropriate workflow, reference documents, and output template based on spawn context. Each mode uses a dual-pass approach — conformance checking followed by an independent quality assessment.

## Routing Table

| Mode | Trigger | Template | Save Path |
|------|---------|----------|-----------|
| Task | Action #9 (`spawn_code_reviewer`) | [templates/CODE-REVIEW.md](./templates/CODE-REVIEW.md) | `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` |
| Phase | Action #11 (`spawn_phase_reviewer`) | [templates/PHASE-REVIEW.md](./templates/PHASE-REVIEW.md) | `{PROJECT-DIR}/reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` |
| Final | Action #12 (`spawn_final_reviewer`) | [templates/FINAL-REVIEW.md](./templates/FINAL-REVIEW.md) | `{PROJECT-DIR}/reports/{NAME}-FINAL-REVIEW.md` |

## Loading Instructions

1. Read [references/review-principles.md](./references/review-principles.md) (shared across all modes)
2. Read [references/code-smells.md](./references/code-smells.md) (shared across all modes)
3. Identify your mode from spawn context using the Routing Table above
4. Follow the mode-specific workflow below
5. Load the mode's template from `templates/` and produce the review document at the mode's save path

## Shared Inputs

| Input | Source | Description |
|-------|--------|-------------|
| PRD | `{NAME}-PRD.md` | Product requirements being validated |
| Architecture | `{NAME}-ARCHITECTURE.md` | Contracts, module map, file structure |
| Design | `{NAME}-DESIGN.md` | Component specs, design tokens (if applicable) |
| Master Plan | `{NAME}-MASTER-PLAN.md` | Phase/task structure, exit criteria |

## Mode: Task Review

### Additional Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Task Handoff | `{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | Task requirements, contracts, acceptance criteria |
| Source Code | Files listed in Task Handoff's File Targets | The code to review |
| Previous Code Review | `{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` | Previous review (if corrective task — may not exist) |
| Corrective Task Handoff | Task Handoff for the corrective task | Corrective handoff (if corrective task — may not exist) |

### Workflow

1. Read the Task Handoff — understand what was supposed to be built
2. Read every source file listed in the Task Handoff's File Targets section
3. Run tests and verify the build passes
4. **Corrective-review check**: If a previous Code Review exists for this task, read it (and the corrective task handoff, if present) to identify expected corrections. Deviations from the original plan that address issues in the previous review are expected corrections — do NOT flag them as conformance failures
5. **Conformance pass**: Compare implementation against the Task Handoff using the 7-category checklist (see categories below). Core question: "Did we build what we intended?"
6. **Skeptical pass** (Independent Quality Assessment): Evaluate code correctness independent of planning documents. Core question: "Is what we built correct?" Record findings with severity, evidence, and suggestions
7. Apply verdict rules (see Verdict Rules section below) — highest severity across both passes determines verdict
8. Fill in the CODE-REVIEW.md template and save to the task-mode save path from the Routing Table

### Checklist Categories

- Architectural consistency
- Design consistency
- Code quality
- Test coverage
- Error handling
- Accessibility
- Security

## Mode: Phase Review

### Additional Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Phase Plan | `{NAME}-PHASE-{NN}-{TITLE}.md` | Exit criteria, task outline |
| All Code Reviews | `{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md` (all tasks) | Per-task review verdicts and issues |
| Source Code | All files from the phase | Code to review holistically |
| Previous Phase Review | `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` | Previous phase review (if corrective — may not exist) |

### Workflow

1. Read the Phase Plan — understand exit criteria and task outline
2. Read all Code Reviews for this phase — understand individual task outcomes
3. Read all source files produced in this phase
4. **Corrective-review check**: If a previous Phase Review exists, read it to identify expected corrections. Deviations from the original plan that address issues in the previous phase review are expected corrections — do NOT flag them
5. **Conformance pass**: Assess cross-task integration using the 4-category checklist (see categories below). Verify each exit criterion from the Phase Plan. Core question: "Did we build what we intended?"
6. **Skeptical pass** (Independent Quality Assessment): Evaluate integration correctness and code quality independent of planning documents. Core question: "Is what we built correct?"
7. Apply verdict rules — highest severity across both passes determines verdict. Set `exit_criteria_met` frontmatter field to `true` only when ALL exit criteria are verified as met; `false` otherwise
8. Fill in the PHASE-REVIEW.md template and save to the phase-mode save path from the Routing Table

### Checklist Categories

- Integration (modules work together)
- Conflicts (no conflicting patterns)
- Contracts (honored across task boundaries)
- Orphaned code (no unused imports, dead code, leftover scaffolding)

## Mode: Final Review

### Additional Inputs

| Input | Source | Description |
|-------|--------|-------------|
| All Phase Reviews | `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md` (all phases) | Phase verdicts, cross-task issues, carry-forward items |
| Source Code | All project source files | Full codebase to review |
| Previous Final Review | `{NAME}-FINAL-REVIEW.md` | Previous final review (if corrective — may not exist) |

### Workflow

1. Read the Master Plan — understand the full project scope and phase structure
2. Read all Phase Reviews — understand per-phase outcomes and carry-forward items
3. Read the full codebase produced by the project
4. **Corrective-review check**: If a previous Final Review exists, read it to identify expected corrections. Deviations from the original plan that address issues in the previous final review are expected corrections — do NOT flag them
5. **Conformance pass**: Assess architectural integrity (5-aspect checklist — see below), P0 requirement coverage (from PRD), cross-phase integration, and cumulative test/build health. Core question: "Did we build what we intended?"
6. **Skeptical pass** (Independent Quality Assessment): Evaluate project-level correctness independent of planning documents. Include `Scope` column in findings to indicate affected phase(s)/module(s). Core question: "Is what we built correct?"
7. Apply verdict rules — highest severity across both passes determines verdict
8. Fill in the FINAL-REVIEW.md template and save to the final-mode save path from the Routing Table

### Focus Areas

- Architectural integrity (module boundaries, API contracts, data flow, error propagation, dependency graph)
- P0 requirement coverage
- Cross-phase integration
- Cumulative test & build health

## Verdict Rules

The highest-severity finding across both passes (conformance + skeptical) determines the overall verdict.

| Verdict | When to Apply |
|---------|---------------|
| `approved` | No issues found, or only low-severity findings (cosmetic, style) |
| `changes_requested` | At least one medium-severity finding (functional issue, missing coverage) |
| `rejected` | At least one high-severity finding (security vulnerability, data loss risk, architectural violation) |

- Skeptical-pass findings use the same severity levels as conformance findings and CAN escalate the verdict
- Severity levels: **low** (cosmetic, style), **medium** (functional issue, missing coverage), **high** (security vulnerability, data loss risk, architectural violation)
- During corrective reviews, deviations matching previous review issues are expected corrections and do not affect the verdict

## Contents

| File | Description |
|------|-------------|
| `references/review-principles.md` | Shared review mindset, dual-pass approach, corrective review context, quality standards, verdict application guidance |
| `references/code-smells.md` | Non-exhaustive code-smell categories with illustrative examples |
| `templates/CODE-REVIEW.md` | Task-mode output template (conformance checklist, independent quality assessment, issues) |
| `templates/PHASE-REVIEW.md` | Phase-mode output template (integration assessment, exit criteria, independent quality assessment) |
| `templates/FINAL-REVIEW.md` | Final-mode output template (architectural integrity, P0 coverage, cross-phase integration, independent quality assessment) |
