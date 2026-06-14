# Claude Code — Hook Event Lifecycle & Telemetry Data Surface

> **Type:** Research / reference. Evergreen.
> **Scope:** Claude Code's **command-hook** system as a data source for telemetry capture — which events fire, the JSON each delivers on **stdin**, and (critically) what each event does and does **not** carry. Focused on the question: *can we capture token usage and per-operation attribution from hooks instead of mining session-log files?* Targets **command hooks** (a shell/node script reading stdin), not the in-process Agent SDK hook callbacks — where the two contracts differ, that is flagged and segregated.
> **Compiled:** 2026-06-14 from a multi-agent research pass against `code.claude.com/docs/en/hooks`, `…/hooks-guide`, `…/agent-sdk/hooks`, `…/monitoring-usage`, and corroborated against this repo's internal snapshot (`~/.radorc/projects/TELEMETRY/claude-code-telemetry.md`, last verified 2026-05-24 against Claude Code 2.1.150).
> **Update — first-party probe, 2026-06-14 (Claude Code 2.1.177):** a live hook probe (every event dumping its stdin; see §2.5 and §8) confirmed the command-hook stdin shapes **and overturned one headline claim** — the `Agent`-tool `PostToolUse` payload **does** carry the finished subagent's full token usage. Claims below verified by that probe are tagged `[verified first-party]`.
> **Audience:** Anyone wiring telemetry capture (TELEMETRY initiative) onto Claude Code hooks, or porting the approach to another harness.

---

## What this adds over the telemetry research doc

The companion [`~/.radorc/projects/TELEMETRY/claude-code-telemetry.md`](../../../.radorc/projects/TELEMETRY/claude-code-telemetry.md) documents the **full** telemetry surface — on-disk JSONL `message.usage` shape, the OTel metric/event/trace catalog, and a §6 hooks summary. Treat it as the baseline. **This document goes deep on one decision the baseline only summarizes: whether to drive capture from hooks, which hooks, and exactly what data a hook hands a shell script on stdin** — because the TELEMETRY-1 design uses a hook as its capture trigger and we needed to know whether hooks make file-scraping unnecessary (they do not) or merely better-triggered (they do).

The central question this resolves: **"hooks vs. files" is a false dichotomy for token data.** Every hook payload includes `transcript_path` — the path to the very JSONL we scrape. The honest framing is **hook = trigger + file locator; file = source of truth for tokens.**

---

## 1. TL;DR — the contract in four sentences

1. **Most hooks carry no token data. The `PostToolUse` hook on the `Agent` tool carries *some* — but, crucially, only the subagent's *final* API turn, not its cumulative total.** Lifecycle hooks (`Stop`, `SubagentStop`, `SessionEnd`, `UserPromptSubmit`) carry **no** token counts. When a subagent finishes, the spawning session's `PostToolUse`/`Agent` fires with rich per-operation metadata for free — `resolvedModel`, `agentType`, `agentId`, `tool_use_id`, aggregate `toolStats`/`totalToolUseCount`/`totalDurationMs`, and the verbatim prompt + response — **but its `usage`/`totalTokens` reflect only the last turn** (multi-turn probe, §2.5). **Accurate per-operation token totals still require summing `message.usage` across the subagent transcript**, which the hook hands you via `agent_transcript_path`. So: hook = deterministic trigger + file-locator + all non-token metadata + verbatim bodies; the transcript = source of truth for token totals. The main orchestrator session's own turns are likewise file-or-OTel-only. **[verified first-party: §2.5]**
2. **Every hook delivers a common envelope on stdin** — `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name` — so a hook always knows *which session*, *where its transcript is*, and *what working dir it ran in*, for free. **[verified: hooks-guide common-input section]**
3. **`transcript_path` is the pivotal field**: it is the absolute path to the session's JSONL, so a hook can trigger a scrape of the exact right file with no slug-globbing or "which session" guesswork. **[verified: hooks-guide]**
4. **For our orchestration specifically, each pipeline operation runs as a Task-tool subagent**, so `SubagentStop` is the natural per-operation trigger and `Stop`/`SessionEnd` are the session-level sweeps — but the tokens still come from reading the file those hooks point at.

