---
name: rad-create-plans
description: "Consolidated document-creation skill for PRDs, Research Findings, Design docs, Architecture docs, Master Plans, Phase Plans, Task Handoffs, and Requirements documents. Routes to the appropriate per-document-type workflow; most routes load shared conventions first, planner (Requirements / Master Plan) routes are self-contained."
user-invocable: false
---

# rad-create-plans

A consolidated skill for creating planning documents. Most routes load shared guidelines and self-review conventions before routing; planner routes (Requirements, Master Plan) are self-contained and skip `references/shared/`. Routing is based on the invoking agent's identity.

## When to Use This Skill

- **PRD** — Product Requirements Document (supported)
- **Research** — Research Findings document (supported)
- **Design** — UX Design document (supported)
- **Architecture** — Technical Architecture document (supported)
- **Master Plan** — Project Master Plan (supported)
- **Phase Plan** — Phase execution plan (supported)
- **Task Handoff** — Coding task handoff document (supported)
- **Requirements** — Project Requirements ledger (FR/NFR/AD/DD) (supported — self-contained workflow, does not load `shared/`)

## Load Sequence

1. Read [references/shared/guidelines.md](references/shared/guidelines.md) **— skip for `planner` routes; the Requirements and Master Plan workflows are self-contained.**
2. Read [references/shared/self-review.md](references/shared/self-review.md) **— skip for `planner` routes.**
3. Route to document-type workflow based on agent identity:

| Invoking Agent | Routes to |
|----------------|-----------|
| `product-manager` | [references/prd/workflow.md](references/prd/workflow.md) |
| `research` | [references/research/workflow.md](references/research/workflow.md) |
| `ux-designer` | [references/design/workflow.md](references/design/workflow.md) |
| `architect` | [references/architecture/workflow.md](references/architecture/workflow.md) |
| `tactical-planner` | Agent routes internally — see `tactical-planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/phase-plan/workflow.md`, `references/task-handoff/workflow.md` |
| `planner` | Agent routes internally — see `planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/requirements/workflow.md`. The workflow is self-contained and does NOT inherit from `references/shared/`. |
