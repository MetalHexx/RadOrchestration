# Memory

The memory system adds an optional local knowledge base to the orchestration pipeline, powered by [total-recall](https://www.npmjs.com/package/@strvmarv/total-recall). It enables planning agents to recall decisions, patterns, and context from past projects — and optionally ingests completed projects automatically so future work benefits from accumulated knowledge.

Memory is **disabled by default** and **never blocks pipeline execution**. You can enable it at any time without affecting existing projects.

## Overview

The memory system provides two capabilities:

- **Recall** — Planning agents automatically query past project knowledge when memory is enabled. This adds relevant context from previous projects during brainstorming, research, requirements, architecture, and task planning.
- **Knowledge base management** — You (or the pipeline) can ingest project directories into the knowledge base, search for documents, check system status, refresh stale data, and remove collections.

Both capabilities rely on MCP (Model Context Protocol) tools exposed by the total-recall server. If the server is unavailable or memory is disabled, the system degrades gracefully — recall silently no-ops and the pipeline continues normally.

## Setup

You can set up the memory system through the interactive installer or manually.

### Interactive Installer

Run the installer:

```bash
npx rad-orchestration
```

The wizard includes a **Memory System** section that handles:

1. Installing the `@strvmarv/total-recall` binary
2. Registering the MCP server in `.vscode/mcp.json`
3. Selecting your preferred auto-ingest policy

The installer writes the `memory` section to `orchestration.yml` regardless of whether you opt in, so the config is always present and ready to enable later.

### Manual Setup

1. **Install the npm package globally:**

```bash
npm install -g @strvmarv/total-recall
```

2. **Register the MCP server** in `.vscode/mcp.json`:

```json
{
  "servers": {
    "total-recall": {
      "command": "total-recall"
    }
  }
}
```

If `.vscode/mcp.json` already exists, merge the `total-recall` entry into the existing `servers` object.

3. **Enable memory in `orchestration.yml`:**

```yaml
# ─── Memory ────────────────────────────────────────────────────────
memory:
  enabled: true
  auto_ingest: "ask"
```

## Configuration Reference

The `memory` section in `orchestration.yml` controls all memory behavior:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memory.enabled` | boolean | `false` | Enable the memory system for planning agents. When `true`, planning agents load the `recall-memory` skill and query past project knowledge. |
| `memory.auto_ingest` | enum | `"never"` | Controls automatic ingestion of completed projects into the knowledge base after final approval. |

### Auto-Ingest Policies

| Policy | Behavior |
|--------|----------|
| `always` | Automatically ingest completed projects after final approval — no prompt |
| `ask` | Present a human gate for confirmation before ingesting |
| `never` | Skip ingestion entirely |

> **Note:** The `memory` section is always present in config (the installer writes it regardless of whether you opt in). If the section is missing entirely, the system treats memory as disabled.

## Agent Recall

When memory is enabled, all five planning agents automatically query the knowledge base for relevant past context:

| Agent | Role |
|-------|------|
| `@brainstormer` | Recalls past project ideas and scope decisions |
| `@research` | Recalls past technical findings and codebase patterns |
| `@product-manager` | Recalls past requirements and user stories |
| `@architect` | Recalls past architecture decisions and technical trade-offs |
| `@tactical-planner` | Recalls past task breakdowns and execution patterns |

These agents load the `recall-memory` skill, which provides read-only access to two search tiers:

### Two-Tier Search

| Tier | MCP Tool | Purpose |
|------|----------|---------|
| Warm | `memory_search` | Semantic search over past decisions, context, and notes |
| Cold | `kb_search` | Full-text search over indexed project document excerpts |

Warm-tier results are checked first for high-relevance matches. Cold-tier results supplement with broader document-level context.

### Graceful Degradation

Recall never fails loudly. The system handles every edge case silently so memory issues never interrupt the pipeline:

| Scenario | Behavior |
|----------|----------|
| `memory.enabled` = `false` | Silent no-op — agents skip recall entirely |
| `memory` section missing from config | Treated as disabled — silent no-op |
| MCP tools unavailable | Silent no-op — agent continues without recall |
| Query returns error | Error is swallowed — agent continues normally |
| No results found | Agent reports "no context found" and proceeds |

> **Note:** Current project requirements always take precedence over past context. Recall provides supplementary context, not authoritative guidance.

## Knowledge Base Management

The `manage-memory` skill provides seven operations for managing the knowledge base. Unlike recall (which silently no-ops on failure), management operations surface errors with recovery hints because you explicitly requested an action.

### Operations

| Operation | MCP Tool | Description |
|-----------|----------|-------------|
| **ingest** | `kb_ingest_dir` | Ingest a single project directory into the knowledge base |
| **bulk-ingest** | `kb_ingest_dir` (per project) | Discover and ingest all projects under `projects.base_path` |
| **search** | `kb_search` | Search the knowledge base for relevant documents |
| **status** | `status` + `kb_list_collections` | Check system status — database location, collections, document counts |
| **refresh** | `kb_refresh` | Re-ingest a collection to update stale data |
| **remove** | `kb_remove` | Remove a collection from the knowledge base (destructive, requires confirmation) |
| **pipeline** | `kb_ingest_dir` | Automated single-project ingestion by the pipeline subagent after final approval |

### Error Handling

When a management operation fails, the system provides a structured error message and, where applicable, a recovery hint:

| Error Scenario | Message | Recovery Hint |
|----------------|---------|---------------|
| Memory system not installed | `✗ Memory system is not installed` | Install with: `npm install -g @strvmarv/total-recall` |
| Memory disabled in config | `✗ Memory is disabled in configuration` | Set `memory.enabled: true` in `orchestration.yml` |
| Project directory not found | `✗ Project directory not found: {path}` | — |
| MCP tool call failure | `✗ {operation} failed: {error.message}` | — |
| Collection not found | `✗ Collection '{name}' not found in knowledge base` | Run `status` to see available collections |

### Pipeline Ingestion

After a project receives final approval, the pipeline can automatically ingest it into the knowledge base. The flow is controlled by your `auto_ingest` configuration:

1. The pipeline resolver checks `pipeline.memory_ingested` in project state.
2. If `false`, the resolver returns an `invoke_memory_ingest` action.
3. The `memory_ingest_requested` handler checks your config:
   - **`enabled: false`** or **`auto_ingest: never`** → marks ingestion as complete (skipped)
   - **`auto_ingest: ask`** → presents a human gate for confirmation
   - **`auto_ingest: always`** → spawns the ingestion subagent immediately
4. The subagent calls `kb_ingest_dir` with the project directory.
5. The `memory_ingest_completed` handler marks `memory_ingested = true` regardless of whether ingestion succeeded or failed.
6. The resolver advances to `display_complete`.

> **Note:** Ingestion failure **never** blocks pipeline completion. Even if ingestion encounters an error, the project completes normally.

## Troubleshooting

Common issues and their solutions:

| Problem | Cause | Solution |
|---------|-------|----------|
| Agents don't recall anything | Memory is disabled in config | Set `memory.enabled: true` in `orchestration.yml` |
| `✗ Memory system is not installed` | The total-recall binary is not installed | Run `npm install -g @strvmarv/total-recall` |
| MCP server not recognized | Server not registered in VS Code | Add the `total-recall` entry to `.vscode/mcp.json` (see [Setup](#setup)) |
| Collection not found | The project was never ingested | Run an `ingest` operation for the project directory |
| Query returns no results | Knowledge base is empty or query is too specific | Run `status` to verify collections exist, then try broader search terms |
| Ingestion seems to do nothing | `auto_ingest` is set to `never` | Change `auto_ingest` to `ask` or `always` in `orchestration.yml` |

## Related Documentation

- [Configuration](configuration.md) — Full `orchestration.yml` reference including the `memory` section
- [Skills](skills.md) — Skill inventory including `recall-memory` and `manage-memory`
- [Agents](agents.md) — Agent roles and which agents use memory recall
- [Pipeline](pipeline.md) — Pipeline flow including the post-completion ingestion step
