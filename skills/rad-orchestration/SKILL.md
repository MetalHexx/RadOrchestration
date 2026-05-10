---
name: rad-orchestration
description: Orchestration system runtime, configuration, and context. All pipeline agents load this skill for system context. The Orchestrator receives pipeline-specific guidance.
user-invocable: false
---

# Orchestration

Unified orchestration skill containing the pipeline runtime, system configuration (`orchestration.yml`), validator, and role-specific reference documents. All pipeline agents load this skill for system context.

## Reference Documents

Read `references/context.md` first. If your role appears in the table below with an additional reference, read that document too.

| Role | Reference Document | What It Provides |
|------|--------------------|-----------------|
| All agents | [references/context.md](references/context.md) | Agent roles, pipeline flow, naming conventions, key operating rules |
| Orchestrator | [references/pipeline-guide.md](references/pipeline-guide.md) | Event loop, action routing, CLI usage, state mutation patterns |
| Orchestrator | [references/action-event-reference.md](references/action-event-reference.md) | Complete Action Routing Table (16 actions) and Event Signaling Reference — quick lookup during pipeline operation |
| Orchestrator | [references/corrective-playbook.md](references/corrective-playbook.md) | Orchestrator-only. Mediation guide for `code_review_completed` with `verdict: changes_requested`. Read on every task-scope corrective cycle. |
| All agents | [references/document-conventions.md](references/document-conventions.md) | Document naming, placement, filename patterns, frontmatter field values |

## Contents

This skill bundles:

- **`config/orchestration.yml`** — System configuration
- **`schemas/state-v4.schema.json`** — State file JSON Schema
- **`scripts/pipeline.js`** — Pipeline runtime entry point. All CLI arguments pass through transparently. 
- **`scripts/migrate-to-v5.ts`** — Migration CLI
- **`scripts/lib/`** — Pipeline engine, resolver, mutations, state I/O, validator
- **`templates/`** — Pipeline templates for the four review-intensity tiers (`extra-high.yml`, `high.yml`, `medium.yml`, `low.yml`)
- **`references/`** — Role-specific reference documents
