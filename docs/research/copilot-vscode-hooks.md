# GitHub Copilot in VS Code — Agent-Plugin Hook Lifecycle & Context-Injection Contract

> **Type:** Research / reference. Evergreen.
> **Scope:** GitHub Copilot **agent-plugins in VS Code** (the VS Code editor extension's plugin/hook system) — the hook event lifecycle and the stdout / context-injection **output contract**, with a focus on injecting conversation context at session start. Targets the **VS Code flavor** exclusively (`code.visualstudio.com/docs/copilot/customization/...`, plugins cloned under VS Code's `agent-plugins` / `agentPlugins` cache, configured via the Agent Plugins panel). The Copilot **CLI** (`~/.copilot/`, `copilot plugin install …`) and **Claude Code** are different products with different output contracts; where they differ, that is flagged explicitly and segregated — CLI/Claude behavior never defines the VS Code contract here.
> **Last verified:** 2026-06-02 against `code.visualstudio.com/docs/copilot/customization/hooks` and `…/agent-plugins`, the `microsoft/vscode-docs` source for both, the hooks reference **bundled inside the Copilot Chat extension** (`microsoft/vscode-copilot-chat/assets/prompts/skills/agent-customization/references/hooks.md`), VS Code release notes v1.110–v1.112, and `github/copilot-sdk` / `obra/superpowers` issues. Agent hooks and agent plugins are both **Preview** in VS Code — *"The configuration format and behavior might change in future releases."* Re-verify the output shape against your installed VS Code build before relying on it.
> **Audience:** Contributors authoring or maintaining a VS Code Copilot agent plugin (or porting one from Copilot CLI / Claude Code) who need a plugin hook to surface session-start context, recovery guidance, or any model-visible text.

---

## What this adds over `copilot-vscode-plugin-system.md`

The companion reference [`./copilot-vscode-plugin-system.md`](./copilot-vscode-plugin-system.md) documents the VS Code Copilot customization surfaces, the plugin distribution/install model, the `plugin.json` manifest probe order, the format→plugin-root-token table, and the hook **config** schema (events list, exit codes, file-discovery order). Treat it as the baseline; this document does **not** re-derive it.

This document goes deeper on the one area the baseline under-specifies: **what VS Code does with each hook's STDOUT, per event — and specifically the exact JSON output shape a hook must emit to inject model-visible conversation context at `SessionStart`.** The baseline's exit-code table says "stdout parsed as JSON" but does not pin down the *shape* of that JSON, nor that **raw/plain stdout is never injected**, nor that VS Code uses the **nested `hookSpecificOutput.additionalContext`** shape (the Claude Code shape) rather than the Copilot CLI's **bare** `additionalContext`. That gap is the subject of this doc.

The CLI sibling for contrast is [`./copilot-cli-hooks.md`](./copilot-cli-hooks.md) — same structure, but its contract is **CLI-specific** (bare top-level `additionalContext`, no raw-stdout injection, version-gated). Do not transplant its output shape to VS Code.

**The central confusion this resolves:** a plugin's `SessionStart` hook that prints **plain text** to stdout injects context in **Claude Code** (which adds raw stdout to context) but produces **nothing** in **VS Code Copilot**. And a hook ported from **Copilot CLI** that emits **bare** `{ "additionalContext": "…" }` *also* may inject nothing in VS Code, because VS Code reads the **nested** `hookSpecificOutput.additionalContext`. Three ecosystems, three contracts (§5).

---

## 1. TL;DR — the VS Code contract in four sentences

