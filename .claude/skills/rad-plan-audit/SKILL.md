---
name: 'rad-plan-audit'
description: 'Audit planning document(s) for codebase accuracy and cross-document cohesion. Two modes: self-review (planner-time validation during document creation) and full audit (comprehensive review of the complete planning set).'
user-invocable: true
---

# Plan Audit

Validates planning documents across two dimensions:

1. **Codebase Accuracy** — Do docs correctly describe the existing code they reference?
2. **Cross-Document Cohesion** — Do all docs in the set align without gaps, contradictions, or drift?

The [audit rubric](./references/audit-rubric.md) defines exactly what counts as a finding.

## Mode Selection

| Mode | When to use | Workflow |
|------|-------------|----------|
| **Self-Review** | You are a planning agent creating or revising a document | [self-review.md](./references/self-review.md) |
| **Full Audit** | Reviewing the complete planning set after creation | [full-audit.md](./references/full-audit.md) |

Load the appropriate workflow document and follow it.
