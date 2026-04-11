# Token Usage Tracking — Design

**Date:** 2026-04-09
**Status:** Design approved, pending implementation plan
**Scope owner:** total-recall plugin (main, post-v0.8.0 GA — the .NET rewrite graduated on 2026-04-09, absorbing rewrite/dotnet via merge commit `bfe304a`)
**Related:** Followup to beta.3–beta.7 stabilization work; independent of MCP/CI fixes.

---

## 1. Summary

Add a token-usage tracking subsystem to total-recall that captures per-turn LLM usage from multiple host tools (Claude Code, Copilot CLI), stores it in the existing SQLite database, and surfaces it via three interfaces: a CLI report command, an MCP tool, and a quota nudge injected into `session_start` context.

The subsystem is designed for **flat-rate provider users** (Claude Code Pro/Max, GitHub Copilot Pro) who want visibility into their burn rate and early warning when approaching quota windows. It is default-on, writes only to the user's local SQLite, and never transmits data off-machine.

---

## 2. Goals, non-goals, and deferred features

### In scope for v1

| Feature | Goal |
|---|---|
| **A — Visibility** | Dashboard / report showing token usage by host, project, day, model, or session, with time-window filters. |
| **B — Quota nudging** | Ambient warnings injected into `session_start` context when the user approaches a known quota window threshold. Hybrid model: built-in plan defaults + user overrides + descriptive fallback. |
| **D — Cross-host aggregation** | Unified view across Claude Code and Copilot CLI, with graceful handling of per-host fidelity differences. |

All three ship default-on. No opt-in flags. Feature B is ambient but non-interactive — it displays information, it does not throttle or pause requests.

### Explicitly deferred

| Feature | Status | Why deferred |
|---|---|---|
| **C — Optimization recommendations** (cache-hit-rate analysis, "your biggest single turn", etc.) | v2 | Requires baselines + scoring; the data model supports it but the UX is separate work. |
| Continuous tail / live-update file watcher | v2 | session_start cadence is sufficient for all v1 features. |
| Cursor / Cline / OpenCode adapters | v2 per host | No empirical schema verification available on current hardware. Architecture supports them as additive adapters. |
| Per-tool-call cost breakdown (web_search, etc.) | v2 | `server_tool_use_json` column captures the raw data; new query dimensions layer on top. |
| Quota enforcement actions (throttling, pausing) | out of scope | Intentional — the feature surfaces information; the LLM or user decides what to do with it. |
| Cross-device sync | out of scope | Per-machine local store is the design. |
| CSV/NDJSON export command | v2 if demand | Users can `sqlite3 .mode csv` against `usage_events` directly in the meantime. |
| Manual pruning UI | v2 if demand | Automatic retention + rollup handle aging. |

---

## 3. Architecture

A new subsystem in `TotalRecall.Infrastructure/Usage/` parallel to the existing `Importers/` subsystem, with its own adapter interface. Reuses the `Telemetry/` event-log pattern — no ORM, no migrations framework, just handwritten SQL matching the rest of the codebase.

### New modules

| Namespace | Purpose |
|---|---|
| `TotalRecall.Infrastructure.Usage.IUsageImporter` | Adapter interface: one implementation per host. Pure — streams `UsageEvent` records without touching SQLite. |
| `TotalRecall.Infrastructure.Usage.ClaudeCodeUsageImporter` | Parses `~/.claude/projects/*/*.jsonl`. Full token fidelity. |
| `TotalRecall.Infrastructure.Usage.CopilotCliUsageImporter` | Parses `~/.copilot/session-state/*/events.jsonl`. Partial fidelity (output_tokens only). |
| `TotalRecall.Infrastructure.Telemetry.UsageEventLog` | Event-sourced append-only table writer. Parallel to `RetrievalEventLog` / `CompactionLog` / `ImportLog`. |
| `TotalRecall.Infrastructure.Telemetry.UsageDailySummary` | Rolling-aggregation table writer. Runs at most once per 24 hours from `session_start`. |
| `TotalRecall.Infrastructure.Telemetry.UsageWatermarkStore` | Per-host incremental scan watermarks. |
| `TotalRecall.Infrastructure.Usage.UsageIndexer` | Orchestrator. Calls each `IUsageImporter.ScanAsync`, persists events, updates watermarks, triggers rollup. Runs once per `session_start`. |
| `TotalRecall.Infrastructure.Usage.UsageQueryService` | Read layer. Translates window + group-by + filter into SQL over raw + daily tables, handles the boundary join. |
| `TotalRecall.Infrastructure.Usage.QuotaPlanRegistry` | Static plan database + user config overrides. Loaded once at MCP server boot. |
| `TotalRecall.Infrastructure.Usage.QuotaEvaluator` | Pure function: `(UsageReport, QuotaPlan?) → QuotaEvaluation` per host. |
| `TotalRecall.Infrastructure.Usage.QuotaNudgeComposer` | Formats `QuotaEvaluation` list into a two-line string for session_start injection. |
| `TotalRecall.Server.Handlers.UsageStatusHandler` | New MCP tool `usage_status`. |
| `TotalRecall.Cli.Commands.UsageCommand` | New CLI verb `total-recall usage`. |

### Integration points