---

## 2. The token question — answered definitively

**Do *lifecycle* hooks (`SessionStart`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `SessionEnd`, `PreCompact`) carry token counts on stdin?**

**No** — confirmed first-party (§2.5). They carry session / identity / lifecycle context only. This matches the declined feature requests GitHub **#11008** / **#52089** (asking for a `usage` block on hook inputs / statusline; the latter closed "not planned") and our internal snapshot's *"hook input never contains token counts."* **[verified first-party + GitHub issues]**

**But there is one partial exception — and a sharp caveat on it:**

**The `PostToolUse` hook for the `Agent` tool carries rich per-operation data on stdin — but its token figures are final-turn-only.** When a subagent completes, its `tool_response` includes `resolvedModel`, `agentId`, `agentType`, `tool_use_id`, aggregate `toolStats` / `totalToolUseCount` / `totalDurationMs`, the verbatim prompt + response, **and a `usage` block + `totalTokens` that — confirmed by the multi-turn probe (§2.5) — equal only the subagent's *last* API turn, not the sum across its turns.** So the hook delivers all the per-operation *metadata* with no file read, but **accurate per-operation token totals require summing `message.usage` across the subagent transcript at `agent_transcript_path`.** Because every pipeline operation is an `Agent`-tool subagent, this is the per-operation capture seam: hook for trigger + metadata + file-locator, transcript for the token sum.

**What is still file-or-OTel-only:** the **main orchestrator session's own per-API-request usage** — its coordination turns between spawns. No hook carries that (the `Stop` hook fires per main turn but with no `usage`). For complete accounting, read the main transcript (located via the hook's `transcript_path`) at `SessionEnd`, or use OTel (`claude_code.api_request` carries the counts; requires a collector — the parked "OTEL relay" idea, not V1). This residual is small relative to the operations.

> **Bottom line, corrected twice:** Hooks give rich per-operation *metadata* and the verbatim prompt/response for free, plus a deterministic trigger and the exact transcript path — but **not** accurate per-operation token totals (the `Agent`-`PostToolUse` `usage` is final-turn-only). So file-reading is **not** eliminated; it is **precisely targeted** — the hook hands you the one `agent_transcript_path` to sum, at the right moment, with zero discovery. The synthesis: hook triggers + locates + enriches; the transcript is the token source of truth.

### 2.5 First-party probe — Claude Code 2.1.177 (2026-06-14)

A throwaway probe — a hook on every event dumping its stdin to NDJSON; one headless session that spawned one `Explore` subagent running one `Bash` call — produced these **verbatim** findings:

- **`PostToolUse` with `tool_name: "Agent"`** (the subagent-completion event) carried the full roll-up:
  ```json
  "tool_response": {
    "status": "completed", "agentId": "a407…", "agentType": "Explore",
    "resolvedModel": "claude-haiku-4-5-20251001",
    "totalTokens": 12230, "totalDurationMs": 4160, "totalToolUseCount": 1,
    "usage": { "input_tokens": 6, "output_tokens": 38,
               "cache_read_input_tokens": 12057, "cache_creation_input_tokens": 129,
               "server_tool_use": {…}, "service_tier": "standard", "speed": "standard",
               "iterations": [ … ] },
    "toolStats": { "readCount":0,"searchCount":0,"bashCount":1,
                   "editFileCount":0,"linesAdded":0,"linesRemoved":0,"otherToolCount":0 }
  },
  "tool_input": { "subagent_type": "Explore", "description": "…", "prompt": "<verbatim spawn prompt>" },
  "tool_use_id": "toolu_01WwUM…"
  ```
  → tokens **+** `resolvedModel` **+** `toolStats` **+** the deterministic spawn link (`tool_use_id`) **+** the verbatim spawn prompt (`tool_input.prompt`) **+** the verbatim response (`tool_response.content`), all on one stdin payload.
