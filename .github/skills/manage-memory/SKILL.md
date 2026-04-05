---
name: manage-memory
description: 'Manage the memory knowledge base. Supports ingestion,
  bulk ingestion, search, status, refresh, and removal. Used by the
  pipeline ingestion subagent and by users for manual operations.'
---

# Manage Memory

Read-write skill for managing the total-recall knowledge base. Supports ingesting project documents, bulk ingestion across all projects, searching collections, checking system status, refreshing stale data, and removing collections. Loaded on-demand by users or by the pipeline ingestion subagent. Unlike `recall-memory` (which silently no-ops when unavailable), this skill surfaces errors with recovery hints because the user explicitly invoked an action.

## Routing Table

| Mode         | Reference Document                                                                            | Script   |
|--------------|-----------------------------------------------------------------------------------------------|----------|
| ingest       | [operations-guide.md#ingest](./references/operations-guide.md#ingest)                        | *(none)* |
| bulk-ingest  | [operations-guide.md#bulk-ingest](./references/operations-guide.md#bulk-ingest)              | *(none)* |
| search       | [operations-guide.md#search](./references/operations-guide.md#search)                        | *(none)* |
| status       | [operations-guide.md#status](./references/operations-guide.md#status)                        | *(none)* |
| refresh      | [operations-guide.md#refresh](./references/operations-guide.md#refresh)                      | *(none)* |
| remove       | [operations-guide.md#remove](./references/operations-guide.md#remove)                        | *(none)* |
| pipeline     | [pipeline-guide.md#workflow](./references/pipeline-guide.md#workflow)                        | *(none)* |

## Loading Instructions

1. **Determine mode** from context:
   - Pipeline subagent → **pipeline** mode (read `pipeline-guide.md`)
   - User request → match to operation mode (read `operations-guide.md`)
2. **Read the reference document** for your mode
3. **Execute MCP tool calls** per the reference guide
4. **On any failure**, display error with recovery hint

## Error Handling

| Scenario                      | Behavior                          |
|-------------------------------|-----------------------------------|
| Memory not installed          | Error: install instructions       |
| Memory disabled in config     | Error: config hint                |
| Project dir not found         | Error: path not found             |
| MCP tool call failure         | Error: show error message         |
| Collection not found          | Error: suggest running status     |

## Contents

- **`references/operations-guide.md`** — User-facing operations: ingest, bulk-ingest, search, status, refresh, remove — with MCP tool calls, confirmation patterns, and output formats
- **`references/pipeline-guide.md`** — Automated pipeline subagent workflow for single-project ingestion