```
┌──────────────────────────────────────────────────┐
│  session_start hook (existing)                    │
│  ┌─────────────────────────────────────────────┐ │
│  │  UsageIndexer.RunAsync() (new)               │ │
│  │    for each IUsageImporter:                  │ │
│  │      scan host transcripts since watermark   │ │
│  │      write raw events → UsageEventLog        │ │
│  │    if ≥24h since last rollup:                │ │
│  │      UsageDailySummary.Rollup()              │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │  session_start response (existing)           │ │
│  │    context field += QuotaNudgeComposer       │ │
│  │      .ComposeForSessionStart()               │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                      │
                      │  read path (on-demand)
                      ▼
     ┌────────────────────────────────┐
     │  UsageQueryService              │
     │    SELECT ... FROM              │
     │       usage_events UNION ALL    │
     │       usage_daily               │
     └────────────────────────────────┘
           ▲                    ▲
           │                    │
 ┌─────────┴──┐       ┌─────────┴──────────┐
 │  MCP tool  │       │  CLI `usage` verb   │
 │  usage_    │       │  total-recall usage │
 │  status    │       └────────────────────┘
 └────────────┘
```

### Boundary invariants

1. **`IUsageImporter` is pure.** Emits `UsageEvent` records; does NOT write to SQLite. Adapters are unit-testable with in-memory fixtures; the write path is centralized in `UsageEventLog`.
2. **`UsageQueryService` is the only read path.** CLI, MCP tool, and `QuotaNudgeComposer` all go through it.
3. **`QuotaPlanRegistry` is data + config, no business logic.** Plan limits are JSON; user overrides patch via config.toml.
4. **Event → daily rollup is idempotent.** Re-running the rollup is a no-op via `INSERT OR REPLACE` keyed on `(day_utc, host, model, project)`.

---

## 4. Data model

Three new tables inside the existing total-recall SQLite database, added as migration #6 to `Storage/Schema.cs`.

### 4.1 `usage_events` — raw, 30-day retention

```sql
CREATE TABLE usage_events (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    host                    TEXT NOT NULL,           -- 'claude-code' | 'copilot-cli' | ...
    host_event_id           TEXT NOT NULL,           -- stable per-event ID from the host
    session_id              TEXT NOT NULL,           -- host session UUID
    interaction_id          TEXT,                    -- Copilot CLI only
    turn_index              INTEGER,                 -- per-session 0-indexed turn counter (computed at ingest)

    ts                      INTEGER NOT NULL,        -- unix epoch milliseconds

    project_path            TEXT,                    -- cwd or gitRoot at event time
    project_repo            TEXT,                    -- "owner/name" (Copilot only)
    project_branch          TEXT,                    -- Copilot only
    project_commit          TEXT,                    -- Copilot only

    model                   TEXT,                    -- "claude-sonnet-4.6", "claude-opus-4.1", null if unknown

    -- All token columns nullable; host fidelity varies.
    input_tokens            INTEGER,                 -- Claude Code only
    cache_creation_5m       INTEGER,                 -- Claude Code only (ephemeral_5m_input_tokens)
    cache_creation_1h       INTEGER,                 -- Claude Code only (ephemeral_1h_input_tokens)
    cache_read              INTEGER,                 -- Claude Code only
    output_tokens           INTEGER,                 -- Claude Code ✓, Copilot CLI ✓

    service_tier            TEXT,                    -- Claude Code only
    server_tool_use_json    TEXT,                    -- Claude Code only, JSON blob
    host_request_id         TEXT,                    -- Copilot CLI: GitHub request ID

    UNIQUE (host, host_event_id)
);

CREATE INDEX idx_usage_events_host_ts ON usage_events (host, ts);
CREATE INDEX idx_usage_events_ts      ON usage_events (ts);
CREATE INDEX idx_usage_events_session ON usage_events (host, session_id, turn_index);
CREATE INDEX idx_usage_events_project ON usage_events (project_repo, project_path);
```

**Column rationale:**

- **`UNIQUE (host, host_event_id)` + `INSERT OR IGNORE`** — idempotent re-scans during repeated `session_start` passes. Claude Code provides a per-record `uuid`; Copilot CLI provides a per-event `id`. Both are host-stable.
- **`turn_index` computed at ingest** — Copilot CLI has a string `turnId`; Claude Code has no explicit turn counter. The indexer orders assistant messages by timestamp within a session and assigns 0, 1, 2, ... — host-agnostic.
- **Separate `project_repo` / `project_path`** — Copilot CLI gives structured git metadata; Claude Code gives only `cwd`. Query normalization uses `COALESCE(project_repo, project_path)`.
- **All token columns nullable** — Copilot CLI leaves input/cache fields NULL; the query layer treats null as "unknown" not "zero".

### 4.2 `usage_daily` — rollup, forever retention

```sql
CREATE TABLE usage_daily (
    day_utc               INTEGER NOT NULL,   -- unix epoch seconds at UTC midnight
    host                  TEXT NOT NULL,
    model                 TEXT,               -- null if not captured
    project               TEXT,               -- COALESCE(project_repo, project_path) at rollup time

    session_count         INTEGER NOT NULL,
    turn_count            INTEGER NOT NULL,
    input_tokens          INTEGER,            -- SUM; null if nothing in slice had it
    cache_creation_tokens INTEGER,            -- SUM of (5m + 1h)
    cache_read_tokens     INTEGER,
    output_tokens         INTEGER,

    PRIMARY KEY (day_utc, host, model, project)
);

CREATE INDEX idx_usage_daily_host_day ON usage_daily (host, day_utc);
CREATE INDEX idx_usage_daily_day      ON usage_daily (day_utc);
```

