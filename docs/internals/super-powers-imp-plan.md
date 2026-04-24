# Token Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add token-usage tracking (Claude Code + Copilot CLI) with visibility reporting, cross-host aggregation, and quota-nudging session_start injection.

**Architecture:** Event-sourced `usage_events` table (30d raw retention) + rolled-up `usage_daily` table (forever). Per-host `IUsageImporter` adapters (pure streaming parsers, no SQL knowledge) invoked by a `UsageIndexer` orchestrator at session_start. `UsageQueryService` is the single read path for CLI, MCP tool, and nudge composer. `QuotaPlanRegistry` holds static plan defaults + config overrides; `QuotaNudgeComposer` formats the session_start injection.

**Tech Stack:** .NET 10 SDK, `net8.0` target, SQLite via `Microsoft.Data.Sqlite`, xUnit 2.9.2, Spectre.Console for CLI tables. Existing patterns to follow: `Infrastructure/Telemetry/RetrievalEventLog.cs` (event-log writer), `Infrastructure/Importers/ClaudeCodeImporter.cs` (host adapter), `Storage/Schema.cs` (migration), `Cli/Commands/StatusCommand.cs` (CLI verb).

**Source spec:** `docs/superpowers/specs/2026-04-09-token-usage-tracking-design.md`

**Branch:** `main` (direct, per user decision post-v0.8.0 GA — NO feature branch)

**Important standing rules (from saved memory):**
- Commit author MUST be `strvmarv <strvmarv@gmail.com>` — no `Co-Authored-By:` trailers under any circumstance.
- Before EVERY implementation start, run `git fetch origin && git status`; rebase if behind.
- ALWAYS run `dotnet test src/TotalRecall.sln` (with `DOTNET_ROLL_FORWARD=Major` env var and `$HOME/.dotnet` on PATH) before committing. No exceptions.
- `docs/superpowers/` is gitignored; plan + spec files are local-only working artifacts. Never `git add` them.

**Test command reference (copy-paste):**
```bash
export PATH="$HOME/.dotnet:$PATH" DOTNET_ROOT="$HOME/.dotnet" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_ROLL_FORWARD=Major
cd ~/source/total-recall
dotnet test src/TotalRecall.sln -c Debug --nologo
```

---

## File Structure

### Phase 1 — Visibility core (single host: Claude Code)

**Create:**
- `src/TotalRecall.Infrastructure/Usage/UsageEvent.cs` — host-neutral record type
- `src/TotalRecall.Infrastructure/Usage/IUsageImporter.cs` — adapter interface
- `src/TotalRecall.Infrastructure/Usage/ClaudeCodeUsageImporter.cs` — Claude Code transcript parser
- `src/TotalRecall.Infrastructure/Telemetry/UsageEventLog.cs` — raw event table writer/reader
- `src/TotalRecall.Infrastructure/Telemetry/UsageWatermarkStore.cs` — per-host watermark store
- `src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs` — orchestrator
- `src/TotalRecall.Infrastructure/Usage/UsageQuery.cs` — query record types
- `src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs` — read layer
- `src/TotalRecall.Cli/Commands/UsageCommand.cs` — `total-recall usage` verb
- `tests/TotalRecall.Infrastructure.Tests/Usage/UsageEventLogTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/UsageWatermarkStoreTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/ClaudeCodeUsageImporterTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/claude-code-sample.jsonl`
- `tests/TotalRecall.Infrastructure.Tests/Usage/UsageIndexerTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/UsageQueryServiceTests.cs`
- `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs`

**Modify:**
- `src/TotalRecall.Infrastructure/Storage/Schema.cs` — add Migration6_UsageTelemetry + register in `Migrations` array
- `src/TotalRecall.Cli/CliApp.cs:186-212` — register `UsageCommand()` in `BuildRegistry()`
- `src/TotalRecall.Server/SessionLifecycle.cs` — add optional `UsageIndexer` dependency, invoke at init
- `src/TotalRecall.Server/ServerComposition.cs:180-220` — construct `UsageIndexer`, pass to `SessionLifecycle`

### Phase 2 — Cross-host + MCP

**Create:**
- `src/TotalRecall.Infrastructure/Usage/CopilotCliUsageImporter.cs`
- `src/TotalRecall.Server/Handlers/UsageStatusHandler.cs` — `usage_status` MCP tool
- `src/TotalRecall.Cli/Commands/UsageCommandJsonWriter.cs` — JSON output formatter
- `tests/TotalRecall.Infrastructure.Tests/Usage/CopilotCliUsageImporterTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/copilot-cli-sample.jsonl`
- `tests/TotalRecall.Server.Tests/Handlers/UsageStatusHandlerTests.cs`

**Modify:**
- `src/TotalRecall.Server/ServerComposition.cs` — register `CopilotCliUsageImporter` + `UsageStatusHandler`

### Phase 3 — Quota nudging

**Create:**
- `src/TotalRecall.Infrastructure/Usage/QuotaPlan.cs` — plan record types
- `src/TotalRecall.Infrastructure/Usage/QuotaPlanRegistry.cs` — loader w/ config overrides
- `src/TotalRecall.Infrastructure/Usage/plans.json` — embedded resource
- `src/TotalRecall.Infrastructure/Usage/QuotaEvaluator.cs` — pure evaluator
- `src/TotalRecall.Infrastructure/Usage/QuotaNudgeComposer.cs` — context injection formatter
- `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaPlanRegistryTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaEvaluatorTests.cs`
- `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaNudgeComposerTests.cs`

**Modify:**
- `src/TotalRecall.Infrastructure/TotalRecall.Infrastructure.csproj` — add `<EmbeddedResource Include="Usage/plans.json" />`
- `src/TotalRecall.Infrastructure/Config/ConfigLoader.cs` — load `[usage.quota]` section (additive)
- `src/TotalRecall.Server/SessionLifecycle.cs` — compose nudge into `Context` field via `QuotaNudgeComposer`

---

## Pre-flight checklist (run ONCE before Task 1)

- [ ] **Pre-1: Confirm branch + clean state**

```bash
cd ~/source/total-recall
git status
git branch --show-current
git fetch origin
git log HEAD..origin/main --oneline
```

Expected: on `main`, clean working tree (apart from known untracked `models/all-MiniLM-L6-v2/.verified`), no new upstream commits. If upstream has new commits, run `git pull --rebase origin main`.

- [ ] **Pre-2: Confirm .NET 10 SDK + test infra healthy**

```bash
export PATH="$HOME/.dotnet:$PATH" DOTNET_ROOT="$HOME/.dotnet" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_ROLL_FORWARD=Major
dotnet --version
dotnet build src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -5
```

Expected: `10.0.100`, build succeeded, 0 warnings, 0 errors. If not, install SDK via `curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --version 10.0.100 --install-dir "$HOME/.dotnet"`.

- [ ] **Pre-3: Baseline test count**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | grep -E 'Passed!'
```

Expected: ~944 passed, 0 failed. Record the exact number for comparison at end of each phase. By end of Phase 3, expect ~980 passed.

---

# PHASE 1 — Visibility Core

Single-host (Claude Code) end-to-end: schema, adapter, indexer, query service, CLI command. By end of Phase 1, running `total-recall usage` produces a real dashboard populated from the local Claude Code transcripts.

## Task 1: Schema migration #6 — create usage_events, usage_daily, usage_watermarks

**Files:**
- Modify: `src/TotalRecall.Infrastructure/Storage/Schema.cs`
- Test: `tests/TotalRecall.Infrastructure.Tests/Storage/UsageTelemetrySchemaTests.cs` (new file)

- [ ] **Step 1: Write the failing schema test**

Create `tests/TotalRecall.Infrastructure.Tests/Storage/UsageTelemetrySchemaTests.cs`:

```csharp
using Microsoft.Data.Sqlite;
using TotalRecall.Infrastructure.Storage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Storage;

public sealed class UsageTelemetrySchemaTests
{
    [Fact]
    public void Migration6_CreatesUsageTables()
    {
        using var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);

