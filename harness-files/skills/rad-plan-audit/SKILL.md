---
name: 'rad-plan-audit'
description: 'Audit the two-doc planning set (Requirements + Master Plan) for codebase accuracy, cross-document cohesion, and explosion-readiness. Two modes: self-review (planner-time) and full audit (reporter subagent; orchestrator dispatches a planner subagent to apply fixes).'
user-invocable: true
---

# Plan Audit

Validates the planning set — `{NAME}-REQUIREMENTS.md` and
`{NAME}-MASTER-PLAN.md` — across three dimensions:

1. **Codebase Accuracy** — do docs correctly describe the existing code
   they reference?
2. **Cross-Document Cohesion** — do Requirements and Master Plan align
   without gaps, contradictions, or drift?
3. **Buildability** — is the Master Plan explosion-ready: every ID
   covered, every step tagged, every task structurally complete?

Phase Plans and Task Handoffs are deterministic explosion artifacts and
are out of scope here — they're validated post-execution by `rad-code-review`.

The [audit rubric](./references/audit-rubric.md) defines exactly what
counts as a finding. The calibration clause governs severity.

## Mode Selection

| Mode | When to use | Workflow |
|------|-------------|----------|
| **Self-Review** | You are a planning agent creating or revising one of the two docs | [self-review.md](./references/self-review.md) |
| **Full Audit** | Reviewing both docs after creation | [full-audit.md](./references/full-audit.md) |
| **Corrections** | You are the planner subagent dispatched to apply an `issues_found` audit report | [corrections-workflow.md](./references/corrections-workflow.md) |

Load the appropriate workflow document and follow it.