**Rollup mechanics** (runs at most once per 24 hours from `session_start`):

```sql
INSERT OR REPLACE INTO usage_daily
  (day_utc, host, model, project,
   session_count, turn_count,
   input_tokens, cache_creation_tokens, cache_read_tokens, output_tokens)
SELECT
  (ts / 86400000) * 86400 AS day_utc,
  host,
  model,
  COALESCE(project_repo, project_path) AS project,
  COUNT(DISTINCT session_id),
  COUNT(*),
  SUM(input_tokens),
  SUM(COALESCE(cache_creation_5m, 0) + COALESCE(cache_creation_1h, 0)),
  SUM(cache_read),
  SUM(output_tokens)
FROM usage_events
WHERE ts < :cutoff_ms
GROUP BY day_utc, host, model, project;

DELETE FROM usage_events WHERE ts < :cutoff_ms;
```

`INSERT OR REPLACE` on the composite PK makes the rollup idempotent even across crash-recovery scenarios. Cardinality back-of-envelope: 5 projects × 2 hosts × 2 models × 365 days ≈ 7,300 rows/year. Negligible.

### 4.3 `usage_watermarks` — incremental scan state

```sql
CREATE TABLE usage_watermarks (
    host                      TEXT PRIMARY KEY,
    last_indexed_ts           INTEGER NOT NULL,   -- max ts seen for this host, ms
    last_scan_at              INTEGER NOT NULL,
    last_rollup_at            INTEGER             -- null until first rollup
);
```

**Watermark semantics:**
- `last_indexed_ts` — indexer considers only events with `ts > last_indexed_ts`. Handles file rotation, deleted old transcripts.
- `last_rollup_at` — single wall-clock timestamp per host; rollup runs when ≥24h elapsed.
- Known gap: backdated events (`ts < last_indexed_ts`) are missed. Neither Claude Code nor Copilot CLI does this in sampled data. Documented as v2 work.

---

## 5. Ingestion pipeline

### 5.1 `IUsageImporter` interface + `UsageEvent` record

```csharp
public interface IUsageImporter
{
    string HostName { get; }
    bool Detect();
    IAsyncEnumerable<UsageEvent> ScanAsync(long sinceMs, CancellationToken ct);
}

public sealed record UsageEvent(
    string Host,
    string HostEventId,
    string SessionId,
    long TimestampMs,
    int? TurnIndex,
    string? Model,
    string? ProjectPath,
    string? ProjectRepo,
    string? ProjectBranch,
    string? ProjectCommit,
    string? InteractionId,
    int? InputTokens,
    int? CacheCreation5m,
    int? CacheCreation1h,
    int? CacheRead,
    int? OutputTokens,
    string? ServiceTier,
    string? ServerToolUseJson,
    string? HostRequestId);
```

`IAsyncEnumerable` streams multi-MB transcripts without loading them into memory. Adapters are stateless — watermark is passed in as `sinceMs`, not stored in the adapter instance.

### 5.2 `ClaudeCodeUsageImporter`

**Source layout:** `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`

**Parsing rules:**
- Each subdirectory under `~/.claude/projects/` is one project; directory name is encoded cwd (e.g., `-Users-strvmarv-source-total-recall`).
- Each `.jsonl` file is one session; filename without extension is the session UUID.
- File-mtime short-circuit: skip any file whose mtime is older than `sinceMs`.
- Only records with `message.usage` are emitted as `UsageEvent` (assistant turns). Filter ratio in sampled data: 500 usage records out of 1739 total.
- Record-level `uuid` becomes `HostEventId`.
- Cache-creation is flat-mapped from `message.usage.cache_creation.ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`.
- `server_tool_use` object is serialized as-is to `server_tool_use_json` (stored verbatim for v2 optimization queries).
- Malformed JSON lines: skip silently, continue.

### 5.3 `CopilotCliUsageImporter`

**Source layout:** `~/.copilot/session-state/<session-uuid>/events.jsonl`

**Schema verified empirically** on `copilot@1.0.22` (2026-04-09). Event types in a typical session:

| Event type | Count (sample) | Notes |
|---|---:|---|
| `session.start` | 1 | Carries rich git context (cwd, gitRoot, branch, repo, headCommit, hostType) |
| `session.context_changed` | 1+ | Mid-session branch/repo changes; must reattribute subsequent events |
| `assistant.turn_start` / `assistant.turn_end` | 22 each | Turn boundaries |
| `assistant.message` | 21 | **The only event with token data** — `data.outputTokens` |
| `user.message` | 6 | User prompts |
| `tool.execution_start` / `tool.execution_complete` | 28 each | `tool.execution_complete.data.model` is the only place model name appears |
| `hook.start` / `hook.end`, `skill.invoked`, `system.notification`, `session.error` | 1 each | Not used by this adapter |

