# Observability Research — Token Usage & Telemetry

> Research findings from investigating observability options for the orchestration pipeline, focused on tracking token usage per project on Claude Code flat-rate plans (Pro/Max). Captured 2026-04-15.

## Motivation

We want to know how much each orchestration project costs in token consumption. At minimum, per-project totals. Ideally, per-agent/per-node granularity within a project. The system runs on Claude Code flat-rate plans, so traditional API billing dashboards don't apply — we need our own tracking.

### What We Want to Track (Scoped)

| Metric | Priority |
|--------|----------|
| Input tokens per project | High |
| Output tokens per project | High |
| Cache read/creation tokens per project | High |
| Per-agent token attribution | Medium |
| Tool success/failure rates | Medium |
| Cache hit rate (efficiency) | Medium |
| Agent wall-clock time | Low |

## Key Findings

### 1. Claude Code Has Native OpenTelemetry Support

Claude Code ships with built-in OTel that works on all billing models including flat rate. Enabled via environment variables:

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp          # otlp | prometheus | console | none
OTEL_LOGS_EXPORTER=otlp             # otlp | console | none
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

**Metrics exported:**
- `claude_code.token.usage` — broken down by type (input, output, cacheRead, cacheCreation) and model
- `claude_code.cost.usage` — USD estimate per API request, by model
- `claude_code.session.count`, `claude_code.active_time.total`
- `claude_code.lines_of_code.count` (added/removed)
- `claude_code.commit.count`, `claude_code.pull_request.count`
- `claude_code.code_edit_tool.decision` — accept/reject with tool name, language

**Events exported (via logs/events protocol):**
- `claude_code.user_prompt` — prompt length, optional content. Has `prompt.id` that correlates all downstream events
- `claude_code.api_request` — model, input/output/cache tokens, cost_usd, duration_ms, speed (fast/normal)
- `claude_code.tool_result` — tool name, success/failure, duration_ms, decision type/source
- `claude_code.api_error` — error, status code, retry attempt count
- `claude_code.tool_decision` — accept/reject decisions with source
- `claude_code.skill_activated` — skill name and source

**Traces (beta):** Distributed tracing linking prompts to API calls to tool executions as parent-child spans. Subprocesses inherit `TRACEPARENT` for end-to-end distributed tracing. Enable with `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`.

**Privacy controls:** Prompts, tool inputs, and tool content are all redacted by default. Opt-in via `OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_TOOL_DETAILS=1`, `OTEL_LOG_TOOL_CONTENT=1`.

**Custom attributes for multi-team:** `OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform"` tags all telemetry.

> **Source:** [Monitoring — Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage)

### 2. Local JSONL Logs Already Contain Token Data

The simplest data source. Claude Code writes conversation logs to `~/.claude/projects/<project-hash>/<session-uuid>.jsonl` in real-time. Every assistant response includes:

```json
{
  "type": "assistant",
  "message": {
    "usage": {
      "input_tokens": 42100,
      "output_tokens": 3134,
      "cache_read_input_tokens": 12500,
      "cache_creation_input_tokens": 1800
    },
    "model": "claude-opus-4-6-20250414"
  },
  "timestamp": "2026-04-15T..."
}
```

**Pros:** No setup. Already being written. Per-request granularity with timestamps and model info.

**Cons:** Organized by Claude Code working directory, not orchestration project. All orchestration runs from `C:\dev\orchestration\v3` land in the same JSONL directory. Requires timestamp correlation with state.json to attribute tokens to specific orchestration projects.

**Other local files:**
- `~/.claude/stats-cache.json` — aggregate daily totals by model (can go stale)
- `~/.claude/history.jsonl` — all sessions combined
- `~/.claude/sessions/<pid>.json` — session metadata (no token data)

### 3. Hooks Don't Receive Token Data

