# Claude Code — Telemetry & Token Usage Reference

> **Type:** Research / reference. Evergreen.
> **Scope:** What Claude Code emits about itself — local session logs, OpenTelemetry metrics/events/traces, the hooks contract, and the smaller sidecar files. Focused on data sources useful for tracking token consumption and tool activity, with the surrounding telemetry surface called out so consumers know what else is on the wire.
> **Last verified:** 2026-05-24 against `code.claude.com/docs/en/monitoring-usage`, `code.claude.com/docs/en/hooks-guide`, and Claude Code `2.1.150` local session files. The docs evolve; re-verify before relying on a contract documented as "undocumented" or "observed."
> **Audience:** Anyone building observability or attribution on top of Claude Code, including for orchestrations that run multiple subagents in a single session.

This document captures what the official Claude Code documentation and live local files say about Claude Code's telemetry surface. Where the docs are silent or where a behavior is only indirectly attested, that is called out explicitly so a planner knows a smoke test is required before relying on it.

For the canonical official docs, see the URL bookmark list at the end.

---

## 1. Where Claude Code writes data on disk

Claude Code writes a per-session record locally on every run, independent of any OpenTelemetry configuration. These files exist on flat-rate plans the same way they do on API plans, and are the simplest data source when no external collector is configured.

### Project root and session files

Claude Code groups sessions by working directory under `~/.claude/projects/`. The folder name is a slugified absolute path (path separators and colons replaced with `-`):

```
~/.claude/projects/
  C--dev-orchestration-v3/
    <session-uuid>.jsonl                       # main session transcript
    <session-uuid>/
      subagents/
        agent-<hex>.jsonl                      # one file per spawned subagent
        agent-<hex>.meta.json                  # tiny sidecar for that subagent
        agent-acompact-<hex>.jsonl             # (observed) compaction subagent
    sessions-index.json                        # index of sessions for this project
```

- **`<session-uuid>.jsonl`** — append-only JSONL transcript of the main session.
- **`<session-uuid>/subagents/agent-<hex>.jsonl`** — one transcript per subagent that the main session spawned via the Task tool. This answers a common open question: **subagents do get their own JSONL files** under a `subagents/` folder named for the parent session UUID.
- **`agent-<hex>.meta.json`** — a tiny companion file next to each subagent JSONL. Observed contents:
  ```json
  { "agentType": "general-purpose", "description": "Implement Task 1: job-seeker.md" }
  ```
  This lets you attribute a subagent transcript to a named agent type without parsing the JSONL.
- **`agent-acompact-<hex>.jsonl`** (observed, undocumented naming) — files prefixed `agent-acompact-` appear when context compaction runs as its own subagent. Treat the name shape as observed convention, not a guaranteed contract.
- **`sessions-index.json`** — per-project session index. Not documented; treat as opaque.

### JSONL line shape and the `usage` block

Each line is a single JSON object. Assistant turns include the API response's `usage` block verbatim under `message.usage`. A real line from a recent session:

```json
{
  "type": "assistant",
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "f32f0a9a-fe05-481b-b573-e74bd58dc36b",
  "requestId": "req_011CaP2RfKzFF4niVborWHXw",
  "timestamp": "2026-04-24T17:54:54.560Z",
  "cwd": "C:\\dev\\orchestration\\v3",
  "gitBranch": "main",
  "entrypoint": "cli",
  "userType": "external",
  "isSidechain": false,
  "version": "2.1.150",
  "message": {
    "id": "...",
    "type": "message",
    "role": "assistant",
    "model": "claude-opus-4-7",
    "content": [ /* ... */ ],
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "stop_details": { /* ... */ },
    "usage": {
      "input_tokens": 6,
      "output_tokens": 314,
      "cache_read_input_tokens": 0,
      "cache_creation_input_tokens": 33384,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 0,
        "ephemeral_1h_input_tokens": 33384
      },
      "server_tool_use": {
        "web_search_requests": 0,
        "web_fetch_requests": 0
      },
      "service_tier": "standard",
      "speed": "standard",
      "inference_geo": "",
      "iterations": [
        {
          "type": "message",
          "input_tokens": 6,
          "output_tokens": 314,
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 33384,
          "cache_creation": {
            "ephemeral_5m_input_tokens": 0,
            "ephemeral_1h_input_tokens": 33384
          }
        }
      ]
    }
  }
}
```