**Parsing rules:**
- Single-pass with running-context variables (`projectPath`, `projectRepo`, `projectBranch`, `projectCommit`, `lastKnownModel`).
- `session.start.data.context` initializes the running project context.
- `session.context_changed.data` updates the running project context for subsequent events.
- `tool.execution_complete.data.model` updates `lastKnownModel`.
- `assistant.message` events emit a `UsageEvent` using the current running context and last-known model.
- `HostEventId` = `assistant.message.id` (a UUID from the host).
- All Claude-Code-specific token fields (`input_tokens`, cache fields, `service_tier`) are left null.
- Only `output_tokens` (from `assistant.message.data.outputTokens`) and `host_request_id` (from `assistant.message.data.requestId`) are populated.

### 5.4 `UsageIndexer` orchestration

```
for each importer in registered_importers:
    if !importer.Detect(): continue
    since_ms = watermark[importer.HostName]  // or initial_backfill value on first run
    new_max = since_ms

    try:
        for each event in importer.ScanAsync(since_ms):
            event_log.InsertOrIgnoreAsync(event)
            new_max = max(new_max, event.TimestampMs)
    catch exception:
        ExceptionLogger.LogChain("total-recall: usage indexer: {host} scan failed", ex)
        continue  // other hosts still run

    if new_max > since_ms:
        watermark.Set(importer.HostName, new_max)

if rollup.ShouldRun():
    rollup.RunAsync()
```

**Failure isolation:** per-host exceptions are logged via `ExceptionLogger.LogChain` (the helper added in Fix B of the beta.5+6 PR, for inner-exception unwrapping) and do not prevent other hosts from scanning. Watermark does NOT advance for a failed host — next session retries cleanly.

**Guarantee:** usage tracking is a best-effort feature. Any failure anywhere in the indexer is swallowed with a log line; the MCP server boots regardless.

---

## 6. Query layer and UX surface

### 6.1 `UsageQueryService`

```csharp
public sealed class UsageQueryService
{
    public Task<UsageReport>  QueryAsync(UsageQuery query, CancellationToken ct);
    public Task<QuotaWindow> QuotaWindowAsync(string host, TimeSpan window, CancellationToken ct);
}

public sealed record UsageQuery(
    DateTimeOffset Start,
    DateTimeOffset End,
    IReadOnlyList<string>? HostFilter,
    IReadOnlyList<string>? ProjectFilter,
    GroupBy GroupBy,                        // None | Host | Project | Day | Model | Session
    int TopN);

public sealed record UsageReport(
    DateTimeOffset Start,
    DateTimeOffset End,
    IReadOnlyList<UsageBucket> Buckets,
    UsageTotals GrandTotal,
    int SessionsWithFullTokenData,          // Claude Code
    int SessionsWithPartialTokenData);      // Copilot CLI

public sealed record UsageBucket(string Key, UsageTotals Totals);

public sealed record UsageTotals(
    int SessionCount,
    long TurnCount,
    long? InputTokens,
    long? CacheCreationTokens,
    long? CacheReadTokens,
    long? OutputTokens);
```

### 6.2 Raw/daily union logic

Dynamic rollup_cutoff is read from `usage_watermarks.last_rollup_at`. Query touches `usage_events` for the post-cutoff portion and `usage_daily` for the pre-cutoff portion, unioned in a CTE:

```sql
WITH raw_slice AS (
    SELECT (ts / 86400000) * 86400 AS day_utc, host, model,
           COALESCE(project_repo, project_path) AS project,
           session_id, input_tokens,
           COALESCE(cache_creation_5m,0) + COALESCE(cache_creation_1h,0) AS cache_creation_tokens,
           cache_read AS cache_read_tokens,
           output_tokens, 1 AS turn_count
    FROM usage_events
    WHERE ts BETWEEN :start_ms AND :end_ms
      AND ts >= :rollup_cutoff_ms
),
rolled_slice AS (
    SELECT day_utc, host, model, project, NULL AS session_id,
           input_tokens, cache_creation_tokens, cache_read_tokens,
           output_tokens, turn_count
    FROM usage_daily
    WHERE day_utc BETWEEN :start_day AND :end_day
      AND day_utc < :rollup_cutoff_day
)
SELECT /* GROUP BY the query dimension */ ...
FROM (SELECT * FROM raw_slice UNION ALL SELECT * FROM rolled_slice);
```

**Null handling in aggregation:** `SUM(input_tokens)` ignores nulls by SQLite default → the result is "tokens we actually measured", not "zero for unknowns". `UsageReport.SessionsWithFullTokenData` lets the renderer caveat explicitly: "3.2M input tokens across 42 of 49 sessions (85.7% coverage)".

### 6.3 CLI command — `total-recall usage`

```
Usage: total-recall usage [OPTIONS]

Options:
  --last <window>     5h | 1d | 7d | 30d | 90d | all   (default: 7d)
  --by <dim>          host | project | day | model | session   (default: host)
  --host <id>         Filter to one host
  --project <id>      Filter to one project
  --top <N>           Limit to top N rows by output_tokens
  --detail            Break out cache_creation vs cache_read separately
  --json              Emit JSON instead of a table
  -h, --help
```

**Default text output** (illustrative):

