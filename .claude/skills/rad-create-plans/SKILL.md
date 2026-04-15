---
name: rad-create-plans
description: "Consolidated document-creation skill for PRDs, Research Findings, Design docs, Architecture docs, Master Plans, Phase Plans, and Task Handoffs. Loads shared conventions and routes to the appropriate per-document-type workflow."
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

## Load Sequence

1. Read [references/shared/guidelines.md](references/shared/guidelines.md)
2. Read [references/shared/self-review.md](references/shared/self-review.md)
3. Route to document-type workflow based on agent identity:

| Invoking Agent | Routes to |
|----------------|-----------|
| `product-manager` | [references/prd/workflow.md](references/prd/workflow.md) |
| `research` | [references/research/workflow.md](references/research/workflow.md) |
| `ux-designer` | [references/design/workflow.md](references/design/workflow.md) |
| `architect` | [references/architecture/workflow.md](references/architecture/workflow.md) |
| `tactical-planner` | Agent routes internally — see `tactical-planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/master-plan/workflow.md`, `references/phase-plan/workflow.md`, `references/task-handoff/workflow.md` |