        var tables = QueryTableNames(conn);
        Assert.Contains("usage_events", tables);
        Assert.Contains("usage_daily", tables);
        Assert.Contains("usage_watermarks", tables);
    }

    [Fact]
    public void Migration6_UsageEventsHasRequiredColumns()
    {
        using var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);

        var cols = QueryColumnNames(conn, "usage_events");
        var required = new[] {
            "id", "host", "host_event_id", "session_id", "ts",
            "project_path", "project_repo", "model",
            "input_tokens", "cache_creation_5m", "cache_creation_1h",
            "cache_read", "output_tokens", "host_request_id"
        };
        foreach (var c in required)
            Assert.Contains(c, cols);
    }

    [Fact]
    public void Migration6_UsageEventsUniqueOnHostAndHostEventId()
    {
        using var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);

        using (var insert1 = conn.CreateCommand())
        {
            insert1.CommandText =
                "INSERT INTO usage_events (host, host_event_id, session_id, ts) " +
                "VALUES ('claude-code', 'abc', 'sess1', 100)";
            insert1.ExecuteNonQuery();
        }

        using var insert2 = conn.CreateCommand();
        insert2.CommandText =
            "INSERT OR IGNORE INTO usage_events (host, host_event_id, session_id, ts) " +
            "VALUES ('claude-code', 'abc', 'sess1', 200)";
        var affected = insert2.ExecuteNonQuery();
        Assert.Equal(0, affected); // duplicate ignored
    }

    [Fact]
    public void Migration6_UsageDailyPrimaryKey()
    {
        using var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);

        using (var insert = conn.CreateCommand())
        {
            insert.CommandText =
                "INSERT INTO usage_daily (day_utc, host, model, project, session_count, turn_count) " +
                "VALUES (1000, 'claude-code', 'opus', 'foo', 1, 5)";
            insert.ExecuteNonQuery();
        }

        using var replace = conn.CreateCommand();
        replace.CommandText =
            "INSERT OR REPLACE INTO usage_daily (day_utc, host, model, project, session_count, turn_count) " +
            "VALUES (1000, 'claude-code', 'opus', 'foo', 2, 10)";
        replace.ExecuteNonQuery();

        using var count = conn.CreateCommand();
        count.CommandText = "SELECT COUNT(*) FROM usage_daily";
        Assert.Equal(1L, (long)count.ExecuteScalar()!);
    }

    private static System.Collections.Generic.HashSet<string> QueryTableNames(SqliteConnection conn)
    {
        var names = new System.Collections.Generic.HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table'";
        using var r = cmd.ExecuteReader();
        while (r.Read()) names.Add(r.GetString(0));
        return names;
    }

    private static System.Collections.Generic.HashSet<string> QueryColumnNames(SqliteConnection conn, string table)
    {
        var names = new System.Collections.Generic.HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"PRAGMA table_info({table})";
        using var r = cmd.ExecuteReader();
        while (r.Read()) names.Add(r.GetString(1));
        return names;
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageTelemetrySchemaTests"
```

Expected: 4 tests, 4 failing with "no such table: usage_events" or similar.

- [ ] **Step 3: Add `Migration6_UsageTelemetry` method + register in Schema.cs**

In `src/TotalRecall.Infrastructure/Storage/Schema.cs`, find the `Migrations` array (around line 186) and add the new entry:

```csharp
private static readonly Action<MsSqliteConnection, Microsoft.Data.Sqlite.SqliteTransaction>[] Migrations =
{
    Migration1_InitialSchema,
    Migration2_MetaAndBenchmark,
    Migration3_Fts5,
    Migration4_CompactionLogSource,
    Migration5_CleanupOrphans,
    Migration6_UsageTelemetry,  // <-- ADD THIS LINE
};
```

Then at the bottom of the file (after `Migration5_CleanupOrphans`), add the implementation:

```csharp
private static void Migration6_UsageTelemetry(
    MsSqliteConnection conn,
    Microsoft.Data.Sqlite.SqliteTransaction tx)
{
    // Raw event log — one row per assistant turn. 30-day retention
    // enforced by UsageDailyRollup. See spec §4.1.
    Exec(conn, tx, """
        CREATE TABLE IF NOT EXISTS usage_events (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            host                    TEXT NOT NULL,
            host_event_id           TEXT NOT NULL,
            session_id              TEXT NOT NULL,
            interaction_id          TEXT,
            turn_index              INTEGER,
            ts                      INTEGER NOT NULL,
            project_path            TEXT,
            project_repo            TEXT,
            project_branch          TEXT,
            project_commit          TEXT,
            model                   TEXT,
            input_tokens            INTEGER,
            cache_creation_5m       INTEGER,
            cache_creation_1h       INTEGER,
            cache_read              INTEGER,
            output_tokens           INTEGER,
            service_tier            TEXT,
            server_tool_use_json    TEXT,
            host_request_id         TEXT,
            UNIQUE (host, host_event_id)
        )
        """);

    Exec(conn, tx, "CREATE INDEX IF NOT EXISTS idx_usage_events_host_ts ON usage_events (host, ts)");
    Exec(conn, tx, "CREATE INDEX IF NOT EXISTS idx_usage_events_ts      ON usage_events (ts)");
    Exec(conn, tx, "CREATE INDEX IF NOT EXISTS idx_usage_events_session ON usage_events (host, session_id, turn_index)");
    Exec(conn, tx, "CREATE INDEX IF NOT EXISTS idx_usage_events_project ON usage_events (project_repo, project_path)");

    // Daily rollup — forever retention, bounded cardinality (~7k rows/year
    // for a heavy user with 5 projects × 2 hosts × 2 models × 365 days).
    Exec(conn, tx, """
        CREATE TABLE IF NOT EXISTS usage_daily (
            day_utc               INTEGER NOT NULL,
            host                  TEXT NOT NULL,
            model                 TEXT,
            project               TEXT,
            session_count         INTEGER NOT NULL,
            turn_count            INTEGER NOT NULL,
            input_tokens          INTEGER,
            cache_creation_tokens INTEGER,
            cache_read_tokens     INTEGER,
            output_tokens         INTEGER,
            PRIMARY KEY (day_utc, host, model, project)
        )
        """);

    Exec(conn, tx, "CREATE INDEX IF NOT EXISTS idx_usage_daily_host_day ON usage_daily (host, day_utc)");
    Exec(conn, tx, "CREATE INDEX IF NOT EXISTS idx_usage_daily_day      ON usage_daily (day_utc)");

    // Per-host watermarks — used by UsageIndexer to skip already-scanned
    // events on repeated session_start passes. See spec §4.3.
    Exec(conn, tx, """
        CREATE TABLE IF NOT EXISTS usage_watermarks (
            host                      TEXT PRIMARY KEY,
            last_indexed_ts           INTEGER NOT NULL,
            last_scan_at              INTEGER NOT NULL,
            last_rollup_at            INTEGER
        )
        """);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageTelemetrySchemaTests"
```

Expected: 4 tests, 4 passing.

- [ ] **Step 5: Run the FULL test suite to catch regressions**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: baseline + 4 new tests all passing, 0 failures. The existing `AutoMigrationGuardTests.Migration6_*` entries (if any) still pass because `Migration6_UsageTelemetry` only adds tables and doesn't touch existing ones.

- [ ] **Step 6: Commit**

```bash
git add src/TotalRecall.Infrastructure/Storage/Schema.cs \
        tests/TotalRecall.Infrastructure.Tests/Storage/UsageTelemetrySchemaTests.cs
git commit -m "feat(usage): add migration #6 for usage telemetry tables

Creates usage_events (raw, 30d retention via future rollup), usage_daily
(forever-aggregated), and usage_watermarks (per-host scan state).
Schema matches spec §4.1-4.3. All token columns nullable because host
fidelity varies (Claude Code full, Copilot CLI output_tokens only).

Part of token usage tracking Phase 1 (see
docs/superpowers/plans/2026-04-09-token-usage-tracking-plan.md)."
```

---

## Task 2: UsageEvent record + IUsageImporter interface

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/UsageEvent.cs`
- Create: `src/TotalRecall.Infrastructure/Usage/IUsageImporter.cs`

No tests for this task — pure data/interface definitions exercised by later tasks' tests.

- [ ] **Step 1: Create the `Usage/` directory + `UsageEvent.cs`**

Create `src/TotalRecall.Infrastructure/Usage/UsageEvent.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/UsageEvent.cs
//
// Host-neutral usage event record, one per assistant turn. Every host
// adapter translates its transcript format into this shape; the writer
// path (UsageEventLog) persists exactly these fields. Nullability of
// token columns is deliberate — Copilot CLI emits only output_tokens,
// Claude Code emits the full Anthropic usage object. See spec §5.1.

namespace TotalRecall.Infrastructure.Usage;

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

- [ ] **Step 2: Create `IUsageImporter.cs`**

Create `src/TotalRecall.Infrastructure/Usage/IUsageImporter.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/IUsageImporter.cs
//
// Adapter interface for reading usage events from a single host's log
// files. PURE — does NOT write to SQLite. Implementations stream
// UsageEvent records via IAsyncEnumerable; the UsageIndexer orchestrator
// owns all database writes. This mirrors the existing Importers/IImporter
// separation where parsers and writers are separated by concern.
//
// Watermark is passed IN via sinceMs, not stored in the adapter — the
// indexer holds the watermark in usage_watermarks and calls ScanAsync
// with the current value. Adapters are stateless and cheap to construct.

using System.Collections.Generic;
using System.Threading;

namespace TotalRecall.Infrastructure.Usage;

public interface IUsageImporter
{
    /// <summary>Host identifier written to usage_events.host.</summary>
    string HostName { get; }

    /// <summary>
    /// True if this host has data on this machine (e.g., the transcript
    /// directory exists). Cheap check; called on every UsageIndexer pass.
    /// </summary>
    bool Detect();

    /// <summary>
    /// Emit all UsageEvent records with ts &gt; sinceMs. Callers persist
    /// them via UsageEventLog. Ordering is not guaranteed — the writer
    /// is UNIQUE on (host, host_event_id) and handles duplicates via
    /// INSERT OR IGNORE.
    /// </summary>
    IAsyncEnumerable<UsageEvent> ScanAsync(long sinceMs, CancellationToken ct);
}
```

- [ ] **Step 3: Build to verify the files compile**

```bash
dotnet build src/TotalRecall.Infrastructure/TotalRecall.Infrastructure.csproj -c Debug --nologo 2>&1 | tail -5
```

Expected: Build succeeded, 0 warnings, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/UsageEvent.cs \
        src/TotalRecall.Infrastructure/Usage/IUsageImporter.cs
git commit -m "feat(usage): UsageEvent record + IUsageImporter interface

Host-neutral event shape + pure streaming adapter contract.
Adapters translate host-specific transcripts into this common shape;
the writer path is centralized in a later task's UsageEventLog.
Part of Phase 1 scaffolding."
```

---

## Task 3: UsageEventLog — writer + reader for usage_events

**Files:**
- Create: `src/TotalRecall.Infrastructure/Telemetry/UsageEventLog.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/UsageEventLogTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/UsageEventLogTests.cs`:

```csharp
using Microsoft.Data.Sqlite;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class UsageEventLogTests
{
    private static SqliteConnection OpenMigrated()
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        return conn;
    }

    private static UsageEvent MakeEvent(
        string host = "claude-code",
        string hostEventId = "evt-1",
        string sessionId = "sess-1",
        long ts = 1000,
        int? input = 100,
        int? output = 50) =>
        new UsageEvent(
            Host: host, HostEventId: hostEventId, SessionId: sessionId,
            TimestampMs: ts, TurnIndex: 0, Model: "claude-opus-4.1",
            ProjectPath: "/p", ProjectRepo: null, ProjectBranch: null, ProjectCommit: null,
            InteractionId: null,
            InputTokens: input, CacheCreation5m: null, CacheCreation1h: null,
            CacheRead: null, OutputTokens: output,
            ServiceTier: null, ServerToolUseJson: null, HostRequestId: null);

    [Fact]
    public void InsertOrIgnore_NewEvent_WritesRow()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var evt = MakeEvent();

        var inserted = log.InsertOrIgnore(evt);

        Assert.Equal(1, inserted);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_events";
        Assert.Equal(1L, (long)cmd.ExecuteScalar()!);
    }

    [Fact]
    public void InsertOrIgnore_DuplicateHostEventId_IsSkipped()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var evt1 = MakeEvent(hostEventId: "dup");
        var evt2 = MakeEvent(hostEventId: "dup", ts: 9999);

        log.InsertOrIgnore(evt1);
        var inserted = log.InsertOrIgnore(evt2);

        Assert.Equal(0, inserted);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_events";
        Assert.Equal(1L, (long)cmd.ExecuteScalar()!);
    }

    [Fact]
    public void InsertOrIgnore_NullableTokenColumns_PersistAsNull()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var evt = MakeEvent(input: null, output: null);

        log.InsertOrIgnore(evt);

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT input_tokens, output_tokens FROM usage_events LIMIT 1";
        using var r = cmd.ExecuteReader();
        Assert.True(r.Read());
        Assert.True(r.IsDBNull(0));
        Assert.True(r.IsDBNull(1));
    }

    [Fact]
    public void CountForHost_ReturnsOnlyMatchingHost()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        log.InsertOrIgnore(MakeEvent(host: "claude-code", hostEventId: "a"));
        log.InsertOrIgnore(MakeEvent(host: "claude-code", hostEventId: "b"));
        log.InsertOrIgnore(MakeEvent(host: "copilot-cli", hostEventId: "c"));

        Assert.Equal(2, log.CountForHost("claude-code"));
        Assert.Equal(1, log.CountForHost("copilot-cli"));
        Assert.Equal(0, log.CountForHost("unknown"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageEventLogTests" 2>&1 | tail -10
```

Expected: compile failure — `UsageEventLog` does not exist yet.

- [ ] **Step 3: Create `UsageEventLog.cs`**

Create `src/TotalRecall.Infrastructure/Telemetry/UsageEventLog.cs`:

```csharp
// src/TotalRecall.Infrastructure/Telemetry/UsageEventLog.cs
//
// Writer/reader for the usage_events table. Mirrors the existing
// RetrievalEventLog pattern: thin wrapper around a borrowed (non-owning)
// SqliteConnection. Write path uses INSERT OR IGNORE against the
// UNIQUE (host, host_event_id) constraint so repeated indexer passes
// on overlapping transcript files are safe.

using System;
using TotalRecall.Infrastructure.Usage;
using MsSqliteConnection = Microsoft.Data.Sqlite.SqliteConnection;

namespace TotalRecall.Infrastructure.Telemetry;

public sealed class UsageEventLog
{
    private readonly MsSqliteConnection _conn;

    public UsageEventLog(MsSqliteConnection conn)
    {
        ArgumentNullException.ThrowIfNull(conn);
        _conn = conn;
    }

    /// <summary>
    /// INSERT OR IGNORE a new usage_events row. Returns 1 on success,
    /// 0 if the (host, host_event_id) pair already existed.
    /// </summary>
    public int InsertOrIgnore(UsageEvent evt)
    {
        ArgumentNullException.ThrowIfNull(evt);

        using var cmd = _conn.CreateCommand();
        cmd.CommandText = @"
INSERT OR IGNORE INTO usage_events
  (host, host_event_id, session_id, interaction_id, turn_index, ts,
   project_path, project_repo, project_branch, project_commit,
   model,
   input_tokens, cache_creation_5m, cache_creation_1h, cache_read, output_tokens,
   service_tier, server_tool_use_json, host_request_id)
VALUES
  ($host, $heid, $sid, $iid, $ti, $ts,
   $pp, $pr, $pb, $pc,
   $model,
   $it, $cc5, $cc1, $cr, $ot,
   $st, $stu, $hrid)";

        cmd.Parameters.AddWithValue("$host", evt.Host);
        cmd.Parameters.AddWithValue("$heid", evt.HostEventId);
        cmd.Parameters.AddWithValue("$sid", evt.SessionId);
        cmd.Parameters.AddWithValue("$iid", (object?)evt.InteractionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$ti", (object?)evt.TurnIndex ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$ts", evt.TimestampMs);
        cmd.Parameters.AddWithValue("$pp", (object?)evt.ProjectPath ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pr", (object?)evt.ProjectRepo ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pb", (object?)evt.ProjectBranch ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pc", (object?)evt.ProjectCommit ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$model", (object?)evt.Model ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$it", (object?)evt.InputTokens ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cc5", (object?)evt.CacheCreation5m ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cc1", (object?)evt.CacheCreation1h ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cr", (object?)evt.CacheRead ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$ot", (object?)evt.OutputTokens ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$st", (object?)evt.ServiceTier ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$stu", (object?)evt.ServerToolUseJson ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$hrid", (object?)evt.HostRequestId ?? DBNull.Value);

        return cmd.ExecuteNonQuery();
    }

    /// <summary>Count of rows for the given host (debug/verbose CLI output).</summary>
    public int CountForHost(string host)
    {
        ArgumentNullException.ThrowIfNull(host);
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_events WHERE host = $h";
        cmd.Parameters.AddWithValue("$h", host);
        return (int)(long)cmd.ExecuteScalar()!;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageEventLogTests" 2>&1 | tail -10
```

Expected: 4 tests, 4 passing.

- [ ] **Step 5: Run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: no regressions, total count increased by 4.

- [ ] **Step 6: Commit**

```bash
git add src/TotalRecall.Infrastructure/Telemetry/UsageEventLog.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/UsageEventLogTests.cs
git commit -m "feat(usage): UsageEventLog writer/reader for usage_events

Thin wrapper around a borrowed SqliteConnection, INSERT OR IGNORE
on (host, host_event_id) UNIQUE key for idempotent re-scans.
Mirrors existing RetrievalEventLog / CompactionLog pattern.
Part of Phase 1."
```

---

## Task 4: UsageWatermarkStore — per-host scan watermark

**Files:**
- Create: `src/TotalRecall.Infrastructure/Telemetry/UsageWatermarkStore.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/UsageWatermarkStoreTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/UsageWatermarkStoreTests.cs`:

```csharp
using Microsoft.Data.Sqlite;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class UsageWatermarkStoreTests
{
    private static SqliteConnection OpenMigrated()
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        return conn;
    }

    [Fact]
    public void GetLastIndexedTs_UnknownHost_ReturnsZero()
    {
        using var conn = OpenMigrated();
        var store = new UsageWatermarkStore(conn);

        Assert.Equal(0L, store.GetLastIndexedTs("claude-code"));
    }

    [Fact]
    public void SetLastIndexedTs_ThenGet_RoundTrips()
    {
        using var conn = OpenMigrated();
        var store = new UsageWatermarkStore(conn);

        store.SetLastIndexedTs("claude-code", 12345);

        Assert.Equal(12345L, store.GetLastIndexedTs("claude-code"));
    }

    [Fact]
    public void SetLastIndexedTs_Overwrites()
    {
        using var conn = OpenMigrated();
        var store = new UsageWatermarkStore(conn);

        store.SetLastIndexedTs("claude-code", 100);
        store.SetLastIndexedTs("claude-code", 500);

        Assert.Equal(500L, store.GetLastIndexedTs("claude-code"));
    }

    [Fact]
    public void SetLastRollupAt_SeparateFromLastIndexedTs()
    {
        using var conn = OpenMigrated();
        var store = new UsageWatermarkStore(conn);
        store.SetLastIndexedTs("claude-code", 100);

        store.SetLastRollupAt("claude-code", 999);

        Assert.Equal(100L, store.GetLastIndexedTs("claude-code"));
        Assert.Equal(999L, store.GetLastRollupAt("claude-code"));
    }

    [Fact]
    public void GetLastRollupAt_UnknownHost_ReturnsZero()
    {
        using var conn = OpenMigrated();
        var store = new UsageWatermarkStore(conn);

        Assert.Equal(0L, store.GetLastRollupAt("claude-code"));
    }
}
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageWatermarkStoreTests" 2>&1 | tail -10
```

Expected: compile failure (class doesn't exist).

- [ ] **Step 3: Create `UsageWatermarkStore.cs`**

Create `src/TotalRecall.Infrastructure/Telemetry/UsageWatermarkStore.cs`:

```csharp
// src/TotalRecall.Infrastructure/Telemetry/UsageWatermarkStore.cs
//
// Per-host scan watermark store backing usage_watermarks table.
// Used by UsageIndexer to skip already-scanned events on repeated
// session_start passes. Unknown hosts return 0 (scan from beginning,
// which the indexer then bounds via config-driven initial_backfill_days).

using System;
using MsSqliteConnection = Microsoft.Data.Sqlite.SqliteConnection;

namespace TotalRecall.Infrastructure.Telemetry;

public sealed class UsageWatermarkStore
{
    private readonly MsSqliteConnection _conn;

    public UsageWatermarkStore(MsSqliteConnection conn)
    {
        ArgumentNullException.ThrowIfNull(conn);
        _conn = conn;
    }

    public long GetLastIndexedTs(string host)
    {
        ArgumentNullException.ThrowIfNull(host);
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = "SELECT last_indexed_ts FROM usage_watermarks WHERE host = $h";
        cmd.Parameters.AddWithValue("$h", host);
        var v = cmd.ExecuteScalar();
        return v is long l ? l : 0L;
    }

    public void SetLastIndexedTs(string host, long tsMs)
    {
        ArgumentNullException.ThrowIfNull(host);
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = @"
INSERT INTO usage_watermarks (host, last_indexed_ts, last_scan_at, last_rollup_at)
VALUES ($h, $ts, $now, NULL)
ON CONFLICT(host) DO UPDATE SET
    last_indexed_ts = excluded.last_indexed_ts,
    last_scan_at    = excluded.last_scan_at";
        cmd.Parameters.AddWithValue("$h", host);
        cmd.Parameters.AddWithValue("$ts", tsMs);
        cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        cmd.ExecuteNonQuery();
    }

    public long GetLastRollupAt(string host)
    {
        ArgumentNullException.ThrowIfNull(host);
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = "SELECT last_rollup_at FROM usage_watermarks WHERE host = $h";
        cmd.Parameters.AddWithValue("$h", host);
        var v = cmd.ExecuteScalar();
        return v is long l ? l : 0L;
    }

    public void SetLastRollupAt(string host, long tsMs)
    {
        ArgumentNullException.ThrowIfNull(host);
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = @"
INSERT INTO usage_watermarks (host, last_indexed_ts, last_scan_at, last_rollup_at)
VALUES ($h, 0, $now, $ts)
ON CONFLICT(host) DO UPDATE SET
    last_rollup_at = excluded.last_rollup_at";
        cmd.Parameters.AddWithValue("$h", host);
        cmd.Parameters.AddWithValue("$ts", tsMs);
        cmd.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        cmd.ExecuteNonQuery();
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageWatermarkStoreTests" 2>&1 | tail -10
```

Expected: 5 tests, 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Infrastructure/Telemetry/UsageWatermarkStore.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/UsageWatermarkStoreTests.cs
git commit -m "feat(usage): UsageWatermarkStore for incremental scan state

Per-host (last_indexed_ts, last_rollup_at) watermark tracking.
Unknown hosts return 0 — the indexer then applies the
config-driven initial_backfill_days bound.
Part of Phase 1."
```

---

## Task 5: ClaudeCodeUsageImporter — parse transcripts into UsageEvent stream

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/ClaudeCodeUsageImporter.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/claude-code-sample.jsonl`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/ClaudeCodeUsageImporterTests.cs`

- [ ] **Step 1: Create the test fixture transcript**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/claude-code-sample.jsonl` with this exact content (each line is one JSON record; empty lines and the malformed line are intentional):

```
{"uuid":"rec-1","timestamp":"2026-04-09T10:00:00.000Z","sessionId":"sess-1","type":"user","message":{"role":"user","content":"hi"}}
{"uuid":"rec-2","timestamp":"2026-04-09T10:00:05.000Z","sessionId":"sess-1","type":"assistant","message":{"role":"assistant","model":"claude-opus-4.1","usage":{"input_tokens":100,"cache_creation_input_tokens":500,"cache_read_input_tokens":200,"output_tokens":50,"service_tier":"standard","cache_creation":{"ephemeral_5m_input_tokens":300,"ephemeral_1h_input_tokens":200},"server_tool_use":{"web_search_requests":1,"web_fetch_requests":0}}}}
not json at all
{"uuid":"rec-3","timestamp":"2026-04-09T10:00:10.000Z","sessionId":"sess-1","type":"assistant","message":{"role":"assistant","model":"claude-opus-4.1","usage":{"input_tokens":75,"output_tokens":20}}}
{"uuid":"rec-4","timestamp":"2026-04-09T10:00:15.000Z","sessionId":"sess-1","type":"assistant","message":{"role":"assistant","model":"claude-opus-4.1"}}
```

(Line 1: user message — no usage, skipped. Line 2: full usage including cache split. Line 3: malformed, skipped. Line 4: minimal usage (input+output only, no cache). Line 5: assistant message without usage field, skipped.)

Mark it as copy-to-output in `tests/TotalRecall.Infrastructure.Tests/TotalRecall.Infrastructure.Tests.csproj`. Add before the closing `</Project>`:

```xml
  <ItemGroup>
    <None Update="Usage/Fixtures/claude-code-sample.jsonl">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
  </ItemGroup>
```

- [ ] **Step 2: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/ClaudeCodeUsageImporterTests.cs`:

```csharp
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class ClaudeCodeUsageImporterTests : System.IDisposable
{
    private readonly string _projectsDir;

    public ClaudeCodeUsageImporterTests()
    {
        _projectsDir = Path.Combine(Path.GetTempPath(), "tr-cc-usage-" + System.Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_projectsDir);
    }

    public void Dispose()
    {
        try { if (Directory.Exists(_projectsDir)) Directory.Delete(_projectsDir, recursive: true); } catch { }
    }

    private string CopyFixtureAsSession(string sessionId, string projectEncodedCwd)
    {
        var projectDir = Path.Combine(_projectsDir, projectEncodedCwd);
        Directory.CreateDirectory(projectDir);
        var fixture = Path.Combine(System.AppContext.BaseDirectory, "Usage", "Fixtures", "claude-code-sample.jsonl");
        var dest = Path.Combine(projectDir, sessionId + ".jsonl");
        File.Copy(fixture, dest, overwrite: true);
        return dest;
    }

    private static async Task<List<UsageEvent>> Drain(ClaudeCodeUsageImporter imp, long sinceMs)
    {
        var list = new List<UsageEvent>();
        await foreach (var e in imp.ScanAsync(sinceMs, CancellationToken.None))
            list.Add(e);
        return list;
    }

    [Fact]
    public void Detect_NoProjectsDir_ReturnsFalse()
    {
        var imp = new ClaudeCodeUsageImporter(projectsDir: "/nonexistent/path");
        Assert.False(imp.Detect());
    }

    [Fact]
    public void Detect_ExistingDir_ReturnsTrue()
    {
        var imp = new ClaudeCodeUsageImporter(_projectsDir);
        Assert.True(imp.Detect());
    }

    [Fact]
    public async Task ScanAsync_FixtureTranscript_YieldsTwoEvents()
    {
        CopyFixtureAsSession("abc-session", "-Users-test-project");
        var imp = new ClaudeCodeUsageImporter(_projectsDir);

        var events = await Drain(imp, sinceMs: 0);

        // Only rec-2 and rec-3 have message.usage; rec-1 is user, malformed line is skipped, rec-4 has no usage.
        Assert.Equal(2, events.Count);
    }

    [Fact]
    public async Task ScanAsync_FullUsageRecord_PopulatesAllFields()
    {
        CopyFixtureAsSession("abc-session", "-Users-test-project");
        var imp = new ClaudeCodeUsageImporter(_projectsDir);

        var events = await Drain(imp, sinceMs: 0);
        var rec2 = events.First(e => e.HostEventId == "rec-2");

        Assert.Equal("claude-code", rec2.Host);
        Assert.Equal("abc-session", rec2.SessionId);
        Assert.Equal("claude-opus-4.1", rec2.Model);
        Assert.Equal(100, rec2.InputTokens);
        Assert.Equal(300, rec2.CacheCreation5m);
        Assert.Equal(200, rec2.CacheCreation1h);
        Assert.Equal(200, rec2.CacheRead);
        Assert.Equal(50, rec2.OutputTokens);
        Assert.Equal("standard", rec2.ServiceTier);
        Assert.NotNull(rec2.ServerToolUseJson);
        Assert.Contains("web_search", rec2.ServerToolUseJson!);
        Assert.Null(rec2.ProjectRepo);   // Claude Code never populates this
    }

    [Fact]
    public async Task ScanAsync_MinimalUsageRecord_LeavesCacheFieldsNull()
    {
        CopyFixtureAsSession("abc-session", "-Users-test-project");
        var imp = new ClaudeCodeUsageImporter(_projectsDir);

        var events = await Drain(imp, sinceMs: 0);
        var rec3 = events.First(e => e.HostEventId == "rec-3");

        Assert.Equal(75, rec3.InputTokens);
        Assert.Equal(20, rec3.OutputTokens);
        Assert.Null(rec3.CacheCreation5m);
        Assert.Null(rec3.CacheCreation1h);
        Assert.Null(rec3.CacheRead);
    }

    [Fact]
    public async Task ScanAsync_Watermark_SkipsOlderEvents()
    {
        CopyFixtureAsSession("abc-session", "-Users-test-project");
        var imp = new ClaudeCodeUsageImporter(_projectsDir);

        // rec-2 at 10:00:05, rec-3 at 10:00:10. Watermark at 10:00:07
        // excludes rec-2 and keeps rec-3.
        var cutoff = new System.DateTimeOffset(2026, 4, 9, 10, 0, 7, System.TimeSpan.Zero).ToUnixTimeMilliseconds();
        var events = await Drain(imp, sinceMs: cutoff);

        Assert.Single(events);
        Assert.Equal("rec-3", events[0].HostEventId);
    }

    [Fact]
    public async Task ScanAsync_EmptyDir_YieldsNothing()
    {
        var imp = new ClaudeCodeUsageImporter(_projectsDir);
        var events = await Drain(imp, sinceMs: 0);
        Assert.Empty(events);
    }

    [Fact]
    public async Task ScanAsync_ProjectPath_DerivedFromEncodedDirName()
    {
        CopyFixtureAsSession("s1", "-Users-strvmarv-source-total--recall");
        var imp = new ClaudeCodeUsageImporter(_projectsDir);

        var events = await Drain(imp, sinceMs: 0);

        Assert.NotEmpty(events);
        // Decoded: "-Users-..." → "/Users/strvmarv/source/total-recall"
        // (single hyphens become slashes; double hyphens decode to a single hyphen)
        Assert.Equal("/Users/strvmarv/source/total-recall", events[0].ProjectPath);
    }
}
```

- [ ] **Step 3: Run to verify fail (compile)**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~ClaudeCodeUsageImporterTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 4: Create `ClaudeCodeUsageImporter.cs`**

Create `src/TotalRecall.Infrastructure/Usage/ClaudeCodeUsageImporter.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/ClaudeCodeUsageImporter.cs
//
// Parses Claude Code transcript files (~/.claude/projects/<encoded-cwd>/
// <session-uuid>.jsonl) into host-neutral UsageEvent records. Only
// records with a message.usage object are emitted — those are the
// "assistant turns" that count for token accounting. Malformed JSON
// lines are skipped silently to match Claude Code's own resilience
// policy (partial writes during a crash).
//
// Fidelity: Claude Code provides the full Anthropic usage object so
// every token field on UsageEvent is populated. ProjectRepo/Branch/Commit
// are left null — Claude Code only gives us the cwd via the encoded
// directory name.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace TotalRecall.Infrastructure.Usage;

public sealed class ClaudeCodeUsageImporter : IUsageImporter
{
    private readonly string _projectsDir;

    public ClaudeCodeUsageImporter(string? projectsDir = null)
    {
        _projectsDir = projectsDir ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".claude", "projects");
    }

    public string HostName => "claude-code";

    public bool Detect() => Directory.Exists(_projectsDir);

    public async IAsyncEnumerable<UsageEvent> ScanAsync(
        long sinceMs,
        [EnumeratorCancellation] CancellationToken ct)
    {
        if (!Detect()) yield break;

        foreach (var projectDir in Directory.EnumerateDirectories(_projectsDir))
        {
            ct.ThrowIfCancellationRequested();
            var cwd = DecodeProjectDirName(Path.GetFileName(projectDir));

            foreach (var jsonlPath in Directory.EnumerateFiles(projectDir, "*.jsonl"))
            {
                // Skip files whose mtime is strictly older than the watermark.
                // This saves opening files that can't possibly have new events.
                var mtimeMs = new DateTimeOffset(
                    File.GetLastWriteTimeUtc(jsonlPath), TimeSpan.Zero).ToUnixTimeMilliseconds();
                if (mtimeMs < sinceMs) continue;

                await foreach (var evt in ParseTranscriptAsync(jsonlPath, cwd, sinceMs, ct))
                    yield return evt;
            }
        }
    }

    private static async IAsyncEnumerable<UsageEvent> ParseTranscriptAsync(
        string jsonlPath,
        string cwd,
        long sinceMs,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var sessionId = Path.GetFileNameWithoutExtension(jsonlPath);
        int turnIndex = 0;

        await using var stream = File.OpenRead(jsonlPath);
        using var reader = new StreamReader(stream);

        string? line;
        while ((line = await reader.ReadLineAsync(ct).ConfigureAwait(false)) is not null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            JsonDocument? doc = null;
            try { doc = JsonDocument.Parse(line); }
            catch (JsonException) { continue; }

            using (doc)
            {
                var root = doc.RootElement;
                if (!root.TryGetProperty("message", out var msg)) continue;
                if (msg.ValueKind != JsonValueKind.Object) continue;
                if (!msg.TryGetProperty("usage", out var usage)) continue;
                if (usage.ValueKind != JsonValueKind.Object) continue;

                var tsMs = ParseTimestampMs(root);
                if (tsMs <= sinceMs) continue;

                var hostEventId = root.TryGetProperty("uuid", out var u) && u.ValueKind == JsonValueKind.String
                    ? u.GetString() ?? Guid.NewGuid().ToString()
                    : Guid.NewGuid().ToString();

                yield return new UsageEvent(
                    Host: "claude-code",
                    HostEventId: hostEventId,
                    SessionId: sessionId,
                    TimestampMs: tsMs,
                    TurnIndex: turnIndex++,
                    Model: GetStringOrNull(msg, "model"),
                    ProjectPath: cwd,
                    ProjectRepo: null,
                    ProjectBranch: null,
                    ProjectCommit: null,
                    InteractionId: null,
                    InputTokens: GetIntOrNull(usage, "input_tokens"),
                    CacheCreation5m: GetCacheCreation(usage, "ephemeral_5m_input_tokens"),
                    CacheCreation1h: GetCacheCreation(usage, "ephemeral_1h_input_tokens"),
                    CacheRead: GetIntOrNull(usage, "cache_read_input_tokens"),
                    OutputTokens: GetIntOrNull(usage, "output_tokens"),
                    ServiceTier: GetStringOrNull(usage, "service_tier"),
                    ServerToolUseJson: GetRawJsonOrNull(usage, "server_tool_use"),
                    HostRequestId: null);
            }
        }
    }

    // --- helpers ---------------------------------------------------------

    /// <summary>
    /// Claude Code encodes cwd paths into directory names by replacing
    /// forward-slashes with hyphens. A double-hyphen ("--") is the escape
    /// for a literal hyphen in the original path. Reverses that.
    /// </summary>
    internal static string DecodeProjectDirName(string encoded)
    {
        if (string.IsNullOrEmpty(encoded)) return encoded;

        // Walk the string replacing `--` with `\x01` (temporary sentinel),
        // then single `-` with `/`, then sentinel back to `-`.
        const char SENTINEL = '\x01';
        var step1 = encoded.Replace("--", SENTINEL.ToString());
        var step2 = step1.Replace('-', '/');
        var step3 = step2.Replace(SENTINEL, '-');
        return step3;
    }

    private static long ParseTimestampMs(JsonElement root)
    {
        if (root.TryGetProperty("timestamp", out var t) && t.ValueKind == JsonValueKind.String)
        {
            var s = t.GetString();
            if (!string.IsNullOrEmpty(s)
                && DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind | DateTimeStyles.AssumeUniversal, out var dto))
            {
                return dto.ToUnixTimeMilliseconds();
            }
        }
        return 0;
    }

    private static int? GetIntOrNull(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetInt32(out var i) => i,
            _ => null,
        };
    }

    private static string? GetStringOrNull(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var v)) return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    }

    /// <summary>
    /// cache_creation lives in a nested object: usage.cache_creation.{ephemeral_5m,ephemeral_1h}_input_tokens.
    /// Returns null if the nested object is absent or the specific field is missing.
    /// </summary>
    private static int? GetCacheCreation(JsonElement usage, string fieldName)
    {
        if (!usage.TryGetProperty("cache_creation", out var cc)) return null;
        if (cc.ValueKind != JsonValueKind.Object) return null;
        return GetIntOrNull(cc, fieldName);
    }

    private static string? GetRawJsonOrNull(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null || v.ValueKind == JsonValueKind.Undefined) return null;
        return v.GetRawText();
    }
}
```

- [ ] **Step 5: Run to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~ClaudeCodeUsageImporterTests" 2>&1 | tail -15
```

Expected: 8 tests, 8 passing.

- [ ] **Step 6: Run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/ClaudeCodeUsageImporter.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/ClaudeCodeUsageImporterTests.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/claude-code-sample.jsonl \
        tests/TotalRecall.Infrastructure.Tests/TotalRecall.Infrastructure.Tests.csproj
git commit -m "feat(usage): ClaudeCodeUsageImporter parses ~/.claude/projects transcripts

Pure streaming parser, no SQL. Only emits records with message.usage
(assistant turns); skips user messages, malformed lines, and tool-only
records. Populates all Anthropic usage fields including cache-creation
5m/1h split. Verified against a fixture with full usage / minimal usage
/ no-usage / malformed line variants.

