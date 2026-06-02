# GitHub Copilot CLI — Hook Event Lifecycle & Context-Injection Contract

> **Type:** Research / reference. Evergreen.
> **Scope:** Copilot CLI (the local `copilot` CLI) hook system — event lifecycle, stdin payloads, and the stdout / context-injection output contract. Targets the **CLI flavor** (`~/.copilot/`, `copilot plugin install ...`) exclusively. Where VS Code Copilot's agent-plugin hooks differ, that is flagged explicitly and segregated — VS Code behavior never defines the CLI contract here.
> **Last verified:** 2026-06-01 against `docs.github.com/en/copilot/...`, the `github/copilot-cli` `changelog.md`, and `github/copilot-cli` issues. Context-injection behavior in this product has been version-sensitive and repeatedly regressed (see the changelog history below) — re-verify against your installed CLI version before relying on any injection contract.
> **Audience:** Contributors authoring or maintaining a Copilot CLI plugin (or porting a plugin from Claude Code / VS Code) who need to surface session-start context, recovery guidance, or any model-visible text from a hook.

---

## What this adds over `copilot-cli-plugin-system.md`

The companion reference [`./copilot-cli-plugin-system.md`](./copilot-cli-plugin-system.md) documents the plugin install model, the `plugin.json` / `hooks.json` schemas (§2–§3), the general hook invocation contract (§4), env vars, exit-code semantics, and the marketplace model. Treat it as the baseline; this document does **not** re-derive it.

This document goes deeper on the one area the baseline under-specifies: **what Copilot CLI does with each hook's STDOUT, per event — and specifically whether/how a hook can inject model-visible conversation context.** The baseline correctly states that `userPromptSubmitted` stdout is "ignored" and that other events parse stdout as a JSON decision protocol, but it does not pin down the context-injection (`additionalContext`) mechanism, the per-event injection matrix, or the critical fact that **raw stdout is never injected** on the CLI (unlike Claude Code). That gap is the subject of this doc.

The central confusion this resolves: a `sessionStart` hook that prints plain text to stdout shows up as conversation context in **Claude Code** but produces **nothing** in **Copilot CLI**. The reasons are two independent differences — the raw-stdout assumption and the JSON field shape — both documented below.

---

## 1. TL;DR — the contract in three sentences