- **The Task tool is reported as `tool_name: "Agent"`** in hook payloads (not `"Task"`). A `PostToolUse` matcher should target `Agent`.
- **`SubagentStop`** carried `agent_transcript_path` (→ `…/subagents/agent-<id>.jsonl`), `agent_id`, `agent_type`, `stop_hook_active`, and `last_assistant_message` (the subagent's final text) — **but no `usage`.** (Resolves smoke-test #1: `agent_transcript_path` is present.)
- **`SubagentStart`** was lean — `agent_id` + `agent_type` only, **no spawn prompt, no parent `tool_use_id`.** (For the prompt/link at *start* time, use `PreToolUse`/`Agent`, which carries `tool_input.prompt` + `tool_use_id`.)
- **`PreToolUse`/`PostToolUse` carry `tool_use_id` on stdin** (resolves smoke-test #3: present in command-hook stdin, not only the SDK callback). Tool hooks fired *inside* a subagent also carry `agent_id` + `agent_type`, so every tool call is attributable to its subagent.
- **A regular tool's `PostToolUse` (e.g. `Bash`) carries `tool_response` but no `usage`.** Only the `Agent` tool's `PostToolUse` carries tokens.
- **`SessionStart`** carried `session_id` / `transcript_path` / `cwd` / `source` — **no `model` / `agent_type`** on this version (correcting an earlier inference in §4).
- Did **not** fire in this minimal run (no trigger): `PreCompact` / `PostCompact`, `StopFailure`, `PostToolUseFailure`.

**Resolved by a second (multi-turn) probe — `usage` is final-turn-only.** A subagent forced through 5 sequential tool calls (9 assistant turns) returned `Agent`-`PostToolUse` `totalTokens: 13284`, which **exactly equals its *last* turn's** `input+output+cache_read+cache_creation` (6+85+12984+209). Summed across all 9 turns the transcript is far larger (output 519 vs last-turn 85; cache_creation 26177; cache_read 87610). The aggregate fields `totalToolUseCount` (4) and `totalDurationMs` *are* real roll-ups; **`usage`/`totalTokens` are not.** ⇒ For accurate per-operation token totals, **sum `message.usage` across the subagent transcript** (`agent_transcript_path`); the hook's own usage undercounts any multi-turn operation.

---

## 3. The common envelope + `transcript_path` (the pivotal insight)

Every command hook receives, on stdin, a JSON object that always includes:

| Field | Meaning | Telemetry use |
|---|---|---|
| `session_id` | Session UUID; matches the JSONL filename and OTel `session.id` | Correlation key |
| `transcript_path` | **Absolute path to the session's main JSONL transcript** | Locate the file to scrape — no globbing |
| `cwd` | Working directory at event time | Project/attribution context |
| `permission_mode` | `default` / `acceptEdits` / `plan` / etc. | Context |
| `hook_event_name` | The event that fired (`"Stop"`, `"SubagentStop"`, …) | Dispatch |

**[verified: hooks-guide "common input fields"; matches internal snapshot §6]**

**Why `transcript_path` is the whole point.** TELEMETRY-1's capture today would have to slugify `cwd` → glob `~/.claude/projects/<slug>/` → guess which `<session>.jsonl` is current. A hook hands us the resolved path directly. From it, the subagent directory is a deterministic sibling — `<dir-of-transcript>/<session-id>/subagents/agent-<hex>.jsonl` (and `.meta.json`). **[path layout verified: internal snapshot §1; that the Stop hook's `transcript_path` points at the main transcript only — not subagents — verified: research pass B]**

---

## 4. Telemetry-relevant events and their stdin

Claude Code exposes ~27–30 hook events (`SessionStart`, `Setup`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `SubagentStart`, `SubagentStop`, `Stop`, `StopFailure`, `TaskCreated`, `TaskCompleted`, `PreCompact`, `PostCompact`, `SessionEnd`, and more — the exact set is version-sensitive; defer to the live reference for the full list). Below are only the events that matter for capture. Tokens are absent from every *lifecycle* event. The partial exception is `PostToolUse` when `tool_name` is `Agent`, which carries `resolvedModel` + aggregate `toolStats` + the subagent's **final-turn** `usage` (not its cumulative total — §2.5). For the lifecycle rows, the column that matters is "what context it hands us."

| Event | Fires when | Telemetry-useful stdin (beyond the common envelope) | Output contract | For us |
|---|---|---|---|---|
| **SessionStart** | Session begins / resumes / clears / after compact | `source` (`startup`/`resume`/`clear`/`compact`); optionally `model`, `agent_type` | stdout can inject context | Already wired (preamble). Confirms session/cwd. |
| **UserPromptSubmit** | User submits a prompt | `prompt` text | stdout injects context; exit 2 blocks | Marks a turn boundary. |
| **PreToolUse** | Before a tool runs | `tool_name`, `tool_input`, `tool_use_id` ¹ | JSON permission decision; exit 2 blocks | Live tool-activity signal. |
| **PostToolUse** | After a tool succeeds | `tool_name`, `tool_input`, `tool_response`, `tool_use_id`; **`tool_name:Agent`** adds `resolvedModel`, `toolStats`, prompt+response, and a **final-turn** `usage`/`totalTokens` | JSON can rewrite result / add context | `Agent` variant = per-op metadata free; **token totals need the transcript sum.** Other tools = per-tool counts. |
| **SubagentStart** | A subagent is spawned | `agent_id`, `agent_type`; likely `agent_prompt` ² | notify-only | Opens a per-operation bracket. |
| **SubagentStop** | A subagent finishes | `agent_id`, `agent_type`; `agent_transcript_path` ² | notify-only | **Per-operation trigger** — see §5. |
| **Stop** | The (orchestrator) session finishes a response | `stop_hook_active` | JSON `decision:"block"` forces another turn | **Primary cumulative-sweep trigger.** |
| **SessionEnd** | Session terminates | `reason` (`clear`/`logout`/`resume`/…) | exit code ignored | Final flush before logs rotate. |
| **PreCompact / PostCompact** | Around context compaction | trigger (`manual`/`auto`); compaction stats | Pre can block; Post is notify | Bracket compaction-driven token churn. |
| **TaskCreated / TaskCompleted** | Task tool list changes | `task_id`, `task_status` | notify-only | Not token-bearing; low value. |

**Field notes:**
¹ **`tool_use_id` on `PreToolUse`/`PostToolUse` stdin.** Our internal snapshot treats `tool_use_id` as present on tool-hook input and usable as a join key against OTel `tool_result`. **[verified: snapshot §4/§6]** One research pass flagged that the *Agent SDK* exposes `tool_use_id` as a separate callback parameter (not inside the input object) — that is the **SDK** contract, not the **command-hook stdin** contract. For command hooks reading stdin, treat `tool_use_id` as **present** but confirm with the §8 probe.
² **Subagent fields (`agent_transcript_path`, `agent_prompt`, even the full `SubagentStart` schema).** These are shown in the **Agent SDK** callback docs and proposed in GitHub **#16424** ("expose agent context in hook payloads"), but the **command-hook stdin** schemas for `SubagentStart`/`SubagentStop` are under-documented (the `SubagentStart` schema issue **#19170** was closed "not planned"/undocumented). **Treat `agent_transcript_path` as likely-present-but-`[smoke test]`.** If it is absent on your version, the subagent JSONL is still a deterministic sibling of the parent `transcript_path` + `agent_id`, so attribution does not depend on it.

---

## 5. Subagent attribution via hooks (because our operations *are* subagents)

The rad-orchestration pipeline runs the **orchestrator as one Claude Code session**; every token-bearing operation (`requirements`, `master_plan`, `coding`, `code_review`, `phase_review`, `final_review`, `commit`, `pr`) is a **Task-tool subagent** it spawns (`orchestrator.md`: *"Spawn the `rad-orc:reviewer` agent…"*). Each lands as `subagents/agent-<hex>.jsonl` with an `agent-<hex>.meta.json` sidecar `{agentType, description, toolUseId}`. **[verified: `harness-files/agents/orchestrator.md`, `runtime-config/action-events/action.spawn_code_reviewer.md`; sidecar shape from internal snapshot §1]**

This makes the subagent hooks a strong fit — and the probe (§2.5) shows the **`Agent`-tool `PostToolUse`** is the single richest event:

- **`PostToolUse`/`Agent` is the per-operation metadata + trigger event.** It fires once when the subagent completes, carrying — on stdin, no file read — `resolvedModel`, `agentType`, `agentId`, the spawn `tool_use_id`, aggregate `toolStats`/`totalToolUseCount`/`totalDurationMs`, the verbatim spawn prompt (`tool_input.prompt`), and the verbatim response (`tool_response.content`). Its `usage`/`totalTokens` are **final-turn-only** (§2.5) — so it identifies, enriches, and brackets the operation but does **not** by itself cost it.
- **`SubagentStop` complements it** with `agent_transcript_path` — the deterministic pointer to the subagent JSONL you sum for the true token total — plus `last_assistant_message`.
- **What hooks still do *not* give us:**
  - **Accurate per-operation token totals** — the `Agent`-`PostToolUse` `usage` is final-turn-only; sum `message.usage` across the subagent transcript at `agent_transcript_path` (the hook hands you that path). **[verified first-party: §2.5]**
  - **The main orchestrator session's own per-request tokens** — not in any hook; read the main transcript (via `transcript_path`) at `SessionEnd`, or use OTel.
  - **Operation *semantics*.** `agentType` cannot distinguish `code_review` from `phase_review` (both are the reviewer agent), or attempt N from a retry. That disambiguation comes from the **pipeline event funnel**, not the harness — see §6. (`tool_use_id` gives the deterministic link; the funnel supplies the meaning.)

**Cleanest hook-driven per-operation path:** register `PostToolUse` matched to `Agent` → on fire, read `resolvedModel` + `agentType` + `tool_use_id` + `toolStats` + `agent_transcript_path` straight from stdin → **sum `message.usage` across that transcript for the accurate token total** → emit a lean usage record → join to the pipeline operation-event (by `tool_use_id`/prompt or session+window) for phase/task/verdict semantics. Model, identity, tool-stats, and the verbatim bodies come free from the hook; the token total comes from the hook-pointed transcript; semantics from the funnel. The hook removes all file-*discovery*; the file read shrinks to a targeted per-operation `usage` sum.

---

## 6. Where pipeline events fit (Stream A is unaffected — and gets *tighter*)

Token attribution to a *pipeline operation* (phase/task/verdict, not just agent kind) is **Stream A**, and it comes from **radorch's own engine** — the `processEvent()` funnel in `cli/src/lib/pipeline-engine/engine.ts` — **not** from Claude Code hooks. The hooks decision does not threaten Stream A's existence; the funnel still owns the semantic layer (operation kind, phase, task, attempt, verdict) that the harness has no concept of.

**Hooks make the locked Stream A↔B correlation more precise, not obsolete.** The locked mechanism (TELEMETRY-1, "Option A"): the funnel appends an **operation-event record** (operation block + `session_id` + `cwd` + a session/time window) to a per-project operations log; capture **joins** each usage row to the operation whose window contains it.

- The funnel runs *before* the subagent exists (the orchestrator spawns it only after reading the signal envelope), so the funnel cannot know the subagent's `agent_id` — the join is inherently window-based, **not** a foreign key. **[grounded: orchestrator spawns post-signal]**
- The `Agent`-tool `PostToolUse` exposes **`tool_use_id`** and the **verbatim spawn prompt** (which *is* the funnel's `data.prompt`), so the join can be near-**deterministic** (match on `tool_use_id` or prompt-hash) rather than a fuzzy time-window. `SubagentStop` adds an exact per-operation bracket, and `agentType` cross-checks the funnel's operation kind.
- Net: the funnel supplies *semantics*; the hook supplies a *precise per-operation envelope*; the join key stays `orchestrator session_id + window`, now far tighter.

---

## 7. Gain / loss vs. file-scraping, and how it maps to our installer

### 7.1 Gain / loss table

| Datum we need | From hook stdin directly? | From the file the hook points to? | OTel only? |
|---|:--:|:--:|:--:|
| **per-op (subagent) token TOTAL** | ⚠️ final-turn only (`PostToolUse`/`Agent`) | ✅ sum `message.usage` via `agent_transcript_path` | ✅ |
| **main-session** per-request tokens | ❌ — read file via `transcript_path` | ✅ `message.usage` | ✅ |
| per-op model | ✅ `resolvedModel` | ✅ | ✅ |
| per-op `iterations[]` / retries | ⚠️ final-turn (`usage.iterations`) | ✅ | ✅ (`api_retries_exhausted`) |
| per-op `server_tool_use` counts | ⚠️ final-turn (`usage`) | ✅ | ❌ |
| per-op `toolStats` (tool counts, lines ±) — accurate aggregate | ✅ (`PostToolUse`/`Agent`) | ⚠️ derivable | partial |
| subagent `agentType` / `agentId` | ✅ (`Agent` hooks + `Subagent*`) | ✅ (`.meta.json`) | ✅ (`agent.name`, gated) |
| verbatim spawn prompt + response | ✅ (`Agent`: `tool_input.prompt` / `tool_response.content`) | ✅ | ❌ (gated bodies only) |
| tool name / per-tool breakdown | ✅ (`Pre/PostToolUse`) | ✅ | ✅ (`tool_result`) |
| `tool_use_id` (deterministic spawn link / join key) | ✅ | ✅ | ✅ |
| **which file to read / when** | ✅ `transcript_path` + deterministic fire | — (must discover) | — |
| session_id / cwd | ✅ | ✅ | ✅ |
| lifecycle timing (turn / subagent start-stop) | ✅ | ⚠️ inferable | ✅ |

All rows above are `[verified first-party]` via the §2.5 probe. The `Agent`-`PostToolUse` `usage` / `totalTokens` / `iterations` / `server_tool_use` are **final-turn-only**, so accurate per-op token totals come from summing the transcript the hook points to (`agent_transcript_path`). `toolStats` / `totalToolUseCount` / `totalDurationMs` *are* accurate aggregates. `model` is **not** on `SessionStart` (2.1.177), but `resolvedModel` **is** on the `Agent`-tool `PostToolUse`.

**Reading it:** hooks add a column the file approach never had — *deterministic trigger + exact file locator + free session context* — and lose **nothing**, because every datum hooks lack is in the file the hook points at. The normalization layer (neutral schema, adapter mapping, per-operation overlay) is **unchanged**; hooks only change the *front door*.

### 7.2 What it takes to wire (grounded in our installer)

Our installer already registers Claude hooks with a clean, tested pattern — extending it to a `Stop`/`SubagentStop` telemetry hook is low-risk:

- **Settings file & shape:** `~/.claude/settings.json`, under `hooks.<Event>` as an array of `{ hooks: [{ type: "command", command: "<cmd>" }] }` entries. **[verified: `harness-installers/standard/lib/install/claude-hook-settings.js`]**
- **Idempotency & coexistence:** each rad-orc entry carries a marker comment (today `# rad-orc-preamble`); merge skips if the marker is present, remove filters by marker — user hooks and multiple hooks per event are preserved. A telemetry hook would use a distinct marker (e.g. `# rad-orc-telemetry`). Writes are atomic (temp + rename). **[verified: `claude-hook-settings.js` `mergePreambleHook`/`removePreambleHook`; tests in `claude-hook-settings.test.mjs`, `hook-wiring.test.mjs`]**
- **CLI invocation pattern:** shims call `spawnSync(process.execPath, [radorchPath, "<verb>"])`, resolving `radorch.mjs` via `CLAUDE_PLUGIN_ROOT`/`COPILOT_PLUGIN_ROOT` or relative to the shim. A telemetry shim would call a new `telemetry capture` verb. **[verified: `harness-installers/shared/hooks/session-preamble.mjs`]**
- **The one genuinely new capability:** the current shim (`session-preamble.mjs`) is **env-only — it reads no stdin.** To receive `transcript_path` / `session_id` / `cwd` from a `Stop`/`SubagentStop` payload, a telemetry shim must **read the hook's stdin JSON**. Small, but a real addition to the shim pattern. **[verified: shim reads only env/argv today]**
- **Platform notes:** quote the node path (`node "<path>"`) for spaces; on the plugin path, Windows `/c/...`→`C:/...` normalization already exists; never throw from the hook entry point (soft-fail, exit 0) so capture can never block or fail a session. **[verified: existing shim + `hooks-shim.test.mjs`]**

---

## 8. Open questions / smoke tests (a 10-minute probe settles all of them)

The docs are SDK-complete but **command-hook-stdin-incomplete** for several fields. Rather than ship on inference, drop a **probe hook** that dumps every payload and run one tiny session.

**Probe recipe (zero-risk, no global config change):** in a throwaway directory, create `.claude/settings.json` registering one command on each of `SubagentStart`, `SubagentStop`, `Stop`, `PostToolUse`, `SessionEnd`, where the command is a node/shell one-liner that appends `hook_event_name` + the full stdin JSON to `./hook-probe.ndjson`. Launch `claude` in that dir, have it spawn one subagent that runs one tool, then read `hook-probe.ndjson`.

**Resolved by the 2026-06-14 probe (§2.5):**
1. `SubagentStop` **includes `agent_transcript_path`** (→ `…/subagents/agent-<id>.jsonl`) plus `last_assistant_message`. ✅
2. `SubagentStart` does **not** include the spawn prompt or parent `tool_use_id` — it is lean (`agent_id` + `agent_type`). Use `PreToolUse`/`Agent` for the prompt + link. ✅
3. `tool_use_id` **is** in `PreToolUse`/`PostToolUse` command-hook stdin (not SDK-callback-only). ✅
4. `Stop` stdin = common envelope + `stop_hook_active` + `last_assistant_message`; its `transcript_path` points at the **main** session only, never subagents. ✅
5. `SessionStart` (2.1.177) carries `source` but **no `model` / `agent_type`.** ✅
6. The Task tool is reported as `tool_name: "Agent"` — and the headline correction: the `Agent`-tool `PostToolUse` carries the full subagent `usage`. ✅

**Resolved by the second (multi-turn) probe:**
7. `Agent`-`PostToolUse` `usage` / `totalTokens` is **final-turn-only**, not aggregate — `totalTokens` (13284) matched the last turn exactly against a 9-turn transcript that summed far higher. Sum the transcript (`agent_transcript_path`) for true per-op totals. ✅

**Still open:**
- **Fire reliability / ordering** of `Stop` / `SubagentStop` and whether `Pre/PostCompact`, `StopFailure`, `PostToolUseFailure` behave as expected under real multi-operation pipeline load on Windows (the minimal runs exercised neither compaction nor failures).

---

## 9. Reference URLs

### Official docs
- Hooks reference (event stdin schemas): <https://code.claude.com/docs/en/hooks>
- Hooks guide (lifecycle, common input fields, output contract): <https://code.claude.com/docs/en/hooks-guide>
- Agent SDK hooks (callback signatures — distinct from command-hook stdin): <https://code.claude.com/docs/en/agent-sdk/hooks>
- Monitoring & OpenTelemetry (the non-file token source): <https://code.claude.com/docs/en/monitoring-usage>

### Evidence that hooks lack token data
- GitHub anthropics/claude-code **#11008** — request to expose token usage/cost in hook inputs (proposes the missing `usage` block).
- GitHub anthropics/claude-code **#52089** — request to expose session token usage to hooks/statusline; **closed "not planned."**
- GitHub anthropics/claude-code **#16424** — proposal to expose agent context (`agent_id`/`agent_type`/`agent_transcript_path`) in hook payloads.
- GitHub anthropics/claude-code **#19170** — `SubagentStart` input schema undocumented; closed "not planned."

### Internal companions (this repo / project store)
- `~/.radorc/projects/TELEMETRY/claude-code-telemetry.md` — full telemetry surface (JSONL `usage`, OTel catalog, §6 hooks summary). Baseline.
- `docs/research/copilot-cli-hooks.md` — sibling research on Copilot CLI's hook context-injection contract (cross-harness contrast).
- `harness-installers/standard/lib/install/claude-hook-settings.js` — the hook-registration pattern a telemetry hook would extend.
