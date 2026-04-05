# Recall Guide

Query past project knowledge using two search tiers. Results provide historical context to inform planning decisions — current project requirements always take precedence over past patterns.

## Two-Tier Search Pattern

The memory system exposes two MCP tools, each targeting a different knowledge tier:

| Tier | Tool | Purpose |
|------|------|---------|
| Warm | `memory_search` | Semantic search over past decisions, context, and notes |
| Cold | `kb_search` | Full-text search over indexed project document excerpts |

Use both tiers together for comprehensive recall. Start with the warm tier for high-level decisions and patterns, then drill into the cold tier for specific document references.

## Warm-Tier Queries — `memory_search`

Use the warm tier when searching for past decisions, architectural choices, lessons learned, or contextual notes from previous projects.

**Tool call:**

```
Tool: memory_search
Parameters:
  query: string    — Natural language search query
Returns: Semantically similar past decisions, context, notes
```

**When to use:**
- Looking for past architectural or design decisions
- Checking if a similar problem was solved before
- Finding lessons learned or post-mortem notes
- Retrieving context on technologies or patterns previously evaluated

**Example queries:**
- `"authentication flow decisions"`
- `"React state management trade-offs"`
- `"API rate limiting strategies"`

## Cold-Tier Queries — `kb_search`

Use the cold tier when searching for specific content from indexed project documents — PRDs, architecture docs, design docs, and phase reports.

**Tool call:**

```
Tool: kb_search
Parameters:
  query: string           — Topic, technology, or pattern name
  collection?: string     — Optional: limit to specific project collection
Returns: Indexed project document excerpts with collection, document, excerpt, score
```

**When to use:**
- Finding how a specific feature was specified in a past PRD
- Looking up architecture decisions documented in past projects
- Searching for design patterns or component specifications
- Retrieving phase report outcomes for similar work

**Example queries:**
- `"checkout flow requirements"` with `collection: "ecommerce-v2"`
- `"database migration strategy"`
- `"error handling patterns"`

## Query Triggering Guidance

Query continuously as new topics surface throughout your work — not only at session start. Trigger recall queries when you encounter:

- **New domain concepts** — a feature area or business domain you haven't seen context for yet
- **Technical decisions with possible precedent** — technology choices, library selections, architectural patterns where past experience is valuable
- **Pattern recognition opportunities** — similar problems, similar scale, similar constraints to past projects
- **Architecture and design trade-offs** — when weighing options, check if past projects evaluated the same trade-offs

Do not batch all queries at the beginning. As each new topic, decision point, or trade-off emerges during your work, issue a recall query immediately.

## Result Output Format

Format all recall results using this template:

```
── Past Project Context ──────────────────────────────────
Source: {project-name} / {document-type}
Relevance: {similarity score or rank}

{excerpt text}

──────────────────────────────────────────────────────────
ℹ This is historical context — current project requirements
  take precedence over past patterns.
```

**Rules:**
- Results are clearly labeled as historical context
- Source project and document type are identified
- A disclaimer reminds agents that current requirements take precedence
- Multiple results are separated by rule lines
- Each result block includes its own source and relevance metadata

### No Results

When a query returns no results, output:

```
No relevant past project context found for: "{query}"
```

## Error Handling

- **Query errors**: Swallow all query errors silently — do not surface them to the user or halt agent work. Continue with the task as if no recall results were available.
- **Partial failures**: If one tier fails but the other succeeds, use the successful results and discard the failure silently.
- **Timeout**: If a query does not return in a reasonable time, abandon it silently and continue.