1. **VS Code parses every hook's stdout as JSON on exit 0** and *only* acts on recognized fields; **raw/plain stdout is never injected** as context. **[verified: hooks.md "Exit Code `0` | Success: parse stdout as JSON"; extension-bundled reference "Hooks receive JSON on stdin and can return JSON on stdout"]**
2. **`SessionStart` *does* fire for plugins and *does* support context injection** — via the **nested** shape `{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "…" } }`. **[verified: hooks.md "SessionStart output" example, verbatim §3]**
3. **The injection field is `hookSpecificOutput.additionalContext` (nested), not a bare top-level `additionalContext`** — this matches Claude Code's nesting, *not* Copilot CLI's bare field. **[verified: hooks.md SessionStart/SubagentStart examples; extension-bundled reference]**
4. **Manifest format (Claude / Copilot / OpenPlugin) affects only plugin-root token + env-var injection, *not* the hook output contract** — *"Plugin hooks use the same base format as workspace hooks."* A Claude-format plugin in VS Code follows **VS Code's** output contract (nested `hookSpecificOutput`), which *happens to coincide* with Claude Code's nesting — but it is VS Code's contract, reached independently. **[verified: agent-plugins.md "Hooks in plugins"; §4]**

---

## 2. Per-event STDOUT / context-injection contract (the centerpiece)

