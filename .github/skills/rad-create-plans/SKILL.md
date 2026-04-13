---
name: rad-create-plans
description: "Consolidated document-creation skill for PRDs, Design docs, Architecture docs, Master Plans, Phase Plans, and Task Handoffs. Loads shared conventions and routes to the appropriate per-document-type workflow."
---

# rad-create-plans

A consolidated skill for creating planning documents. It loads shared guidelines and self-review conventions, then routes to the correct per-document-type workflow based on the invoking agent's identity.

## When to Use This Skill

- **PRD** — Product Requirements Document (supported)
- **Research** — Research Findings document (supported)
- **Design** — UX Design document *(future)*
- **Architecture** — Technical Architecture document *(future)*
- **Master Plan** — Project Master Plan *(future)*
- **Phase Plan** — Phase execution plan *(future)*
- **Task Handoff** — Coding task handoff document *(future)*

## Load Sequence

1. Read [references/shared/guidelines.md](references/shared/guidelines.md)
2. Read [references/shared/self-review.md](references/shared/self-review.md)
3. Route to document-type workflow based on agent identity:

| Invoking Agent | Routes to |
|----------------|-----------|
| `product-manager` | [references/prd/workflow.md](references/prd/workflow.md) |
| `research` | [references/research/workflow.md](references/research/workflow.md) |
| `ux-designer` | `references/design/workflow.md` *(future)* |
| `architect` | `references/architecture/workflow.md` *(future)* |
| `tactical-planner` | `references/master-plan/workflow.md` *(future)* |
