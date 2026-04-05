---
name: recall-memory
description: 'Query past project knowledge from the memory system. Read-only access to warm tier (semantic memory) and cold tier (indexed project documents). Loaded by all planning agents.'
---

# Recall Memory

Read-only skill for querying past project knowledge from the memory system. Provides two-tier search — warm tier (semantic memory via `memory_search`) and cold tier (indexed project documents via `kb_search`). Results are clearly labeled as historical context with a disclaimer that current requirements take precedence.

## Routing Table

| Mode   | Reference Document             | Script   |
|--------|--------------------------------|----------|
| recall | [references/recall-guide.md](./references/recall-guide.md) | *(none)* |

## Loading Instructions

1. **Check orchestration config**: `memory.enabled === true`
   - If `false` or missing → return (silent no-op, no output)
2. **Check MCP tools available**: `memory_search`, `kb_search`
   - If unavailable → return (silent no-op, no output)
3. **Read** `references/recall-guide.md` for query patterns
4. **Query continuously** as new topics surface — not only at session start

## Graceful Degradation

| Scenario                      | Behavior                    |
|-------------------------------|-----------------------------|
| `memory.enabled` = `false`    | Silent no-op                |
| `memory` section missing      | Treat as disabled, no-op    |
| MCP tools unavailable         | Silent no-op                |
| Query returns error           | Swallow error, continue     |
| No results found              | Report "no context found"   |

## Contents

- **`references/recall-guide.md`** — Two-tier query patterns (warm tier via `memory_search`, cold tier via `kb_search`), query triggering guidance, result output format, error handling
