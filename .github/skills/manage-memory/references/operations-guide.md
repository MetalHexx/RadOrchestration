# Operations Guide

User-facing operations for managing the memory knowledge base. Each operation documents when to use it, the MCP tool call with parameters and return shape, confirmation patterns, and output format.

## Config Awareness

The skill references the `memory:` section of `orchestration.yml`:

```yaml
memory:
  enabled: false                         # Enable memory system for planning agents
  auto_ingest: "never"                   # always | ask | never
```

For bulk operations, the skill reads the projects base path:

```yaml
projects:
  base_path: "../orchestration-projects"  # Relative or absolute path to project storage
```

---

## Ingest

Ingest a single project directory into the knowledge base.

**When to use**: User wants to add a project to the knowledge base for the first time.

**MCP Tool Call**:

```
Tool: kb_ingest_dir
Parameters:
  path: string           — Absolute path to project directory
  collection?: string    — Optional collection name (defaults to directory name)
Returns: { files_ingested: number, collection: string }
```

**Confirmation**: Not required — user explicitly requested the operation.

**Output Format**:

```
Ingesting: {project-directory-name}
  ⠋ Processing files...
  ✓ Ingested {N} files into collection '{collection-name}'
```

---

## Bulk Ingest

Discover all project directories under `projects.base_path` and ingest each one.

**When to use**: User wants to ingest all projects at once (initial setup, or adding many projects).

**Config dependency**: Read `projects.base_path` from `orchestration.yml` to discover project directories. This is a string value — either a relative or absolute path to the project storage directory. List all subdirectories under this path as candidate projects.

**MCP Tool Call** (called once per discovered project):

```
Tool: kb_ingest_dir
Parameters:
  path: string           — Absolute path to project directory
  collection?: string    — Optional collection name (defaults to directory name)
Returns: { files_ingested: number, collection: string }
```

**Confirmation**: **Required** — list all discovered directories and ask:

```
Ingest N projects into the knowledge base?
```

Present the list of directories so the user can confirm before proceeding.

**Output Format**:

```
Found {N} project directories in {projects-base-path}

Ingest all {N} projects into the knowledge base?
  │
  ├─ Confirmed
  │   Ingesting: {project-1}
  │     ✓ {N} files
  │   Ingesting: {project-2}
  │     ✓ {N} files
  │   ...
  │   ✓ Bulk ingestion complete: {N} projects, {total-files} files
  │
  └─ Declined
      Bulk ingestion cancelled.
```

---

## Search

Search the knowledge base for relevant documents.

**When to use**: User wants to find past project knowledge, patterns, or context.

**MCP Tool Call**:

```
Tool: kb_search
Parameters:
  query: string          — Topic, technology, or pattern name
  collection?: string    — Optional: limit to specific project collection
Returns: array of { collection: string, document: string, excerpt: string, score: number }
```

**Confirmation**: Not required — read-only operation.

**Output Format**:

```
Knowledge base search: "{query}"

  [{rank}] {collection-name} / {document}
      {excerpt}

  {total} results found
```

---

## Status

Check the memory system status — database location, collection count, and per-collection details.

**When to use**: User wants to see what's in the knowledge base, or to verify the system is working.

**MCP Tool Calls**:

```
Tool: status
Parameters: (none)
Returns: { db_path: string, collections: number, total_documents: number }
```

```
Tool: kb_list_collections
Parameters: (none)
Returns: array of { name: string, document_count: number, last_updated: string }
```

**Confirmation**: Not required — read-only operation.

**Output Format**:

```
Memory System Status
  Database: {path}
  Collections: {count}
  Total documents: {count}

  Collection          Documents   Last Updated
  ─────────────────   ─────────   ────────────
  {collection-name}   {count}     {date}
  {collection-name}   {count}     {date}
```

---

## Refresh

Re-ingest a previously ingested project to update stale data.

**When to use**: User knows a project has changed and wants the knowledge base updated.

**MCP Tool Call**:

```
Tool: kb_refresh
Parameters:
  collection: string     — Collection name to re-ingest
Returns: { files_ingested: number, collection: string }
```

**Confirmation**: Not required — user explicitly requested the operation.

**Output Format**:

```
Refreshing: {collection-name}
  ⠋ Re-ingesting files...
  ✓ Refreshed collection '{collection-name}' ({N} files)
```

---

## Remove

Remove a collection from the knowledge base. This cannot be undone.

**When to use**: User wants to delete a project's data from the knowledge base.

**MCP Tool Call**:

```
Tool: kb_remove
Parameters:
  collection: string     — Collection name to remove
Returns: { removed: boolean, collection: string, documents_removed: number }
```

**Confirmation**: **Required** — ask before proceeding:

```
Remove {project-name} from the knowledge base? This cannot be undone.
```

**Output Format**:

```
Remove {project-name} from the knowledge base? This cannot be undone.
  │
  ├─ Confirmed
  │   ✓ Removed collection '{collection-name}' ({N} documents)
  │
  └─ Declined
      Removal cancelled.
```

---

## Error Output Format

All errors follow this consistent pattern:

```
✗ {Operation} failed: {error-message}
  {recovery hint if applicable}
```

| Error Scenario | Message | Recovery Hint |
|----------------|---------|---------------|
| Memory system not installed | `✗ Memory system is not installed` | `Install with: npm install -g @strvmarv/total-recall` |
| Memory disabled in config | `✗ Memory is disabled in configuration` | `Set memory.enabled: true in orchestration.yml` |
| Project directory not found | `✗ Project directory not found: {path}` | *(none)* |
| MCP tool call failure | `✗ {operation} failed: {error.message}` | *(none)* |
| Collection not found | `✗ Collection '{name}' not found in knowledge base` | `Run status to see available collections` |