For each of VS Code's **eight** hook events, what VS Code does with the hook's stdout on **exit 0**: `ignored` (common-output only — no context/decision field), `parsed-as-JSON-decision`, or `injected-as-context` — and the exact field path when injected. Event names are **PascalCase** (VS Code's native casing). camelCase variants from CLI-format hooks are normalized at load (baseline).

All events additionally honor the **common output fields** on exit 0 — these are not context injection; they are session/flow control:

```json
{ "continue": true, "stopReason": "…", "systemMessage": "…" }
```

| Field | Type | Effect | Source |
|---|---|---|---|
| `continue` | boolean | `false` stops the entire agent session (default `true`). | **[verified: hooks.md "Common output format"]** |
| `stopReason` | string | Shown to the **user** when `continue:false`. | **[verified]** |
| `systemMessage` | string | Warning shown to the **user** in chat. **Not** model context. | **[verified]** |

Event-by-event:

| Event (PascalCase) | Stdout on exit 0 | Honored output fields | Injection / decision shape | Notes |
|---|---|---|---|---|
| `SessionStart` | **JSON parsed → context injected** | `hookSpecificOutput.additionalContext` (string) | `{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "…" } }` | The one that matters. Raw stdout ignored. Fires on the **first prompt of a new session** (see §3.1 timing). **[verified: hooks.md §"SessionStart output"]** |
| `UserPromptSubmit` | **No context/decision field — common output only** | `continue`, `stopReason`, `systemMessage` only | — | Verbatim: *"The `UserPromptSubmit` hook uses the common output format only."* **There is NO documented `additionalContext` (bare or nested) for `UserPromptSubmit` in VS Code.** The events table lists "inject system context" as a *use case*, but the **output section grants no injection field** — do not assume this event can inject model-visible context. **[verified: hooks.md §"UserPromptSubmit output"]** |
| `PreToolUse` | **JSON parsed → permission decision (+ context)** | `hookSpecificOutput.permissionDecision` (`allow`/`ask`/`deny`), `permissionDecisionReason`, `updatedInput`, `additionalContext` | decision + optional `additionalContext`, all under `hookSpecificOutput` | `additionalContext` here is nested too. **[verified: hooks.md §"PreToolUse output"; extension reference]** |
| `PostToolUse` | **JSON parsed → result block (+ context)** | top-level `decision`(`block`)/`reason`; `hookSpecificOutput.additionalContext` | `{ "decision": "block", "reason": "…", "hookSpecificOutput": { "hookEventName": "PostToolUse", "additionalContext": "…" } }` | `decision` is top-level; `additionalContext` is nested. **[verified: hooks.md §"PostToolUse output"]** |
| `SubagentStart` | **JSON parsed → context injected** | `hookSpecificOutput.additionalContext` | `{ "hookSpecificOutput": { "hookEventName": "SubagentStart", "additionalContext": "…" } }` | Context prepended to the subagent's conversation. **[verified: hooks.md §"SubagentStart output"]** |
| `SubagentStop` | **JSON parsed → decision** | `hookSpecificOutput.decision`(`block`)/`reason` | nested decision | Blocks subagent completion. **[verified: hooks.md]** |
| `Stop` | **JSON parsed → decision** | `hookSpecificOutput.decision`(`block`)/`reason` | `{ "hookSpecificOutput": { "hookEventName": "Stop", "decision": "block", "reason": "…" } }` | `block` forces another agent turn. When a `Stop` hook is scoped to a custom agent, it is *also* treated as `SubagentStop`. **[verified: hooks.md §"Stop"]** |
| `PreCompact` | **Common output only** | `continue`, `stopReason`, `systemMessage` | — | Notification before context compaction; no context-injection field. **[verified: hooks.md]** |

### Reading the table

- **`hookSpecificOutput` is the wrapper for every event-specific field in VS Code** — `additionalContext`, `permissionDecision`, and the per-event `decision`/`reason` all live inside it (except `PostToolUse`'s top-level `decision`, which is the documented exception). This is the single most important structural fact and the chief difference from Copilot CLI, where every field is **bare top-level**. **[verified: extension-bundled reference "`PreToolUse` permissions are read from `hookSpecificOutput.permissionDecision`"]**
- **Three "injection-capable" events:** `SessionStart`, `SubagentStart`, and (secondarily) `PreToolUse`/`PostToolUse` via their nested `additionalContext`. **`UserPromptSubmit` is *not* one of them** in VS Code's documented contract — a critical, counter-intuitive finding for porters coming from the CLI, where `userPromptSubmitted` *also* can't inject via command-hook stdout but for a different reason.
- **`exit 2`** is the simplest block path: *"The hook's stderr is shown to the model as context. No JSON output is needed."* This is the one place **stderr** (not stdout) reaches the model — as a blocking error, not session-start context. **[verified: hooks.md §"Choosing how to return data"]**

---

## 3. `SessionStart` — the full contract

### 3.1 Does `SessionStart` fire for plugins in VS Code? When?

**Yes — it fires, and it fires for plugin-contributed hooks.** Plugin hooks run alongside workspace and user hooks; *"Plugin hooks support: `SessionStart`, `UserPromptSubmit`, …"* and *"When multiple hooks target the same event, all of them execute."* **[verified: agent-plugins.md "Hooks in plugins"]**

**Timing — read carefully.** VS Code's events table defines `SessionStart` as firing when the *"User submits the first prompt of a new session"* — **not** at editor/chat-pane open, but at **first prompt submit**. **[verified: hooks.md lifecycle table; extension reference "First prompt of a new agent session"]** Implication: a `SessionStart` hook cannot inject context "before the user types" — it injects context **bundled with the first turn**. Its `source` input field is *"Currently always `\"new\"`."* (no `resume`/`startup` distinction documented for VS Code, unlike the CLI's tri-state `source`). **[verified: hooks.md §"SessionStart input"]**

A real-world data point that the event **does fire** for VS Code plugin/workspace hooks: `obra/superpowers#1225` shows a `SessionStart` hook *firing* in VS Code Copilot on Windows but then failing at the command layer with a PowerShell syntax error (`NonBlockingError`) — i.e., dispatch reached the command; the failure was the command string, not non-firing. **[verified: obra/superpowers#1225 — log shows the hook ran and produced a NonBlockingError]**

### 3.2 What does VS Code do with `SessionStart` stdout?

- **Plain/raw stdout: ignored.** VS Code always parses stdout as JSON (exit-0 rule). A heredoc banner or `echo "…"` is not valid JSON → JSON-parse failure → nothing injected (and a parse-error log entry). There is **no raw-stdout-to-context path** in VS Code for any event. **[verified: hooks.md exit-code table; extension reference; §2]**
- **JSON stdout with nested `additionalContext`: injected as conversation context.** Verbatim: *"The `SessionStart` hook can inject additional context into the agent's conversation."* The implementation *"extracts the `additionalContext` from `hookSpecificOutput` when processing `SessionStart` hooks and joins multiple contexts with newlines."* **[verified: hooks.md §"SessionStart output"; source-behavior surfaced from `microsoft/vscode-copilot-chat` — inferred-from-search, see §7]**

### 3.3 The exact working shape (copy-pasteable, verbatim from the docs)

A `SessionStart` hook that injects context must print, on stdout, exit 0:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Project: my-app v2.1.0 | Branch: main | Node: v20.11.0"
  }
}
```

**[verified: this is reproduced verbatim from `code.visualstudio.com/docs/copilot/customization/hooks` §"SessionStart output" and its end-to-end example.]**

The field is **nested under `hookSpecificOutput`** and **`hookEventName` must be present and equal `"SessionStart"`**. The output table documents `additionalContext` as *"Context added to the agent's conversation."* **[verified: hooks.md output-field table]**

Candidate shapes — verdicts for **VS Code agent-plugins** specifically:

| Candidate | VS Code verdict |
|---|---|
| Raw/plain stdout text (the Claude Code "just echo" path) | **Ignored** — and a JSON-parse error. Stdout is always parsed as JSON. **[verified]** |
| `{ "additionalContext": "…" }` (bare top-level — the **Copilot CLI** shape) | **Not the documented VS Code shape.** Docs and the extension reference read injection from `hookSpecificOutput.additionalContext` (nested) only. Whether VS Code *silently tolerates* a bare top-level `additionalContext` as a fallback is **[unverified — smoke test required]**; do not depend on it. |
| `{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "…" } }` (nested — the **Claude Code** shape) | **Correct for VS Code.** **[verified: hooks.md verbatim example]** |
| `{ "context": "…" }` / `{ "systemMessage": "…" }` | **Wrong field.** `context` is undocumented; `systemMessage` shows a warning to the **user**, not model context. **[verified: common-output table]** |

A complete plugin hook entry (Claude-format plugin → `hooks/hooks.json`; the `${CLAUDE_PLUGIN_ROOT}` token/env-var lets the script self-locate — see §4):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-context.mjs\"",
        "timeout": 10
      }
    ]
  }
}
```