```
total-recall usage — last 7 days
┌──────────────┬─────────┬─────────┬──────────┬─────────┬─────────┐
│ host         │ sessions│   turns │   input  │  cached │  output │
├──────────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ claude-code  │      42 │   3,108 │  12.4M   │  42.1M  │   487k  │
│ copilot-cli  │       7 │     219 │    —     │    —    │    32k  │
├──────────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ total        │      49 │   3,327 │  12.4M   │  42.1M  │   519k  │
└──────────────┴─────────┴─────────┴──────────┴─────────┴─────────┘

Tracked at token granularity: 42 of 49 sessions (85.7%)
Quota: claude-code at 68% of 5h window (reset in 1h 52m)
```

**Em-dash (`—`) for NULL token columns** — visually distinguishes "we know this is zero" from "we don't know this value".

**`--by session` constraint:** locked to `--last ≤30d` (raw retention window). Beyond that, per-session granularity is lost in the daily rollup. Error message emitted at argument-parse time, before any query runs: `"--by session requires --last ≤30d (raw event retention window)"` — exit code 2 (usage error), matching other CLI argument validation in `CliApp`.

**`--json` output** follows a stable schema including `coverage` metadata (`sessions_with_full_token_data`, `sessions_with_partial_token_data`, `fidelity_percent`) and `quotas[]` array with the current evaluation for each host.

### 6.4 MCP tool — `usage_status`

```jsonc
{
  "name": "usage_status",
  "description":
    "Get token usage across hosts (claude-code, copilot-cli, ...). " +
    "Use for visibility reports (last 7 days, group by host/project/day/model) " +
    "and for current quota state (last 5h window for claude-code).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "window":   { "type": "string", "enum": ["5h","1d","7d","30d","90d","all"], "default": "7d" },
      "group_by": { "type": "string", "enum": ["host","project","day","model","session","none"], "default": "host" },
      "host":     { "type": "string" },
      "project":  { "type": "string" },
      "top":      { "type": "integer", "minimum": 1 }
    }
  }
}
```

Returns the same JSON shape as `total-recall usage --json`.

### 6.5 `session_start` context injection

`UsageIndexer` runs before the existing `session_start` response is composed. `QuotaNudgeComposer.ComposeForSessionStart()` returns a two-line string prepended to the existing `context` field:

```
Usage: claude-code 68% of 5h window (245k/360k tokens, reset 3:40 PM local); copilot-cli 27 messages in last 5h (+78% vs 7d avg).
Last 7 days: 49 sessions / 3,327 turns / 12.4M in / 519k out across 2 hosts. 85.7% tracked at token granularity.
- ALWAYS run tests before committing code changes…
- User requirement for git commits on this device…
```

Default cap: **280 chars for the first line only** — the per-host quota nudge list. The second line (overall summary) is always a single sentence of fixed shape and is never trimmed. When the first line would exceed 280 chars, lower-severity hosts are dropped in order (Descriptive → Info → Warning; Critical is always preserved), with `(+N more)` suffix indicating how many hosts were omitted.

### 6.6 Query correctness notes

- All query logic uses UTC millisecond timestamps internally; CLI renders to local time via `DateTimeOffset.ToLocalTime()` for display only.
- `--last 5h` is wall-clock `now - 5h` (strict), not session-anchored.
- `--last all` touches both tables; indexed on `(host, ts)` and `(host, day_utc)`.

---

## 7. Quota nudging (hybrid W model)

### 7.1 `QuotaPlanRegistry`

```csharp
public sealed record QuotaPlan(
    string Host,
    string PlanId,
    string DisplayName,
    IReadOnlyList<QuotaWindowSpec> Windows);

public sealed record QuotaWindowSpec(
    string WindowId,            // "5h_rolling", "weekly", "monthly"
    TimeSpan Duration,
    WindowKind Kind,            // Rolling | CalendarWeek | CalendarMonth
    long? TokenLimit,           // null if plan measures in messages
    long? MessageLimit);        // null if plan measures in tokens
```

Plans are loaded from embedded `Infrastructure/Usage/plans.json` at boot; user overrides from `config.toml` shadow the embedded defaults. `ActivePlanFor(host)` returns the plan configured for that host, or null (descriptive fallback).

### 7.2 Embedded `plans.json` shipping content

```jsonc
[
  {
    "host": "claude-code",
    "plan_id": "pro",
    "display_name": "Claude Pro",
    "windows": [
      {
        "window_id": "5h_rolling",
        "duration_s": 18000,
        "kind": "rolling",
        "message_limit": 45,
        "token_limit": null,
        "note": "Claude Pro has historically been message-limited per 5h window. Verify via your Claude billing page."
      }
    ]
  },
  {
    "host": "claude-code",
    "plan_id": "max_5x",
    "display_name": "Claude Max 5×",
    "windows": [
      {
        "window_id": "5h_rolling",
        "duration_s": 18000,
        "kind": "rolling",
        "message_limit": 225,
        "token_limit": null,
        "note": "Max 5× is advertised as 5× Pro's 5h throughput."
      }
    ]
  },
  {
    "host": "claude-code",
    "plan_id": "max_20x",
    "display_name": "Claude Max 20×",
    "windows": [
      {
        "window_id": "5h_rolling",
        "duration_s": 18000,
        "kind": "rolling",
        "message_limit": 900,
        "token_limit": null
      }
    ]
  },
  {
    "host": "copilot-cli",
    "plan_id": "copilot_pro",
    "display_name": "GitHub Copilot Pro",
    "windows": [
      {
        "window_id": "monthly",
        "duration_s": 2592000,
        "kind": "calendar_month",
        "message_limit": 300,
        "token_limit": null,
        "note": "Copilot Pro message-based monthly quota. Number is best-effort; verify at github.com/settings/billing."
      }
    ]
  }
]
```

