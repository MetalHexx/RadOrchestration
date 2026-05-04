# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Repo Rules
You must always follow these rules when editing or running the orchestration system from this repository.

## Canonical vs Runtime Test Code
- The root [skills](./skills/) folder is canonical source.
- The root [agents](./agents) folder is canonical source.
- The [.claude](./.claude/) is runtime compiled for testing. 
- The [.github](./.github) is runtime compiled for testing.

## Never EXECUTE the pipeline from the Canonical source!
- When invoking the orchestration pipeline to execute a project, never read or invoke the files from the canonical source.
- Never read or invoke skills from the canonical source
- Never read or invoke agents from the canonical source
- The canonical source is uncompiled and will return the wrong orchRoot for any non-Claude harness.

## Only EDIT the Canonical Source!
- When making code changes to improve the Rad Orchestration system, only edit the canonical source!
- Editing files the runtime compiled test files is incorrect! 

## DO NOT Add Requirements in Canonical Source
- When making changes to the rad orchestration pipeline and markdown files, do not leave requirements (FR-N, NFR-N, AD-N, DD-N) in the files. These should only be used in project planning documents, not actual code or documentation. The only exception is that we're making changes to the rad-create-plans or rad-code-review skills which leverage requirements as part of project planning and code review.

## Source layout

Canonical agent and skill source lives at the **repo root** in `agents/` and `skills/`, authored in Claude shape (the format Claude Code accepts natively). `.claude/` is a gitignored, generated artifact — populated by `npm run build` (default Claude adapter) and refreshed after any edit to `agents/` or `skills/`. Do not commit changes under `.claude/agents/` or `.claude/skills/`; edit the repo-root canonical source instead.

The `rad-*` reserved-namespace rule above applies to `skills/` at the repo root — it does not change with the restructure.

# Common Commands

## Multi-harness build (repo root)

After editing any file under `agents/` or `skills/`, refresh the dogfood folder for the harness you are running in:

```bash
npm run build                  # Claude Code (default) → .claude/
npm run build:claude           # explicit
npm run build:copilot-vscode   # → .github/
npm run build:copilot-cli      # → .github/
npm run build:all              # every adapter, sequentially
```