…where `session-context.mjs` writes the nested JSON and exits 0:

```js
const text = "Project: …";
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text }
}));
process.exit(0);
```

**[inferred — composed from the verified output shape (§3.3) + the verified plugin hook-file/token rules (§4); smoke test on your VS Code build.]**

> **Windows note.** VS Code runs the `windows` / `command` string through **PowerShell** on Windows. A bare `"C:\path\node.exe" arg` (cmd.exe style) is a **PowerShell parse error**; use the call operator `& "…"` or invoke `node` on PATH. **[verified: obra/superpowers#1225 — PowerShell syntax error from cmd-style command]** A robust cross-platform pattern is an inline `node -e "import(pathToFileURL(process.env.CLAUDE_PLUGIN_ROOT + '/hooks/…').href)"` shim that reads the env var inside the script rather than relying on shell `${…}` expansion. **[inferred]**

### 3.4 Stability / version provenance

- Agent **plugins** shipped **Preview** in VS Code **1.110** (Feb 2026 / released 2026-03-04); plugins can bundle hooks. **[verified: v1.110 release notes; baseline]**
- The **Agent Debug panel** also shipped in **1.110** (Preview) and shows *"exactly which prompt files, skills, hooks, and other customizations are loaded for a session."* This is the primary on-machine diagnostic for "is my hook even loading?" (§6). **[verified: v1.110 release notes]**
- **Agent-scoped hooks** (hooks in `.agent.md` frontmatter, gated by `chat.useCustomAgentHooks`) added **Preview** in **1.111** (2026-03-09). **[verified: v1.111 release notes]**
- The hook **output contract itself** (the `hookSpecificOutput.additionalContext` shape) is documented on the customization/hooks page and mirrored in the extension-bundled reference; the docs carry no per-version GA marker for the injection field — treat it as **Preview, may change**. **[verified: hooks.md preview banner]**

---

## 4. Does manifest format change the hook OUTPUT contract? (the crux)

**No. Manifest format affects only plugin-root token + env-var injection; the hook *output/injection* contract is uniform across formats and identical to workspace hooks.** **[verified: agent-plugins.md "Plugin hooks use the same base format as workspace hooks"; the output contract lives entirely on the workspace-hooks page, not the plugin page.]**

Two orthogonal axes, often conflated:

**Axis A — where the hook's stdout JSON must put its fields (the OUTPUT contract).** Set by **VS Code**, the same for every plugin format and for workspace/user hooks: nested `hookSpecificOutput.additionalContext` (§2/§3). **Manifest format does not move this.**

**Axis B — how the hook *command* locates its own files (token / env-var injection).** Set by **manifest format**:

| Format | Manifest path | Hook file | Plugin-root token | Env var injected into hook process |
|---|---|---|---|---|
| **Claude** | `.claude-plugin/plugin.json` | `hooks/hooks.json` | `${CLAUDE_PLUGIN_ROOT}` | `CLAUDE_PLUGIN_ROOT` |
| **OpenPlugin** | `.plugin/plugin.json` | (plugin-defined) | `${PLUGIN_ROOT}` | `PLUGIN_ROOT` |
| **Copilot** | `plugin.json` (root) | `hooks.json` (root) | **(Not defined)** | **(None)** |

**[verified: agent-plugins.md plugin-root token table + hook-file-path table, both quoted verbatim from `microsoft/vscode-docs`.]**

**The trap to avoid:** because a Claude-format plugin gets `CLAUDE_PLUGIN_ROOT` injected (Axis B), it is tempting to assume it therefore follows **Claude Code's** *runtime* hook semantics (raw-stdout injection). **It does not.** It runs inside **VS Code**, under **VS Code's** output contract (Axis A) — which *coincidentally* also uses the nested `hookSpecificOutput.additionalContext` shape, but for VS-Code reasons, not because the plugin is "Claude format." A Claude-format plugin's `SessionStart` hook emitting **raw stdout** injects **nothing in VS Code** (Axis A: stdout parsed as JSON; raw text fails to parse), even though the same hook injects in Claude Code (raw-stdout path). The shared nesting is why a *correctly-JSON* Claude-format hook is portable VS-Code↔Claude-Code; the raw-stdout shortcut is *not* portable. **[inferred from §2 + §5; high confidence — both contracts independently verified.]**

> **Copilot-format caveat (carried from baseline).** A **Copilot-format** plugin (root `plugin.json`) gets **no** plugin-root token and **no** env var in VS Code — its hook command has no documented way to self-locate. This is an Axis-B gap unrelated to the output contract, but it means Copilot-format plugins are the wrong choice when a VS Code hook must reference a bundled script by absolute path. **[verified: agent-plugins.md "(Not defined)"; baseline empirical note.]**

---

## 5. Claude Code vs Copilot CLI vs Copilot-in-VS-Code — SessionStart context injection (the three-way contrast)

This is the entire source of confusion: three ecosystems, three contracts, overlapping event names and field names. Generic, side-by-side:

| Aspect | **Claude Code** `SessionStart` | **Copilot CLI** `sessionStart` | **Copilot in VS Code** `SessionStart` |
|---|---|---|---|
| Raw/plain stdout on exit 0 | **Added to context automatically.** *"Any text your hook script prints to stdout is added as context for Claude."* | **Ignored.** *"Any output from this hook is ignored."* | **Ignored** (parsed as JSON; raw text = parse error). |
| "Just `echo` and it works" | **Yes** | **No** | **No** |
| JSON injection field | **Nested:** `hookSpecificOutput.additionalContext` (+ `hookEventName`) | **Bare:** top-level `additionalContext` | **Nested:** `hookSpecificOutput.additionalContext` (+ `hookEventName`) |
| Exact working JSON | `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` | `{"additionalContext":"…"}` | `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` |
| Native event casing | PascalCase `SessionStart` | camelCase `sessionStart` (PascalCase accepted) | PascalCase `SessionStart` |
| Plugin-root env var | `CLAUDE_PLUGIN_ROOT` | `%COPILOT_PLUGIN_ROOT%` (+ aliases incl. `CLAUDE_PLUGIN_ROOT`) | `CLAUDE_PLUGIN_ROOT` (Claude-format only) |
| Where the output contract is documented | `code.claude.com/docs/en/hooks` | `docs.github.com/en/copilot/reference/hooks-reference` (CLI + cloud agent only) | `code.visualstudio.com/docs/copilot/customization/hooks` |
| Stability | Stable | GA (version-sensitive; injection regressed pre-1.0.11) | **Preview** ("format/behavior may change") |

**[verified: Claude column — `code.claude.com/docs/en/hooks`; CLI column — `./copilot-cli-hooks.md` + GitHub hooks-reference; VS Code column — `code.visualstudio.com/.../hooks` (this doc).]**

**Two independent gotchas, two directions:**

1. **Porting from Claude Code → VS Code:** a hook relying on **raw stdout** injects nothing in VS Code. *Fix:* it already emits the right JSON *if* it used Claude Code's nested form — keep the nesting, just stop relying on the raw-stdout shortcut. The nested shape is shared, so a JSON-emitting Claude hook is portable.
2. **Porting from Copilot CLI → VS Code:** a hook emitting **bare** `{ "additionalContext": "…" }` may inject nothing in VS Code, because VS Code reads the **nested** path. *Fix:* wrap it: move `additionalContext` under `hookSpecificOutput` and add `hookEventName`.

A single hook that targets all three can emit the **nested** shape (works for Claude Code and VS Code) and additionally a **bare** top-level `additionalContext` (for Copilot CLI) in the *same* JSON object — the bare field is ignored by the nested-readers and the nested field is ignored by the CLI. **[inferred — emit-both belt-and-suspenders; smoke test the combined object on each runtime, since tolerance of extra fields is unverified for VS Code (§7).]**

> **⚠️ Documented-but-conflicting source.** The Awesome Copilot learning-hub page "Automating with Hooks" shows the **bare** `{ "additionalContext": "…" }` shape and claims it is *"compatible across GitHub Copilot CLI, VS Code, and Claude Code."* That page is **CLI-centric**, and its bare example reflects the **CLI** contract — it **conflicts** with the canonical VS Code docs and the Copilot Chat extension's own bundled reference, both of which use the **nested** `hookSpecificOutput.additionalContext` for VS Code. **Trust the `code.visualstudio.com` docs + the extension-bundled reference for VS Code; treat the learning-hub's "bare works everywhere" claim as CLI-leaked and unverified for VS Code.** **[verified-conflict: awesome-copilot learning hub vs `code.visualstudio.com/.../hooks`.]**

---

## 6. Hook config discovery & the hook process environment (VS Code)

### Where VS Code reads hook configs (probe order)

| Scope | Default location | Format |
|---|---|---|
| **Workspace (Copilot)** | `.github/hooks/*.json` | VS Code/Copilot |
| **Workspace (Claude)** | `.claude/settings.json`, `.claude/settings.local.json` | Claude |
| **User** | `~/.copilot/hooks`, `~/.claude/settings.json` | mixed |
| **Custom agent** | `hooks` field in `.agent.md` frontmatter (Preview; `chat.useCustomAgentHooks`) | inline |
| **Plugin** | `hooks/hooks.json` (Claude format) **or** `hooks.json` at plugin root (Copilot format) | per manifest format |

**[verified: hooks.md §"Hook file locations" + agent-plugins.md §"Hooks in plugins", both verbatim.]** *"Workspace hooks take precedence over user hooks for the same event type."* For `PreToolUse`, the **most restrictive** permission wins (`deny` > `ask` > `allow`). When several sources contribute the same event, **all run**, and multiple `additionalContext` values are **joined with newlines**. **[verified: hooks.md; agent-plugins.md; source-behavior per §7.]**

`chat.hookFilesLocations` customizes the set (relative or `~` paths only; default value shown verbatim in the baseline). Setting a path to `false` disables it — including defaults (e.g. to stop loading Claude-format hooks). **[verified: hooks.md.]**

### Env vars injected into the hook process

- **Claude-format plugin:** `CLAUDE_PLUGIN_ROOT` is *"set … for the hook process"* and `${CLAUDE_PLUGIN_ROOT}` is substituted in `command`/`cwd`/`env`. **[verified: agent-plugins.md.]**
- **OpenPlugin:** `PLUGIN_ROOT` (token + env var). **[verified.]**
- **Copilot-format:** **nothing** documented. **[verified: "(Not defined)".]**
- The hook **stdin** payload's common fields: `timestamp` (ISO-8601), `cwd`, `sessionId`, `hookEventName`, `transcript_path`. Per-event adds (`source` for SessionStart; `prompt` for UserPromptSubmit; `tool_name`/`tool_input`/`tool_use_id` for tool events). **[verified: hooks.md §"Common input fields".]**

### Diagnosing on-machine (the smoke-test surface)

- **Agent Debug panel** (1.110+, Preview): shows which hooks/customizations loaded for the session. **[verified: v1.110 notes.]**
- **Output panel → channel "GitHub Copilot Chat Hooks"**: hook output and errors. Search the broader log for **"Load Hooks"** to see which hooks loaded and from where. **[verified: surfaced from awesome-copilot debugging guidance / search; cross-checks the panel — confirm the exact channel name on your build.]**

---

## 7. Open questions / smoke tests

Items the docs do not settle for **VS Code agent-plugins**. Test against your installed VS Code + Copilot Chat build (use a distinctive sentinel string in `additionalContext` and ask the agent to repeat it).

1. **Does VS Code tolerate a *bare* top-level `additionalContext` at `SessionStart` as a fallback?** Docs/extension-reference read the **nested** path only. If bare is silently honored, a CLI-shaped hook would "accidentally work" — but **do not assume it; [unverified — smoke test].** The safe shape is nested.
2. **Are *extra* sibling fields tolerated?** For an emit-both (nested + bare) cross-runtime object — does VS Code reject/ignore the extra bare `additionalContext`, or error on the unknown field? **[unverified.]**
3. **Exact parsing in `microsoft/vscode-copilot-chat`.** The "extracts `additionalContext` from `hookSpecificOutput` … joins with newlines" behavior was surfaced via search of the repo, not read line-by-line (code search returned the bundled prose reference, not the minified parser). Confirm against the actual source/build if a contract detail is load-bearing. **[inferred-from-search — verify in source.]**
4. **`UserPromptSubmit` truly cannot inject model context in VS Code.** Docs say "common output format only." Confirm there is no undocumented `hookSpecificOutput.additionalContext` honored on `UserPromptSubmit` (the CLI/.NET-SDK side has a *separate, different* gap — `github/copilot-sdk#775` reports `additionalContext` from a UserPromptSubmit hook silently ignored in the .NET SDK/CLI runtime, with `modifiedPrompt` working instead; **that is not the VS Code surface** — but it corroborates "UserPromptSubmit is not a reliable injection point"). **[verified-absence in VS Code docs + corroborating-but-different-product evidence.]**
5. **Plain-stdout failure mode.** Confirm that raw text on `SessionStart` stdout produces a JSON-parse error in the "GitHub Copilot Chat Hooks" channel (expected) rather than silently injecting. **[expected; smoke test.]**
6. **Windows command quoting.** Confirm the PowerShell call-operator requirement (`& "…"`) and that an inline `node -e` shim reading `process.env.CLAUDE_PLUGIN_ROOT` sidesteps `${…}` shell-expansion issues cross-platform. **[partly verified via obra/superpowers#1225; smoke test your shim.]**
7. **`source` values.** VS Code docs say `source` is *"Currently always `\"new\"`."* Confirm whether resume/continue ever fires `SessionStart` and with what `source`. **[unverified — likely "fires only on new"; test.]**

---

## 8. Reference URLs

### Canonical VS Code docs — the contract
- https://code.visualstudio.com/docs/copilot/customization/hooks — **primary source for §2–§3 and §6.** Event list, common output fields, exit codes, per-event output sections, the verbatim `SessionStart` nested `hookSpecificOutput.additionalContext` example, discovery locations.
- https://code.visualstudio.com/docs/copilot/customization/agent-plugins — **primary source for §4.** "Hooks in plugins" (hook-file path by format), plugin-root token/env-var table, "Plugin hooks use the same base format as workspace hooks."
- https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/hooks.md — source for the above (read verbatim).
- https://github.com/microsoft/vscode-docs/blob/main/docs/copilot/customization/agent-plugins.md — source for the plugin hook tables (read verbatim).

### Implementation's own reference (source of truth)
- https://github.com/microsoft/vscode-copilot-chat/blob/main/assets/prompts/skills/agent-customization/references/hooks.md — the hooks reference **bundled inside the Copilot Chat extension**. Confirms stdin/stdout-JSON, `hookSpecificOutput.permissionDecision`, exit codes, "auto-inject context" as a documented hook use. **Cross-validates §2.**

### VS Code release notes (provenance / stability)
- https://code.visualstudio.com/updates/v1_110 — agent plugins (Preview) + Agent Debug panel ship (2026-03-04).
- https://code.visualstudio.com/updates/v1_111 — agent-scoped hooks (Preview) (2026-03-09).
- https://code.visualstudio.com/updates/v1_112 — weekly-cadence release (2026-03-18); no new hook-output changes noted.

### Primary evidence (issues)
- https://github.com/obra/superpowers/issues/1225 — `SessionStart` hook **fires** in VS Code Copilot on Windows but fails with a **PowerShell syntax error** (cmd-style command string). Evidence the event dispatches to plugin/workspace hooks, and the Windows quoting gotcha (§3.3).
- https://github.com/github/copilot-sdk/issues/775 — `additionalContext` from a `UserPromptSubmit` hook **silently ignored** (`.NET SDK` / CLI runtime; `ModifiedPrompt` works instead). **Different product** from VS Code, but corroborates that `UserPromptSubmit` is not a reliable injection point (§7.4).
- https://github.com/github/copilot-cli/issues/2142 — CLI `sessionStart` `additionalContext` fire-and-forget bug (CLI-only context; see the CLI sibling doc). Included to mark the boundary, not as VS Code evidence.

### Contrast ecosystems (do NOT use to define the VS Code contract)
- https://code.claude.com/docs/en/hooks — Claude Code: raw-stdout injection + **nested** `hookSpecificOutput.additionalContext`. The §5 Claude column.
- https://docs.github.com/en/copilot/reference/hooks-reference — GitHub hooks reference; **explicitly scoped to "Copilot CLI and Copilot cloud agent," NOT VS Code.** Uses **bare** `additionalContext`. The §5 CLI column. Do not apply to VS Code.
- [`./copilot-cli-hooks.md`](./copilot-cli-hooks.md) — the CLI sibling (bare top-level `additionalContext`, raw stdout ignored, version-gated). Contrast only.

### Community syntheses (cross-check, flagged)
- https://www.kenmuse.com/blog/creating-agent-plugins-for-vs-code-and-copilot-cli/ — VS Code vs CLI plugin creation (does not pin the output shape).
- https://awesome-copilot.github.com/learning-hub/automating-with-hooks/ — **CLI-centric**; shows **bare** `additionalContext` and claims cross-tool compatibility. **Conflicts with VS Code's nested shape — see §5 warning.**
- https://medium.com/@gdrenteria/vs-code-agent-hooks-give-copilot-context-before-the-first-message-… — "context before the first message" via `SessionStart`; useful framing, does not pin the exact JSON nesting.

### Baseline (this repo)
- [`./copilot-vscode-plugin-system.md`](./copilot-vscode-plugin-system.md) — VS Code Copilot customization surfaces, plugin install/distribution, manifest probe order, hook config schema. Baseline for everything not re-derived here.