The `note` field is silently ignored by the JSON loader at runtime — it exists as a standing invitation to verify current numbers during PR review. Every entry carrying a `note` creates an audit trail so nobody mistakes "concrete-looking" config for "authoritative".

### 7.3 `QuotaEvaluator`

```csharp
public sealed record QuotaEvaluation(
    string Host,
    Severity Severity,                         // Info | Warning | Critical | Descriptive
    string NudgeLine,
    QuotaEvaluationDetail? HardQuota,
    DescriptiveComparison? Descriptive);

public enum Severity { Info, Warning, Critical, Descriptive }

public sealed record QuotaEvaluationDetail(
    string WindowId,
    DateTimeOffset WindowEnd,
    long Used,
    long Limit,
    double PercentUsed,
    string UnitLabel);                         // "tokens" or "messages"

public sealed record DescriptiveComparison(
    long Current,
    long AverageBaseline,
    double DeltaPercent,
    string UnitLabel);
```

**Evaluation algorithm** (runs per host once per session_start):

```
plan = registry.ActivePlanFor(host)

if plan is null:
    emit BuildDescriptiveFor(host)          # no plan → always descriptive
    return

for each window in plan.Windows:
    used = query.Aggregate(host, window.Kind, window.Duration)

    if plan.TokenLimit is not null and used.InputTokens is not null:
        metric = used.InputTokens + used.OutputTokens + used.CacheCreation
        limit  = plan.TokenLimit
        unit   = "tokens"
    elif plan.MessageLimit is not null:
        metric = used.TurnCount
        limit  = plan.MessageLimit
        unit   = "messages"
    else:
        emit BuildDescriptiveFor(host, window)   # plan exists but host fidelity insufficient
        continue

    ratio = metric / limit
    severity = (ratio ≥ critical_threshold) ? Critical
             : (ratio ≥ warning_threshold)  ? Warning
             :                                Info

    emit QuotaEvaluation(host, severity, ...)
```

**Practical effect for Copilot CLI:** Copilot emits only `outputTokens`, so token-based quotas cannot be computed. The evaluator falls to the `MessageLimit` branch (counting `assistant.message` events in the window) or to descriptive fallback if no plan is configured. This is exactly what the Q3=B (unified schema, optional fields) decision was designed to accommodate, empirically validated during Section 5 exploration.

### 7.4 `QuotaNudgeComposer` format templates

```
CRITICAL   ⚠ {host} at {pct}% of {window} window ({used}/{limit} {unit}), reset {reset_time} — defer non-urgent calls
WARNING      {host} at {pct}% of {window} window ({used}/{limit} {unit}, reset {reset_time})
INFO         {host} at {pct}% of {window} window ({used}/{limit} {unit}, reset {reset_time})
DESCRIPT     {host}: {current} {unit} in last {period} ({delta_sign}{delta_pct}% vs {baseline_days}d avg)
```

Multiple hosts join with `; `. Length cap enforcement drops in reverse severity order (Descriptive → Info → Warning) but never drops Critical. When anything is dropped, appends ` (+N more)` so the user knows to run `usage_status` or `total-recall usage`.

### 7.5 Config schema (`config.toml`)

```toml
[usage.quota]
warning_threshold       = 0.80     # default 0.80
critical_threshold      = 0.95     # default 0.95
descriptive_window_days = 7        # rolling baseline for "+X% vs avg"
nudge_max_length        = 280      # chars for the session_start injection line
nudge_enabled           = true     # kill switch, default on

[usage.quota.active_plan]
claude-code = "max_5x"
copilot-cli = "copilot_pro"

[[usage.quota.plan_override]]
host    = "claude-code"
plan_id = "max_5x"
[[usage.quota.plan_override.window]]
window_id     = "5h_rolling"
duration_s    = 18000
kind          = "rolling"
token_limit   = 1800000            # user-verified from billing page
```

Defaults apply when the user's config doesn't mention usage at all. Malformed override entries are caught per-entry by the loader (bad plan skipped with a stderr warning, other plans still load).

---

## 8. Known risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Copilot CLI schema drift.** Verified on copilot@1.0.22; future versions may change. | Adapter logs warning for unknown `copilotVersion`; parser tolerates missing/renamed fields via `TryGetProperty`. |
| R2 | **Claude Code transcript schema drift.** `message.usage` shape has evolved (cache_creation.ephemeral_1h is recent). | All token columns nullable. Additive schema changes won't break parsing. |
| R3 | **Plan quota drift.** Shipped defaults will age out. | `note` field documents verification source; config override; community PRs; descriptive fallback as safety net when numbers are obviously wrong. |
| R4 | **Backdated events missed by watermark.** | Documented gap. Not observed in sampled data for either host. V2 mitigation: scan by file mtime instead of event timestamp. |
| R5 | **Concurrent MCP sessions writing simultaneously.** | SQLite WAL + `Pooling=False`; `INSERT OR IGNORE` on UNIQUE key is duplicate-safe. Test required. |
| R6 | **First-run scan explosion** on users with years of history. | **Bounded initial backfill**: default 30 days, opt-in to unlimited via `usage.indexer.initial_backfill_days = 0`. Stderr log explains the limit. |
| R7 | **Config override format mistakes.** | `QuotaPlanRegistry` loader wraps each plan override in try/catch; bad entries skipped with warning, good entries still load. |