1. **Copilot CLI never injects a hook's raw/plain stdout into the model's context.** Plain text on stdout is discarded for every event. **[verified: github/copilot-cli#1139, multiple independent reproductions; tutorial doc "Any output from this hook is ignored by Copilot CLI"]**
2. **Context injection is opt-in via a JSON object with a bare top-level `additionalContext` string field** — `{ "additionalContext": "..." }` — and only on the specific events that support it (`sessionStart`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `preToolUse`, `notification`). **[verified: docs.github.com hooks reference; github/copilot-sdk session-lifecycle docs; changelog entries]**
3. **For `sessionStart` specifically, that injection only works on Copilot CLI ≥ v1.0.11** (2026-03-23); before that the field was parsed-but-discarded ("fire-and-forget"). **[verified: github/copilot-cli#2142 + changelog 1.0.11]**

---

## 2. Per-event STDOUT / context-injection contract

This is the centerpiece table. For each hook event it states what Copilot CLI does with the hook's stdout on **exit 0**: `ignored`, `parsed-as-JSON-decision`, or `injected-as-context` — and, where injected, the exact required output shape.

| Event (camelCase / PascalCase) | Stdout on exit 0 | Output fields honored | Injection shape | Notes |
|---|---|---|---|---|
| `sessionStart` / `SessionStart` | **JSON parsed → context injected** (CLI ≥ 1.0.11) | `additionalContext` (string) | `{ "additionalContext": "..." }` | Plain stdout ignored. Injected as conversation context at session start. **Before 1.0.11: parsed-but-discarded.** **[verified: changelog 1.0.11; #2142]** |
| `userPromptSubmitted` / `UserPromptSubmit` | **Ignored** (command-hook stdout) | — (command hook) | — | Docs: "Output processed: No." A command hook's stdout/JSON is **not** read; only side effects + exit code matter. (The **SDK/in-process** hook has a `modifiedPrompt` return, which is a different surface — see §5.) **[verified: hooks reference; baseline §4]** |
| `preToolUse` / `PreToolUse` | **JSON parsed → decision** (+ context ≥ 1.0.24) | `permissionDecision` (`allow`/`deny`/`ask`), `permissionDecisionReason`, `modifiedArgs`, `additionalContext` | decision fields bare; `{ "additionalContext": "..." }` | `additionalContext` support added in **v1.0.24** (2026-04-10). Earlier versions ignored it (#2585, open). **[verified: changelog 1.0.24; #2585]** |
| `postToolUse` / `PostToolUse` | **JSON parsed → result mod + context** | `modifiedResult`, `additionalContext` | `{ "additionalContext": "..." }` (or `modifiedResult`) | Multiple hooks' `additionalContext` joined with `\n\n`, capped ~10 KB. **Historically flaky** — first added 1.0.6, re-fixed 1.0.49 ("now injected as a system message instead of being silently discarded"), and #2980 still **OPEN** (2026-04). **[verified: changelog 1.0.6/1.0.49; #2980]** |
| `postToolUseFailure` / `PostToolUseFailure` | **JSON parsed → recovery context** | `additionalContext` | `{ "additionalContext": "..." }`; also **exit 2** → stderr/stdout appended as failure context | Recovery guidance to the agent after a tool error. **[verified: hooks reference]** |
| `agentStop` / `Stop` | **JSON parsed → decision** | `decision` (`block`/`allow`), `reason` | bare fields | `decision:"block"` forces another agent turn; `reason` becomes the next-turn prompt. No context-injection field. **[verified: hooks reference; baseline §3]** |
| `subagentStart` (camelCase only) | **JSON parsed → context injected** | `additionalContext` | `{ "additionalContext": "..." }` | "Cannot block creation, but `additionalContext` is prepended to the subagent's prompt." Added **v1.0.7**. **[verified: changelog 1.0.7; hooks reference]** |
| `subagentStop` / `SubagentStop` | **JSON parsed → decision** | `decision` (`block`/`allow`), `reason` | bare fields | Same decision protocol as `agentStop`. No context field. **[verified: hooks reference]** |
| `preCompact` / `PreCompact` | **Ignored** | — | — | "Output processed: No — notification only." **[verified: hooks reference]** |
| `sessionEnd` / `SessionEnd` | **Ignored** | — | — | "Output processed: No." Side-effects only. **[verified: hooks reference]** |
| `errorOccurred` / `ErrorOccurred` | **Ignored** | — | — | "Output processed: No." **[verified: hooks reference]** |
| `permissionRequest` (camelCase only, CLI) | **JSON parsed → permission decision** | `behavior` (`allow`/`deny`), `message`, `interrupt` | bare fields | `message` is the reason fed to the LLM on deny. **exit 2** ⇒ merged with `{"behavior":"deny"}`. No general context-injection field. **[verified: hooks reference; baseline §4]** |
| `notification` (camelCase only, CLI) | **JSON parsed → context injected (async)** | `additionalContext` | `{ "additionalContext": "..." }` | "If `additionalContext` is returned, the text is injected into the session as a prepended user message." Fire-and-forget; never blocks. **[verified: hooks reference]** |

### Reading the table

- **Three events ignore stdout entirely** for command hooks: `userPromptSubmitted`, `preCompact`, `sessionEnd`, `errorOccurred`. (`userPromptSubmitted` is the surprising one for porters — see §4.)
- **`additionalContext` is the single, consistent field name** for "inject model-visible text." It is always a **bare top-level string** — never nested inside a `hookSpecificOutput` wrapper. This is the opposite of Claude Code (see §6). **[verified: github/copilot-sdk session-lifecycle docs — "The `additionalContext` field is a direct property of the returned object, not nested within any wrapper."]**
- **Decision events** (`preToolUse`, `agentStop`, `subagentStop`, `permissionRequest`) use their own bare top-level fields (`permissionDecision`, `decision`, `behavior`, …), also not wrapped.

---

## 3. `sessionStart` — the full contract

### 3.1 Does `sessionStart` fire at all on the CLI? Under what conditions?

**It fires for interactive session starts, and the stdin payload's `source` field disambiguates the trigger.** **[verified: hooks reference + baseline §3/§4]**

Stdin payload (camelCase):

```json
{
  "sessionId": "abc123",
  "timestamp": 1704614400000,
  "cwd": "/path/to/project",
  "source": "startup",
  "initialPrompt": "optional"
}
```

`source` ∈ `"startup" | "resume" | "new"`. The PascalCase (`SessionStart`) variant uses `hook_event_name`, `session_id`, ISO-8601 `timestamp`, and `initial_prompt`.

Firing-condition nuances — **partly verified, partly version-sensitive:**

- The baseline (§3) quotes docs language that `sessionStart` "fires only for new interactive sessions … do not fire on resume." The live reference page, however, documents all three `source` values including `"resume"`, implying resume *does* fire and is distinguished by `source`. **These two statements conflict; treat resume-firing as [unverified — smoke test required].** Do not depend on `sessionStart` firing on `--continue`/resume without testing your installed version.
- **`sessionStart` has a documented history of simply not firing or firing out of order**, especially on Windows and in older versions:
  - #1730 (open) — `sessionStart` in `.github/hooks/` did not fire at all on CLI v0.0.420 (Windows/PowerShell).
  - #2201 (open) — following the official tutorial, `sessionStart` "doesn't print to terminal and doesn't run at CLI startup"; the reporter observed the `sessionStart` audit entry landing **after** the first `userPromptSubmitted` entry (an ordering bug).
  - #1352 (open) — `sessionStart` stdout "is not displayed in terminal UI" (related to the fact that stdout is discarded, §3.2).
  **[verified: issue states via gh API; all three OPEN as of 2026-06-01]**

**Takeaway:** `sessionStart` *is* a real CLI event, but its firing reliability and timing have open bugs. Anything that *must* run before the model first reads context is safer on `userPromptSubmitted` (see §4).

### 3.2 What does the CLI do with `sessionStart` stdout?

**Plain stdout: ignored.** The official tutorial states verbatim, for its `sessionStart` banner example:

> "Any output from this hook is ignored by Copilot CLI, which makes it suitable for informational messages." **[verified: docs.github.com/en/copilot/tutorials/copilot-cli-hooks]**

**JSON stdout with `additionalContext`: injected as conversation context — on CLI ≥ v1.0.11.** The reference pages state, for `sessionStart`:

> "Optional — can inject `additionalContext` into the session." **[verified: docs.github.com hooks reference + cli-hooks-reference]**

These two statements are *consistent*, not contradictory: the tutorial's example emits a plain-text heredoc banner (correctly "ignored"); the reference describes the JSON `additionalContext` path (honored). The tutorial simply never demonstrates the JSON form. The reference pages, conversely, show the `sessionStart` **input** schema but **no output JSON example** for `sessionStart` — the output shape is documented only as the field name `additionalContext`. **[verified: cli-hooks-reference shows input schema only for sessionStart, no output example]**

### 3.3 The exact working shape (copy-pasteable)

A `sessionStart` hook that injects context must print, on stdout, exit 0:

```json
{ "additionalContext": "Project: acme-api (TypeScript, pnpm). Active branch: main. Conventions: see CONTRIBUTING.md." }
```

The `additionalContext` is a **bare top-level string field** — *not* wrapped in `hookSpecificOutput`, *not* a `context` field, *not* raw text. **[verified: github/copilot-sdk session-lifecycle docs — bare top-level `additionalContext`]**

Candidate shapes explicitly **refuted**:

| Candidate | Verdict |
|---|---|
| Raw/plain stdout text | **Ignored.** Discarded for every event. **[verified: #1139, tutorial]** |
| `{ "additionalContext": "..." }` (bare) | **Correct** for CLI. **[verified: SDK docs, changelog 1.0.11]** |
| `{ "context": "..." }` | **No evidence it works.** `context` is not a documented field. **[inferred — refuted]** |
| `{ "hookSpecificOutput": { "additionalContext": "..." } }` (the Claude Code shape) | **Not the CLI shape.** This is the Claude Code nesting (§6). No evidence Copilot CLI reads the nested form. **[verified: SDK docs say bare, not nested]** |

A minimal cross-platform plugin hook entry (uses `%COPILOT_PLUGIN_ROOT%` per baseline §4 to locate the bundled script):

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "command": "node \"%COPILOT_PLUGIN_ROOT%\\hooks\\session-context.mjs\"",
        "timeoutSec": 10
      }
    ]
  }
}
```

…where `session-context.mjs` does `process.stdout.write(JSON.stringify({ additionalContext: text }))` and `process.exit(0)`. **[inferred — composed from verified pieces; smoke test required on your CLI version]**

### 3.4 Version history (why this is version-sensitive)

Verbatim from `github/copilot-cli/changelog.md`:

- **v1.0.7 (2026-03-17):** "Add subagentStart hook that fires when a subagent is spawned, with support for injecting additional context into the subagent's prompt."
- **v1.0.11 (2026-03-23):** "sessionStart hook additionalContext is now injected into the conversation." ← **the fix.** Same release: "Extension hooks from multiple extensions now merge instead of overwriting each other or hooks from hooks.json" (the multi-extension overwrite bug from #2142).
- **v1.0.24 (2026-04-10):** "preToolUse hooks now respect modifiedArgs/updatedInput, and additionalContext fields."
- **v1.0.49 (2026-05-18):** "postToolUse hook additionalContext is now injected as a system message for the model instead of being silently discarded." ← a *second* postToolUse fix; evidence that these injection paths regress.

**[verified: raw changelog.md, lines quoted directly]**

Before v1.0.11, sessionStart `additionalContext` was *parsed but thrown away*. Issue #2142 (CLOSED/COMPLETED 2026-03-23) describes the exact bug: "In the CLI's bundled source, the sessionStart hook invocation is fire-and-forget — no variable assignment, so the result (including additionalContext) is discarded." A maintainer confirmed: "The original issue was regarding that `additionalContext` is being ignored during `onSessionStart` hooks. I have a PR out for that" → "Fix gone out in latest CLI pre-release." **[verified: #2142 body + maintainer comments via gh API]**

---

## 4. If/when `sessionStart` can't inject — the recommended preamble pattern

If you target a CLI version older than 1.0.11, or you hit the open firing/ordering bugs (#1730/#2201), or you simply want the most battle-tested surface, the documented alternative is:

**Cache the context in `sessionStart` (side-effect only), then inject it on the first `userPromptSubmitted`.** This is the maintainer- and reporter-endorsed workaround from #2142:

> "Workaround: cache context in onSessionStart, inject via onUserPromptSubmitted modifiedPrompt." **[verified: #2142 body]**

Important caveat for the **command-hook** (`hooks.json`) flavor specifically: **`userPromptSubmitted` command-hook stdout is ignored** (docs: "Output processed: No"). The `modifiedPrompt` mechanism referenced in #2142 is part of the **in-process SDK/extension** hook surface (`onUserPromptSubmitted` returning `{ modifiedPrompt }`), not the command-hook stdout surface. **[verified: hooks reference; #2142 references the SDK return value]** So the real options for command-hook plugins are:

1. **`sessionStart` JSON `additionalContext`** — the intended path; requires CLI ≥ 1.0.11 and tolerance for the open firing bugs. **[verified-with-caveats]**
2. **Move the preamble to a non-hook surface** that the model reads natively at session start — e.g. ship the content as a **custom instructions file** (the CLI discovers instruction files from the working dir up to the git root) or a **skill/agent** the model loads. This sidesteps the hook injection contract entirely. **[verified: changelog notes instruction-file and monorepo discovery; baseline §8 agent/skill loading]**
3. **Write a marker/context file on `sessionStart` (side effect)** and have an instruction file or the first prompt reference it. The original feature request #1139 even proposed this as the fallback: "Hooks could write context to a `.github/context.md` file and Copilot CLI could automatically read/inject that." (That auto-read was *not* implemented; you must wire the reference yourself.) **[verified: #1139 body]**

There is **no event whose *raw* stdout is injected** at/near session start. The only session-start-adjacent injection surface is `sessionStart`'s JSON `additionalContext` (and, for subagents, `subagentStart`). **[verified: §2 table]**

---

## 5. Mechanical details (confirm, not pad)

### Where the CLI discovers hook configurations

Copilot CLI does **not** read hooks from one file — it combines hook configs from multiple sources at session start, in load order **user → project → plugins** (all sources merged; multiple sources contributing the same event all run, per baseline §3). **[verified: cli-hooks-reference]**

| Source | Location | Notes |
|---|---|---|
| **Repo-level files** | `.github/hooks/*.json` at the repository root | Verbatim: *"Copilot agents load hook configurations from `.github/hooks/*.json` files in the repository."* Auto-discovered when `copilot` runs inside the repo — no registration, no flag. This is the path the official tutorial demonstrates. **[verified: tutorial + cli-hooks-reference]** |
| **User-level files** | `~/.copilot/hooks/*.json` (`%USERPROFILE%\.copilot\hooks\` on Windows); honors `$COPILOT_HOME/hooks/` when `COPILOT_HOME` is set | User-global: fires on every session regardless of cwd. **[verified: cli-hooks-reference]** |
| **Repo settings (inline)** | a `hooks` field inside `.github/copilot/settings.json` or `.github/copilot/settings.local.json` — and, for cross-tool compat, `.claude/settings.json` / `.claude/settings.local.json` | Inline hooks object rather than a standalone file. **[verified: cli-hooks-reference]** |
| **User settings (inline)** | a `hooks` field inside `~/.copilot/settings.json` | Inline, user-global. **[verified: cli-hooks-reference]** |
| **Plugin-contributed** | `hooks.json` or `hooks/hooks.json` in each plugin's install dir (or the path named by `plugin.json`'s `hooks` field) | Per installed plugin. **[verified: baseline §2/§3]** |

**No hook trust/approval prompt is documented** for the local CLI — discovered hooks run without an interactive confirmation gate. This is an *absence* in the docs (the tutorial and reference describe no approval step), not a positive guarantee — treat "hooks just run once discovered" as **[verified-by-absence — smoke-test if you depend on it]**. Practical consequence: dropping a JSON file into any discovery location above is enough to make a hook fire on the next session; nothing else gates it.

> **Smoke-testing tip.** To exercise a hook without packaging a plugin, drop a `.json` config into `.github/hooks/` of a throwaway repo (then launch `copilot` from that repo) or into `~/.copilot/hooks/` (fires anywhere). The repo-level path is the tutorial-demonstrated one and is the safest first choice when verifying firing/injection behavior.

### Other mechanics

These are largely settled in the baseline (§3–§4); confirmed against the live docs here:

- **Event-name casing:** dual — camelCase native (`sessionStart`) and PascalCase VS-Code-compatible (`SessionStart`). camelCase-only events: `subagentStart`, `permissionRequest`, `notification`. **[verified: baseline §3 + hooks reference]**
- **`sessionStart` stdin shape:** `{ sessionId, timestamp (Unix ms), cwd, source: "startup"|"resume"|"new", initialPrompt? }`; PascalCase variant uses `hook_event_name`, `session_id`, ISO-8601 `timestamp`, `initial_prompt`. **[verified: hooks reference]**
- **Injected env vars:** `COPILOT_PLUGIN_ROOT` (+ aliases `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`), `COPILOT_PLUGIN_DATA`, `COPILOT_PROJECT_DIR`, `COPILOT_CLI=1`, `COPILOT_CLI_BINARY_VERSION`, `COPILOT_LOADER_PID`. Use `%COPILOT_PLUGIN_ROOT%` in the `command` string to locate bundled scripts. **[verified: baseline §4, empirically confirmed there]**
- **Exit-code semantics (fail-open):** `0` → stdout parsed as JSON output if present; `2` → warning, stderr surfaced, run continues (special-cased: `permissionRequest` exit 2 = `{"behavior":"deny"}` with stdout JSON merged in; `postToolUseFailure` exit 2 = stdout/stderr appended as failure context); other non-zero → logged as hook failure, run continues. **[verified: hooks reference + baseline §4]**
- **`timeoutSec`:** default **30**. (`timeout` is an accepted alias, superseded by `timeoutSec`.) **[verified: hooks reference + baseline §4]**
- **`cmd.exe` vs direct-node on Windows:** command hooks run through the platform shell. On Windows the `command` string is invoked such that `%VAR%` expands (cmd.exe semantics), which is why `"%COPILOT_PLUGIN_ROOT%\\hooks\\x.mjs"` resolves. If you invoke node directly without going through cmd.exe, `%VAR%` will **not** expand — pass the var through `env` or resolve it inside the script from `process.env.COPILOT_PLUGIN_ROOT` instead. **[verified: baseline §4 empirical note; cross-platform `%`-expansion is shell-dependent — inferred for the direct-node case, smoke test if relied upon]**
- **`additionalContext` joining:** when multiple hooks on one event return `additionalContext`, results are joined with a double newline (`\n\n`) and capped at ~10 KB. **[verified: hooks reference, documented for postToolUse]**
- **No mid-session reload:** hook config and plugin payload load at CLI start; changes need a new session. (baseline §4.) **[verified: baseline]**

---

## 6. Claude Code vs Copilot CLI — SessionStart context injection (the source of the confusion)

The entire confusion stems from porting Claude Code's **raw-stdout-as-context** assumption (and its **nested** JSON shape) to Copilot CLI, where neither holds.

| Aspect | Claude Code `SessionStart` | Copilot CLI `sessionStart` |
|---|---|---|
| Raw/plain stdout on exit 0 | **Added to context automatically.** Docs: "Any text your hook script prints to stdout is added as context for Claude." | **Ignored / discarded.** Docs: "Any output from this hook is ignored." |
| "Just `echo` and it works" | **Yes** — "a hook that only loads context can print to stdout directly without building JSON." | **No** — plain echo produces nothing. Reproduced repeatedly (#1139, #1352). |
| JSON injection field | **Nested:** `{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "..." } }` | **Bare:** `{ "additionalContext": "..." }` |
| Field name | `additionalContext` (inside `hookSpecificOutput`) | `additionalContext` (top-level) |
| Availability | Stable, documented behavior | Only CLI ≥ v1.0.11; before that parsed-but-discarded; firing itself has open bugs |

**[verified: Claude Code hooks doc at code.claude.com/docs/en/hooks — verbatim quotes above; Copilot side per §2/§3]**

**Net:** a hook authored for Claude Code's SessionStart that relies on plain stdout (or on the `hookSpecificOutput.additionalContext` nesting) will **silently inject nothing** on Copilot CLI. To work on both, a script must (a) emit JSON, not rely on raw stdout, and (b) branch on the runtime to choose bare vs nested `additionalContext` — Copilot CLI sets `COPILOT_CLI=1`, which is a reliable discriminator. **[inferred — the dual-shape branch is composed from verified pieces; smoke test the combined hook on both runtimes]**

---

## 7. Open questions / smoke tests

Items the docs do not settle. Smoke-test against your installed `copilot` before relying on them.

1. **Resume / `--continue` firing.** Does `sessionStart` fire with `source:"resume"` on `copilot --continue`, or only on fresh sessions? The baseline quotes "do not fire on resume"; the reference documents a `"resume"` source value. **Conflicting — test it.**
2. **Does bare `additionalContext` actually reach the model on your version?** Given #2142 (sessionStart) and #2980 (postToolUse, still OPEN), injection has regressed before. Verify with a hook emitting a distinctive sentinel string and asking the agent to repeat it.
3. **Is the *nested* `hookSpecificOutput.additionalContext` (Claude shape) silently tolerated by Copilot CLI, or strictly ignored?** Docs say bare; confirm the nested form is genuinely a no-op (it likely is) so a dual-runtime script can rely on branching rather than emitting both.
4. **`sessionStart` vs `userPromptSubmitted` ordering.** #2201 reports `sessionStart` landing after the first `userPromptSubmitted`. If your bootstrap must run strictly first, verify ordering on your platform.
5. **Multi-hook / multi-source `additionalContext` precedence and 10 KB cap.** Documented for `postToolUse`; confirm it applies identically to `sessionStart` when several plugins each inject.
6. **Direct-node (non-cmd.exe) `%VAR%` expansion on Windows.** Confirm whether a `command` invoked without a shell wrapper expands `%COPILOT_PLUGIN_ROOT%`; if not, resolve from `process.env` inside the script.
7. **`sessionStart` firing in prompt/`-p` mode and in `.github/hooks/` (repo) vs plugin source.** #1730 reported total non-firing in an older version; v1.0.10 changelog notes "Repo hooks (.github/hooks/) now fire correctly when using prompt mode (-p flag)" — confirm on your version.

---

## 8. Reference URLs

### Official docs — the contract
- https://docs.github.com/en/copilot/reference/hooks-configuration — per-event output table; `additionalContext` for sessionStart/postToolUse/postToolUseFailure/subagentStart/notification; stdin payloads; exit codes. **Primary source for §2.**
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference — CLI-specific hooks reference; sessionStart "can inject `additionalContext`"; input schemas (no output example for sessionStart); **enumerates the hook-config discovery locations (user / repo / inline-settings / plugin) and the user→project→plugin load order**. **Primary source for §3.2 and §5 (discovery locations).**
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks — how-to; configuration mechanics (does not cover output processing).
- https://docs.github.com/en/copilot/tutorials/copilot-cli-hooks — tutorial; **verbatim "Any output from this hook is ignored by Copilot CLI"** for the sessionStart banner, and **verbatim ".github/hooks/*.json" repo-level discovery**. **Primary source for "raw stdout ignored" and the §5 repo-level location.**
- https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-hooks — cloud-agent hooks (no context-injection detail; env vars only).

### Primary evidence of the discrepancy (github/copilot-cli)
- https://github.com/github/copilot-cli/issues/2142 — "onSessionStart hook: additionalContext return value silently ignored." CLOSED/COMPLETED. Establishes fire-and-forget bug + workaround + fix-in-1.0.11. **Primary source for §3.4.**
- https://github.com/github/copilot-cli/issues/1139 — "Support injecting hook command output into LLM context (like Claude Code)." CLOSED/COMPLETED. Verbatim "Cannot inject stdout into LLM context"; resolution note confirms "hooks need to output JSON rather than raw stdout." **Primary source for "raw stdout never injected."**
- https://github.com/github/copilot-cli/issues/2980 — "postToolUse hook additionalContext not injected into agent context window." **OPEN** (2026-04-26). Evidence injection still regresses.
- https://github.com/github/copilot-cli/issues/2585 — "preToolUse hook doesn't pass additionalContext to agent." OPEN.
- https://github.com/github/copilot-cli/issues/2201 — "sessionStart hook doesn't print to terminal and doesn't run at CLI startup." OPEN. Ordering bug (sessionStart after userPromptSubmitted).
- https://github.com/github/copilot-cli/issues/1730 — "sessionStart hook in .github/hooks/ does not fire" (v0.0.420). OPEN.
- https://github.com/github/copilot-cli/issues/1352 — "sessionStart hook stdout is not displayed in terminal UI." OPEN.

### Changelog (version history of the injection behavior)
- https://github.com/github/copilot-cli/blob/main/changelog.md — verbatim entries for v1.0.7 (subagentStart context), v1.0.11 (sessionStart additionalContext injected; multi-extension hook merge), v1.0.24 (preToolUse additionalContext), v1.0.49 (postToolUse additionalContext re-fix). **Primary source for §3.4 version table.**

### Copilot SDK (output-shape confirmation)
- https://github.com/github/copilot-sdk/blob/main/docs/hooks/session-lifecycle.md — confirms `additionalContext` is a **bare top-level** field for sessionStart (not nested). **Primary source for §3.3 / §6.**

### Cross-platform contrast (Claude Code)
- https://code.claude.com/docs/en/hooks — Claude Code hooks; verbatim "Any text your hook script prints to stdout is added as context for Claude" and the **nested** `hookSpecificOutput.additionalContext` shape. **Primary source for §6.**

### Baseline (this repo)
- [`./copilot-cli-plugin-system.md`](./copilot-cli-plugin-system.md) — plugin install model, `hooks.json` schema, env vars, exit codes, marketplace. Baseline for everything not re-derived here.
