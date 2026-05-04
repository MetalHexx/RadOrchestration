---
name: rad-create-plans
description: "Consolidated document-creation skill for Requirements and Master Plan documents. Routes to the appropriate per-document-type workflow based on the invoking agent's action."
user-invocable: false
---

# rad-create-plans

A consolidated skill for creating planning documents. Routing is based on the invoking agent's identity; each workflow is self-contained.

## When to Use This Skill

- **Master Plan** — Project Master Plan (supported)
- **Requirements** — Project Requirements ledger (FR/NFR/AD/DD) (supported)

## DO NOT
Write FR/NFR/AD/DD IDs inside the code, tests, or comment bodies you inline into requirements or plan steps. IDs are planning scaffolding — they live on requirement headings and step requirement lines, not inside the code/test/comment text itself.

## Routing

| Invoking Agent | Routes to |
|----------------|-----------|
| `planner` | Agent routes internally — see `planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/requirements/workflow.md`, `references/master-plan/workflow.md`. |
