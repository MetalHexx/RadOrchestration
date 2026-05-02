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
- Write requirements (FR/NFR/AD/DD) in any code, comments or docs that a given project produces. These are ephemeral planning artifacts only. 
  - For example,  if we had to to create a component for a UI project to meet the requirement "FR-1", we shouldn't leave a comment in the code like `// This component satisfies FR-1` or `// This component satisfies FR-1, FR-2, NFR-3`. 
  ```

## Routing

| Invoking Agent | Routes to |
|----------------|-----------|
| `planner` | Agent routes internally — see `planner.md` REQUIRED block for action-to-workflow mapping. Workflow paths: `references/requirements/workflow.md`, `references/master-plan/workflow.md`. |