Part of Phase 1."
```

---

## Task 6: UsageIndexer — orchestrator that drives importers + writes events + advances watermarks

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/UsageIndexerTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/UsageIndexerTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class UsageIndexerTests
{
    private sealed class FakeImporter : IUsageImporter
    {
        public bool DetectResult { get; set; } = true;
        public List<UsageEvent> Events { get; } = new();
        public bool ThrowOnScan { get; set; }
        public long LastSinceMs { get; private set; }

        public string HostName { get; }
        public FakeImporter(string host) { HostName = host; }

        public bool Detect() => DetectResult;

        public async IAsyncEnumerable<UsageEvent> ScanAsync(
            long sinceMs,
            [EnumeratorCancellation] CancellationToken ct)
        {
            LastSinceMs = sinceMs;
            if (ThrowOnScan) throw new InvalidOperationException("simulated scan failure");
            foreach (var e in Events)
            {
                if (e.TimestampMs > sinceMs)
                    yield return e;
            }
            await Task.CompletedTask;
        }
    }

    private static Microsoft.Data.Sqlite.SqliteConnection OpenMigrated()
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        return conn;
    }

    private static UsageEvent E(string host, string eid, long ts) =>
        new UsageEvent(
            Host: host, HostEventId: eid, SessionId: "s", TimestampMs: ts,
            TurnIndex: 0, Model: null, ProjectPath: null, ProjectRepo: null,
            ProjectBranch: null, ProjectCommit: null, InteractionId: null,
            InputTokens: 10, CacheCreation5m: null, CacheCreation1h: null,
            CacheRead: null, OutputTokens: 5, ServiceTier: null,
            ServerToolUseJson: null, HostRequestId: null);

    [Fact]
    public async Task RunAsync_SingleHost_WritesEventsAndAdvancesWatermark()
    {
        using var conn = OpenMigrated();
        var eventLog = new UsageEventLog(conn);
        var watermarks = new UsageWatermarkStore(conn);
        var fake = new FakeImporter("claude-code");
        fake.Events.Add(E("claude-code", "a", 100));
        fake.Events.Add(E("claude-code", "b", 200));

        var stderr = new StringWriter();
        var indexer = new UsageIndexer(new[] { fake }, eventLog, watermarks, stderr);

        await indexer.RunAsync(CancellationToken.None);

        Assert.Equal(2, eventLog.CountForHost("claude-code"));
        Assert.Equal(200L, watermarks.GetLastIndexedTs("claude-code"));
    }

    [Fact]
    public async Task RunAsync_UndetectedHost_IsSkipped()
    {
        using var conn = OpenMigrated();
        var eventLog = new UsageEventLog(conn);
        var watermarks = new UsageWatermarkStore(conn);
        var fake = new FakeImporter("claude-code") { DetectResult = false };
        fake.Events.Add(E("claude-code", "a", 100));

        var indexer = new UsageIndexer(new[] { fake }, eventLog, watermarks, new StringWriter());

        await indexer.RunAsync(CancellationToken.None);

        Assert.Equal(0, eventLog.CountForHost("claude-code"));
    }

    [Fact]
    public async Task RunAsync_PerHostFailure_DoesNotBlockOtherHosts()
    {
        using var conn = OpenMigrated();
        var eventLog = new UsageEventLog(conn);
        var watermarks = new UsageWatermarkStore(conn);

        var failing = new FakeImporter("claude-code") { ThrowOnScan = true };
        var working = new FakeImporter("copilot-cli");
        working.Events.Add(E("copilot-cli", "w1", 100));

        var stderr = new StringWriter();
        var indexer = new UsageIndexer(new[] { (IUsageImporter)failing, working }, eventLog, watermarks, stderr);

        await indexer.RunAsync(CancellationToken.None);

        Assert.Equal(0, eventLog.CountForHost("claude-code"));
        Assert.Equal(1, eventLog.CountForHost("copilot-cli"));
        Assert.Equal(0L, watermarks.GetLastIndexedTs("claude-code")); // failed host NOT advanced
        Assert.Equal(100L, watermarks.GetLastIndexedTs("copilot-cli"));
        Assert.Contains("claude-code scan failed", stderr.ToString());
    }

    [Fact]
    public async Task RunAsync_SecondRun_RespectsWatermark()
    {
        using var conn = OpenMigrated();
        var eventLog = new UsageEventLog(conn);
        var watermarks = new UsageWatermarkStore(conn);
        var fake = new FakeImporter("claude-code");
        fake.Events.Add(E("claude-code", "a", 100));

        var indexer = new UsageIndexer(new[] { fake }, eventLog, watermarks, new StringWriter());

        await indexer.RunAsync(CancellationToken.None);
        // Second run: fake should be called with sinceMs = 100 (prior max)
        fake.Events.Add(E("claude-code", "b", 200));
        await indexer.RunAsync(CancellationToken.None);

        Assert.Equal(100L, fake.LastSinceMs); // last ScanAsync saw the prior watermark
        Assert.Equal(2, eventLog.CountForHost("claude-code"));
        Assert.Equal(200L, watermarks.GetLastIndexedTs("claude-code"));
    }

    [Fact]
    public async Task RunAsync_NoEvents_WatermarkStays()
    {
        using var conn = OpenMigrated();
        var eventLog = new UsageEventLog(conn);
        var watermarks = new UsageWatermarkStore(conn);
        watermarks.SetLastIndexedTs("claude-code", 500);
        var fake = new FakeImporter("claude-code");

        var indexer = new UsageIndexer(new[] { fake }, eventLog, watermarks, new StringWriter());
        await indexer.RunAsync(CancellationToken.None);

        Assert.Equal(500L, watermarks.GetLastIndexedTs("claude-code"));
    }
}
```

- [ ] **Step 2: Run to verify fail (compile)**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageIndexerTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 3: Create `UsageIndexer.cs`**

Create `src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs
//
// Orchestrator: iterates registered IUsageImporter adapters, streams
// their events into UsageEventLog, and advances per-host watermarks
// on success. Invoked once per session_start.
//
// Failure isolation: per-host exceptions are caught, logged via the
// existing ExceptionLogger pattern, and DO NOT advance the watermark
// for that host — the next session_start retries cleanly. Other hosts
// continue scanning. This matches SessionLifecycle's existing "don't
// block session init on a single importer failure" policy.

using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Diagnostics;
using TotalRecall.Infrastructure.Telemetry;

namespace TotalRecall.Infrastructure.Usage;

public sealed class UsageIndexer
{
    private readonly IReadOnlyList<IUsageImporter> _importers;
    private readonly UsageEventLog _eventLog;
    private readonly UsageWatermarkStore _watermarks;
    private readonly TextWriter _stderr;

    public UsageIndexer(
        IReadOnlyList<IUsageImporter> importers,
        UsageEventLog eventLog,
        UsageWatermarkStore watermarks,
        TextWriter? stderr = null)
    {
        ArgumentNullException.ThrowIfNull(importers);
        ArgumentNullException.ThrowIfNull(eventLog);
        ArgumentNullException.ThrowIfNull(watermarks);
        _importers = importers;
        _eventLog = eventLog;
        _watermarks = watermarks;
        _stderr = stderr ?? Console.Error;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        foreach (var importer in _importers)
        {
            if (!importer.Detect()) continue;

            var since = _watermarks.GetLastIndexedTs(importer.HostName);
            var newMax = since;
            var inserted = 0;

            try
            {
                await foreach (var evt in importer.ScanAsync(since, ct).ConfigureAwait(false))
                {
                    _eventLog.InsertOrIgnore(evt);
                    if (evt.TimestampMs > newMax) newMax = evt.TimestampMs;
                    inserted++;
                }
            }
            catch (Exception ex)
            {
                ExceptionLogger.LogChain(
                    _stderr,
                    $"total-recall: usage indexer: {importer.HostName} scan failed",
                    ex);
                continue; // other hosts still run; watermark for this host stays put
            }

            if (newMax > since)
            {
                _watermarks.SetLastIndexedTs(importer.HostName, newMax);
            }

            if (inserted > 0)
            {
                _stderr.WriteLine(
                    $"total-recall: usage indexer: scanned {inserted} new events from {importer.HostName}");
            }
        }
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageIndexerTests" 2>&1 | tail -10
```

Expected: 5 tests, 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/UsageIndexerTests.cs
git commit -m "feat(usage): UsageIndexer orchestrator with per-host failure isolation

Iterates registered IUsageImporters, streams events to UsageEventLog,
advances watermarks on success. Failing hosts are logged via
ExceptionLogger.LogChain and skipped without blocking other hosts
or advancing their watermark. Matches existing SessionLifecycle
resilience policy.
Part of Phase 1."
```

---

## Task 7: UsageQueryService — read layer with group-by dimensions

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/UsageQuery.cs` — query + report record types
- Create: `src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/UsageQueryServiceTests.cs`

**Scope note:** Phase 1 implements query against `usage_events` ONLY (no daily rollup yet — that's Phase 2). The CTE structure in spec §6.2 will be extended in Phase 2. For Phase 1, keep the implementation single-table and leave a TODO marker for the union.

- [ ] **Step 1: Create `UsageQuery.cs` with the record types**

Create `src/TotalRecall.Infrastructure/Usage/UsageQuery.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/UsageQuery.cs
//
// Query + report record types for UsageQueryService. Keeps UsageQueryService.cs
// free of type noise. See spec §6.1 for field semantics.

using System;
using System.Collections.Generic;

namespace TotalRecall.Infrastructure.Usage;

public enum GroupBy { None, Host, Project, Day, Model, Session }

public sealed record UsageQuery(
    DateTimeOffset Start,
    DateTimeOffset End,
    IReadOnlyList<string>? HostFilter,      // null = all hosts
    IReadOnlyList<string>? ProjectFilter,   // null = all projects
    GroupBy GroupBy,
    int TopN);                              // 0 = no limit

public sealed record UsageTotals(
    int SessionCount,
    long TurnCount,
    long? InputTokens,                       // null if nothing in bucket had it
    long? CacheCreationTokens,
    long? CacheReadTokens,
    long? OutputTokens);

public sealed record UsageBucket(string Key, UsageTotals Totals);

public sealed record UsageReport(
    DateTimeOffset Start,
    DateTimeOffset End,
    IReadOnlyList<UsageBucket> Buckets,
    UsageTotals GrandTotal,
    int SessionsWithFullTokenData,           // at least input_tokens present
    int SessionsWithPartialTokenData);       // output_tokens present but not input
```

- [ ] **Step 2: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/UsageQueryServiceTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class UsageQueryServiceTests
{
    private static Microsoft.Data.Sqlite.SqliteConnection OpenSeeded(Action<UsageEventLog> seed)
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        var log = new UsageEventLog(conn);
        seed(log);
        return conn;
    }

    private static UsageEvent E(string host, string eid, string session, long ts,
        int? input, int? output, string? model = null, string? project = null) =>
        new UsageEvent(
            Host: host, HostEventId: eid, SessionId: session, TimestampMs: ts,
            TurnIndex: 0, Model: model, ProjectPath: project, ProjectRepo: null,
            ProjectBranch: null, ProjectCommit: null, InteractionId: null,
            InputTokens: input, CacheCreation5m: null, CacheCreation1h: null,
            CacheRead: null, OutputTokens: output, ServiceTier: null,
            ServerToolUseJson: null, HostRequestId: null);

    private static UsageQuery Last(GroupBy group, TimeSpan window) =>
        new UsageQuery(
            Start: DateTimeOffset.UtcNow - window,
            End: DateTimeOffset.UtcNow,
            HostFilter: null,
            ProjectFilter: null,
            GroupBy: group,
            TopN: 0);

    [Fact]
    public void Query_GroupByHost_SumsPerHost()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = OpenSeeded(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a1", "s1", nowMs - 1000, input: 100, output: 20));
            log.InsertOrIgnore(E("claude-code", "a2", "s1", nowMs - 2000, input: 50, output: 10));
            log.InsertOrIgnore(E("copilot-cli", "b1", "s2", nowMs - 1000, input: null, output: 15));
        });

        var svc = new UsageQueryService(conn);
        var report = svc.Query(Last(GroupBy.Host, TimeSpan.FromHours(1)));

        Assert.Equal(2, report.Buckets.Count);
        var cc = report.Buckets.First(b => b.Key == "claude-code");
        Assert.Equal(150L, cc.Totals.InputTokens);
        Assert.Equal(30L, cc.Totals.OutputTokens);
        var co = report.Buckets.First(b => b.Key == "copilot-cli");
        Assert.Null(co.Totals.InputTokens); // nothing in bucket had input_tokens
        Assert.Equal(15L, co.Totals.OutputTokens);
    }

    [Fact]
    public void Query_GroupByHost_GrandTotalIsUnionOfNonNulls()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = OpenSeeded(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a1", "s1", nowMs - 1000, input: 100, output: 20));
            log.InsertOrIgnore(E("copilot-cli", "b1", "s2", nowMs - 1000, input: null, output: 15));
        });

        var svc = new UsageQueryService(conn);
        var report = svc.Query(Last(GroupBy.Host, TimeSpan.FromHours(1)));

        Assert.Equal(100L, report.GrandTotal.InputTokens); // only Claude Code had input
        Assert.Equal(35L, report.GrandTotal.OutputTokens);
        Assert.Equal(2, report.GrandTotal.SessionCount);
    }

    [Fact]
    public void Query_Coverage_SplitsFullAndPartial()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = OpenSeeded(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a1", "sess-full", nowMs - 500, input: 100, output: 20));
            log.InsertOrIgnore(E("copilot-cli", "b1", "sess-part1", nowMs - 500, input: null, output: 10));
            log.InsertOrIgnore(E("copilot-cli", "b2", "sess-part2", nowMs - 500, input: null, output: 10));
        });

        var svc = new UsageQueryService(conn);
        var report = svc.Query(Last(GroupBy.Host, TimeSpan.FromHours(1)));

        Assert.Equal(1, report.SessionsWithFullTokenData);      // sess-full
        Assert.Equal(2, report.SessionsWithPartialTokenData);   // sess-part1, sess-part2
    }

    [Fact]
    public void Query_GroupByProject_UsesCoalesceOfRepoAndPath()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = OpenSeeded(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a1", "s1", nowMs - 500, input: 100, output: 20, project: "/work/foo"));
            log.InsertOrIgnore(E("claude-code", "a2", "s2", nowMs - 500, input: 50, output: 10, project: "/work/bar"));
        });

        var svc = new UsageQueryService(conn);
        var report = svc.Query(Last(GroupBy.Project, TimeSpan.FromHours(1)));

        Assert.Equal(2, report.Buckets.Count);
    }

    [Fact]
    public void Query_HostFilter_LimitsToNamedHost()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = OpenSeeded(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a1", "s1", nowMs - 500, input: 100, output: 20));
            log.InsertOrIgnore(E("copilot-cli", "b1", "s2", nowMs - 500, input: null, output: 10));
        });

        var svc = new UsageQueryService(conn);
        var report = svc.Query(new UsageQuery(
            Start: DateTimeOffset.UtcNow - TimeSpan.FromHours(1),
            End: DateTimeOffset.UtcNow,
            HostFilter: new[] { "claude-code" },
            ProjectFilter: null,
            GroupBy: GroupBy.Host,
            TopN: 0));

        Assert.Single(report.Buckets);
        Assert.Equal("claude-code", report.Buckets[0].Key);
    }

    [Fact]
    public void Query_WindowBeforeAnyEvents_ReturnsEmpty()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = OpenSeeded(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a1", "s1", nowMs - 1000, input: 100, output: 20));
        });

        var svc = new UsageQueryService(conn);
        var report = svc.Query(new UsageQuery(
            Start: DateTimeOffset.UtcNow.AddDays(-100),
            End: DateTimeOffset.UtcNow.AddDays(-99),
            HostFilter: null, ProjectFilter: null,
            GroupBy: GroupBy.Host, TopN: 0));

        Assert.Empty(report.Buckets);
        Assert.Equal(0, report.GrandTotal.SessionCount);
    }
}
```

- [ ] **Step 3: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageQueryServiceTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 4: Create `UsageQueryService.cs`**

Create `src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs
//
// Single read path for UsageCommand, usage_status MCP tool, and
// QuotaNudgeComposer. Phase 1 queries usage_events only; Phase 2
// extends the CTE to UNION ALL with usage_daily via a dynamic
// rollup_cutoff read from usage_watermarks. See spec §6.2.
//
// Null handling: SUM() ignores nulls by default in SQLite, so a
// bucket containing a mix of Claude Code (full token data) and
// Copilot CLI (output_tokens only) events produces InputTokens =
// "only the Claude Code sum". UsageReport exposes coverage counts
// separately so callers can caveat "X tokens across Y of Z sessions".

using System;
using System.Collections.Generic;
using System.Data;
using System.Text;
using MsSqliteConnection = Microsoft.Data.Sqlite.SqliteConnection;

namespace TotalRecall.Infrastructure.Usage;

public sealed class UsageQueryService
{
    private readonly MsSqliteConnection _conn;

    public UsageQueryService(MsSqliteConnection conn)
    {
        ArgumentNullException.ThrowIfNull(conn);
        _conn = conn;
    }

    public UsageReport Query(UsageQuery query)
    {
        ArgumentNullException.ThrowIfNull(query);

        var startMs = query.Start.ToUnixTimeMilliseconds();
        var endMs = query.End.ToUnixTimeMilliseconds();

        var keyExpr = query.GroupBy switch
        {
            GroupBy.None    => "'_total_'",
            GroupBy.Host    => "host",
            GroupBy.Project => "COALESCE(project_repo, project_path, '(none)')",
            GroupBy.Day     => "strftime('%Y-%m-%d', ts/1000, 'unixepoch')",
            GroupBy.Model   => "COALESCE(model, '(unknown)')",
            GroupBy.Session => "session_id",
            _ => "host",
        };

        var sql = new StringBuilder();
        sql.Append($@"
SELECT
    {keyExpr} AS bucket_key,
    COUNT(DISTINCT session_id) AS session_count,
    COUNT(*)                   AS turn_count,
    SUM(input_tokens)          AS input_tokens,
    SUM(COALESCE(cache_creation_5m,0) + COALESCE(cache_creation_1h,0)) AS cache_creation_tokens,
    SUM(cache_read)            AS cache_read_tokens,
    SUM(output_tokens)         AS output_tokens
FROM usage_events
WHERE ts BETWEEN $start AND $end");

        if (query.HostFilter is { Count: > 0 })
        {
            sql.Append(" AND host IN (");
            for (var i = 0; i < query.HostFilter.Count; i++)
            {
                if (i > 0) sql.Append(", ");
                sql.Append($"$h{i}");
            }
            sql.Append(")");
        }

        if (query.ProjectFilter is { Count: > 0 })
        {
            sql.Append(" AND COALESCE(project_repo, project_path) IN (");
            for (var i = 0; i < query.ProjectFilter.Count; i++)
            {
                if (i > 0) sql.Append(", ");
                sql.Append($"$p{i}");
            }
            sql.Append(")");
        }

        sql.Append($" GROUP BY {keyExpr}");
        sql.Append(" ORDER BY output_tokens DESC NULLS LAST");
        if (query.TopN > 0) sql.Append($" LIMIT {query.TopN}");

        var buckets = new List<UsageBucket>();
        using (var cmd = _conn.CreateCommand())
        {
            cmd.CommandText = sql.ToString();
            cmd.Parameters.AddWithValue("$start", startMs);
            cmd.Parameters.AddWithValue("$end", endMs);
            if (query.HostFilter is { } hf)
            {
                for (var i = 0; i < hf.Count; i++)
                    cmd.Parameters.AddWithValue($"$h{i}", hf[i]);
            }
            if (query.ProjectFilter is { } pf)
            {
                for (var i = 0; i < pf.Count; i++)
                    cmd.Parameters.AddWithValue($"$p{i}", pf[i]);
            }
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                var totals = new UsageTotals(
                    SessionCount: r.GetInt32(1),
                    TurnCount: r.GetInt64(2),
                    InputTokens: r.IsDBNull(3) ? null : r.GetInt64(3),
                    CacheCreationTokens: r.IsDBNull(4) ? null : r.GetInt64(4),
                    CacheReadTokens: r.IsDBNull(5) ? null : r.GetInt64(5),
                    OutputTokens: r.IsDBNull(6) ? null : r.GetInt64(6));
                buckets.Add(new UsageBucket(
                    Key: r.IsDBNull(0) ? "(null)" : r.GetString(0),
                    Totals: totals));
            }
        }

        var grand = QueryGrandTotal(startMs, endMs, query);
        var (full, partial) = QueryCoverage(startMs, endMs, query);

        return new UsageReport(
            Start: query.Start,
            End: query.End,
            Buckets: buckets,
            GrandTotal: grand,
            SessionsWithFullTokenData: full,
            SessionsWithPartialTokenData: partial);
    }

