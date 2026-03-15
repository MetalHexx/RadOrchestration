---
project: "VALIDATOR"
phase: 2
task: 1
title: "Agent Checks"
status: "complete"
files_changed: 2
tests_written: 17
tests_passing: 17
build_status: "pass"
---

# Task Report: Agent Checks

## Summary

Created `lib/checks/agents.js` — the agent validation check module that scans `.github/agents/` for `.agent.md` files, validates frontmatter fields, tool arrays, agent arrays, and populates `context.agents` with `AgentInfo` entries. Created `tests/agents.test.js` with 17 test cases covering all acceptance criteria. All tests pass and the module requires cleanly.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `lib/checks/agents.js` | 316 | Agent validation check module with constants, helpers, and async export |
| CREATED | `tests/agents.test.js` | 290 | 17 test cases using node:test with mocked fs-helpers and frontmatter |

## Tests

| Test | File | Status |
|------|------|--------|
| exports an async function | `tests/agents.test.js` | ✅ Pass |
| no agents directory — returns empty results, context.agents is empty Map | `tests/agents.test.js` | ✅ Pass |
| valid agent file — 1 pass result, context.agents populated | `tests/agents.test.js` | ✅ Pass |
| missing required fields — 3 fail results | `tests/agents.test.js` | ✅ Pass |
| empty required fields — fail results for empty name, description, tools | `tests/agents.test.js` | ✅ Pass |
| invalid tool name — 1 fail result with detail | `tests/agents.test.js` | ✅ Pass |
| deprecated tool name — 1 warn result | `tests/agents.test.js` | ✅ Pass |
| namespaced tool — no fail/warn for tools | `tests/agents.test.js` | ✅ Pass |
| non-Orchestrator with non-empty agents — fail | `tests/agents.test.js` | ✅ Pass |
| non-empty agents without agent toolset — fail | `tests/agents.test.js` | ✅ Pass |
| Orchestrator with valid agents — no agents-array fail | `tests/agents.test.js` | ✅ Pass |
| malformed file — null content — 1 fail, no crash | `tests/agents.test.js` | ✅ Pass |
| malformed file — no frontmatter — 1 fail, no crash | `tests/agents.test.js` | ✅ Pass |
| skills parsing — extracts skill names from ## Skills section | `tests/agents.test.js` | ✅ Pass |
| multiple agents — 2 pass results, context.agents has 2 entries | `tests/agents.test.js` | ✅ Pass |
| all results have category "agents" | `tests/agents.test.js` | ✅ Pass |
| never throws — wraps errors in try/catch | `tests/agents.test.js` | ✅ Pass |

**Test summary**: 17/17 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `lib/checks/agents.js` exports an async function `checkAgents(basePath, context)` that returns `CheckResult[]` | ✅ Met |
| 2 | All `.agent.md` files in `.github/agents/` are discovered via `listFiles(agentsDir, '.agent.md')` | ✅ Met |
| 3 | Missing or empty `name` field produces a `fail` result with `category: 'agents'` | ✅ Met |
| 4 | Missing or empty `description` field produces a `fail` result | ✅ Met |
| 5 | Missing or empty `tools` array produces a `fail` result | ✅ Met |
| 6 | Missing `agents` field produces a `fail` result | ✅ Met |
| 7 | Each invalid tool name produces a `fail` result with detail listing valid values | ✅ Met |
| 8 | Each deprecated tool name produces a `warn` result | ✅ Met |
| 9 | Valid toolset names and valid namespaced tools produce no fail/warn | ✅ Met |
| 10 | Non-empty `agents[]` without `agent` in `tools[]` produces a `fail` result | ✅ Met |
| 11 | Non-Orchestrator agent with non-empty `agents[]` produces a `fail` result | ✅ Met |
| 12 | `context.agents` is populated as a `Map<string, AgentInfo>` with one entry per discovered agent file | ✅ Met |
| 13 | Each `AgentInfo` has correct `filename`, `tools`, `agents`, and `referencedSkills` fields | ✅ Met |
| 14 | `referencedSkills` is correctly extracted from `## Skills` section of agent body | ✅ Met |
| 15 | Unreadable files produce `fail` results (no unhandled exceptions) | ✅ Met |
| 16 | Files with unparseable frontmatter produce `fail` results (no unhandled exceptions) | ✅ Met |
| 17 | Empty or missing agents directory produces empty results (no crash) | ✅ Met |
| 18 | All test cases in `tests/agents.test.js` pass | ✅ Met |
| 19 | `node -e "require('./lib/checks/agents')"` exits cleanly | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass — `node -e "require('./lib/checks/agents')"` exits cleanly
- **Lint**: N/A — no linter configured in project
- **Type check**: N/A — plain JavaScript, no TypeScript
