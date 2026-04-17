---
name: rad-create-plans
description: "Consolidated document-creation skill for PRDs, Research Findings, Design docs, Architecture docs, Master Plans, Phase Plans, Task Handoffs, Requirements documents, and Execution Plans. Loads shared conventions and routes to the appropriate per-document-type workflow."
user-invocable: false
---

# rad-create-plans

A consolidated skill for creating planning documents. It loads shared guidelines and self-review conventions, then routes to the correct per-document-type workflow based on the invoking agent's identity.

## When to Use This Skill

- **PRD** — Product Requirements Document (supported)
- **Research** — Research Findings document (supported)
- **Design** — UX Design document (supported)
- **Architecture** — Technical Architecture document (supported)
- **Master Plan** — Project Master Plan (supported)
- **Phase Plan** — Phase execution plan (supported)
- **Task Handoff** — Coding task handoff document (supported)
- **Requirements** — Project Requirements ledger (FR/NFR/AD/DD) (supported — self-contained workflow, does not load `shared/`)
- **Execution Plan** — Inlined phase + task plan that replaces Master/Phase/Handoff chain (supported — self-contained workflow, does not load `shared/`)

## Load Sequence

1. Read [references/shared/guidelines.md](references/shared/guidelines.md) **— skip for `planner` routes; the Requirements and Execution Plan workflows are self-contained.**
2. Read [references/shared/self-review.md](references/shared/self-review.md) **— skip for `planner` routes.**
3. Route to document-type workflow based on agent identity:

| Invoking Agent | Routes to |
|----------------|-----------|
| `product-manager` | [references/prd/workflow.md](references/prd/workflow.md) |
| `research` | [references/research/workflow.md](references/research/workflow.md) |
| `ux-designer` | [references/design/workflow.md](references/design/workflow.md) |
| `architect` | [references/architecture/workflow.md](references/architecture/workflow.md) |
| `tactical-planner` | Agent routes internally — see `tactical-planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/master-plan/workflow.md`, `references/phase-plan/workflow.md`, `references/task-handoff/workflow.md` |
| `planner` | Agent routes internally — see `planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/requirements/workflow.md`, `references/execution-plan/workflow.md`. Both workflows are self-contained and do NOT inherit from `references/shared/`. |