Claude Code hooks (`PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, etc.) receive event-specific JSON on stdin, but this does **not** include token counts. Hook inputs contain `session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input` — no usage metrics.

Hooks are useful for: file protection, formatting, notifications, permission control, context injection. Not useful as a direct source of token telemetry.

However, `SubagentStart`/`SubagentStop` hooks do fire with timing info, which could help bracket time windows for per-agent token attribution if correlated with JSONL timestamps.

> **Source:** [Automate workflows with hooks — Claude Code Docs](https://code.claude.com/docs/en/hooks-guide)

### 4. Per-Subagent Token Tracking — Feature Gap

A feature request ([anthropics/claude-code#22625](https://github.com/anthropics/claude-code/issues/22625)) asked for per-subagent token usage tracking. It was **closed as not planned** with no official Anthropic response.

Proposed workaround from the issue: manually note session token count before/after spawning an agent and calculate the difference.

### 5. Prompt Caching on Flat Rate Plans

Prompt caching applies on flat rate — it reduces latency and, more importantly, **cache reads consume less of the rate-limit allocation** than fresh input tokens. Tracking cache hit rate tells you how efficiently agents use the budget window. This is relevant for the orchestration pipeline where sequential agents may benefit from cached context.

### 6. Flat Rate Billing Specifics

- Pro ($20/mo), Max 5x ($100/mo), Max 20x ($200/mo) — flat monthly fee
- Claude Code shares the same 5-hour rolling window and weekly usage limits as Claude web/desktop
- No per-token billing — "cost" means token consumption relative to rate limits
- Individual Pro/Max plans don't get Claude Code usage analytics (that's Team/Enterprise only)
- Third-party tools like `ccusage` parse local JSONL for post-hoc analysis on flat-rate plans

### 7. Community Tools & Approaches

| Tool | Approach | Per-Agent? |
|------|----------|------------|
| [claude-code-otel](https://github.com/ColeMurray/claude-code-otel) | OTel Collector → Prometheus + Loki → Grafana | No — per-session/user |
| [claude_telemetry](https://github.com/TechNickAI/claude_telemetry) | CLI wrapper (`claudia`) using hooks to emit OTel spans | No — per-execution |
| [ccusage](https://github.com/phuryn/claude-usage) | Local JSONL parsing dashboard | No — per-project-directory |
| [Claude Agent SDK OTel Instrumentor](http://justinbarias.io/blog/opentelemetry-instrumentation-claude-agent-sdk/) | Monkey-patches Agent SDK with OTel spans | Partial — SubagentStart/Stop wired but not implemented |
| Native OTel + Grafana | Built-in export to any OTel backend | No — per-session/user |

None of these solve per-orchestration-agent attribution out of the box.

## Recommended Approach

### Simplest Path: JSONL Parsing + State.json Correlation

**No pipeline changes. Dashboard-only feature.**

1. **Data source:** Parse `~/.claude/projects/C--dev-orchestration-v3/*.jsonl` for `message.usage` objects
2. **Project attribution:** Correlate JSONL timestamps with project `state.json` pipeline start/end timestamps
3. **Real-time updates:** File-watch the active JSONL file, emit SSE events when new token data arrives
4. **Dashboard integration:** Add a `TokenSummary` component to the project page, extend `ProjectSummary` type

**What this gives us:**
- Per-project input/output/cache token totals (real-time)
- Model breakdown
- Timeline of token consumption during pipeline execution

**What this doesn't give us (yet):**
- Per-agent attribution within a project (Planner vs. Coder vs. Reviewer)
- Tool call correlation

### Future Enhancement: Per-Agent Attribution

To get per-agent granularity, options include:

1. **SubagentStart/Stop hooks + JSONL correlation** — Hooks fire with timestamps when subagents spawn/finish. Cross-reference with JSONL entries in that time window to attribute tokens to specific agents. Requires hooks but no pipeline changes.

2. **Pipeline-level token snapshots** — Have each pipeline agent read the JSONL total before/after its work and write the delta to state.json. Requires minor pipeline agent modifications.

3. **OTel with custom resource attributes** — If each agent ran in its own Claude Code session with `OTEL_RESOURCE_ATTRIBUTES="agent.name=coder,project=MY-PROJECT"`, native OTel would handle attribution. Only viable if the pipeline architecture supports separate sessions per agent.

## Open Questions

- How do subagent sessions map to the JSONL file structure? Do nested subagents create separate JSONL files or append to the parent session's file?
- What's the timestamp resolution in state.json vs. JSONL? Is it precise enough for clean correlation?
- For the dashboard, should token data live in state.json (read by existing infrastructure) or a separate telemetry file?
- How should we represent "cost" on flat rate — raw tokens, equivalent API cost in USD, or percentage of rate-limit budget?