    private UsageTotals QueryGrandTotal(long startMs, long endMs, UsageQuery query)
    {
        var sql = new StringBuilder();
        sql.Append(@"
SELECT
    COUNT(DISTINCT session_id),
    COUNT(*),
    SUM(input_tokens),
    SUM(COALESCE(cache_creation_5m,0) + COALESCE(cache_creation_1h,0)),
    SUM(cache_read),
    SUM(output_tokens)
FROM usage_events
WHERE ts BETWEEN $start AND $end");
        AppendFilters(sql, query);

        using var cmd = _conn.CreateCommand();
        cmd.CommandText = sql.ToString();
        cmd.Parameters.AddWithValue("$start", startMs);
        cmd.Parameters.AddWithValue("$end", endMs);
        BindFilters(cmd, query);
        using var r = cmd.ExecuteReader();
        if (!r.Read())
            return new UsageTotals(0, 0, null, null, null, null);
        return new UsageTotals(
            SessionCount: r.GetInt32(0),
            TurnCount: r.GetInt64(1),
            InputTokens: r.IsDBNull(2) ? null : r.GetInt64(2),
            CacheCreationTokens: r.IsDBNull(3) ? null : r.GetInt64(3),
            CacheReadTokens: r.IsDBNull(4) ? null : r.GetInt64(4),
            OutputTokens: r.IsDBNull(5) ? null : r.GetInt64(5));
    }

    private (int full, int partial) QueryCoverage(long startMs, long endMs, UsageQuery query)
    {
        // A "full" session has at least one event with input_tokens NOT NULL.
        // A "partial" session has NO events with input_tokens but at least one with output_tokens.
        var sql = new StringBuilder();
        sql.Append(@"
WITH per_session AS (
    SELECT
        session_id,
        MAX(CASE WHEN input_tokens IS NOT NULL THEN 1 ELSE 0 END) AS has_full,
        MAX(CASE WHEN output_tokens IS NOT NULL THEN 1 ELSE 0 END) AS has_any
    FROM usage_events
    WHERE ts BETWEEN $start AND $end");
        AppendFilters(sql, query);
        sql.Append(@"
    GROUP BY session_id
)
SELECT
    SUM(has_full),
    SUM(CASE WHEN has_full = 0 AND has_any = 1 THEN 1 ELSE 0 END)
FROM per_session");

        using var cmd = _conn.CreateCommand();
        cmd.CommandText = sql.ToString();
        cmd.Parameters.AddWithValue("$start", startMs);
        cmd.Parameters.AddWithValue("$end", endMs);
        BindFilters(cmd, query);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return (0, 0);
        var full = r.IsDBNull(0) ? 0 : (int)r.GetInt64(0);
        var partial = r.IsDBNull(1) ? 0 : (int)r.GetInt64(1);
        return (full, partial);
    }

    private static void AppendFilters(StringBuilder sql, UsageQuery query)
    {
        if (query.HostFilter is { Count: > 0 } hf)
        {
            sql.Append(" AND host IN (");
            for (var i = 0; i < hf.Count; i++)
            {
                if (i > 0) sql.Append(", ");
                sql.Append($"$h{i}");
            }
            sql.Append(")");
        }
        if (query.ProjectFilter is { Count: > 0 } pf)
        {
            sql.Append(" AND COALESCE(project_repo, project_path) IN (");
            for (var i = 0; i < pf.Count; i++)
            {
                if (i > 0) sql.Append(", ");
                sql.Append($"$p{i}");
            }
            sql.Append(")");
        }
    }

    private static void BindFilters(Microsoft.Data.Sqlite.SqliteCommand cmd, UsageQuery query)
    {
        if (query.HostFilter is { } hf)
            for (var i = 0; i < hf.Count; i++)
                cmd.Parameters.AddWithValue($"$h{i}", hf[i]);
        if (query.ProjectFilter is { } pf)
            for (var i = 0; i < pf.Count; i++)
                cmd.Parameters.AddWithValue($"$p{i}", pf[i]);
    }
}
```

- [ ] **Step 5: Run to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageQueryServiceTests" 2>&1 | tail -10
```

Expected: 6 tests, 6 passing.

- [ ] **Step 6: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/UsageQuery.cs \
        src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/UsageQueryServiceTests.cs
git commit -m "feat(usage): UsageQueryService read layer

Single read path for CLI / MCP tool / nudge composer. Supports
group-by host/project/day/model/session, host & project filters,
TopN, and coverage counts (full vs partial token data). Phase 1
queries usage_events only; Phase 2 extends to UNION with usage_daily.
Null handling honors 'we don't know' vs 'zero'.
Part of Phase 1."
```

---

## Task 8: UsageCommand — `total-recall usage` CLI verb (text output)

**Files:**
- Create: `src/TotalRecall.Cli/Commands/UsageCommand.cs`
- Create: `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs`

**Scope:** Phase 1 implements text output only. `--json` is Phase 2. Focus on `--last <window>`, `--by <dim>`, `--host <id>` flags and a simple Spectre table renderer.

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs`:

```csharp
using System;
using System.IO;
using System.Threading.Tasks;
using TotalRecall.Cli.Commands;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Cli.Tests.Commands;

public sealed class UsageCommandTests
{
    private static Microsoft.Data.Sqlite.SqliteConnection Seed(Action<UsageEventLog> seed)
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        var log = new UsageEventLog(conn);
        seed(log);
        return conn;
    }

    private static UsageEvent E(string host, string eid, long ts, int? input, int? output) =>
        new UsageEvent(
            Host: host, HostEventId: eid, SessionId: "s1", TimestampMs: ts,
            TurnIndex: 0, Model: "claude-opus-4.1", ProjectPath: "/p",
            ProjectRepo: null, ProjectBranch: null, ProjectCommit: null,
            InteractionId: null, InputTokens: input, CacheCreation5m: null,
            CacheCreation1h: null, CacheRead: null, OutputTokens: output,
            ServiceTier: null, ServerToolUseJson: null, HostRequestId: null);

    [Fact]
    public async Task RunAsync_DefaultFlags_PrintsTableWithTotalRow()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, input: 100, output: 20));
            log.InsertOrIgnore(E("copilot-cli", "b", nowMs - 1000, input: null, output: 10));
        });
        var svc = new UsageQueryService(conn);
        var output = new StringWriter();
        var cmd = new UsageCommand(svc, output);

        var exit = await cmd.RunAsync(Array.Empty<string>());

        Assert.Equal(0, exit);
        var text = output.ToString();
        Assert.Contains("claude-code", text);
        Assert.Contains("copilot-cli", text);
        Assert.Contains("total", text);       // total row
        Assert.Contains("—", text);           // em-dash for null input on copilot
    }

    [Fact]
    public async Task RunAsync_ByDay_FormatsDateKeys()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, input: 100, output: 20));
        });
        var svc = new UsageQueryService(conn);
        var output = new StringWriter();
        var cmd = new UsageCommand(svc, output);

        var exit = await cmd.RunAsync(new[] { "--by", "day" });

        Assert.Equal(0, exit);
        // Should contain today's date in YYYY-MM-DD form
        var today = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd");
        Assert.Contains(today, output.ToString());
    }

    [Fact]
    public async Task RunAsync_InvalidWindow_ReturnsTwoAndPrintsError()
    {
        using var conn = Seed(_ => { });
        var svc = new UsageQueryService(conn);
        var errOut = new StringWriter();
        var cmd = new UsageCommand(svc, TextWriter.Null, errOut);

        var exit = await cmd.RunAsync(new[] { "--last", "bogus" });

        Assert.Equal(2, exit);
        Assert.Contains("--last", errOut.ToString());
    }

    [Fact]
    public async Task RunAsync_BySessionWithLongWindow_ReturnsTwoWithGuidance()
    {
        using var conn = Seed(_ => { });
        var svc = new UsageQueryService(conn);
        var errOut = new StringWriter();
        var cmd = new UsageCommand(svc, TextWriter.Null, errOut);

        var exit = await cmd.RunAsync(new[] { "--by", "session", "--last", "90d" });

        Assert.Equal(2, exit);
        Assert.Contains("--by session requires --last", errOut.ToString());
    }

    [Fact]
    public async Task RunAsync_NoEvents_PrintsEmptyTable()
    {
        using var conn = Seed(_ => { });
        var svc = new UsageQueryService(conn);
        var output = new StringWriter();
        var cmd = new UsageCommand(svc, output);

        var exit = await cmd.RunAsync(Array.Empty<string>());

        Assert.Equal(0, exit);
        Assert.Contains("no usage events", output.ToString(), StringComparison.OrdinalIgnoreCase);
    }
}
```

Also ensure the csproj references `TotalRecall.Infrastructure` — it should already since the existing Cli.Tests reference Cli which references Infrastructure.

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageCommandTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 3: Create `UsageCommand.cs`**

Create `src/TotalRecall.Cli/Commands/UsageCommand.cs`:

```csharp
// src/TotalRecall.Cli/Commands/UsageCommand.cs
//
// `total-recall usage [OPTIONS]` — primary CLI surface for feature A
// (visibility). Phase 1 ships the text-table output path; --json is
// Phase 2.
//
// Flags (spec §6.3):
//   --last <window>   5h|1d|7d|30d|90d|all  default: 7d
//   --by <dim>        host|project|day|model|session  default: host
//   --host <id>       filter to single host
//   --project <id>    filter to single project
//   --top <N>         limit buckets
//   --detail          break out cache_creation vs cache_read (not in Phase 1)
//   --json            Phase 2
//
// Production constructor resolves dbPath via ConfigLoader; test
// constructor accepts an injected UsageQueryService.

using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Config;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Usage;
using MsSqliteConnection = Microsoft.Data.Sqlite.SqliteConnection;

namespace TotalRecall.Cli.Commands;

public sealed class UsageCommand : ICliCommand
{
    private readonly UsageQueryService? _injectedService;
    private readonly TextWriter _out;
    private readonly TextWriter _err;

    // Production ctor — opens the DB on demand so the verb doesn't
    // require db wiring at registry-build time.
    public UsageCommand() : this(null, Console.Out, Console.Error) { }

    // Test ctor — inject a seeded service, optionally redirect output.
    public UsageCommand(UsageQueryService? service, TextWriter? stdout = null, TextWriter? stderr = null)
    {
        _injectedService = service;
        _out = stdout ?? Console.Out;
        _err = stderr ?? Console.Error;
    }

    public string Name => "usage";
    public string? Group => null;
    public string Description => "Show token usage and burn rate across hosts";

    public async Task<int> RunAsync(string[] args)
    {
        if (!TryParseArgs(args, out var window, out var groupBy, out var hostFilter, out var projectFilter, out var topN, out var error))
        {
            _err.WriteLine(error);
            return 2;
        }

        // --by session requires --last ≤ 30d because Phase 1 raw events
        // are capped at that retention (Phase 2 adds daily rollup which
        // drops session granularity past the cutoff).
        if (groupBy == GroupBy.Session && window > TimeSpan.FromDays(30))
        {
            _err.WriteLine("--by session requires --last ≤30d (raw event retention window)");
            return 2;
        }

        // Build service — either the injected one (tests) or construct
        // fresh against the resolved db path.
        UsageQueryService svc;
        MsSqliteConnection? ownedConn = null;
        if (_injectedService is not null)
        {
            svc = _injectedService;
        }
        else
        {
            var dbPath = ConfigLoader.GetDbPath();
            ownedConn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(dbPath);
            MigrationRunner.RunMigrations(ownedConn);
            svc = new UsageQueryService(ownedConn);
        }

        try
        {
            var now = DateTimeOffset.UtcNow;
            var query = new UsageQuery(
                Start: now - window,
                End: now,
                HostFilter: hostFilter,
                ProjectFilter: projectFilter,
                GroupBy: groupBy,
                TopN: topN);

            var report = svc.Query(query);
            RenderTable(report, window, groupBy);
        }
        finally
        {
            ownedConn?.Dispose();
        }

        await Task.CompletedTask;
        return 0;
    }

    // -------- argument parsing --------

    private bool TryParseArgs(
        string[] args,
        out TimeSpan window,
        out GroupBy groupBy,
        out IReadOnlyList<string>? hostFilter,
        out IReadOnlyList<string>? projectFilter,
        out int topN,
        out string? error)
    {
        window = TimeSpan.FromDays(7);
        groupBy = GroupBy.Host;
        hostFilter = null;
        projectFilter = null;
        topN = 0;
        error = null;

        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            switch (a)
            {
                case "--last":
                    if (i + 1 >= args.Length) { error = "--last requires a value (5h|1d|7d|30d|90d|all)"; return false; }
                    if (!TryParseWindow(args[++i], out window)) { error = $"--last: unknown window '{args[i]}' (expected 5h|1d|7d|30d|90d|all)"; return false; }
                    break;
                case "--by":
                    if (i + 1 >= args.Length) { error = "--by requires a value (host|project|day|model|session)"; return false; }
                    if (!TryParseGroupBy(args[++i], out groupBy)) { error = $"--by: unknown dimension '{args[i]}'"; return false; }
                    break;
                case "--host":
                    if (i + 1 >= args.Length) { error = "--host requires a value"; return false; }
                    hostFilter = new[] { args[++i] };
                    break;
                case "--project":
                    if (i + 1 >= args.Length) { error = "--project requires a value"; return false; }
                    projectFilter = new[] { args[++i] };
                    break;
                case "--top":
                    if (i + 1 >= args.Length) { error = "--top requires an integer"; return false; }
                    if (!int.TryParse(args[++i], out topN) || topN < 1) { error = $"--top: invalid integer '{args[i]}'"; return false; }
                    break;
                default:
                    error = $"unknown argument: {a}";
                    return false;
            }
        }
        return true;
    }

    private static bool TryParseWindow(string s, out TimeSpan window)
    {
        window = default;
        switch (s)
        {
            case "5h":  window = TimeSpan.FromHours(5);  return true;
            case "1d":  window = TimeSpan.FromDays(1);   return true;
            case "7d":  window = TimeSpan.FromDays(7);   return true;
            case "30d": window = TimeSpan.FromDays(30);  return true;
            case "90d": window = TimeSpan.FromDays(90);  return true;
            case "all": window = TimeSpan.FromDays(36500); return true;
            default:    return false;
        }
    }

    private static bool TryParseGroupBy(string s, out GroupBy g)
    {
        switch (s)
        {
            case "host":    g = GroupBy.Host;    return true;
            case "project": g = GroupBy.Project; return true;
            case "day":     g = GroupBy.Day;     return true;
            case "model":   g = GroupBy.Model;   return true;
            case "session": g = GroupBy.Session; return true;
            default:        g = GroupBy.Host;    return false;
        }
    }

    // -------- rendering --------

    private void RenderTable(UsageReport report, TimeSpan window, GroupBy groupBy)
    {
        _out.WriteLine($"total-recall usage — last {FormatWindow(window)}, by {groupBy.ToString().ToLowerInvariant()}");

        if (report.Buckets.Count == 0)
        {
            _out.WriteLine("(no usage events in the selected window)");
            return;
        }

        // Simple fixed-width table — avoids Spectre.Console so test captures
        // stdout cleanly. See CliApp comment on why Spectre is reserved for
        // --version only.
        var colHeaders = new[] { groupBy.ToString().ToLowerInvariant(), "sessions", "turns", "input", "cached", "output" };
        var rows = new List<string[]>();
        foreach (var b in report.Buckets)
        {
            rows.Add(new[]
            {
                b.Key,
                b.Totals.SessionCount.ToString(),
                FormatInt(b.Totals.TurnCount),
                FormatTokens(b.Totals.InputTokens),
                FormatTokens(Combine(b.Totals.CacheCreationTokens, b.Totals.CacheReadTokens)),
                FormatTokens(b.Totals.OutputTokens),
            });
        }
        rows.Add(new[]
        {
            "total",
            report.GrandTotal.SessionCount.ToString(),
            FormatInt(report.GrandTotal.TurnCount),
            FormatTokens(report.GrandTotal.InputTokens),
            FormatTokens(Combine(report.GrandTotal.CacheCreationTokens, report.GrandTotal.CacheReadTokens)),
            FormatTokens(report.GrandTotal.OutputTokens),
        });

        RenderFixedWidthTable(colHeaders, rows);

        var tracked = report.SessionsWithFullTokenData;
        var total = tracked + report.SessionsWithPartialTokenData;
        if (total > 0)
        {
            var pct = 100.0 * tracked / total;
            _out.WriteLine();
            _out.WriteLine($"Tracked at token granularity: {tracked} of {total} sessions ({pct:F1}%)");
        }
    }

    private static long? Combine(long? a, long? b)
    {
        if (a is null && b is null) return null;
        return (a ?? 0) + (b ?? 0);
    }

    private static string FormatWindow(TimeSpan ts)
    {
        if (ts == TimeSpan.FromHours(5)) return "5 hours";
        if (ts == TimeSpan.FromDays(1))  return "1 day";
        if (ts == TimeSpan.FromDays(7))  return "7 days";
        if (ts == TimeSpan.FromDays(30)) return "30 days";
        if (ts == TimeSpan.FromDays(90)) return "90 days";
        return $"{ts.TotalDays:F0} days";
    }

    private static string FormatInt(long n) =>
        n.ToString("N0", System.Globalization.CultureInfo.InvariantCulture);

    private static string FormatTokens(long? n)
    {
        if (n is null) return "—";
        var v = n.Value;
        if (v >= 1_000_000) return $"{v / 1_000_000.0:F1}M";
        if (v >= 1_000)     return $"{v / 1_000.0:F0}k";
        return v.ToString();
    }

    private void RenderFixedWidthTable(string[] headers, List<string[]> rows)
    {
        var widths = new int[headers.Length];
        for (var i = 0; i < headers.Length; i++)
            widths[i] = headers[i].Length;
        foreach (var row in rows)
            for (var i = 0; i < row.Length; i++)
                if (row[i].Length > widths[i]) widths[i] = row[i].Length;

        void Divider()
        {
            var sb = new System.Text.StringBuilder();
            for (var i = 0; i < widths.Length; i++)
            {
                if (i > 0) sb.Append("-+-");
                sb.Append(new string('-', widths[i]));
            }
            _out.WriteLine(sb.ToString());
        }

        void Row(string[] values)
        {
            var sb = new System.Text.StringBuilder();
            for (var i = 0; i < values.Length; i++)
            {
                if (i > 0) sb.Append(" | ");
                sb.Append(values[i].PadRight(widths[i]));
            }
            _out.WriteLine(sb.ToString());
        }

        Row(headers);
        Divider();
        for (var i = 0; i < rows.Count - 1; i++) Row(rows[i]);
        Divider();
        Row(rows[rows.Count - 1]); // grand total
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageCommandTests" 2>&1 | tail -10
```

Expected: 5 tests, 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Cli/Commands/UsageCommand.cs \
        tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs
git commit -m "feat(usage): UsageCommand CLI verb (text output)

'total-recall usage [--last W] [--by DIM] [--host H] [--project P] [--top N]'.
Fixed-width table output (avoids Spectre.Console for testability),
em-dash for null token columns, 'tracked at token granularity' footer.
Phase 1 text-only; JSON output in Phase 2.
Part of Phase 1."
```

---

## Task 9: Register UsageCommand in CliApp + wire UsageIndexer into SessionLifecycle + ServerComposition

**Files:**
- Modify: `src/TotalRecall.Cli/CliApp.cs` — register UsageCommand in BuildRegistry
- Modify: `src/TotalRecall.Server/SessionLifecycle.cs` — accept optional UsageIndexer + call in RunInit
- Modify: `src/TotalRecall.Server/ServerComposition.cs` — construct UsageIndexer + pass to SessionLifecycle

- [ ] **Step 1: Register UsageCommand in CliApp.BuildRegistry**

In `src/TotalRecall.Cli/CliApp.cs`, around line 186-212, add `new Commands.UsageCommand()` to the list (place it alphabetically near StatusCommand):

```csharp
private static IReadOnlyList<ICliCommand> BuildRegistry()
{
    return new List<ICliCommand>
    {
        new Commands.CompactCommand(),
        new Commands.ImportHostCommand(),
        new Commands.StatusCommand(),
        new Commands.UsageCommand(),    // <-- ADD THIS LINE
        new Commands.MigrateCommand(),
        // ... (rest unchanged)
```

- [ ] **Step 2: Modify SessionLifecycle to accept an optional UsageIndexer**

In `src/TotalRecall.Server/SessionLifecycle.cs`, add a new constructor parameter (keep the existing one working for tests that don't care about usage):

Find the constructor around line 48-63 and modify:

```csharp
public sealed class SessionLifecycle : ISessionLifecycle
{
    private readonly IReadOnlyList<IImporter> _importers;
    private readonly ISqliteStore _store;
    private readonly ICompactionLogReader _compactionLog;
    private readonly Func<long> _nowMs;
    private readonly string _sessionId;
    private readonly TotalRecall.Infrastructure.Usage.UsageIndexer? _usageIndexer;  // <-- NEW

    private readonly SemaphoreSlim _initLock = new(1, 1);
    private SessionInitResult? _cached;

    public SessionLifecycle(
        IReadOnlyList<IImporter> importers,
        ISqliteStore store,
        ICompactionLogReader compactionLog,
        string? sessionId = null,
        Func<long>? nowMs = null,
        TotalRecall.Infrastructure.Usage.UsageIndexer? usageIndexer = null)  // <-- NEW
    {
        ArgumentNullException.ThrowIfNull(importers);
        ArgumentNullException.ThrowIfNull(store);
        ArgumentNullException.ThrowIfNull(compactionLog);
        _importers = importers;
        _store = store;
        _compactionLog = compactionLog;
        _sessionId = sessionId ?? Guid.NewGuid().ToString();
        _nowMs = nowMs ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        _usageIndexer = usageIndexer;
    }
```

- [ ] **Step 3: Invoke the indexer in RunInit**

Still in SessionLifecycle.cs, `RunInit()` is currently synchronous; we need to call the async indexer without breaking the existing signature. Since `UsageIndexer.RunAsync` takes a CancellationToken and the rest of RunInit is sync, invoke it with `.GetAwaiter().GetResult()` inside a try/catch — failures must NEVER block session_start.

Find `RunInit()` around line 89 and add this at the very start of the method (before "1. Host importer sweep"):

```csharp
private SessionInitResult RunInit()
{
    // 0. Usage indexer — best-effort, failures never block session_start.
    //    Runs before the existing importer sweep so quota nudges reflect
    //    the latest data. See token-usage-tracking spec §5.4.
    if (_usageIndexer is not null)
    {
        try
        {
            _usageIndexer.RunAsync(CancellationToken.None).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            // Never propagate — usage tracking must not prevent server boot.
            Console.Error.WriteLine($"total-recall: usage indexer failed: {ex.Message}");
        }
    }

    // 1. Host importer sweep — only invoke importers whose Detect() trips.
    // ... (existing code unchanged)
```

- [ ] **Step 4: Wire construction in ServerComposition**

In `src/TotalRecall.Server/ServerComposition.cs`, around line 180-220 (inside `OpenProduction`), after `var importLog = new ImportLog(conn);` and before the host-importer list, add:

```csharp
// Usage tracking wiring — Phase 1 registers Claude Code only.
// Phase 2 adds Copilot CLI. See token-usage-tracking spec §5.
var usageEventLog = new TotalRecall.Infrastructure.Telemetry.UsageEventLog(conn);
var usageWatermarks = new TotalRecall.Infrastructure.Telemetry.UsageWatermarkStore(conn);
var usageImporters = new List<TotalRecall.Infrastructure.Usage.IUsageImporter>
{
    new TotalRecall.Infrastructure.Usage.ClaudeCodeUsageImporter(),
};
var usageIndexer = new TotalRecall.Infrastructure.Usage.UsageIndexer(
    usageImporters, usageEventLog, usageWatermarks);
```

Then find the existing `var sessionLifecycle = new SessionLifecycle(importers, store, compactionLog);` line and extend it:

```csharp
var sessionLifecycle = new SessionLifecycle(
    importers, store, compactionLog,
    usageIndexer: usageIndexer);
```

- [ ] **Step 5: Build**

```bash
dotnet build src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: Build succeeded, 0 warnings, 0 errors.

- [ ] **Step 6: Run full test suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -15
```

Expected: all Phase 1 tests passing. `UsageCommand` is now reachable via `total-recall usage`; `UsageIndexer` is wired into SessionLifecycle. Existing `SessionLifecycleTests` should still pass because `usageIndexer` parameter is optional with a default of `null`.

- [ ] **Step 7: Manual smoke test**

```bash
dotnet publish src/TotalRecall.Host/TotalRecall.Host.csproj -c Release -r osx-arm64 -p:PublishAot=true 2>&1 | tail -5
BIN=src/TotalRecall.Host/bin/Release/net8.0/osx-arm64/publish/total-recall
$BIN usage 2>&1 | head -30
```

Expected output: a table with at least one Claude Code row (your real ~/.claude/projects data is visible to the binary) and a total row. "Tracked at token granularity: X of Y sessions" footer.

- [ ] **Step 8: Commit**

```bash
git add src/TotalRecall.Cli/CliApp.cs \
        src/TotalRecall.Server/SessionLifecycle.cs \
        src/TotalRecall.Server/ServerComposition.cs
git commit -m "feat(usage): wire UsageIndexer into session_start + register UsageCommand

ServerComposition constructs the indexer with ClaudeCodeUsageImporter
and passes it to SessionLifecycle. SessionLifecycle runs indexer once
at init before the existing importer sweep; failures are caught and
logged but never block session_start. CliApp registers UsageCommand
so 'total-recall usage' is reachable.
End of Phase 1."
```

- [ ] **Step 9: Phase 1 checkpoint**

Run full test suite and record the count:

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | grep -E 'Passed!'
```

Expected: baseline (~944) + Phase 1 tests (~28) = ~972 passing, 0 failures.

---

# PHASE 2 — Cross-host + MCP

Adds `CopilotCliUsageImporter`, the `usage_status` MCP tool, JSON output for the CLI, and the daily rollup (unblocks the raw/daily union for long windows). By end of Phase 2, the user can query usage across both hosts and agents can invoke `usage_status` explicitly.

## Task 10: CopilotCliUsageImporter — parse Copilot session events.jsonl

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/CopilotCliUsageImporter.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/copilot-cli-sample.jsonl`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/CopilotCliUsageImporterTests.cs`

- [ ] **Step 1: Create the Copilot fixture**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/copilot-cli-sample.jsonl`:

```
{"type":"session.start","data":{"sessionId":"s-copilot-1","version":1,"producer":"copilot-agent","copilotVersion":"1.0.22","startTime":"2026-04-09T22:00:00.000Z","context":{"cwd":"/Users/test/proj","gitRoot":"/Users/test/proj","branch":"main","headCommit":"abc123","repository":"test/proj","hostType":"github"},"alreadyInUse":false,"remoteSteerable":false},"id":"evt-start","timestamp":"2026-04-09T22:00:00.100Z","parentId":null}
{"type":"user.message","data":{"content":"hello","interactionId":"i-1"},"id":"evt-user-1","timestamp":"2026-04-09T22:00:05.000Z","parentId":"evt-start"}
{"type":"assistant.turn_start","data":{"turnId":"0","interactionId":"i-1"},"id":"evt-ts-1","timestamp":"2026-04-09T22:00:05.100Z","parentId":"evt-user-1"}
{"type":"tool.execution_complete","data":{"toolCallId":"tc-1","model":"claude-sonnet-4.6","interactionId":"i-1","success":true,"result":{}},"id":"evt-tc-1","timestamp":"2026-04-09T22:00:05.200Z","parentId":"evt-ts-1"}
{"type":"assistant.message","data":{"messageId":"m-1","content":"","interactionId":"i-1","outputTokens":146,"requestId":"REQ-1"},"id":"evt-am-1","timestamp":"2026-04-09T22:00:05.300Z","parentId":"evt-tc-1"}
{"type":"session.context_changed","data":{"cwd":"/Users/test/proj","gitRoot":"/Users/test/proj","branch":"feature/xyz","headCommit":"def456","repository":"test/proj","hostType":"github"},"id":"evt-ctx","timestamp":"2026-04-09T22:01:00.000Z","parentId":"evt-am-1"}
not valid json at all
{"type":"assistant.message","data":{"messageId":"m-2","content":"","interactionId":"i-2","outputTokens":88,"requestId":"REQ-2"},"id":"evt-am-2","timestamp":"2026-04-09T22:01:30.000Z","parentId":"evt-ctx"}
{"type":"hook.end","data":{"hookInvocationId":"h1","hookType":"sessionStart","success":true},"id":"evt-hook-end","timestamp":"2026-04-09T22:01:35.000Z","parentId":null}
{"type":"assistant.message","data":{"messageId":"m-3","content":"","interactionId":"i-3"},"id":"evt-am-3","timestamp":"2026-04-09T22:01:40.000Z","parentId":null}
```

(Line 1: session.start with full context. Line 2: user message — not emitted. Line 3: turn_start — not emitted. Line 4: tool.execution_complete — updates running `lastKnownModel`. Line 5: first assistant.message — should emit with model=claude-sonnet-4.6, branch=main. Line 6: context_changed — updates running project to branch=feature/xyz. Line 7: malformed — skipped. Line 8: second assistant.message — should emit with branch=feature/xyz. Line 9: hook.end — not emitted. Line 10: assistant.message with no outputTokens — should still emit with OutputTokens=null.)

Add copy-to-output in the csproj — in `tests/TotalRecall.Infrastructure.Tests/TotalRecall.Infrastructure.Tests.csproj`, the `<ItemGroup>` you added in Task 5 already has a `Usage/Fixtures/claude-code-sample.jsonl` entry. Add another line inside the same ItemGroup:

```xml
    <None Update="Usage/Fixtures/copilot-cli-sample.jsonl">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
```

- [ ] **Step 2: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/CopilotCliUsageImporterTests.cs`:

```csharp
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class CopilotCliUsageImporterTests : System.IDisposable
{
    private readonly string _root;

    public CopilotCliUsageImporterTests()
    {
        _root = Path.Combine(Path.GetTempPath(), "tr-copilot-usage-" + System.Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(_root, "session-state"));
    }

    public void Dispose()
    {
        try { if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true); } catch { }
    }

    private string CopyFixtureAsSession(string sessionId)
    {
        var dir = Path.Combine(_root, "session-state", sessionId);
        Directory.CreateDirectory(dir);
        var fixture = Path.Combine(System.AppContext.BaseDirectory, "Usage", "Fixtures", "copilot-cli-sample.jsonl");
        var dest = Path.Combine(dir, "events.jsonl");
        File.Copy(fixture, dest, overwrite: true);
        return dest;
    }

    private static async Task<List<UsageEvent>> Drain(CopilotCliUsageImporter imp, long sinceMs)
    {
        var list = new List<UsageEvent>();
        await foreach (var e in imp.ScanAsync(sinceMs, CancellationToken.None))
            list.Add(e);
        return list;
    }

    [Fact]
    public void Detect_NoSessionStateDir_ReturnsFalse()
    {
        var imp = new CopilotCliUsageImporter(copilotHome: "/nonexistent");
        Assert.False(imp.Detect());
    }

    [Fact]
    public void Detect_SessionStateDirExists_ReturnsTrue()
    {
        var imp = new CopilotCliUsageImporter(copilotHome: _root);
        Assert.True(imp.Detect());
    }

    [Fact]
    public async Task ScanAsync_EmitsOneEventPerAssistantMessage()
    {
        CopyFixtureAsSession("s-copilot-1");
        var imp = new CopilotCliUsageImporter(copilotHome: _root);

        var events = await Drain(imp, sinceMs: 0);

        // Three assistant.message events in the fixture
        Assert.Equal(3, events.Count);
    }

    [Fact]
    public async Task ScanAsync_FirstMessage_UsesInitialContextAndLastKnownModel()
    {
        CopyFixtureAsSession("s-copilot-1");
        var imp = new CopilotCliUsageImporter(copilotHome: _root);

        var events = await Drain(imp, sinceMs: 0);
        var m1 = events.First(e => e.HostEventId == "evt-am-1");

        Assert.Equal("copilot-cli", m1.Host);
        Assert.Equal("s-copilot-1", m1.SessionId);
        Assert.Equal("/Users/test/proj", m1.ProjectPath);
        Assert.Equal("test/proj", m1.ProjectRepo);
        Assert.Equal("main", m1.ProjectBranch);
        Assert.Equal("abc123", m1.ProjectCommit);
        Assert.Equal("claude-sonnet-4.6", m1.Model);
        Assert.Equal(146, m1.OutputTokens);
        Assert.Equal("REQ-1", m1.HostRequestId);
        Assert.Equal("i-1", m1.InteractionId);
        // Claude Code-specific fields are null
        Assert.Null(m1.InputTokens);
        Assert.Null(m1.CacheCreation5m);
        Assert.Null(m1.CacheCreation1h);
        Assert.Null(m1.CacheRead);
        Assert.Null(m1.ServiceTier);
    }

    [Fact]
    public async Task ScanAsync_AfterContextChange_ReattributesBranch()
    {
        CopyFixtureAsSession("s-copilot-1");
        var imp = new CopilotCliUsageImporter(copilotHome: _root);

        var events = await Drain(imp, sinceMs: 0);
        var m2 = events.First(e => e.HostEventId == "evt-am-2");

        Assert.Equal("feature/xyz", m2.ProjectBranch);
        Assert.Equal("def456", m2.ProjectCommit);
    }

    [Fact]
    public async Task ScanAsync_AssistantMessageMissingOutputTokens_EmitsWithNullOutput()
    {
        CopyFixtureAsSession("s-copilot-1");
        var imp = new CopilotCliUsageImporter(copilotHome: _root);

        var events = await Drain(imp, sinceMs: 0);
        var m3 = events.First(e => e.HostEventId == "evt-am-3");

        Assert.Null(m3.OutputTokens);
    }

    [Fact]
    public async Task ScanAsync_Watermark_SkipsOlderEvents()
    {
        CopyFixtureAsSession("s-copilot-1");
        var imp = new CopilotCliUsageImporter(copilotHome: _root);

        // Only keep events strictly after 22:01:00 — excludes m1, keeps m2 and m3
        var cutoff = new System.DateTimeOffset(2026, 4, 9, 22, 1, 10, System.TimeSpan.Zero).ToUnixTimeMilliseconds();
        var events = await Drain(imp, sinceMs: cutoff);

        Assert.Equal(2, events.Count);
        Assert.DoesNotContain(events, e => e.HostEventId == "evt-am-1");
    }
}
```

- [ ] **Step 3: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~CopilotCliUsageImporterTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 4: Create `CopilotCliUsageImporter.cs`**

Create `src/TotalRecall.Infrastructure/Usage/CopilotCliUsageImporter.cs`:

```csharp
// src/TotalRecall.Infrastructure/Usage/CopilotCliUsageImporter.cs
//
// Parses Copilot CLI's session-state events.jsonl files into UsageEvent.
// Layout: ~/.copilot/session-state/<session-uuid>/events.jsonl
//
// Schema verified empirically on copilot@1.0.22 (2026-04-09). Only
// assistant.message events carry token data (`data.outputTokens`).
// Model name is NOT on the message itself — it's on the most recent
// tool.execution_complete event in the same session, so we maintain a
// "last known model" running variable.
//
// Context tracking: session.start.data.context initializes project
// attribution (cwd, gitRoot, branch, repository, headCommit). Mid-session
// session.context_changed events update the running context; subsequent
// assistant.message events attribute to the new context.
//
// Copilot CLI provides NONE of the Anthropic input/cache token fields.
// Every UsageEvent emitted here leaves InputTokens, CacheCreation*, CacheRead,
// ServiceTier, and ServerToolUseJson as null. This is the "unified schema,
// optional fields" decision from spec Q3=B.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace TotalRecall.Infrastructure.Usage;

public sealed class CopilotCliUsageImporter : IUsageImporter
{
    private readonly string _sessionStateDir;

    public CopilotCliUsageImporter(string? copilotHome = null)
    {
        var home = copilotHome ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".copilot");
        _sessionStateDir = Path.Combine(home, "session-state");
    }

    public string HostName => "copilot-cli";

    public bool Detect() => Directory.Exists(_sessionStateDir);

    public async IAsyncEnumerable<UsageEvent> ScanAsync(
        long sinceMs,
        [EnumeratorCancellation] CancellationToken ct)
    {
        if (!Detect()) yield break;

        foreach (var sessionDir in Directory.EnumerateDirectories(_sessionStateDir))
        {
            ct.ThrowIfCancellationRequested();
            var eventsPath = Path.Combine(sessionDir, "events.jsonl");
            if (!File.Exists(eventsPath)) continue;

            var mtimeMs = new DateTimeOffset(
                File.GetLastWriteTimeUtc(eventsPath), TimeSpan.Zero).ToUnixTimeMilliseconds();
            if (mtimeMs < sinceMs) continue;

            await foreach (var evt in ParseEventsAsync(eventsPath, sinceMs, ct))
                yield return evt;
        }
    }

    private static async IAsyncEnumerable<UsageEvent> ParseEventsAsync(
        string eventsPath,
        long sinceMs,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var sessionId = Path.GetFileName(Path.GetDirectoryName(eventsPath)!);
        int turnIndex = 0;

        // Running project context — updated by session.start and session.context_changed
        string? projectPath = null, projectRepo = null, projectBranch = null, projectCommit = null;

        // Running model attribution — updated by tool.execution_complete
        string? lastKnownModel = null;

        await using var stream = File.OpenRead(eventsPath);
        using var reader = new StreamReader(stream);

        string? line;
        while ((line = await reader.ReadLineAsync(ct).ConfigureAwait(false)) is not null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            JsonDocument? doc = null;
            try { doc = JsonDocument.Parse(line); }
            catch (JsonException) { continue; }

            using (doc)
            {
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var typeEl) || typeEl.ValueKind != JsonValueKind.String)
                    continue;
                var type = typeEl.GetString();
                if (type is null) continue;

                var data = root.TryGetProperty("data", out var d) ? d : default;

                switch (type)
                {
                    case "session.start":
                        if (data.ValueKind == JsonValueKind.Object
                            && data.TryGetProperty("context", out var ctx)
                            && ctx.ValueKind == JsonValueKind.Object)
                        {
                            projectPath   = GetStringOrNull(ctx, "cwd") ?? projectPath;
                            projectRepo   = GetStringOrNull(ctx, "repository") ?? projectRepo;
                            projectBranch = GetStringOrNull(ctx, "branch") ?? projectBranch;
                            projectCommit = GetStringOrNull(ctx, "headCommit") ?? projectCommit;
                        }
                        break;

                    case "session.context_changed":
                        if (data.ValueKind == JsonValueKind.Object)
                        {
                            projectPath   = GetStringOrNull(data, "cwd") ?? projectPath;
                            projectRepo   = GetStringOrNull(data, "repository") ?? projectRepo;
                            projectBranch = GetStringOrNull(data, "branch") ?? projectBranch;
                            projectCommit = GetStringOrNull(data, "headCommit") ?? projectCommit;
                        }
                        break;

                    case "tool.execution_complete":
                        if (data.ValueKind == JsonValueKind.Object)
                        {
                            var m = GetStringOrNull(data, "model");
                            if (!string.IsNullOrEmpty(m)) lastKnownModel = m;
                        }
                        break;

                    case "assistant.message":
                        var tsMs = ParseTimestampMs(root);
                        if (tsMs <= sinceMs) continue;

                        var hostEventId = root.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String
                            ? idEl.GetString() ?? Guid.NewGuid().ToString()
                            : Guid.NewGuid().ToString();

                        int? outputTokens = null;
                        string? interactionId = null;
                        string? requestId = null;
                        if (data.ValueKind == JsonValueKind.Object)
                        {
                            outputTokens = GetIntOrNull(data, "outputTokens");
                            interactionId = GetStringOrNull(data, "interactionId");
                            requestId = GetStringOrNull(data, "requestId");
                        }

                        yield return new UsageEvent(
                            Host: "copilot-cli",
                            HostEventId: hostEventId,
                            SessionId: sessionId,
                            TimestampMs: tsMs,
                            TurnIndex: turnIndex++,
                            Model: lastKnownModel,
                            ProjectPath: projectPath,
                            ProjectRepo: projectRepo,
                            ProjectBranch: projectBranch,
                            ProjectCommit: projectCommit,
                            InteractionId: interactionId,
                            InputTokens: null,
                            CacheCreation5m: null,
                            CacheCreation1h: null,
                            CacheRead: null,
                            OutputTokens: outputTokens,
                            ServiceTier: null,
                            ServerToolUseJson: null,
                            HostRequestId: requestId);
                        break;
                }
            }
        }
    }

    // --- helpers ---------------------------------------------------------

    private static long ParseTimestampMs(JsonElement root)
    {
        if (root.TryGetProperty("timestamp", out var t) && t.ValueKind == JsonValueKind.String)
        {
            var s = t.GetString();
            if (!string.IsNullOrEmpty(s)
                && DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind | DateTimeStyles.AssumeUniversal, out var dto))
            {
                return dto.ToUnixTimeMilliseconds();
            }
        }
        return 0;
    }

    private static int? GetIntOrNull(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetInt32(out var i) => i,
            _ => null,
        };
    }

    private static string? GetStringOrNull(JsonElement obj, string key)
    {
        if (!obj.TryGetProperty(key, out var v)) return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    }
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~CopilotCliUsageImporterTests" 2>&1 | tail -10
```

Expected: 7 tests, 7 passing.

- [ ] **Step 6: Register CopilotCliUsageImporter in ServerComposition**

In `src/TotalRecall.Server/ServerComposition.cs`, find the `usageImporters` list you added in Task 9 Step 4 and add the Copilot adapter:

```csharp
var usageImporters = new List<TotalRecall.Infrastructure.Usage.IUsageImporter>
{
    new TotalRecall.Infrastructure.Usage.ClaudeCodeUsageImporter(),
    new TotalRecall.Infrastructure.Usage.CopilotCliUsageImporter(),  // <-- ADD
};
```

- [ ] **Step 7: Build + run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: no regressions, 7 new tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/CopilotCliUsageImporter.cs \
        src/TotalRecall.Server/ServerComposition.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/CopilotCliUsageImporterTests.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/Fixtures/copilot-cli-sample.jsonl \
        tests/TotalRecall.Infrastructure.Tests/TotalRecall.Infrastructure.Tests.csproj
git commit -m "feat(usage): CopilotCliUsageImporter + register in ServerComposition

Parses ~/.copilot/session-state/<id>/events.jsonl, emits one UsageEvent
per assistant.message. Running-context strategy handles mid-session
branch/repo switches via session.context_changed. Model attribution
comes from the most recent tool.execution_complete. InputTokens and
all cache fields left null — Copilot CLI does not expose them
(empirically verified on copilot@1.0.22).
Part of Phase 2."
```

---

## Task 11: UsageDailyRollup — pre-30d event aggregation

**Files:**
- Create: `src/TotalRecall.Infrastructure/Telemetry/UsageDailyRollup.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/UsageDailyRollupTests.cs`

Rollup runs from `UsageIndexer` when `>= 24h` has elapsed since the last rollup (tracked via `UsageWatermarkStore.SetLastRollupAt`). Aggregates events older than 30 days into `usage_daily`, then deletes the raw events.

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/UsageDailyRollupTests.cs`:

```csharp
using System;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class UsageDailyRollupTests
{
    private static Microsoft.Data.Sqlite.SqliteConnection OpenMigrated()
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        return conn;
    }

    private static UsageEvent E(string host, string eid, long ts, int? input, int? output, string? model = "opus") =>
        new UsageEvent(
            Host: host, HostEventId: eid, SessionId: "s-" + eid, TimestampMs: ts,
            TurnIndex: 0, Model: model, ProjectPath: "/p", ProjectRepo: null,
            ProjectBranch: null, ProjectCommit: null, InteractionId: null,
            InputTokens: input, CacheCreation5m: null, CacheCreation1h: null,
            CacheRead: null, OutputTokens: output, ServiceTier: null,
            ServerToolUseJson: null, HostRequestId: null);

    [Fact]
    public void Rollup_EventsOlderThanCutoff_AggregatedAndDeleted()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var rollup = new UsageDailyRollup(conn);

        var oldDay = DateTimeOffset.UtcNow.AddDays(-31).ToUnixTimeMilliseconds();
        log.InsertOrIgnore(E("claude-code", "a1", oldDay, input: 100, output: 20));
        log.InsertOrIgnore(E("claude-code", "a2", oldDay + 1000, input: 50, output: 10));

        var cutoff = DateTimeOffset.UtcNow.AddDays(-30).ToUnixTimeMilliseconds();
        var result = rollup.RollupOlderThan(cutoff);

        Assert.Equal(2, result.EventsAggregated);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_events";
        Assert.Equal(0L, (long)cmd.ExecuteScalar()!);

        cmd.CommandText = "SELECT COUNT(*), SUM(input_tokens), SUM(output_tokens) FROM usage_daily";
        using var r = cmd.ExecuteReader();
        Assert.True(r.Read());
        Assert.Equal(1L, r.GetInt64(0));       // one daily row
        Assert.Equal(150L, r.GetInt64(1));     // summed input
        Assert.Equal(30L, r.GetInt64(2));      // summed output
    }

    [Fact]
    public void Rollup_EventsWithinCutoff_Untouched()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var rollup = new UsageDailyRollup(conn);

        var recent = DateTimeOffset.UtcNow.AddDays(-5).ToUnixTimeMilliseconds();
        log.InsertOrIgnore(E("claude-code", "a1", recent, input: 100, output: 20));

        var cutoff = DateTimeOffset.UtcNow.AddDays(-30).ToUnixTimeMilliseconds();
        var result = rollup.RollupOlderThan(cutoff);

        Assert.Equal(0, result.EventsAggregated);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_events";
        Assert.Equal(1L, (long)cmd.ExecuteScalar()!);
    }

    [Fact]
    public void Rollup_IsIdempotent_SecondRunNoOp()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var rollup = new UsageDailyRollup(conn);

        var oldDay = DateTimeOffset.UtcNow.AddDays(-31).ToUnixTimeMilliseconds();
        log.InsertOrIgnore(E("claude-code", "a1", oldDay, input: 100, output: 20));
        var cutoff = DateTimeOffset.UtcNow.AddDays(-30).ToUnixTimeMilliseconds();

        var first = rollup.RollupOlderThan(cutoff);
        var second = rollup.RollupOlderThan(cutoff);

        Assert.Equal(1, first.EventsAggregated);
        Assert.Equal(0, second.EventsAggregated);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_daily";
        Assert.Equal(1L, (long)cmd.ExecuteScalar()!);  // still one row, not duplicated
    }

    [Fact]
    public void Rollup_GroupsByDayHostModelProject()
    {
        using var conn = OpenMigrated();
        var log = new UsageEventLog(conn);
        var rollup = new UsageDailyRollup(conn);

        var day1 = new DateTimeOffset(2026, 3, 1, 10, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var day2 = new DateTimeOffset(2026, 3, 2, 10, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        log.InsertOrIgnore(E("claude-code", "a1", day1, input: 100, output: 20, model: "opus"));
        log.InsertOrIgnore(E("claude-code", "a2", day1, input: 50, output: 10, model: "opus"));
        log.InsertOrIgnore(E("claude-code", "a3", day1, input: 75, output: 15, model: "sonnet"));
        log.InsertOrIgnore(E("claude-code", "a4", day2, input: 25, output: 5, model: "opus"));

        var cutoff = DateTimeOffset.UtcNow.AddDays(-30).ToUnixTimeMilliseconds();
        rollup.RollupOlderThan(cutoff);

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usage_daily";
        // day1/opus, day1/sonnet, day2/opus → 3 rows
        Assert.Equal(3L, (long)cmd.ExecuteScalar()!);
    }
}
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageDailyRollupTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 3: Create `UsageDailyRollup.cs`**

Create `src/TotalRecall.Infrastructure/Telemetry/UsageDailyRollup.cs`:

```csharp
// src/TotalRecall.Infrastructure/Telemetry/UsageDailyRollup.cs
//
// Rolling aggregation — takes events older than the cutoff (default 30
// days), groups by (day_utc, host, model, project), INSERT OR REPLACE-es
// into usage_daily, then deletes the source rows. The whole operation
// is wrapped in a transaction so partial failures don't leave a split
// state (some events rolled up but not deleted, or vice versa).
//
// Idempotency: INSERT OR REPLACE on the composite PK means re-running
// is safe. If a rollup is interrupted between INSERT and DELETE, the
// next run re-inserts the same aggregated values (no change) and then
// deletes. Correctness holds as long as cutoff only moves forward.

using System;
using MsSqliteConnection = Microsoft.Data.Sqlite.SqliteConnection;

namespace TotalRecall.Infrastructure.Telemetry;

public sealed record UsageRollupResult(int EventsAggregated, int DailyRowsWritten);

public sealed class UsageDailyRollup
{
    private readonly MsSqliteConnection _conn;

    public UsageDailyRollup(MsSqliteConnection conn)
    {
        ArgumentNullException.ThrowIfNull(conn);
        _conn = conn;
    }

    /// <summary>
    /// Roll up all events with ts &lt; cutoffMs into usage_daily, then
    /// delete them from usage_events. Returns (events aggregated, daily
    /// rows written after dedup).
    /// </summary>
    public UsageRollupResult RollupOlderThan(long cutoffMs)
    {
        using var tx = _conn.BeginTransaction();

        int eventCount;
        using (var countCmd = _conn.CreateCommand())
        {
            countCmd.Transaction = tx;
            countCmd.CommandText = "SELECT COUNT(*) FROM usage_events WHERE ts < $cutoff";
            countCmd.Parameters.AddWithValue("$cutoff", cutoffMs);
            eventCount = (int)(long)countCmd.ExecuteScalar()!;
        }

        if (eventCount == 0)
        {
            tx.Commit();
            return new UsageRollupResult(0, 0);
        }

        // Aggregate into usage_daily
        int dailyRows;
        using (var aggCmd = _conn.CreateCommand())
        {
            aggCmd.Transaction = tx;
            aggCmd.CommandText = @"
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
WHERE ts < $cutoff
GROUP BY day_utc, host, model, project";
            aggCmd.Parameters.AddWithValue("$cutoff", cutoffMs);
            dailyRows = aggCmd.ExecuteNonQuery();
        }

        // Delete the source events
        using (var delCmd = _conn.CreateCommand())
        {
            delCmd.Transaction = tx;
            delCmd.CommandText = "DELETE FROM usage_events WHERE ts < $cutoff";
            delCmd.Parameters.AddWithValue("$cutoff", cutoffMs);
            delCmd.ExecuteNonQuery();
        }

        tx.Commit();
        return new UsageRollupResult(eventCount, dailyRows);
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageDailyRollupTests" 2>&1 | tail -10
```

Expected: 4 tests, 4 passing.

- [ ] **Step 5: Wire rollup into UsageIndexer**

Modify `src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs` to optionally accept a `UsageDailyRollup` and invoke it when ≥24h has elapsed since the last rollup. Update the constructor and add a helper:

```csharp
public sealed class UsageIndexer
{
    private readonly IReadOnlyList<IUsageImporter> _importers;
    private readonly UsageEventLog _eventLog;
    private readonly UsageWatermarkStore _watermarks;
    private readonly UsageDailyRollup? _rollup;
    private readonly TextWriter _stderr;
    private readonly int _retentionDays;

    // Sentinel host used to store the global rollup watermark in the
    // usage_watermarks table — avoids adding a separate singleton table.
    private const string RollupHostKey = "__rollup__";

    public UsageIndexer(
        IReadOnlyList<IUsageImporter> importers,
        UsageEventLog eventLog,
        UsageWatermarkStore watermarks,
        TextWriter? stderr = null,
        UsageDailyRollup? rollup = null,
        int retentionDays = 30)
    {
        ArgumentNullException.ThrowIfNull(importers);
        ArgumentNullException.ThrowIfNull(eventLog);
        ArgumentNullException.ThrowIfNull(watermarks);
        _importers = importers;
        _eventLog = eventLog;
        _watermarks = watermarks;
        _stderr = stderr ?? Console.Error;
        _rollup = rollup;
        _retentionDays = retentionDays;
    }
```

Then at the end of `RunAsync`, after the per-host loop, add:

```csharp
        // Daily rollup — at most once per 24h. Watermark stored against
        // the sentinel "__rollup__" host key in usage_watermarks.
        if (_rollup is not null)
        {
            var lastRollup = _watermarks.GetLastRollupAt(RollupHostKey);
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var cadenceMs = 24L * 60 * 60 * 1000;
            if (lastRollup == 0 || nowMs - lastRollup >= cadenceMs)
            {
                try
                {
                    var cutoff = DateTimeOffset.UtcNow
                        .AddDays(-_retentionDays).ToUnixTimeMilliseconds();
                    var result = _rollup.RollupOlderThan(cutoff);
                    _watermarks.SetLastRollupAt(RollupHostKey, nowMs);
                    if (result.EventsAggregated > 0)
                    {
                        _stderr.WriteLine(
                            $"total-recall: usage rollup: {result.EventsAggregated} raw events " +
                            $"aged past cutoff, consolidated into {result.DailyRowsWritten} daily rows");
                    }
                }
                catch (Exception ex)
                {
                    ExceptionLogger.LogChain(
                        _stderr, "total-recall: usage rollup failed", ex);
                }
            }
        }
```

- [ ] **Step 6: Update ServerComposition to construct UsageDailyRollup and pass it**

In `src/TotalRecall.Server/ServerComposition.cs`, extend the Phase 1 wiring block:

```csharp
var usageEventLog = new TotalRecall.Infrastructure.Telemetry.UsageEventLog(conn);
var usageWatermarks = new TotalRecall.Infrastructure.Telemetry.UsageWatermarkStore(conn);
var usageRollup = new TotalRecall.Infrastructure.Telemetry.UsageDailyRollup(conn);  // <-- NEW
var usageImporters = new List<TotalRecall.Infrastructure.Usage.IUsageImporter>
{
    new TotalRecall.Infrastructure.Usage.ClaudeCodeUsageImporter(),
    new TotalRecall.Infrastructure.Usage.CopilotCliUsageImporter(),
};
var usageIndexer = new TotalRecall.Infrastructure.Usage.UsageIndexer(
    usageImporters, usageEventLog, usageWatermarks, rollup: usageRollup);  // <-- EXTEND
```

- [ ] **Step 7: Run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: all previous tests plus 4 new rollup tests passing.

- [ ] **Step 8: Extend UsageQueryService to union raw + daily tables**

Phase 1 queried `usage_events` only. Now that `usage_daily` has real data in it, extend `UsageQueryService.Query` to UNION ALL with the daily table for days that are past the raw retention cutoff.

In `src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs`, find the main Query SQL in the `Query` method and replace the `FROM usage_events WHERE ts BETWEEN ...` clause with a CTE:

```csharp
        var sql = new StringBuilder();
        sql.Append($@"
WITH unioned AS (
    SELECT
        host, model,
        COALESCE(project_repo, project_path, '(none)') AS project,
        session_id,
        strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day_str,
        ts,
        1 AS turn_count,
        input_tokens,
        COALESCE(cache_creation_5m, 0) + COALESCE(cache_creation_1h, 0) AS cache_creation_tokens,
        cache_read AS cache_read_tokens,
        output_tokens
    FROM usage_events
    WHERE ts BETWEEN $start AND $end
    UNION ALL
    SELECT
        host, model,
        COALESCE(project, '(none)') AS project,
        NULL AS session_id,
        strftime('%Y-%m-%d', day_utc, 'unixepoch') AS day_str,
        day_utc * 1000 AS ts,
        turn_count,
        input_tokens,
        cache_creation_tokens,
        cache_read_tokens,
        output_tokens
    FROM usage_daily
    WHERE day_utc * 1000 BETWEEN $start AND $end
)
SELECT
    {GroupKeyExprForUnion(query.GroupBy)} AS bucket_key,
    COUNT(DISTINCT session_id) AS session_count,
    SUM(turn_count)           AS turn_count,
    SUM(input_tokens)         AS input_tokens,
    SUM(cache_creation_tokens) AS cache_creation_tokens,
    SUM(cache_read_tokens)    AS cache_read_tokens,
    SUM(output_tokens)        AS output_tokens
FROM unioned
WHERE 1=1");
```

Add the helper method at the bottom of the class:

```csharp
    private static string GroupKeyExprForUnion(GroupBy groupBy) => groupBy switch
    {
        GroupBy.None    => "'_total_'",
        GroupBy.Host    => "host",
        GroupBy.Project => "project",
        GroupBy.Day     => "day_str",
        GroupBy.Model   => "COALESCE(model, '(unknown)')",
        GroupBy.Session => "session_id",
        _ => "host",
    };
```

Replace the filter-append calls to use `AND host IN (...)` against the union (unchanged). Also update `QueryGrandTotal` and `QueryCoverage` to use the same CTE structure (for consistency — grand total and coverage must also see daily rows).

**Caveat on coverage counts past the rollup cutoff:** `usage_daily` rows have `session_id = NULL` in the union, so `COUNT(DISTINCT session_id)` undercounts. This is acceptable for Phase 2 — document as a known limitation: "coverage indicator reflects only the raw event window; rolled-up data contributes to token totals but not session counts." Add a comment in `UsageQueryService.QueryCoverage`:

```csharp
    // NOTE: coverage counts (full vs partial token data) are computed
    // from usage_events only — rolled-up daily rows do not preserve
    // per-session granularity. For queries that span the rollup boundary,
    // the coverage indicator reflects only the raw-event portion of the
    // window. Older data still contributes to token totals via the
    // union. Documented as a known limitation of tiered storage.
```

The existing Phase 1 tests all use data within the raw window so they still pass. Add one new test for the union path:

Add to `UsageQueryServiceTests.cs`:

```csharp
    [Fact]
    public void Query_WindowSpanningRollupBoundary_UnionsRawAndDaily()
    {
        using var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);

        // Seed a usage_daily row representing 60 days ago
        using (var cmd = conn.CreateCommand())
        {
            var oldDay = DateTimeOffset.UtcNow.AddDays(-60).ToUnixTimeSeconds();
            var dayFloor = (oldDay / 86400) * 86400;
            cmd.CommandText = @"
INSERT INTO usage_daily
  (day_utc, host, model, project,
   session_count, turn_count,
   input_tokens, cache_creation_tokens, cache_read_tokens, output_tokens)
VALUES ($day, 'claude-code', 'opus', '/p', 3, 10, 1000, 0, 0, 200)";
            cmd.Parameters.AddWithValue("$day", dayFloor);
            cmd.ExecuteNonQuery();
        }

        // Seed a raw event representing yesterday
        var log = new UsageEventLog(conn);
        var yesterday = DateTimeOffset.UtcNow.AddDays(-1).ToUnixTimeMilliseconds();
        log.InsertOrIgnore(E("claude-code", "recent", "s-recent", yesterday, input: 500, output: 50));

        var svc = new UsageQueryService(conn);
        var report = svc.Query(new UsageQuery(
            Start: DateTimeOffset.UtcNow.AddDays(-90),
            End: DateTimeOffset.UtcNow,
            HostFilter: null, ProjectFilter: null,
            GroupBy: GroupBy.Host, TopN: 0));

        // Grand total should include BOTH the raw event AND the rolled-up day
        Assert.Equal(1500L, report.GrandTotal.InputTokens);  // 500 recent + 1000 rolled
        Assert.Equal(250L, report.GrandTotal.OutputTokens);  // 50 recent + 200 rolled
        Assert.Equal(11L, report.GrandTotal.TurnCount);      // 1 recent + 10 rolled
    }
```

- [ ] **Step 9: Run tests to verify**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageQueryServiceTests" 2>&1 | tail -10
```

Expected: 7 tests passing (6 Phase 1 + 1 new union test).

- [ ] **Step 10: Commit**

```bash
git add src/TotalRecall.Infrastructure/Telemetry/UsageDailyRollup.cs \
        src/TotalRecall.Infrastructure/Usage/UsageIndexer.cs \
        src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs \
        src/TotalRecall.Server/ServerComposition.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/UsageDailyRollupTests.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/UsageQueryServiceTests.cs
git commit -m "feat(usage): rolling aggregation + raw/daily union in query layer

UsageDailyRollup aggregates events older than N days (default 30)
into usage_daily, then deletes the source rows inside a transaction.
Idempotent via INSERT OR REPLACE on composite PK. UsageIndexer triggers
rollup at most once per 24h; failures logged but non-blocking.
UsageQueryService now queries usage_events UNION ALL usage_daily so
long-window queries see the full history.
Part of Phase 2."
```

---

## Task 12: UsageCommand `--json` output

**Files:**
- Modify: `src/TotalRecall.Cli/Commands/UsageCommand.cs` — add `--json` flag + JSON emitter
- Modify: `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs` — add JSON tests

- [ ] **Step 1: Add failing JSON output tests**

Append to `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs`:

```csharp
    [Fact]
    public async Task RunAsync_JsonFlag_EmitsStableJsonShape()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, input: 100, output: 20));
            log.InsertOrIgnore(E("copilot-cli", "b", nowMs - 1000, input: null, output: 10));
        });
        var svc = new UsageQueryService(conn);
        var output = new StringWriter();
        var cmd = new UsageCommand(svc, output);

        var exit = await cmd.RunAsync(new[] { "--json" });
        Assert.Equal(0, exit);

        var json = output.ToString();
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(System.Text.Json.JsonValueKind.Object, root.ValueKind);
        Assert.True(root.TryGetProperty("query", out _));
        Assert.True(root.TryGetProperty("buckets", out var buckets));
        Assert.Equal(System.Text.Json.JsonValueKind.Array, buckets.ValueKind);
        Assert.Equal(2, buckets.GetArrayLength());
        Assert.True(root.TryGetProperty("grand_total", out _));
        Assert.True(root.TryGetProperty("coverage", out var cov));
        Assert.True(cov.TryGetProperty("fidelity_percent", out _));
    }

    [Fact]
    public async Task RunAsync_JsonFlag_NullTokensBecomeJsonNull()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("copilot-cli", "b", nowMs - 1000, input: null, output: 10));
        });
        var svc = new UsageQueryService(conn);
        var output = new StringWriter();
        var cmd = new UsageCommand(svc, output);

        await cmd.RunAsync(new[] { "--json" });

        using var doc = System.Text.Json.JsonDocument.Parse(output.ToString());
        var bucket = doc.RootElement.GetProperty("buckets")[0];
        Assert.Equal(System.Text.Json.JsonValueKind.Null, bucket.GetProperty("input_tokens").ValueKind);
        Assert.Equal(10, bucket.GetProperty("output_tokens").GetInt32());
    }
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageCommandTests" 2>&1 | tail -10
```

Expected: 2 new tests fail (`--json` flag unknown).

- [ ] **Step 3: Add `--json` flag parsing + JSON rendering to UsageCommand**

In `src/TotalRecall.Cli/Commands/UsageCommand.cs`, add the `--json` flag to `TryParseArgs`:

```csharp
    private bool TryParseArgs(
        string[] args,
        out TimeSpan window,
        out GroupBy groupBy,
        out IReadOnlyList<string>? hostFilter,
        out IReadOnlyList<string>? projectFilter,
        out int topN,
        out bool emitJson,                   // <-- NEW
        out string? error)
    {
        window = TimeSpan.FromDays(7);
        groupBy = GroupBy.Host;
        hostFilter = null;
        projectFilter = null;
        topN = 0;
        emitJson = false;                    // <-- NEW
        error = null;

        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            switch (a)
            {
                // ... existing cases unchanged ...
                case "--json":
                    emitJson = true;
                    break;
                default:
                    error = $"unknown argument: {a}";
                    return false;
            }
        }
        return true;
    }
```

Then in `RunAsync`, after the query runs, branch on `emitJson`:

```csharp
            var report = svc.Query(query);
            if (emitJson)
                RenderJson(report, query);
            else
                RenderTable(report, window, groupBy);
```

Add the `RenderJson` method. Hand-write the JSON to avoid JsonContext / source-gen complexity (following the existing CLI pattern of hand-rolled JSON in Memory/ExportCommand.cs):

```csharp
    private void RenderJson(UsageReport report, UsageQuery query)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append('{');

        // query block
        sb.Append("\"query\":{");
        sb.Append($"\"start_ms\":{query.Start.ToUnixTimeMilliseconds()},");
        sb.Append($"\"end_ms\":{query.End.ToUnixTimeMilliseconds()},");
        sb.Append($"\"group_by\":\"{query.GroupBy.ToString().ToLowerInvariant()}\",");
        sb.Append($"\"host_filter\":{JsonStringArrayOrNull(query.HostFilter)},");
        sb.Append($"\"project_filter\":{JsonStringArrayOrNull(query.ProjectFilter)}");
        sb.Append('}');

        // buckets array
        sb.Append(",\"buckets\":[");
        for (var i = 0; i < report.Buckets.Count; i++)
        {
            if (i > 0) sb.Append(',');
            AppendBucket(sb, report.Buckets[i]);
        }
        sb.Append(']');

        // grand_total
        sb.Append(",\"grand_total\":");
        AppendTotals(sb, report.GrandTotal);

        // coverage
        var full = report.SessionsWithFullTokenData;
        var partial = report.SessionsWithPartialTokenData;
        var totalSessions = full + partial;
        var pct = totalSessions == 0 ? 0.0 : 100.0 * full / totalSessions;
        sb.Append($",\"coverage\":{{\"sessions_with_full_token_data\":{full},");
        sb.Append($"\"sessions_with_partial_token_data\":{partial},");
        sb.Append($"\"fidelity_percent\":{pct.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}}}");

        sb.Append('}');
        _out.WriteLine(sb.ToString());
    }

    private static void AppendBucket(System.Text.StringBuilder sb, UsageBucket b)
    {
        sb.Append('{');
        sb.Append($"\"key\":{JsonEscape(b.Key)},");
        AppendTotalsBody(sb, b.Totals);
        sb.Append('}');
    }

    private static void AppendTotals(System.Text.StringBuilder sb, UsageTotals t)
    {
        sb.Append('{');
        AppendTotalsBody(sb, t);
        sb.Append('}');
    }

    private static void AppendTotalsBody(System.Text.StringBuilder sb, UsageTotals t)
    {
        sb.Append($"\"session_count\":{t.SessionCount},");
        sb.Append($"\"turn_count\":{t.TurnCount},");
        sb.Append($"\"input_tokens\":{JsonNullableLong(t.InputTokens)},");
        sb.Append($"\"cache_creation_tokens\":{JsonNullableLong(t.CacheCreationTokens)},");
        sb.Append($"\"cache_read_tokens\":{JsonNullableLong(t.CacheReadTokens)},");
        sb.Append($"\"output_tokens\":{JsonNullableLong(t.OutputTokens)}");
    }

    private static string JsonNullableLong(long? v) =>
        v is null ? "null" : v.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static string JsonStringArrayOrNull(IReadOnlyList<string>? list)
    {
        if (list is null) return "null";
        var sb = new System.Text.StringBuilder("[");
        for (var i = 0; i < list.Count; i++)
        {
            if (i > 0) sb.Append(',');
            sb.Append(JsonEscape(list[i]));
        }
        sb.Append(']');
        return sb.ToString();
    }

    private static string JsonEscape(string s)
    {
        var sb = new System.Text.StringBuilder("\"");
        foreach (var c in s)
        {
            switch (c)
            {
                case '"':  sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append($"\\u{(int)c:X4}");
                    else sb.Append(c);
                    break;
            }
        }
        sb.Append('"');
        return sb.ToString();
    }
```

Update the `TryParseArgs` call site to receive the new `emitJson` out var and thread it through.

- [ ] **Step 4: Run tests**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageCommandTests" 2>&1 | tail -10
```

Expected: 7 tests, 7 passing (5 from Phase 1 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Cli/Commands/UsageCommand.cs \
        tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs
git commit -m "feat(usage): --json output for total-recall usage

Hand-rolled JSON emitter (mirrors existing CLI pattern in
Memory/ExportCommand) to avoid JsonContext source-gen overhead.
Stable top-level shape: {query, buckets[], grand_total, coverage}.
Null token fields serialize as JSON null, not 0.
Part of Phase 2."
```

---

## Task 13: UsageStatusHandler — MCP tool `usage_status`

**Files:**
- Create: `src/TotalRecall.Server/Handlers/UsageStatusHandler.cs`
- Create: `tests/TotalRecall.Server.Tests/Handlers/UsageStatusHandlerTests.cs`
- Modify: `src/TotalRecall.Server/ServerComposition.cs` — register the handler

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Server.Tests/Handlers/UsageStatusHandlerTests.cs`:

```csharp
using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using TotalRecall.Server.Handlers;
using Xunit;

namespace TotalRecall.Server.Tests.Handlers;

public sealed class UsageStatusHandlerTests
{
    private static Microsoft.Data.Sqlite.SqliteConnection Seed(Action<UsageEventLog> seed)
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        seed(new UsageEventLog(conn));
        return conn;
    }

    private static UsageEvent E(string host, string eid, long ts, int? input, int? output) =>
        new UsageEvent(
            Host: host, HostEventId: eid, SessionId: "s", TimestampMs: ts,
            TurnIndex: 0, Model: "opus", ProjectPath: "/p", ProjectRepo: null,
            ProjectBranch: null, ProjectCommit: null, InteractionId: null,
            InputTokens: input, CacheCreation5m: null, CacheCreation1h: null,
            CacheRead: null, OutputTokens: output, ServiceTier: null,
            ServerToolUseJson: null, HostRequestId: null);

    [Fact]
    public async Task ExecuteAsync_EmptyArgs_ReturnsDefaultSevenDayReport()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, 100, 20));
        });
        var svc = new UsageQueryService(conn);
        var handler = new UsageStatusHandler(svc);

        var result = await handler.ExecuteAsync(null, CancellationToken.None);

        Assert.False(result.IsError);
        var text = result.Content![0].Text;
        Assert.NotNull(text);
        using var doc = JsonDocument.Parse(text!);
        Assert.True(doc.RootElement.TryGetProperty("buckets", out _));
    }

    [Fact]
    public async Task ExecuteAsync_WindowAndGroupByArgs_Honored()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, 100, 20));
        });
        var svc = new UsageQueryService(conn);
        var handler = new UsageStatusHandler(svc);