Notable fields beyond the four headline token counters:

| Field | Notes |
|---|---|
| `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` | Cache-creation tokens split by TTL bucket. The top-level `cache_creation_input_tokens` is the sum. |
| `iterations[]` | One entry per attempt the SDK made for this assistant turn (retries / continuations). Lets you account for retried token spend that is otherwise rolled up. |
| `server_tool_use.web_search_requests` / `web_fetch_requests` | Server-side tool call counts billed alongside the request. |
| `service_tier` | `"standard"` observed. Other values not yet seen locally. |
| `speed` | `"standard"` observed. Fast mode would emit `"fast"` here, matching the OTel `speed` attribute. |
| `inference_geo` | Empty string observed. Anthropic does not document this field. |
| `requestId` (top-level) | Anthropic API request ID. Matches the `request_id` attribute on OTel `claude_code.api_request` events — usable as a correlation key between the JSONL transcript and OTel events. |
| `parentUuid` (top-level) | Links assistant turns into a thread. Useful when reconstructing per-turn token cost. |
| `sessionId` | Matches the JSONL filename. |
| `gitBranch`, `cwd`, `entrypoint`, `version` | Per-line context. `cwd` is duplicated on every line; treat as the working directory at line time, not session start. |

> **Project attribution caveat.** The folder name groups by Claude Code working directory, not by any higher-level project concept. If multiple orchestration projects all run from the same CWD they share a JSONL directory. Per-orchestration-project attribution requires correlating timestamps (or `requestId`) with whatever the orchestrator records on its own.

### `stats-cache.json` (limited utility for tokens)

`~/.claude/stats-cache.json` is a small aggregate file used by the CLI's own usage screens. Observed shape:

```json
{
  "version": 3,
  "lastComputedDate": "2026-04-22",
  "dailyActivity": [
    { "date": "2026-04-16", "messageCount": 7234, "sessionCount": 26, "toolCallCount": 8784 }
  ]
}
```

**There are no token counts and no per-model breakdown** in this file. It is useful for "how many sessions did I run today" but not for token attribution. It can also lag — `lastComputedDate` is only refreshed when the CLI recomputes.

### `sessions/<pid>.json` (process-level metadata)

`~/.claude/sessions/<pid>.json` is one file per running Claude Code process. Observed shape:

```json
{
  "pid": 20084,
  "sessionId": "4f867dd9-c656-42e8-a7e9-d766a14c3464",
  "cwd": "C:\\dev\\orchestration\\v3",
  "startedAt": 1779631481405,
  "procStart": "639152138792945500",
  "version": "2.1.150",
  "peerProtocol": 1,
  "kind": "interactive",
  "entrypoint": "cli",
  "status": "waiting",
  "updatedAt": 1779638994205,
  "waitingFor": "permission prompt"
}
```

No token data. Useful for joining a live PID to a session UUID, or for "is anything running right now."

### Tool-result spillover files

When tool results are large, Claude Code persists them to disk and references the path inline in the transcript:

```
~/.claude/projects/<project>/<session-uuid>/tool-results/toolu_<id>.txt
```

These contain raw tool output (for example, a large WebFetch payload). They are written by the harness, not by the model — irrelevant to token attribution, but useful to know about when scrubbing project folders.

### Task tool persistence

`~/.claude/tasks/<session-uuid>/<N>.json` mirrors the in-conversation Task tool list. Not relevant to telemetry; flagged because the path shape suggests it might be.

---

## 2. Native OpenTelemetry support

Claude Code ships with built-in OpenTelemetry that exports metrics, events (as OTel logs), and optionally distributed traces. It works on all billing models including flat rate.

### Enabling

The minimum configuration:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp      # otlp | prometheus | console | none
export OTEL_LOGS_EXPORTER=otlp         # otlp | console | none
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