### Initial backfill behavior

First run (empty `usage_watermarks`):

```
initial_backfill_days = config.Get("usage.indexer.initial_backfill_days", default=30)
since_ms = (initial_backfill_days == 0)
    ? 0                                          # unlimited
    : NowMs - (initial_backfill_days * 86400000)
watermark[host] = since_ms
// normal scan starting from that watermark
```

---

## 9. Testing strategy

Target **~35 new tests** bringing the suite from 944 → ~980.

### `TotalRecall.Infrastructure.Tests` (~20 tests)

- `ClaudeCodeUsageImporterTests` — transcript fixtures covering all token variations, missing `usage`, malformed lines, `cache_creation.ephemeral_5m` vs `ephemeral_1h`.
- `CopilotCliUsageImporterTests` — fixtures for `session.start`, `session.context_changed` mid-session, `assistant.message` with and without `outputTokens`, running-model lookup from `tool.execution_complete`.
- `UsageQueryServiceTests` — in-memory SQLite with seeded mixed-host events; group-by dimensions; null handling; raw/daily boundary union.
- `UsageDailyRollupTests` — idempotency, partial-run recovery, PK conflict handling.
- `QuotaEvaluatorTests` — table-driven threshold crossings (79/80/95%), descriptive fallback triggers (no plan, fidelity mismatch).
- `QuotaNudgeComposerTests` — format correctness, length cap drop order, `+N more` suffix.
- `QuotaPlanRegistryTests` — embedded-defaults load, config override shadowing, malformed override isolation.

### `TotalRecall.Server.Tests` (~10 tests)

- `UsageIndexerTests` — temp dir with fake host layouts, full pass end-to-end, watermark advance.
- Per-host failure isolation: one importer throws, others still run.
- `UsageStatusHandlerTests` — MCP tool invocation, JSON shape stability, filter parameters.
- `SessionStartUsageInjectionTests` — verify quota nudge composes into context response.

### `TotalRecall.Cli.Tests` (~5 tests)

- `UsageCommandTests` — text format snapshot, JSON shape, `--by session` beyond 30d error, combined filters, help text.

---

## 10. Observability of the feature itself

- **Indexer log per session_start** (only when events were scanned): `total-recall: usage indexer: scanned 47 new events (claude-code 42, copilot-cli 5), watermark advanced to 2026-04-09T22:14:37Z`.
- **Rollup log per trigger**: `total-recall: usage rollup: 312 raw events aged past cutoff, consolidated into 14 daily rows`.
- **`total-recall usage --verbose`** shows: raw/daily row counts, per-host watermarks, last rollup time, loaded plans, active plan per host.
- **All indexer/rollup exceptions** go through the existing `ExceptionLogger.LogChain` helper (Fix B pattern from earlier PR).
- **`usage_status` MCP tool** can return a debug section on request: which plan matched, why descriptive fell back.

---

## 11. Migration & backwards compatibility

- **New migration #6** in `Storage/Schema.cs.Migrations[]`. Creates `usage_events`, `usage_daily`, `usage_watermarks` inside the existing `RunMigrations` transaction.
- **Fresh installs**: tables are part of initial schema.
- **Existing installs (beta.7 or earlier upgrading)**: migration runs once; tables empty until first `session_start` triggers the indexer.
- **Rollback**: if a user downgrades, the tables sit unused in their DB. Re-upgrade picks up where it left off via watermarks.
- **Config**: purely additive. Absent `[usage.quota]` section means "use defaults".

---

## 12. Implementation phasing

Three independently shippable phases. Each maps to one input→output→policy layer.

| Phase | Ships | Files | LOC | Tests |
|---|---|---:|---:|---:|
| **1. Visibility core** | Feature A. Data model + schema migration, `ClaudeCodeUsageImporter`, `UsageIndexer`, `UsageQueryService`, CLI `usage` command with text output. Single host. | ~15 | ~1500 | ~15 |
| **2. Cross-host + MCP** | Feature D. `CopilotCliUsageImporter`, `usage_status` MCP tool, JSON output, coverage indicators, rollup. | ~8 | ~700 | ~10 |
| **3. Quota nudging** | Feature B. `QuotaPlanRegistry`, `QuotaEvaluator`, `QuotaNudgeComposer`, `plans.json`, session_start injection, config schema. | ~6 | ~900 | ~15 |

Properties:
- Phase 1 is independently useful — Claude Code usage on day one without waiting for full feature.
- Phase 2 builds on Phase 1's infrastructure.
- Phase 3 is fully isolated from ingest/query — reads from `UsageQueryService`, writes nothing back.
- Each phase is ~1-2 days of focused work and produces a complete, testable increment.