        var args = JsonDocument.Parse("{\"window\":\"5h\",\"group_by\":\"day\"}").RootElement;
        var result = await handler.ExecuteAsync(args, CancellationToken.None);

        Assert.False(result.IsError);
        using var doc = JsonDocument.Parse(result.Content![0].Text!);
        Assert.Equal("day", doc.RootElement.GetProperty("query").GetProperty("group_by").GetString());
    }

    [Fact]
    public async Task ExecuteAsync_InvalidWindow_ReturnsError()
    {
        using var conn = Seed(_ => { });
        var svc = new UsageQueryService(conn);
        var handler = new UsageStatusHandler(svc);

        var args = JsonDocument.Parse("{\"window\":\"bogus\"}").RootElement;
        var result = await handler.ExecuteAsync(args, CancellationToken.None);

        Assert.True(result.IsError);
    }

    [Fact]
    public void Name_And_InputSchema_StableShape()
    {
        using var conn = Seed(_ => { });
        var handler = new UsageStatusHandler(new UsageQueryService(conn));

        Assert.Equal("usage_status", handler.Name);
        Assert.NotNull(handler.InputSchema.ToString());
    }
}
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageStatusHandlerTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 3: Create `UsageStatusHandler.cs`**

Create `src/TotalRecall.Server/Handlers/UsageStatusHandler.cs`:

```csharp
// src/TotalRecall.Server/Handlers/UsageStatusHandler.cs
//
// MCP tool handler for `usage_status`. Reuses UsageQueryService and
// emits JSON identical in shape to `total-recall usage --json`. The
// tool lets an agent query its own burn rate explicitly (e.g., before
// starting an expensive plan).
//
// Input schema mirrors the CLI flags so the LLM's mental model is
// consistent: window (5h|1d|7d|30d|90d|all), group_by (host|project|
// day|model|session|none), host, project, top. All fields optional;
// defaults match the CLI defaults.

using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using TotalRecall.Infrastructure.Usage;

namespace TotalRecall.Server.Handlers;

public sealed class UsageStatusHandler : IToolHandler
{
    private static readonly JsonElement _inputSchema = JsonDocument.Parse("""
        {
          "type": "object",
          "properties": {
            "window":   { "type": "string", "enum": ["5h","1d","7d","30d","90d","all"], "default": "7d" },
            "group_by": { "type": "string", "enum": ["host","project","day","model","session","none"], "default": "host" },
            "host":     { "type": "string" },
            "project":  { "type": "string" },
            "top":      { "type": "integer", "minimum": 1 }
          }
        }
        """).RootElement.Clone();

    private readonly UsageQueryService _query;

    public UsageStatusHandler(UsageQueryService query)
    {
        _query = query ?? throw new ArgumentNullException(nameof(query));
    }

    public string Name => "usage_status";

    public string Description =>
        "Get token usage across hosts (claude-code, copilot-cli, ...). " +
        "Use for visibility reports (last 7 days, group by host/project/day/model) " +
        "and for current quota state (last 5h window for claude-code).";

    public JsonElement InputSchema => _inputSchema;

    public Task<ToolCallResult> ExecuteAsync(JsonElement? arguments, CancellationToken ct)
    {
        var window = TimeSpan.FromDays(7);
        var groupBy = GroupBy.Host;
        IReadOnlyList<string>? hostFilter = null;
        IReadOnlyList<string>? projectFilter = null;
        int topN = 0;

        if (arguments is JsonElement args && args.ValueKind == JsonValueKind.Object)
        {
            if (args.TryGetProperty("window", out var w) && w.ValueKind == JsonValueKind.String)
            {
                if (!TryParseWindow(w.GetString()!, out window))
                    return Task.FromResult(Error($"window: unknown value '{w.GetString()}'"));
            }
            if (args.TryGetProperty("group_by", out var g) && g.ValueKind == JsonValueKind.String)
            {
                if (!TryParseGroupBy(g.GetString()!, out groupBy))
                    return Task.FromResult(Error($"group_by: unknown value '{g.GetString()}'"));
            }
            if (args.TryGetProperty("host", out var h) && h.ValueKind == JsonValueKind.String)
                hostFilter = new[] { h.GetString()! };
            if (args.TryGetProperty("project", out var p) && p.ValueKind == JsonValueKind.String)
                projectFilter = new[] { p.GetString()! };
            if (args.TryGetProperty("top", out var t) && t.ValueKind == JsonValueKind.Number && t.TryGetInt32(out var top))
                topN = top;
        }

        var now = DateTimeOffset.UtcNow;
        var query = new UsageQuery(now - window, now, hostFilter, projectFilter, groupBy, topN);
        var report = _query.Query(query);

        var json = BuildJson(report, query);
        return Task.FromResult(new ToolCallResult
        {
            Content = new[] { new ToolContent { Type = "text", Text = json } },
            IsError = false,
        });
    }

    // -------- parsing --------

    private static bool TryParseWindow(string s, out TimeSpan window)
    {
        window = default;
        return s switch
        {
            "5h"  => (window = TimeSpan.FromHours(5)) != default,
            "1d"  => (window = TimeSpan.FromDays(1)) != default,
            "7d"  => (window = TimeSpan.FromDays(7)) != default,
            "30d" => (window = TimeSpan.FromDays(30)) != default,
            "90d" => (window = TimeSpan.FromDays(90)) != default,
            "all" => (window = TimeSpan.FromDays(36500)) != default,
            _ => false,
        };
    }

    private static bool TryParseGroupBy(string s, out GroupBy g) => s switch
    {
        "host"    => (g = GroupBy.Host) == GroupBy.Host,
        "project" => (g = GroupBy.Project) == GroupBy.Project,
        "day"     => (g = GroupBy.Day) == GroupBy.Day,
        "model"   => (g = GroupBy.Model) == GroupBy.Model,
        "session" => (g = GroupBy.Session) == GroupBy.Session,
        "none"    => (g = GroupBy.None) == GroupBy.None,
        _         => (g = GroupBy.Host) == GroupBy.None, // always false
    };

    // -------- JSON rendering (mirrors UsageCommand.RenderJson shape) --------

    private static string BuildJson(UsageReport report, UsageQuery query)
    {
        var sb = new StringBuilder();
        sb.Append('{');
        sb.Append("\"query\":{");
        sb.Append($"\"start_ms\":{query.Start.ToUnixTimeMilliseconds()},");
        sb.Append($"\"end_ms\":{query.End.ToUnixTimeMilliseconds()},");
        sb.Append($"\"group_by\":\"{query.GroupBy.ToString().ToLowerInvariant()}\",");
        sb.Append($"\"host_filter\":{StringsOrNull(query.HostFilter)},");
        sb.Append($"\"project_filter\":{StringsOrNull(query.ProjectFilter)}");
        sb.Append("},");

        sb.Append("\"buckets\":[");
        for (var i = 0; i < report.Buckets.Count; i++)
        {
            if (i > 0) sb.Append(',');
            var b = report.Buckets[i];
            sb.Append('{');
            sb.Append($"\"key\":{Esc(b.Key)},");
            AppendTotalsBody(sb, b.Totals);
            sb.Append('}');
        }
        sb.Append("],");

        sb.Append("\"grand_total\":{");
        AppendTotalsBody(sb, report.GrandTotal);
        sb.Append("},");

        var full = report.SessionsWithFullTokenData;
        var partial = report.SessionsWithPartialTokenData;
        var total = full + partial;
        var pct = total == 0 ? 0.0 : 100.0 * full / total;
        sb.Append("\"coverage\":{");
        sb.Append($"\"sessions_with_full_token_data\":{full},");
        sb.Append($"\"sessions_with_partial_token_data\":{partial},");
        sb.Append($"\"fidelity_percent\":{pct.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}");
        sb.Append('}');

        sb.Append('}');
        return sb.ToString();
    }

    private static void AppendTotalsBody(StringBuilder sb, UsageTotals t)
    {
        sb.Append($"\"session_count\":{t.SessionCount},");
        sb.Append($"\"turn_count\":{t.TurnCount},");
        sb.Append($"\"input_tokens\":{NullableLong(t.InputTokens)},");
        sb.Append($"\"cache_creation_tokens\":{NullableLong(t.CacheCreationTokens)},");
        sb.Append($"\"cache_read_tokens\":{NullableLong(t.CacheReadTokens)},");
        sb.Append($"\"output_tokens\":{NullableLong(t.OutputTokens)}");
    }

    private static string NullableLong(long? v) =>
        v is null ? "null" : v.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static string StringsOrNull(IReadOnlyList<string>? list)
    {
        if (list is null) return "null";
        var sb = new StringBuilder("[");
        for (var i = 0; i < list.Count; i++)
        {
            if (i > 0) sb.Append(',');
            sb.Append(Esc(list[i]));
        }
        sb.Append(']');
        return sb.ToString();
    }

    private static string Esc(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (var c in s)
        {
            switch (c)
            {
                case '"':  sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append($"\\u{(int)c:X4}");
                    else sb.Append(c);
                    break;
            }
        }
        sb.Append('"');
        return sb.ToString();
    }

    private static ToolCallResult Error(string message) => new ToolCallResult
    {
        Content = new[] { new ToolContent { Type = "text", Text = message } },
        IsError = true,
    };
}
```