Defaults: metrics exported every **60 s**, logs every **5 s**. Override with `OTEL_METRIC_EXPORT_INTERVAL` and `OTEL_LOGS_EXPORT_INTERVAL` (both in milliseconds). For console-debug iteration use `OTEL_METRICS_EXPORTER=console` with a short interval like `1000`.

Telemetry can also be enforced from a managed settings file (`env` block in `.claude/settings.json` / managed policy), which an organization can ship via MDM. Managed env vars cannot be overridden by users.

> **Subprocess inheritance gotcha.** Claude Code does **not** propagate `OTEL_*` to subprocesses it spawns (Bash, hooks, MCP servers, language servers). An OTel-instrumented program run through the Bash tool will not inherit Claude Code's exporter; it must set its own. The single exception is `TRACEPARENT` (see [Traces](#5-traces-beta)).

### Cardinality and content controls

| Env var | Default | Purpose |
|---|---|---|
| `OTEL_METRICS_INCLUDE_SESSION_ID` | `true` | Include `session.id` on metrics. Disable to lower cardinality. |
| `OTEL_METRICS_INCLUDE_VERSION` | `false` | Include `app.version` on metrics. |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | `true` | Include `user.account_uuid` / `user.account_id`. |
| `OTEL_LOG_USER_PROMPTS` | off | Emit prompt text on `user_prompt` events. Off by default — only `prompt_length` is logged. |
| `OTEL_LOG_TOOL_DETAILS` | off | Emit `tool_parameters`, `tool_input`, bash commands, MCP/skill/agent names that would otherwise collapse to `custom` / `third-party`, and hook matcher strings. |
| `OTEL_LOG_TOOL_CONTENT` | off | In trace spans, emit full tool input/output bodies (≤ 60 KB per attribute). Requires traces. |
| `OTEL_LOG_RAW_API_BODIES` | off | Emit full Anthropic Messages API request and response JSON as `api_request_body` / `api_response_body` events. `=1` for inline (≤ 60 KB), `=file:<dir>` for untruncated bodies written to disk with a `body_ref` in the event. Bodies include the entire conversation history; enabling this implies consent to everything the three flags above would reveal. Claude's extended-thinking content is always redacted. |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | `delta` | Set to `cumulative` if the metrics backend expects cumulative temporality. |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | `1740000` (29 min) | Interval for the optional `otelHeadersHelper` script that produces dynamic auth headers. Only honored for `http/protobuf` and `http/json`; the `grpc` exporter ignores it. |
| `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` (alias `ENABLE_ENHANCED_TELEMETRY_BETA`) | off | Enables span tracing. See [Traces](#5-traces-beta). |

For mTLS, the cert env vars depend on protocol: `http/*` uses `CLAUDE_CODE_CLIENT_CERT` / `CLAUDE_CODE_CLIENT_KEY` and trusts CAs via `NODE_EXTRA_CA_CERTS`; `grpc` uses the standard `OTEL_EXPORTER_OTLP_CLIENT_KEY` / `OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE` and `OTEL_EXPORTER_OTLP_CERTIFICATE`.

### Multi-team / custom attribution

Use `OTEL_RESOURCE_ATTRIBUTES` to tag every emitted metric/event/span:

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform,cost_center=eng-123"
```

Strict formatting: comma-separated `key=value`, no spaces, no quotes (quoting does **not** escape spaces — the quotes end up in the value). Percent-encode anything outside US-ASCII or any reserved character.

### Service-level resource attributes (always emitted)

Every export carries:

- `service.name`: `claude-code`
- `service.version`: current Claude Code version
- `os.type`, `os.version`, `host.arch`
- `wsl.version` (only on WSL)
- Meter name: `com.anthropic.claude_code`

---

## 3. Metrics

All metrics share the **standard attributes** below; metrics with extra attributes are noted in the table.

### Standard attributes

| Attribute | Notes |
|---|---|
| `session.id` | Per-session UUID. Gated by `OTEL_METRICS_INCLUDE_SESSION_ID`. |
| `app.version` | Claude Code version. Off on metrics by default. |
| `organization.id` | When authenticated. |
| `user.account_uuid` / `user.account_id` | When authenticated. Gated by `OTEL_METRICS_INCLUDE_ACCOUNT_UUID`. |
| `user.id` | Anonymous device/install ID. Always included. |
| `user.email` | OAuth-authenticated only. |
| `terminal.type` | `iTerm.app`, `vscode`, `cursor`, `tmux`, etc. when detected. |

Event-only additions (excluded from metrics because they would explode cardinality): `prompt.id` (UUID v4 correlating a user prompt to every event it triggers — see [Event correlation](#4-events)) and `workspace.host_paths`.

### Metric catalog

| Metric | Unit | Notes |
|---|---|---|
| `claude_code.session.count` | count | Incremented per session start. Adds `start_type`: `fresh` / `resume` / `continue`. |
| `claude_code.lines_of_code.count` | count | Adds `type`: `added` / `removed`. |
| `claude_code.pull_request.count` | count | Incremented when Claude Code opens a PR/MR via shell or MCP. |
| `claude_code.commit.count` | count | Incremented per git commit Claude Code creates. |
| `claude_code.cost.usage` | USD | Per-request cost estimate. See attributes below. |
| `claude_code.token.usage` | tokens | Per-request token usage. See attributes below. |
| `claude_code.code_edit_tool.decision` | count | Per accept/reject of an Edit/Write/NotebookEdit call. Adds `tool_name`, `decision`, `source`, `language`. |
| `claude_code.active_time.total` | seconds | Active time, excluding idle. Adds `type`: `user` (keyboard) / `cli` (tool execution + responses). |

> **Cost metrics are approximations.** Anthropic explicitly directs API-billed deployments to the Console / Bedrock / Vertex billing data for ground truth.

### `claude_code.token.usage` attributes (most relevant for token attribution)

| Attribute | Notes |
|---|---|
| `type` | `input` / `output` / `cacheRead` / `cacheCreation` |
| `model` | e.g. `claude-sonnet-4-6` |
| `query_source` | `main` / `subagent` / `auxiliary` |
| `speed` | `fast` if fast mode active; absent otherwise |
| `effort` | `low` / `medium` / `high` / `xhigh` / `max`; absent when model doesn't support effort |
| `agent.name` | **Built-in agent names and agents from official-marketplace plugins appear verbatim. Other user-defined agent names collapse to `custom`** unless `OTEL_LOG_TOOL_DETAILS=1`. Absent when not issued by a named subagent. |
| `skill.name` | Active skill. Built-in / bundled / user-defined / official-plugin skill names appear verbatim. Third-party plugin skills collapse to `third-party`. |
| `plugin.name` | Owning plugin for the active skill or subagent. Third-party collapses to `third-party`. |
| `marketplace.name` | Only emitted for official marketplaces. |

`claude_code.cost.usage` carries the same set of attribution attributes, so per-agent / per-skill / per-plugin spend is supported natively for built-in and official-plugin components. **Custom user-defined subagents only get verbatim names when `OTEL_LOG_TOOL_DETAILS=1`** — otherwise everything not on the allowlist becomes `custom` or `third-party`, which limits per-agent attribution for purely local orchestration setups.

---

## 4. Events

Events are exported via the OTel logs/events protocol when `OTEL_LOGS_EXPORTER` is configured. Each event carries:

- All standard attributes (see [§3](#3-metrics))
- `event.name`, `event.timestamp` (ISO 8601), `event.sequence` (monotonic per session)
- `prompt.id` (UUID v4) — correlation key linking every event produced while processing a single user prompt. Filter by it to recover the full call chain triggered by one prompt.

### Event catalog

| Event name | When |
|---|---|
| `claude_code.user_prompt` | Prompt submitted. Carries `prompt_length`, optional `prompt` text (gated), `command_name`, `command_source`. |
| `claude_code.api_request` | Every API call. Carries `model`, `cost_usd`, `duration_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `request_id`, `speed`, `query_source`, `effort`. |
| `claude_code.api_error` | API call gave up. Carries `error`, `status_code`, `attempt`, `duration_ms`, `request_id`, `speed`, `query_source`, `effort`. **Intermediate retries are not separate events** — the final `api_error` is the terminal signal. |
| `claude_code.api_retries_exhausted` | Emitted alongside the final `api_error` when `attempt > 1`. Carries `total_attempts`, `total_retry_duration_ms`. |
| `claude_code.api_request_body` | Full Messages API request JSON (`OTEL_LOG_RAW_API_BODIES` only). One event per attempt. Either inline `body` (≤ 60 KB) or `body_ref` path. |
| `claude_code.api_response_body` | Full Messages API response JSON (`OTEL_LOG_RAW_API_BODIES` only). |
| `claude_code.tool_result` | Tool completed. Carries `tool_name`, `tool_use_id` (correlates with hooks), `success`, `duration_ms`, `error_type`, `decision_type`, `decision_source`, `tool_input_size_bytes`, `tool_result_size_bytes`, `mcp_server_scope`, optional `tool_parameters` / `tool_input` (gated). |
| `claude_code.tool_decision` | Permission decision. Carries `decision` (`accept` / `reject`), `source` (`config`, `hook`, `user_permanent`, `user_temporary`, `user_abort`, `user_reject`), `tool_use_id`. |
| `claude_code.permission_mode_changed` | Permission mode switched. Carries `from_mode`, `to_mode`, `trigger` (`shift_tab`, `exit_plan_mode`, `auto_gate_denied`, `auto_opt_in`). |
| `claude_code.auth` | `/login` or `/logout`. Carries `action`, `success`, `auth_method`, `error_category`, `status_code`. Raw error messages never included. |
| `claude_code.mcp_server_connection` | MCP server connect / disconnect / failure. Carries `status`, `transport_type`, `server_scope`, `duration_ms`, `error_code`. `server_name` and full `error` gated by `OTEL_LOG_TOOL_DETAILS`. |
| `claude_code.internal_error` | Uncaught internal error. Only `error_name` (class) and `error_code` (errno). Messages and stack traces never included. Not emitted on Bedrock / Vertex / Foundry, or with `DISABLE_ERROR_REPORTING`. |
| `claude_code.plugin_installed` | Plugin install completed. Carries `marketplace.is_official`, `install.trigger` (`cli` / `ui`), `plugin.name`, `plugin.version`, `marketplace.name` (third-party collapses unless `OTEL_LOG_TOOL_DETAILS`). |
| `claude_code.plugin_loaded` | Once per enabled plugin at session start. Includes counts of skills/commands/agents the plugin declares and a `plugin_id_hash` for fleet-wide counting without naming third-party plugins. |
| `claude_code.skill_activated` | Skill invoked. Carries `skill.name` (third-party redacted unless `OTEL_LOG_TOOL_DETAILS`), `invocation_trigger` (`user-slash` / `claude-proactive` / `nested-skill`), `skill.source`. |
| `claude_code.at_mention` | `@mention` resolved. Carries `mention_type` (`file` / `directory` / `agent` / `mcp_resource`), `success`. |
| `claude_code.hook_registered` | Once per hook at session start. Inventory event. |
| `claude_code.hook_execution_start` / `claude_code.hook_execution_complete` | Per hook event group. Carries `hook_event`, `hook_name`, `num_hooks`, plus `num_success` / `num_blocking` / `num_non_blocking_error` / `num_cancelled` on the complete event. |
| `claude_code.hook_plugin_metrics` | Per-invocation custom metrics from official-marketplace plugin hooks only. Up to 20 keys per emission. |
| `claude_code.compaction` | Compaction completed. **Carries `pre_tokens` and `post_tokens`** — useful for tracking compaction savings. Also `trigger` (`auto` / `manual`), `success`, `duration_ms`. |
| `claude_code.feedback_survey` | Session quality survey. Carries `event_type`, `appearance_id`, `survey_type`, `response`. |

### Correlating events ↔ JSONL ↔ hooks

- `request_id` on `api_request` / `api_error` / `api_response_body` matches the top-level `requestId` field in the JSONL.
- `tool_use_id` on `tool_result` / `tool_decision` matches the `tool_use_id` passed to hooks on stdin, so OTel events and hook-captured data can be joined.
- `prompt.id` links all events triggered by a single prompt, but is intentionally **not** on metrics.

---

## 5. Traces (beta)

Traces are off by default. Enable with both `CLAUDE_CODE_ENABLE_TELEMETRY=1` and `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`, plus `OTEL_TRACES_EXPORTER`. Traces reuse the OTLP endpoint/headers/mTLS config unless overridden by `OTEL_EXPORTER_OTLP_TRACES_*`.

### Span hierarchy

```
claude_code.interaction                    (root, one per user prompt)
├── claude_code.llm_request
├── claude_code.hook                       (only with detailed beta tracing)
└── claude_code.tool
    ├── claude_code.tool.blocked_on_user
    ├── claude_code.tool.execution
    └── (Task tool) subagent llm_request / tool spans nested here
```

When the Task tool spawns a subagent, the subagent's API and tool spans nest under the parent's `claude_code.tool` span — so a single trace captures the full subagent call tree.

### `claude_code.llm_request` span attributes (token-relevant)

Beyond the OTel GenAI conventions (`gen_ai.system=anthropic`, `gen_ai.request.model`, `gen_ai.response.id`, `gen_ai.response.finish_reasons`), the span carries:

- `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens` — same shape as the metric.
- `duration_ms`, `ttft_ms` (time to first token).
- `query_source` — e.g. `repl_main_thread` or a subagent name.
- `agent_id`, `parent_agent_id` — **per-subagent attribution at trace level**. Absent for the main session.
- `request_id`, `client_request_id`, `attempt`, `success`, `status_code`, `error`.
- `response.has_tool_call`, `stop_reason`.

### Cross-process trace propagation

- When tracing is active, Bash and PowerShell subprocesses inherit a `TRACEPARENT` env var carrying the active tool span's W3C context. Subprocesses that read `TRACEPARENT` can parent their own spans under the same trace.
- Agent SDK and non-interactive (`claude -p`) sessions also **read** inbound `TRACEPARENT` / `TRACESTATE` from their environment, so an embedding process can make Claude Code's `claude_code.interaction` a child of its own span. Interactive sessions deliberately ignore inbound `TRACEPARENT` to avoid inheriting ambient values from CI/containers.
- When Claude Code talks directly to the Anthropic API, the `llm_request` span's context is sent as the API's `traceparent` header and the API's `traceresponse` header is recorded as a span link.

The `claude_code.hook` span exists only under "detailed beta tracing," which requires `ENABLE_BETA_TRACING_DETAILED=1` and `BETA_TRACING_ENDPOINT`, and (in interactive CLI sessions) org allowlisting. The standard beta tracing flag alone does not produce it.

---

## 6. Hooks contract — and what it doesn't carry

Hooks are fired by Claude Code at lifecycle points and run as user-defined shell commands (or `http`, `mcp_tool`, `prompt`, `agent` types). Event-specific JSON is delivered on stdin.

**Hook input never contains token counts.** A `PreToolUse` hook input looks like:

```json
{
  "session_id": "abc123",
  "cwd": "/Users/sarah/myproject",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" }
}
```

Different events add different fields (`UserPromptSubmit` gets `prompt`, `SessionStart` gets `source`, etc.), but no hook event includes `message.usage` or any token counter.

What hooks **do** provide that helps observability:

- `tool_use_id` on tool-related hook events matches the same field on OTel `tool_result` / `tool_decision` events, enabling join.
- `SubagentStart` / `SubagentStop` fire with timing, so they can bracket a time window for a subagent. Correlating those timestamps with JSONL `message.usage` entries or with `query_source` / `agent_id` on OTel events is how an external pipeline attributes tokens to subagents when running on flat-rate without an OTel collector.

### Hook events (current as of `2.1.x`)

`SessionStart`, `Setup`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Notification`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `TeammateIdle`, `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `Elicitation`, `ElicitationResult`, `SessionEnd`.

For full per-event input schemas see the official Hooks reference (linked at the end).

---

## 7. Per-agent / per-subagent attribution paths

Putting the pieces above together, there are three viable paths for attributing token spend to a specific subagent within one session:

1. **OTel metrics with `agent.name`** — Built-in subagent types and official-marketplace plugin agents already carry verbatim `agent.name` on `claude_code.token.usage` and `claude_code.cost.usage`. Custom user-defined agent names collapse to `custom` unless `OTEL_LOG_TOOL_DETAILS=1`. Zero pipeline code changes needed; the trade-off is enabling tool-details exposes a lot of other content too.

2. **OTel traces with `agent_id` / `parent_agent_id`** — Span-level attribution is unconditional once traces are enabled; the subagent's `llm_request` spans nest under the parent's `tool` span and carry token counts on the span itself. This is the cleanest "who spent what" answer if a trace backend is in scope.

3. **JSONL correlation** — On flat-rate with no collector, the subagent JSONL files (`<session-uuid>/subagents/agent-<hex>.jsonl`) contain the subagent's own `message.usage` entries. The companion `.meta.json` gives the agent type. Summing across files yields per-subagent totals without any OTel setup.

The widely-cited "per-subagent tracking is a feature gap" claim (from [anthropics/claude-code#22625](https://github.com/anthropics/claude-code/issues/22625)) predates the current `agent.name`, `agent_id`, and `subagents/` JSONL layout. Re-check that issue's status before designing around the gap.

---

## 8. Notes for flat-rate plans (Pro / Max)

- Pro and Max plans are flat monthly fees with no per-token billing. "Cost" means token consumption against a 5-hour rolling window and weekly usage limits shared with Claude web/desktop.
- Individual Pro / Max plans do **not** expose Claude Code usage analytics in the Console — that's Team / Enterprise. Anything you want to see has to come from your own JSONL parsing or your own OTel collector.
- `claude_code.cost.usage` still emits a USD estimate on flat-rate plans; treat it as an approximation calibrated to API pricing, not actual billing.
- Prompt caching applies on flat-rate. Cache reads consume less of the rate-limit allocation than fresh input tokens, so cache hit rate is a meaningful efficiency metric on flat plans even though there's no dollar incentive.

---

## 9. Privacy, redaction, and audit

- OTel export is opt-in. Anthropic's separate operational telemetry is documented at `code.claude.com/docs/en/data-usage`.
- Raw file contents and code snippets are not in metrics or events. Trace spans are a separate path: only emit content when `OTEL_LOG_TOOL_CONTENT=1`.
- Prompt content off by default (`OTEL_LOG_USER_PROMPTS=1` to opt in). `user.email` is included whenever OAuth-authenticated — filter at the backend if that's a concern.
- `OTEL_LOG_RAW_API_BODIES` exposes the full conversation history (system prompt + all prior turns + tool results). Enabling it implicitly consents to everything `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_DETAILS`, and `OTEL_LOG_TOOL_CONTENT` would reveal. Extended-thinking content is always redacted from these bodies regardless of any flag.
- For SIEM use, every event carries identity (`user.email`, `user.account_uuid`, `user.account_id`, `organization.id`, `user.id`, `session.id`). Direct-API / Bedrock / Vertex / Foundry deployments have no Claude account in the session — attach identity yourself with `OTEL_RESOURCE_ATTRIBUTES="enduser.id=...,enduser.directory_id=..."`.

---

## URL bookmarks

- Monitoring & OpenTelemetry: <https://code.claude.com/docs/en/monitoring-usage>
- Hooks guide: <https://code.claude.com/docs/en/hooks-guide>
- Hooks reference (event schemas): <https://code.claude.com/docs/en/hooks>
- Settings precedence: <https://code.claude.com/docs/en/settings#settings-precedence>
- Data usage / operational telemetry: <https://code.claude.com/docs/en/data-usage>
- Network configuration / mTLS: <https://code.claude.com/docs/en/network-config>
- Permissions: <https://code.claude.com/docs/en/permissions>
- Headless / `-p` mode: <https://code.claude.com/docs/en/headless>
- Anthropic ROI / monitoring guide repo: <https://github.com/anthropics/claude-code-monitoring-guide>
- Bedrock-specific monitoring guide: <https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock/blob/main/assets/docs/MONITORING.md>
- Per-subagent tracking feature request (historical, claim now partially obsolete): <https://github.com/anthropics/claude-code/issues/22625>
