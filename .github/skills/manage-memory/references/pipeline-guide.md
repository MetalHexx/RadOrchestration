# Pipeline Guide

Automated pipeline subagent workflow for single-project ingestion. This guide is read by a subagent spawned by the Orchestrator in a single-purpose session.

## Workflow

1. **Receive context** — The Orchestrator spawns you with the project name from `state.json → project.name`
2. **Resolve project path** — Build the full path using `projects.base_path` from `orchestration.yml`: `{projects.base_path}/{project-name}`
3. **Call `kb_ingest_dir`** — Ingest the project directory into the knowledge base:

```
Tool: kb_ingest_dir
Parameters:
  path: string           — Absolute path to resolved project directory
  collection?: string    — Optional collection name (defaults to directory name)
Returns: { files_ingested: number, collection: string }
```

4. **Report result** — Output the result to the Orchestrator:
   - **Success**: Report the collection name and file count
   - **Failure**: Report the error message

5. **Orchestrator signals** — The Orchestrator reads your result and signals `memory_ingest_completed --success <true|false> [--error <message>]`

## What This Subagent Does NOT Handle

- **Config checks** — The Orchestrator already verified `memory.enabled` and `auto_ingest` before spawning this subagent
- **Human gates** — The Orchestrator handles the `auto_ingest: ask` confirmation gate before spawning
- **Retry logic** — The pipeline engine handles retry logic if ingestion fails