Note: the `TryParseGroupBy` trick `(g = GroupBy.X) == GroupBy.X` always evaluates to true for valid inputs and `== GroupBy.None` to false for unknowns; it's a compact idiom to both assign and return success. If you prefer clarity, replace with an explicit switch + out bool.

- [ ] **Step 4: Register handler in ServerComposition**

In `src/TotalRecall.Server/ServerComposition.cs`, find where other handlers are registered (around line 130-150) and add:

```csharp
registry.Register(new UsageStatusHandler(new UsageQueryService(conn)));
```

Also update the `BuildRegistry` method signature if needed to thread `conn` through. If `conn` is already in scope where handlers are built, the change is a one-liner.

- [ ] **Step 5: Run tests**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageStatusHandlerTests" 2>&1 | tail -10
```

Expected: 4 tests, 4 passing.

- [ ] **Step 6: Run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -10
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/TotalRecall.Server/Handlers/UsageStatusHandler.cs \
        src/TotalRecall.Server/ServerComposition.cs \
        tests/TotalRecall.Server.Tests/Handlers/UsageStatusHandlerTests.cs
git commit -m "feat(usage): usage_status MCP tool

New tool handler wraps UsageQueryService with a JSON-shaped response
identical to 'total-recall usage --json'. Input schema mirrors CLI
flags (window, group_by, host, project, top) so LLM and CLI usage
are consistent.
End of Phase 2."
```

- [ ] **Step 8: Phase 2 checkpoint**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | grep -E 'Passed!'
```

Expected: Phase 1 total + ~17 new tests from Phase 2 = ~989 passing.

---

# PHASE 3 — Quota nudging

Plan registry + evaluator + nudge composer + session_start injection. By end of Phase 3, `session_start` includes a two-line quota nudge at the top of the context field.

## Task 14: QuotaPlan records + embedded plans.json

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/QuotaPlan.cs` — records
- Create: `src/TotalRecall.Infrastructure/Usage/plans.json` — embedded resource
- Modify: `src/TotalRecall.Infrastructure/TotalRecall.Infrastructure.csproj` — embed the resource

- [ ] **Step 1: Create `QuotaPlan.cs`**

```csharp
// src/TotalRecall.Infrastructure/Usage/QuotaPlan.cs
//
// Plan definition records. Populated from embedded plans.json at boot
// (via QuotaPlanRegistry) and overridable by config.toml. See spec §7.1.

using System;
using System.Collections.Generic;

namespace TotalRecall.Infrastructure.Usage;

public enum WindowKind { Rolling, CalendarWeek, CalendarMonth }

public sealed record QuotaPlan(
    string Host,
    string PlanId,
    string DisplayName,
    IReadOnlyList<QuotaWindowSpec> Windows);

public sealed record QuotaWindowSpec(
    string WindowId,
    TimeSpan Duration,
    WindowKind Kind,
    long? TokenLimit,
    long? MessageLimit);
```

- [ ] **Step 2: Create `plans.json` (exact content from spec §7.2)**

Create `src/TotalRecall.Infrastructure/Usage/plans.json`:

```json
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

- [ ] **Step 3: Embed the resource in the csproj**

In `src/TotalRecall.Infrastructure/TotalRecall.Infrastructure.csproj`, before the closing `</Project>` tag, add:

```xml
  <ItemGroup>
    <EmbeddedResource Include="Usage/plans.json" />
  </ItemGroup>
```

- [ ] **Step 4: Build to verify resource embeds**

```bash
dotnet build src/TotalRecall.Infrastructure/TotalRecall.Infrastructure.csproj -c Debug --nologo 2>&1 | tail -5
```

Expected: Build succeeded, 0 warnings, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/QuotaPlan.cs \
        src/TotalRecall.Infrastructure/Usage/plans.json \
        src/TotalRecall.Infrastructure/TotalRecall.Infrastructure.csproj
git commit -m "feat(usage): QuotaPlan records + embedded plans.json

Data types for built-in plan definitions. plans.json ships with
approximate numbers for Claude Pro/Max 5x/Max 20x and Copilot Pro;
every entry has a 'note' field inviting verification against current
billing pages (silently ignored at runtime). Part of Phase 3."
```

---

## Task 15: QuotaPlanRegistry — load embedded + config overrides

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/QuotaPlanRegistry.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaPlanRegistryTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaPlanRegistryTests.cs`:

```csharp
using System.Collections.Generic;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class QuotaPlanRegistryTests
{
    [Fact]
    public void LoadEmbedded_Contains_ClaudeCode_And_CopilotCli_Plans()
    {
        var registry = QuotaPlanRegistry.LoadEmbedded();

        var ccPlans = registry.PlansForHost("claude-code");
        Assert.Contains(ccPlans, p => p.PlanId == "pro");
        Assert.Contains(ccPlans, p => p.PlanId == "max_5x");
        Assert.Contains(ccPlans, p => p.PlanId == "max_20x");

        var copPlans = registry.PlansForHost("copilot-cli");
        Assert.Contains(copPlans, p => p.PlanId == "copilot_pro");
    }

    [Fact]
    public void LoadEmbedded_ClaudeCodePro_HasFiveHourWindow()
    {
        var registry = QuotaPlanRegistry.LoadEmbedded();
        var pro = registry.Lookup("claude-code", "pro");

        Assert.NotNull(pro);
        var w = Assert.Single(pro!.Windows);
        Assert.Equal("5h_rolling", w.WindowId);
        Assert.Equal(System.TimeSpan.FromHours(5), w.Duration);
        Assert.Equal(WindowKind.Rolling, w.Kind);
        Assert.Equal(45L, w.MessageLimit);
        Assert.Null(w.TokenLimit);
    }

    [Fact]
    public void Lookup_UnknownPlan_ReturnsNull()
    {
        var registry = QuotaPlanRegistry.LoadEmbedded();

        Assert.Null(registry.Lookup("claude-code", "nonexistent"));
        Assert.Null(registry.Lookup("unknown-host", "pro"));
    }

    [Fact]
    public void ActivePlanFor_WithoutConfig_ReturnsNull()
    {
        var registry = QuotaPlanRegistry.LoadEmbedded();
        // No config_active map passed — ActivePlanFor should return null
        Assert.Null(registry.ActivePlanFor("claude-code"));
    }

    [Fact]
    public void ActivePlanFor_WithConfig_ReturnsPlan()
    {
        var active = new Dictionary<string, string>(System.StringComparer.Ordinal)
        {
            ["claude-code"] = "max_5x",
        };
        var registry = QuotaPlanRegistry.LoadEmbedded(activePlansFromConfig: active);

        var plan = registry.ActivePlanFor("claude-code");
        Assert.NotNull(plan);
        Assert.Equal("max_5x", plan!.PlanId);
    }
}
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~QuotaPlanRegistryTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 3: Create `QuotaPlanRegistry.cs`**

```csharp
// src/TotalRecall.Infrastructure/Usage/QuotaPlanRegistry.cs
//
// Loads embedded plans.json at boot and merges any user config overrides
// on top. Config override loading is a separate concern handled by the
// caller — this class just accepts a pre-parsed "active plans" map and
// an optional "custom plans" list. See spec §7.1.
//
// Defensive loading: malformed entries in the override list are caught
// and skipped per-entry (stderr warning, others still load). Embedded
// JSON is assumed well-formed since it's a compile-time resource.

using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text.Json;

namespace TotalRecall.Infrastructure.Usage;

public sealed class QuotaPlanRegistry
{
    private readonly Dictionary<(string Host, string PlanId), QuotaPlan> _plans;
    private readonly Dictionary<string, string> _activePlanByHost;

    private QuotaPlanRegistry(
        Dictionary<(string, string), QuotaPlan> plans,
        Dictionary<string, string> activePlanByHost)
    {
        _plans = plans;
        _activePlanByHost = activePlanByHost;
    }

    /// <summary>
    /// Load plans.json from the embedded resource. Optionally merge
    /// per-host "active plan" pointers from config.
    /// </summary>
    public static QuotaPlanRegistry LoadEmbedded(
        IReadOnlyDictionary<string, string>? activePlansFromConfig = null)
    {
        var asm = typeof(QuotaPlanRegistry).Assembly;
        var resourceName = "TotalRecall.Infrastructure.Usage.plans.json";
        using var stream = asm.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource not found: {resourceName}");
        using var reader = new StreamReader(stream);
        var json = reader.ReadToEnd();

        var plans = ParsePlans(json);
        var active = new Dictionary<string, string>(StringComparer.Ordinal);
        if (activePlansFromConfig is not null)
        {
            foreach (var (host, planId) in activePlansFromConfig)
                active[host] = planId;
        }
        return new QuotaPlanRegistry(plans, active);
    }

    public QuotaPlan? Lookup(string host, string planId)
    {
        ArgumentNullException.ThrowIfNull(host);
        ArgumentNullException.ThrowIfNull(planId);
        return _plans.GetValueOrDefault((host, planId));
    }

    public IReadOnlyList<QuotaPlan> PlansForHost(string host)
    {
        var list = new List<QuotaPlan>();
        foreach (var ((h, _), plan) in _plans)
            if (h == host) list.Add(plan);
        return list;
    }

    public QuotaPlan? ActivePlanFor(string host)
    {
        if (!_activePlanByHost.TryGetValue(host, out var planId)) return null;
        return Lookup(host, planId);
    }

    // -------- parser --------

    private static Dictionary<(string, string), QuotaPlan> ParsePlans(string json)
    {
        var dict = new Dictionary<(string, string), QuotaPlan>();
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.ValueKind != JsonValueKind.Array) return dict;

        foreach (var planEl in doc.RootElement.EnumerateArray())
        {
            try
            {
                var host = planEl.GetProperty("host").GetString()!;
                var planId = planEl.GetProperty("plan_id").GetString()!;
                var displayName = planEl.GetProperty("display_name").GetString()!;
                var windows = new List<QuotaWindowSpec>();
                if (planEl.TryGetProperty("windows", out var wArr) && wArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var wEl in wArr.EnumerateArray())
                    {
                        var wId = wEl.GetProperty("window_id").GetString()!;
                        var durS = wEl.GetProperty("duration_s").GetInt64();
                        var kindStr = wEl.GetProperty("kind").GetString();
                        var kind = kindStr switch
                        {
                            "rolling"        => WindowKind.Rolling,
                            "calendar_week"  => WindowKind.CalendarWeek,
                            "calendar_month" => WindowKind.CalendarMonth,
                            _ => WindowKind.Rolling,
                        };
                        long? tokenLimit = wEl.TryGetProperty("token_limit", out var tl) && tl.ValueKind == JsonValueKind.Number
                            ? tl.GetInt64() : null;
                        long? messageLimit = wEl.TryGetProperty("message_limit", out var ml) && ml.ValueKind == JsonValueKind.Number
                            ? ml.GetInt64() : null;
                        windows.Add(new QuotaWindowSpec(wId, TimeSpan.FromSeconds(durS), kind, tokenLimit, messageLimit));
                    }
                }
                dict[(host, planId)] = new QuotaPlan(host, planId, displayName, windows);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(
                    $"total-recall: QuotaPlanRegistry: skipping malformed plan entry ({ex.Message})");
            }
        }
        return dict;
    }
}
```

- [ ] **Step 4: Run tests**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~QuotaPlanRegistryTests" 2>&1 | tail -10
```

Expected: 5 tests, 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/QuotaPlanRegistry.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/QuotaPlanRegistryTests.cs
git commit -m "feat(usage): QuotaPlanRegistry — load embedded plans + config overrides

Loads plans.json from embedded resource, merges caller-provided
active-plan map. Per-entry try/catch isolates malformed entries
so one bad config override can't take down the whole registry.
Part of Phase 3."
```

---

## Task 16: QuotaEvaluator — pure evaluator with descriptive fallback

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/QuotaEvaluation.cs` — records
- Create: `src/TotalRecall.Infrastructure/Usage/QuotaEvaluator.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaEvaluatorTests.cs`

- [ ] **Step 1: Create `QuotaEvaluation.cs`**

```csharp
// src/TotalRecall.Infrastructure/Usage/QuotaEvaluation.cs
//
// Result types for QuotaEvaluator. Kept in a separate file to keep
// QuotaEvaluator.cs focused on logic. See spec §7.3.

using System;

namespace TotalRecall.Infrastructure.Usage;

public enum Severity { Info, Warning, Critical, Descriptive }

public sealed record QuotaEvaluation(
    string Host,
    Severity Severity,
    string NudgeLine,
    QuotaEvaluationDetail? HardQuota,
    DescriptiveComparison? Descriptive);

public sealed record QuotaEvaluationDetail(
    string WindowId,
    DateTimeOffset WindowEnd,
    long Used,
    long Limit,
    double PercentUsed,
    string UnitLabel);

public sealed record DescriptiveComparison(
    long Current,
    long AverageBaseline,
    double DeltaPercent,
    string UnitLabel);
```

- [ ] **Step 2: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaEvaluatorTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using TotalRecall.Infrastructure.Storage;
using TotalRecall.Infrastructure.Telemetry;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class QuotaEvaluatorTests
{
    private static Microsoft.Data.Sqlite.SqliteConnection Seed(Action<UsageEventLog> seed)
    {
        var conn = TotalRecall.Infrastructure.Storage.SqliteConnection.Open(":memory:");
        MigrationRunner.RunMigrations(conn);
        seed(new UsageEventLog(conn));
        return conn;
    }

    private static UsageEvent E(string host, string eid, long ts, int? input, int? output) =>
        new UsageEvent(
            Host: host, HostEventId: eid, SessionId: "s-" + eid, TimestampMs: ts,
            TurnIndex: 0, Model: "opus", ProjectPath: "/p", ProjectRepo: null,
            ProjectBranch: null, ProjectCommit: null, InteractionId: null,
            InputTokens: input, CacheCreation5m: null, CacheCreation1h: null,
            CacheRead: null, OutputTokens: output, ServiceTier: null,
            ServerToolUseJson: null, HostRequestId: null);

    private static QuotaEvaluator NewEval(
        Microsoft.Data.Sqlite.SqliteConnection conn,
        QuotaPlanRegistry registry)
    {
        var svc = new UsageQueryService(conn);
        return new QuotaEvaluator(svc, registry);
    }

    [Fact]
    public void Evaluate_NoPlan_ReturnsDescriptive()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, input: 100, output: 20));
        });
        // Registry loaded with NO active plan
        var registry = QuotaPlanRegistry.LoadEmbedded();
        var evalr = NewEval(conn, registry);

        var result = evalr.EvaluateHost("claude-code");

        Assert.Equal(Severity.Descriptive, result.Severity);
        Assert.NotNull(result.Descriptive);
        Assert.Null(result.HardQuota);
    }

    [Fact]
    public void Evaluate_MessageLimit_UnderThreshold_Info()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            // 20 messages in last 5h, limit is 45 (Claude Pro), ratio ~44% → Info
            for (var i = 0; i < 20; i++)
                log.InsertOrIgnore(E("claude-code", $"a{i}", nowMs - 1000 - i, input: 100, output: 20));
        });
        var registry = QuotaPlanRegistry.LoadEmbedded(
            new Dictionary<string, string> { ["claude-code"] = "pro" });
        var evalr = NewEval(conn, registry);

        var result = evalr.EvaluateHost("claude-code");

        Assert.Equal(Severity.Info, result.Severity);
        Assert.NotNull(result.HardQuota);
        Assert.Equal(20L, result.HardQuota!.Used);
        Assert.Equal(45L, result.HardQuota.Limit);
        Assert.Equal("messages", result.HardQuota.UnitLabel);
    }

    [Fact]
    public void Evaluate_MessageLimit_OverWarning_Warning()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            // 38 messages / 45 = 84% → Warning
            for (var i = 0; i < 38; i++)
                log.InsertOrIgnore(E("claude-code", $"a{i}", nowMs - 1000 - i, input: 100, output: 20));
        });
        var registry = QuotaPlanRegistry.LoadEmbedded(
            new Dictionary<string, string> { ["claude-code"] = "pro" });
        var evalr = NewEval(conn, registry);

        var result = evalr.EvaluateHost("claude-code");

        Assert.Equal(Severity.Warning, result.Severity);
    }

    [Fact]
    public void Evaluate_MessageLimit_OverCritical_Critical()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            // 44 messages / 45 = 97% → Critical
            for (var i = 0; i < 44; i++)
                log.InsertOrIgnore(E("claude-code", $"a{i}", nowMs - 1000 - i, input: 100, output: 20));
        });
        var registry = QuotaPlanRegistry.LoadEmbedded(
            new Dictionary<string, string> { ["claude-code"] = "pro" });
        var evalr = NewEval(conn, registry);

        var result = evalr.EvaluateHost("claude-code");

        Assert.Equal(Severity.Critical, result.Severity);
    }

    [Fact]
    public void Evaluate_HostWithNoEvents_DescriptiveWithZero()
    {
        using var conn = Seed(_ => { });
        var registry = QuotaPlanRegistry.LoadEmbedded();
        var evalr = NewEval(conn, registry);

        var result = evalr.EvaluateHost("claude-code");

        Assert.Equal(Severity.Descriptive, result.Severity);
        Assert.NotNull(result.Descriptive);
        Assert.Equal(0L, result.Descriptive!.Current);
    }
}
```

- [ ] **Step 3: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~QuotaEvaluatorTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 4: Create `QuotaEvaluator.cs`**