**First clone of the repo requires `npm run build`** before the in-repo Claude Code instance can read agents and skills (the canonical sources at `agents/` and `skills/` are not the files Claude Code reads — `.claude/agents/` and `.claude/skills/` are, and they're gitignored).

## Tests by sub-package

This repo is a polyglot monorepo with several test runners. Pick the right one:

- **Pipeline runtime** (`skills/rad-orchestration/scripts/`) — Vitest:
  ```bash
  cd skills/rad-orchestration/scripts
  npm test                              # full suite
  npx vitest run path/to/file.test.ts   # single file
  npm run typecheck                     # tsc --noEmit (also run by pre-commit hook)
  ```
- **Adapters + repo-root build CLI** (`adapters/`, `scripts/`) — Node's built-in test runner. Run from repo root:
  ```bash
  node --test adapters/**/*.test.js
  node --test scripts/**/*.test.js
  node --test tests/scripts/**/*.test.mjs
  ```
- **Installer** (`installer/`) — Node test runner:
  ```bash
  cd installer && npm test
  ```
- **Dashboard UI** (`ui/`) — Node test runner via tsx, plus `next` for dev/build:
  ```bash
  cd ui && npm test
  cd ui && npm run dev               # dev server (port 3000 — kill any prior occupant first)
  cd ui && npm run build-and-start   # full production build + start
  ```

## Pre-commit hook (one-time setup per clone)

The pre-commit hook runs `tsc --noEmit` on the pipeline scripts folder before every commit. Point git at the in-tree hooks dir once after cloning:

```bash
git config core.hooksPath .githooks
```

The hook lives at `.githooks/pre-commit`.

## Prompt harnesses

`prompt-tests/` is an operator-driven, on-demand regression harness for planner subagent outputs. It is **not** part of CI and costs real Opus tokens per run — re-run only when a planner prompt, skill workflow, or explosion-script change actually warrants a new baseline. See `prompt-tests/README.md` for the per-behavior runner protocol.

# Architecture

The repo ships a document-driven, multi-agent orchestration system plus everything needed to develop it across multiple AI coding harnesses.

## Three execution layers

1. **Agents and skills** (markdown) — the orchestration product itself. Twelve specialized agents (`agents/`) and ~18 reusable skills (`skills/`) communicate exclusively through structured markdown documents. There is no shared memory or message passing between agents — every interaction is mediated by a document on disk. Each document type has exactly one writer (sole-writer policy). The Coder reads only its self-contained Task Handoff.
2. **Pipeline runtime** (TypeScript) at `skills/rad-orchestration/scripts/` — a deterministic state machine entered through `pipeline.js`. The Orchestrator agent never makes routing decisions itself: it signals an event, parses the JSON result, and dispatches on `result.action` against a fixed routing table. Routing, triage, and state validation are pure functions; LLM judgment is reserved for planning, coding, and review.
3. **Dashboard** (Next.js) at `ui/` — a read-only visualizer that watches each project's `state.json` and renders pipeline progress, documents, and configuration in real time.

## Multi-harness adapters

The system targets multiple AI coding harnesses (Claude Code, GitHub Copilot in VS Code, GitHub Copilot CLI) from a single canonical source.

- `agents/` and `skills/` at the repo root are the **only** authored source — written in Claude shape, which is also the format Claude Code reads natively.
- `adapters/<harness>/adapter.js` is a self-contained per-harness projection: filename rule, frontmatter shape, tool-name dictionary, and model alias map. Adapters never transform the body of agents or skills, never modify `rad-*` skill names, and never ship settings or top-level instruction files.
- `scripts/build.js` discovers adapters via `adapters/discover.js`, runs them via `adapters/run.js`, and emits each harness's gitignored target folder (`.claude/`, `.github/`).
- `installer/src/<harness>/` holds **pre-compiled bundles** that the published `radorch` npm installer ships to end users. These are produced by `installer/scripts/sync-source.js` at pack time — do not hand-edit.
- A new harness is added by mirroring `adapters/_template/` (an empty adapter scaffold with its own README and tests).

## Pipeline runtime detail

The pipeline runtime is the load-bearing piece. Key files in `skills/rad-orchestration/scripts/`:

- `pipeline.js` — JIT entry point. Checks for `node_modules`; runs `npm ci` if missing; delegates to `main.ts` with original argv. This is what every install (Claude or Copilot, dogfood or end-user) invokes.
- `main.ts` — CLI surface. Parses `--event`, `--project-dir`, etc., calls into the engine, prints a single JSON result.
- `lib/` — engine, resolver, mutations, state I/O, validator. The action routing table lives in `references/action-event-reference.md` (16 actions) and is the contract the Orchestrator agent dispatches on.
- `schemas/state-v4.schema.json` — JSON Schema for `state.json`. State invariants are validated on every write.
- `migrate-to-v5.ts` / `fix-ghost-v5.ts` — one-shot migration CLIs.
- `tests/` — Vitest, including unit tests, integration tests, contract tests, and end-to-end engine tests.

## Installer

`installer/` is the npm package end users `npx rad-orchestration` to install. It walks an interactive wizard, copies the pre-compiled bundle for the chosen harness from `installer/src/<harness>/` into the user's workspace, generates `orchestration.yml`, and optionally sets up the dashboard. The installer never ships settings files or top-level instruction files — those are user-owned. `installer/scripts/sync-source.js` re-syncs `installer/src/` from the canonical sources via the adapters before publish (`prepack`).

## Skill and agent loading

The canonical sources at `agents/` and `skills/` are **not** what Claude Code loads at runtime — Claude Code reads from `.claude/agents/` and `.claude/skills/`, which are gitignored and produced by `npm run build`. After editing any agent or skill, run the appropriate build command before invoking it from the harness, otherwise you'll be running stale content. The same applies in reverse on Copilot — never edit `.claude/` or `.github/` and expect those changes to survive a build.  When we edit the project skills and agents, we are editing the canonical source. The build process transforms that canonical source into the shape required by each harness and outputs it to the respective target folder.

## Where things live

- `agents/`, `skills/` — canonical source (committed)
- `adapters/<harness>/` — self-contained per-harness adapter (committed)
- `scripts/build.js` — repo-root multi-harness build CLI (committed)
- `installer/` — `radorch` npm package (committed)
- `installer/src/<harness>/` — pre-compiled bundles for publish (committed; regenerated by `sync-source.js`)
- `ui/` — Next.js dashboard (committed)
- `prompt-tests/` — operator-driven planner regression harness (committed)
- `tests/scripts/` — repo-wide cross-cutting tests (e.g., reserved-namespace, agent-skill ref integrity)
- `docs/` — user-facing docs; `docs/internals/` for refactor design notes
- `.agents/` — non-production / dev-only skills and prompts (e.g., `rad-create-skill` scaffolding)
- `.claude/`, `.github/agents/`, `.github/skills/`, `dist/`, `claude/`, `copilot-vscode/`, `copilot-cli/` — **gitignored** generated artifacts
