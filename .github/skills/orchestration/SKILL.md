---
name: orchestration
description: Orchestration system runtime, configuration, validation, and context. All pipeline agents load this skill for system context. The Orchestrator receives pipeline-specific guidance. Reviewers and Tactical Plannersreceive validation guidance.
---

# Orchestration

Unified orchestration skill containing the pipeline runtime, system configuration (`orchestration.yml`), validator, and role-specific reference documents. All pipeline agents load this skill for system context.

## Reference Documents

Read `references/context.md` first. If your role appears in the table below with an additional reference, read that document too.

| Role | Reference Document | What It Provides |
|------|--------------------|-----------------|
| All agents | [references/context.md](references/context.md) | Agent roles, pipeline flow, naming conventions, key operating rules |
| Orchestrator | [references/pipeline-guide.md](references/pipeline-guide.md) | Event loop, action routing, CLI usage, state mutation patterns |
| Reviewer, Tactical Planner | [references/validation-guide.md](references/validation-guide.md) | Validator CLI, check modules, validation workflow |
| All agents | [references/document-conventions.md](references/document-conventions.md) | Document naming, placement, filename patterns, frontmatter field values |

## Contents

This skill bundles:

- **`config/orchestration.yml`** — System configuration
- **`schemas/state-v4.schema.json`** — State file JSON Schema
- **`scripts/pipeline.js`** — Pipeline CLI entry point
- **`scripts/migrate-to-v5.js`** — Migrate v4 states and orchestration.yml config to v5 (bulk, dry-run, config modes)
- **`scripts/migrate-legacy.js`** — Migrate pre-v4 states (v1/v2/v3) to current schema
- **`scripts/lib/`** — Pipeline engine, resolver, mutations, state I/O, validator
- **`scripts/validate/`** — Orchestration validator CLI, check modules, utilities
- **`references/`** — Role-specific reference documents