---

## 13. Decision log

| # | Question | Options | Decision | Rationale |
|---|---|---|---|---|
| Q1 | What's the primary value? | A visibility / B quota nudging / C optimization / D cross-host | **A + B + D default-on, C deferred** | Visibility is the ambient-first value; quota nudging gives behavioral leverage via session_start injection; cross-host matters because the user runs multiple assistants; optimization can layer on top later. |
| Q2 | Indexing cadence? | Pull-on-demand / session_start / continuous tail | **session_start** | Mirrors existing `import-host` pattern; fast queries via persistent tables; dev complexity well-understood. |
| Q3 | Schema fidelity strictness? | Strict tokens-only / unified optional / per-host separate | **Unified optional** | Ships D on day one with graceful Copilot degradation; empirically validated when Copilot CLI exploration found only `outputTokens`. |
| Q4a | Nudge surface? | session_start inject / MCP tool / stderr / hybrid | **Hybrid: session_start + MCP tool** | Ambient + on-demand. session_start inject gives LLM-level leverage; MCP tool handles explicit queries. |
| Q4b | Quota trigger model? | Hardcoded plans / user config / descriptive only / hybrid | **Hybrid W: defaults + overrides + descriptive fallback** | Works out of the box for most users, user-correctable, degrades gracefully to descriptive for unknown plans or insufficient host fidelity. |
| Q5 | Storage grain? | Row per session / row per turn / hybrid | **Row per turn (event-sourced)** | Required for 5h rolling window correctness; matches existing `RetrievalEventLog` / `CompactionLog` / `ImportLog` pattern; unlocks future C feature without schema change. |
| Q6 | Retention strategy? | Simple prune / rolling aggregation / no retention | **Rolling aggregation (30d raw + daily forever)** | Forever-trends on-brand for total-recall's archival character; bounded cardinality (~7k daily rows/year); matches tiered storage patterns elsewhere. |
| Q7 | `plans.json` shipping content? | Approximate numbers / shapes only / defer to build agent | **Approximate numbers with `note` fields** | "Default-on" means real behavior out of box; wrong-but-fixable is better than empty; `note` fields create standing invitation to verify. |

---

## Appendix A: Unrelated finding — Copilot CLI hook path resolution bug

During empirical verification of Copilot CLI's event schema (Section 5.3), the following unrelated issue was discovered and is filed separately from this spec:

Copilot CLI's plugin hook invoker resolves total-recall's `hooks/session-start/run.sh` as **absolute from filesystem root** (`/hooks/session-start/run.sh`) instead of plugin-relative (`${CLAUDE_PLUGIN_ROOT}/hooks/session-start/run.sh`). Total-recall's session-start hook therefore fails on every Copilot CLI session with:

```
HookExitCodeError: Hook command failed with code 127
Stderr: bash: /hooks/session-start/run.sh: No such file or directory
```

The MCP side of the plugin is unaffected — total-recall's MCP server still starts correctly under Copilot CLI; only the hook fails. Root cause determination (whether Copilot CLI's hook resolver needs to support plugin-relative paths, or whether total-recall's plugin.json needs a Copilot-compatible hook declaration format) requires separate investigation and is **out of scope for the usage tracking feature**. Filed as a tracking note for a future PR.

---

## Appendix B: Empirically verified Copilot CLI event schema (reference)

From `~/.copilot/session-state/<session-uuid>/events.jsonl` on `copilot@1.0.22` (2026-04-09):

**`session.start`** — carries `sessionId`, `copilotVersion`, `startTime`, and a full `context` object with `cwd`, `gitRoot`, `branch`, `repository` (owner/name slug), `headCommit`, `baseCommit`, `hostType`.

**`session.context_changed`** — same `data` fields as `context` above; emitted on mid-session branch/repo switch.

**`assistant.message`** (the ONLY event carrying token data):
```jsonc
{
  "type": "assistant.message",
  "data": {
    "messageId": "...",
    "content": "...",
    "toolRequests": [...],
    "interactionId": "...",
    "reasoningOpaque": "...",
    "reasoningText": "...",
    "outputTokens": 146,            // ← the only token field
    "requestId": "6EC9:2E8DE:149632B:16E3546:69D82680"
  },
  "id": "...",
  "timestamp": "2026-04-09T22:21:55.364Z",
  "parentId": "..."
}
```

**`tool.execution_complete`** — `data.model` contains the model name (e.g., `claude-sonnet-4.6`). This is the only place the model is surfaced; `CopilotCliUsageImporter` uses a running "last known model" to attribute to subsequent `assistant.message` events.

**Fields NOT present** (compared to Claude Code):
- `input_tokens`
- `cache_creation_input_tokens` / `cache_creation.ephemeral_{5m,1h}_input_tokens`
- `cache_read_input_tokens`
- `service_tier`
- `server_tool_use`

Sample stats from one session (`75c6a1f7-0d0f-4c10-a7da-c8bd91f463d3`): 134 total events, 21 `assistant.message`, 22 `assistant.turn_start`/`end`, 28 `tool.execution_start`/`complete`, 6 `user.message`. Across all 134 events, the only token-related field found by recursive search is `data.outputTokens` on `assistant.message` events (21 occurrences).