```csharp
// src/TotalRecall.Infrastructure/Usage/QuotaEvaluator.cs
//
// Evaluates a host's current usage against its configured plan (or
// descriptive fallback if no plan). One QuotaEvaluation per host per
// session_start. See spec §7.3.
//
// Default thresholds: warning at 80%, critical at 95%. Configurable
// via constructor (config-driven from [usage.quota] section).

using System;
using System.Globalization;

namespace TotalRecall.Infrastructure.Usage;

public sealed class QuotaEvaluator
{
    private readonly UsageQueryService _query;
    private readonly QuotaPlanRegistry _registry;
    private readonly double _warningThreshold;
    private readonly double _criticalThreshold;
    private readonly int _descriptiveBaselineDays;

    public QuotaEvaluator(
        UsageQueryService query,
        QuotaPlanRegistry registry,
        double warningThreshold = 0.80,
        double criticalThreshold = 0.95,
        int descriptiveBaselineDays = 7)
    {
        _query = query ?? throw new ArgumentNullException(nameof(query));
        _registry = registry ?? throw new ArgumentNullException(nameof(registry));
        _warningThreshold = warningThreshold;
        _criticalThreshold = criticalThreshold;
        _descriptiveBaselineDays = descriptiveBaselineDays;
    }

    public QuotaEvaluation EvaluateHost(string host)
    {
        var plan = _registry.ActivePlanFor(host);
        if (plan is null) return BuildDescriptiveOnly(host);

        // Phase 3 evaluates the first window only (Claude Code's 5h
        // rolling, Copilot CLI's monthly). Multi-window plans can layer
        // on later by returning multiple evaluations per host.
        var window = plan.Windows.Count > 0 ? plan.Windows[0] : null;
        if (window is null) return BuildDescriptiveOnly(host);

        var now = DateTimeOffset.UtcNow;
        var windowStart = now - window.Duration;
        var report = _query.Query(new UsageQuery(
            Start: windowStart,
            End: now,
            HostFilter: new[] { host },
            ProjectFilter: null,
            GroupBy: GroupBy.None,
            TopN: 0));

        long? metric = null;
        long? limit = null;
        string unit = "messages";

        // Token-limit plans need actual token counts (Claude Code can supply;
        // Copilot CLI cannot because input_tokens is always null).
        if (window.TokenLimit is long tl && report.GrandTotal.InputTokens is long input)
        {
            metric = input
                + (report.GrandTotal.OutputTokens ?? 0)
                + (report.GrandTotal.CacheCreationTokens ?? 0);
            limit = tl;
            unit = "tokens";
        }
        else if (window.MessageLimit is long ml)
        {
            metric = report.GrandTotal.TurnCount;
            limit = ml;
            unit = "messages";
        }

        if (metric is null || limit is null || limit == 0)
            return BuildDescriptiveOnly(host);

        var ratio = (double)metric.Value / limit.Value;
        var severity = ratio >= _criticalThreshold ? Severity.Critical
                     : ratio >= _warningThreshold  ? Severity.Warning
                     :                                Severity.Info;

        var windowEnd = now + window.Duration; // rough reset hint for rolling
        var detail = new QuotaEvaluationDetail(
            WindowId: window.WindowId,
            WindowEnd: windowEnd,
            Used: metric.Value,
            Limit: limit.Value,
            PercentUsed: Math.Round(ratio * 100, 1),
            UnitLabel: unit);

        var line = FormatHardLine(host, detail, severity);
        return new QuotaEvaluation(host, severity, line, detail, Descriptive: null);
    }

    private QuotaEvaluation BuildDescriptiveOnly(string host)
    {
        var now = DateTimeOffset.UtcNow;
        var recent = _query.Query(new UsageQuery(
            Start: now - TimeSpan.FromHours(5),
            End: now,
            HostFilter: new[] { host },
            ProjectFilter: null,
            GroupBy: GroupBy.None,
            TopN: 0));

        var baselineWindow = TimeSpan.FromDays(_descriptiveBaselineDays);
        var baseline = _query.Query(new UsageQuery(
            Start: now - baselineWindow,
            End: now,
            HostFilter: new[] { host },
            ProjectFilter: null,
            GroupBy: GroupBy.None,
            TopN: 0));

        // Current = turns in the last 5h
        var current = recent.GrandTotal.TurnCount;
        // Baseline = average turns per 5h across the 7-day window
        var windows5hInBaseline = Math.Max(1L, (long)(baselineWindow.TotalHours / 5.0));
        var avg = baseline.GrandTotal.TurnCount / windows5hInBaseline;
        var delta = avg == 0
            ? 0.0
            : Math.Round(((double)current - avg) / avg * 100, 1);

        var descriptive = new DescriptiveComparison(
            Current: current,
            AverageBaseline: avg,
            DeltaPercent: delta,
            UnitLabel: "messages");

        var sign = delta >= 0 ? "+" : "";
        var line = $"{host}: {current} messages in last 5h " +
                   $"({sign}{delta.ToString("F0", CultureInfo.InvariantCulture)}% vs {_descriptiveBaselineDays}d avg)";

        return new QuotaEvaluation(host, Severity.Descriptive, line, HardQuota: null, Descriptive: descriptive);
    }

    private static string FormatHardLine(string host, QuotaEvaluationDetail d, Severity sev)
    {
        var prefix = sev == Severity.Critical ? "⚠ " : "";
        var suffix = sev == Severity.Critical ? " — defer non-urgent calls" : "";
        var resetLocal = d.WindowEnd.ToLocalTime().ToString("h:mm tt", CultureInfo.InvariantCulture);
        return $"{prefix}{host} at {d.PercentUsed.ToString("F0", CultureInfo.InvariantCulture)}% " +
               $"of {d.WindowId} window ({d.Used}/{d.Limit} {d.UnitLabel}, reset {resetLocal}){suffix}";
    }
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~QuotaEvaluatorTests" 2>&1 | tail -10
```

Expected: 5 tests, 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/QuotaEvaluation.cs \
        src/TotalRecall.Infrastructure/Usage/QuotaEvaluator.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/QuotaEvaluatorTests.cs
git commit -m "feat(usage): QuotaEvaluator with hybrid plan + descriptive fallback

Evaluates current burn against configured plan's first window. Token
limits require full token data (Claude Code); message limits work for
both hosts. Descriptive fallback fires when no plan is configured or
when the plan's unit doesn't match available host fidelity. Default
thresholds: warning 80%, critical 95%. Part of Phase 3."
```

---

## Task 17: QuotaNudgeComposer — format evaluations for session_start

**Files:**
- Create: `src/TotalRecall.Infrastructure/Usage/QuotaNudgeComposer.cs`
- Create: `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaNudgeComposerTests.cs`

- [ ] **Step 1: Write failing tests**

Create `tests/TotalRecall.Infrastructure.Tests/Usage/QuotaNudgeComposerTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using TotalRecall.Infrastructure.Usage;
using Xunit;

namespace TotalRecall.Infrastructure.Tests.Usage;

public sealed class QuotaNudgeComposerTests
{
    private static QuotaEvaluation Ev(string host, Severity sev, string line) =>
        new QuotaEvaluation(host, sev, line, HardQuota: null, Descriptive: null);

    [Fact]
    public void Compose_SingleInfo_ReturnsSingleLine()
    {
        var composer = new QuotaNudgeComposer(maxFirstLineLength: 280);
        var output = composer.Compose(new[]
        {
            Ev("claude-code", Severity.Info, "claude-code at 68% of 5h_rolling window (245/360 tokens, reset 3:40 PM)"),
        });

        Assert.Contains("claude-code at 68%", output);
        Assert.Single(output.Split('\n'));
    }

    [Fact]
    public void Compose_MultipleHosts_JoinedWithSemicolon()
    {
        var composer = new QuotaNudgeComposer(maxFirstLineLength: 280);
        var output = composer.Compose(new[]
        {
            Ev("claude-code", Severity.Info, "claude-code at 68% of 5h_rolling (245/360 tokens)"),
            Ev("copilot-cli", Severity.Descriptive, "copilot-cli: 27 messages in last 5h (+78% vs 7d avg)"),
        });

        Assert.Contains("claude-code at 68%", output);
        Assert.Contains("copilot-cli: 27", output);
        Assert.Contains("; ", output);
    }

    [Fact]
    public void Compose_Empty_ReturnsEmptyString()
    {
        var composer = new QuotaNudgeComposer(maxFirstLineLength: 280);
        Assert.Equal(string.Empty, composer.Compose(Array.Empty<QuotaEvaluation>()));
    }

    [Fact]
    public void Compose_OverCap_DropsLowestSeverityFirst()
    {
        // Tiny cap forces drops
        var composer = new QuotaNudgeComposer(maxFirstLineLength: 60);
        var output = composer.Compose(new[]
        {
            Ev("claude-code", Severity.Critical, "claude-code at 96% CRITICAL"),
            Ev("copilot-cli", Severity.Descriptive, "copilot-cli: 27 msgs last 5h (+78%)"),
        });

        // Critical must be preserved; Descriptive dropped.
        Assert.Contains("claude-code at 96% CRITICAL", output);
        Assert.DoesNotContain("copilot-cli", output);
        Assert.Contains("(+1 more)", output); // indicator
    }

    [Fact]
    public void Compose_CriticalAlwaysPreserved_EvenWithTinyCap()
    {
        var composer = new QuotaNudgeComposer(maxFirstLineLength: 10);
        var output = composer.Compose(new[]
        {
            Ev("claude-code", Severity.Critical, "claude-code at 97%"),
        });

        Assert.Contains("claude-code", output);
    }
}
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~QuotaNudgeComposerTests" 2>&1 | tail -10
```

Expected: compile failure.

- [ ] **Step 3: Create `QuotaNudgeComposer.cs`**

```csharp
// src/TotalRecall.Infrastructure/Usage/QuotaNudgeComposer.cs
//
// Formats a list of QuotaEvaluation records into a single-line
// semicolon-separated string for session_start injection. Enforces
// a max length on the first line only; drops lowest-severity hosts
// first (Descriptive → Info → Warning) when over the cap, but NEVER
// drops Critical. See spec §6.5 + §7.4.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace TotalRecall.Infrastructure.Usage;

public sealed class QuotaNudgeComposer
{
    private readonly int _maxFirstLineLength;

    public QuotaNudgeComposer(int maxFirstLineLength = 280)
    {
        _maxFirstLineLength = maxFirstLineLength;
    }

    public string Compose(IReadOnlyList<QuotaEvaluation> evaluations)
    {
        if (evaluations is null || evaluations.Count == 0) return string.Empty;

        // Order by severity (Critical > Warning > Info > Descriptive) so
        // drop-order is "keep most important". Ties broken by input order.
        var ordered = evaluations
            .Select((e, i) => (Eval: e, Idx: i))
            .OrderBy(t => SeverityRank(t.Eval.Severity))
            .ThenBy(t => t.Idx)
            .Select(t => t.Eval)
            .ToList();

        // Greedy: include highest-severity entries first until adding
        // another would push past the cap. Critical is never dropped,
        // even if it alone exceeds the cap.
        var included = new List<QuotaEvaluation>();
        int currentLen = "Usage: ".Length;
        int droppedCount = 0;

        foreach (var e in ordered)
        {
            var delta = (included.Count == 0 ? e.NudgeLine.Length : "; ".Length + e.NudgeLine.Length);
            if (e.Severity == Severity.Critical || currentLen + delta <= _maxFirstLineLength)
            {
                included.Add(e);
                currentLen += delta;
            }
            else
            {
                droppedCount++;
            }
        }

        if (included.Count == 0) return string.Empty;

        var sb = new StringBuilder();
        sb.Append("Usage: ");
        for (var i = 0; i < included.Count; i++)
        {
            if (i > 0) sb.Append("; ");
            sb.Append(included[i].NudgeLine);
        }
        if (droppedCount > 0)
        {
            sb.Append($" (+{droppedCount} more)");
        }
        return sb.ToString();
    }

    private static int SeverityRank(Severity s) => s switch
    {
        Severity.Critical    => 0,
        Severity.Warning     => 1,
        Severity.Info        => 2,
        Severity.Descriptive => 3,
        _                    => 4,
    };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~QuotaNudgeComposerTests" 2>&1 | tail -10
```

Expected: 5 tests, 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/TotalRecall.Infrastructure/Usage/QuotaNudgeComposer.cs \
        tests/TotalRecall.Infrastructure.Tests/Usage/QuotaNudgeComposerTests.cs
git commit -m "feat(usage): QuotaNudgeComposer — format evaluations for session_start

Single-line semicolon-separated output with length cap. Drop order
on overflow: Descriptive → Info → Warning; Critical is always
preserved. Appends '(+N more)' suffix when anything was dropped.
Part of Phase 3."
```

---

## Task 18: Integrate nudge into SessionLifecycle context

**Files:**
- Modify: `src/TotalRecall.Server/SessionLifecycle.cs` — accept evaluator + composer, prepend nudge to Context
- Modify: `src/TotalRecall.Server/ServerComposition.cs` — construct and inject

- [ ] **Step 1: Add optional dependencies to SessionLifecycle**

In `src/TotalRecall.Server/SessionLifecycle.cs`, extend the constructor further (additive — keep existing tests passing):

```csharp
public sealed class SessionLifecycle : ISessionLifecycle
{
    private readonly IReadOnlyList<IImporter> _importers;
    private readonly ISqliteStore _store;
    private readonly ICompactionLogReader _compactionLog;
    private readonly Func<long> _nowMs;
    private readonly string _sessionId;
    private readonly TotalRecall.Infrastructure.Usage.UsageIndexer? _usageIndexer;
    private readonly TotalRecall.Infrastructure.Usage.QuotaEvaluator? _quotaEvaluator;    // <-- NEW
    private readonly TotalRecall.Infrastructure.Usage.QuotaNudgeComposer? _nudgeComposer; // <-- NEW
    private readonly IReadOnlyList<string>? _nudgeHosts;                                   // <-- NEW

    public SessionLifecycle(
        IReadOnlyList<IImporter> importers,
        ISqliteStore store,
        ICompactionLogReader compactionLog,
        string? sessionId = null,
        Func<long>? nowMs = null,
        TotalRecall.Infrastructure.Usage.UsageIndexer? usageIndexer = null,
        TotalRecall.Infrastructure.Usage.QuotaEvaluator? quotaEvaluator = null,  // <-- NEW
        TotalRecall.Infrastructure.Usage.QuotaNudgeComposer? nudgeComposer = null, // <-- NEW
        IReadOnlyList<string>? nudgeHosts = null)                                 // <-- NEW
    {
        // ... existing assignments ...
        _quotaEvaluator = quotaEvaluator;
        _nudgeComposer = nudgeComposer;
        _nudgeHosts = nudgeHosts;
    }
```

- [ ] **Step 2: Compose nudge and prepend to Context in RunInit**

Still in SessionLifecycle.cs, find the existing `var context = BuildContext(hotEntries);` line around line 140 and add nudge composition BEFORE it:

```csharp
        // 4. Context string assembly — matches TS session-tools.ts:260-264.
        //    Prepend a quota-nudge line from the usage subsystem when
        //    enabled (Phase 3). Per spec §6.5, the nudge is line 1 and
        //    the existing hot-tier dump is everything below it.
        var context = BuildContext(hotEntries);

        if (_quotaEvaluator is not null && _nudgeComposer is not null && _nudgeHosts is not null)
        {
            try
            {
                var evals = new List<TotalRecall.Infrastructure.Usage.QuotaEvaluation>();
                foreach (var host in _nudgeHosts)
                {
                    evals.Add(_quotaEvaluator.EvaluateHost(host));
                }
                var nudge = _nudgeComposer.Compose(evals);
                if (!string.IsNullOrEmpty(nudge))
                {
                    context = nudge + (context.Length > 0 ? "\n" + context : "");
                }
            }
            catch (Exception ex)
            {
                // Never propagate — usage nudging must not break session_start.
                Console.Error.WriteLine($"total-recall: quota nudge failed: {ex.Message}");
            }
        }
```

- [ ] **Step 3: Wire construction in ServerComposition**

In `src/TotalRecall.Server/ServerComposition.cs`, extend the Phase 1/2 usage wiring block:

```csharp
var usageEventLog = new TotalRecall.Infrastructure.Telemetry.UsageEventLog(conn);
var usageWatermarks = new TotalRecall.Infrastructure.Telemetry.UsageWatermarkStore(conn);
var usageRollup = new TotalRecall.Infrastructure.Telemetry.UsageDailyRollup(conn);
var usageImporters = new List<TotalRecall.Infrastructure.Usage.IUsageImporter>
{
    new TotalRecall.Infrastructure.Usage.ClaudeCodeUsageImporter(),
    new TotalRecall.Infrastructure.Usage.CopilotCliUsageImporter(),
};
var usageIndexer = new TotalRecall.Infrastructure.Usage.UsageIndexer(
    usageImporters, usageEventLog, usageWatermarks, rollup: usageRollup);
var usageQueryService = new TotalRecall.Infrastructure.Usage.UsageQueryService(conn);

// Phase 3 — quota nudging.
// Active plans are read from config.toml [usage.quota.active_plan] — NULL by
// default, which means descriptive fallback for all hosts. Extend once the
// config loader has native support (TODO: config wiring in Task 19).
var planRegistry = TotalRecall.Infrastructure.Usage.QuotaPlanRegistry.LoadEmbedded(
    activePlansFromConfig: null);
var quotaEvaluator = new TotalRecall.Infrastructure.Usage.QuotaEvaluator(
    usageQueryService, planRegistry);
var nudgeComposer = new TotalRecall.Infrastructure.Usage.QuotaNudgeComposer();
var nudgeHosts = new[] { "claude-code", "copilot-cli" };
```

Then update the SessionLifecycle construction:

```csharp
var sessionLifecycle = new SessionLifecycle(
    importers, store, compactionLog,
    usageIndexer: usageIndexer,
    quotaEvaluator: quotaEvaluator,
    nudgeComposer: nudgeComposer,
    nudgeHosts: nudgeHosts);
```

Also update the `new UsageStatusHandler(...)` registration from Task 13 to reuse `usageQueryService` instead of constructing a second one.

- [ ] **Step 4: Build + run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -15
```

Expected: all previous tests plus Phase 3 tests passing. Existing `SessionLifecycleTests` should still pass because the new parameters are optional (default null → no nudge added).

- [ ] **Step 5: Manual smoke test**

```bash
dotnet publish src/TotalRecall.Host/TotalRecall.Host.csproj -c Release -r osx-arm64 -p:PublishAot=true 2>&1 | tail -5
BIN=src/TotalRecall.Host/bin/Release/net8.0/osx-arm64/publish/total-recall
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"session_start","arguments":{}}}' | $BIN serve 2>&1 | head -30
```

Expected: a `session_start` response where the `context` field starts with `"Usage: claude-code: X messages in last 5h..."` (descriptive fallback since no plan is configured). Your real Claude Code and Copilot CLI history drives the numbers.

- [ ] **Step 6: Commit**

```bash
git add src/TotalRecall.Server/SessionLifecycle.cs \
        src/TotalRecall.Server/ServerComposition.cs
git commit -m "feat(usage): inject quota nudge into session_start context

SessionLifecycle.RunInit evaluates registered hosts via QuotaEvaluator,
composes the single-line nudge via QuotaNudgeComposer, and prepends
it to the existing hot-tier context block. Failures in evaluation
or composition are caught and logged but never propagate — nudge
must never block session_start. Default-on; hosts to evaluate are
driven by the ServerComposition wiring (claude-code + copilot-cli
in Phase 3). Part of Phase 3."
```

---

## Task 19: Config schema for quota overrides + --verbose

**Files:**
- Modify: `src/TotalRecall.Infrastructure/Config/ConfigLoader.cs` — add `[usage.quota]` section (additive; OK if skipped in v1)
- Modify: `src/TotalRecall.Cli/Commands/UsageCommand.cs` — add `--verbose` flag
- Modify: `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs` — verbose test

This task is smaller — it polishes the feature and closes the observability requirement from spec §10. Config integration is minimal: load the `[usage.quota.active_plan]` table if present, pass to `QuotaPlanRegistry.LoadEmbedded(...)`. If the config loader doesn't expose arbitrary TOML tables easily, leave config integration as a TODO marker and ship with registry defaults — users opt in via code for v1.

- [ ] **Step 1: Add `--verbose` test**

Append to `tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs`:

```csharp
    [Fact]
    public async Task RunAsync_VerboseFlag_PrintsDiagnosticInfo()
    {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var conn = Seed(log =>
        {
            log.InsertOrIgnore(E("claude-code", "a", nowMs - 1000, input: 100, output: 20));
        });
        var svc = new UsageQueryService(conn);
        var output = new StringWriter();
        var cmd = new UsageCommand(svc, output);

        var exit = await cmd.RunAsync(new[] { "--verbose" });
        Assert.Equal(0, exit);

        var text = output.ToString();
        // Verbose mode should mention row counts or similar diagnostic info
        Assert.Contains("events", text, StringComparison.OrdinalIgnoreCase);
    }
```

- [ ] **Step 2: Run to verify fail**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageCommandTests" 2>&1 | tail -10
```

Expected: new test fails (unknown flag).

- [ ] **Step 3: Add `--verbose` parsing + output to UsageCommand**

In `src/TotalRecall.Cli/Commands/UsageCommand.cs`, add to `TryParseArgs`:

```csharp
                case "--verbose":
                    verbose = true;
                    break;
```

Thread `out bool verbose` through the signature (mirror what you did for `emitJson`). At the end of `RunAsync`, when not emitting JSON and `verbose` is true, append:

```csharp
            if (verbose && !emitJson)
            {
                _out.WriteLine();
                _out.WriteLine($"[verbose] raw events: {CountRawEvents(svc)}");
                _out.WriteLine($"[verbose] query window: {query.Start:u} → {query.End:u}");
            }
```

Add a helper on UsageQueryService (or inline the count query):

```csharp
        // In UsageQueryService.cs:
        public long CountRawEvents()
        {
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM usage_events";
            return (long)cmd.ExecuteScalar()!;
        }
```

And in UsageCommand:

```csharp
        private static long CountRawEvents(UsageQueryService svc) => svc.CountRawEvents();
```

- [ ] **Step 4: Run tests**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo --filter "FullyQualifiedName~UsageCommandTests" 2>&1 | tail -10
```

Expected: all UsageCommand tests passing (8 total).

- [ ] **Step 5: Run full suite**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | tail -15
```

Expected: all Phase 1/2/3 tests passing. Target count: ~980+.

- [ ] **Step 6: Commit**

```bash
git add src/TotalRecall.Cli/Commands/UsageCommand.cs \
        src/TotalRecall.Infrastructure/Usage/UsageQueryService.cs \
        tests/TotalRecall.Cli.Tests/Commands/UsageCommandTests.cs
git commit -m "feat(usage): --verbose flag for diagnostic output

Prints raw event count and query window under --verbose. Satisfies
spec §10 observability requirement. Full config override loading
from [usage.quota] TOML section is deferred as a v2 follow-up;
Phase 3 ships with built-in plans only (descriptive fallback is
the ship-default for unconfigured users).
End of Phase 3."
```

- [ ] **Step 7: Phase 3 checkpoint**

```bash
dotnet test src/TotalRecall.sln -c Debug --nologo 2>&1 | grep -E 'Passed!'
```

Expected: baseline (~944) + 17 Phase 1 + 17 Phase 2 + ~15 Phase 3 = ~993 passing.

- [ ] **Step 8: Final smoke test — end-to-end**

```bash
# Build the release binary
dotnet publish src/TotalRecall.Host/TotalRecall.Host.csproj -c Release -r osx-arm64 -p:PublishAot=true 2>&1 | tail -3

# Run the CLI command
BIN=src/TotalRecall.Host/bin/Release/net8.0/osx-arm64/publish/total-recall
$BIN usage
$BIN usage --last 5h --by day
$BIN usage --json | python3 -m json.tool | head -40
$BIN usage --verbose
```

Expected:
1. Default output: table grouped by host, real numbers from your Claude Code + Copilot CLI history, em-dashes for Copilot's null input/cache columns.
2. 5h + by day: single-row table with today's date.
3. --json: structured JSON with `query`, `buckets`, `grand_total`, `coverage` top-level keys; null tokens emit as JSON null.
4. --verbose: default table + diagnostic footer with raw event count.

---

# Final checklist

- [ ] All three phases committed to `main`
- [ ] Test count at ~993 passed, 0 failed, 0 skipped
- [ ] `dotnet publish -r osx-arm64 -p:PublishAot=true` succeeds with no warnings
- [ ] Manual smoke tests from Task 19 Step 8 all produce expected output
- [ ] `session_start` context field begins with `Usage: ...` line when invoked via MCP
- [ ] `total-recall usage --json` shape matches spec §6.3 JSON example
- [ ] `usage_status` MCP tool is registered and returns data (inspectable via any MCP client)

## Known follow-ups (NOT in this plan; spec §2 "deferred" + §8 "risks")

- **Feature C — optimization recommendations** (cache-hit-rate analysis, top-session analysis). Data is in `server_tool_use_json`; add new query dimensions.
- **Cursor / Cline / OpenCode usage adapters.** Pattern is set; each is ~200 LOC + fixture.
- **Live file-watcher mode** for sub-second quota nudge freshness. Spec Q2 Option C.
- **Full config-driven `[usage.quota]` override loading.** Task 19 left this as a TODO; ship with code-driven defaults.
- **Backdated-event scan mode** via file-mtime watermarking (spec R4).
- **Copilot CLI hook path resolution bug** (spec Appendix A) — orthogonal, tracked separately.
- **CSV/NDJSON export command** — `total-recall usage --export` if demand materializes.
- **Per-host retention knobs** beyond the global 30d default.

---

# Execution Handoff

Plan complete. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. Each task's code is self-contained so the subagent has full context without needing to re-read earlier tasks.

**2. Inline Execution** — Execute tasks sequentially in the current session using `executing-plans`, with checkpoints for review after each task.

Which approach?
