# Run Notes — baseline-instructions-canary-2026-05-02

- **Run folder:** `prompt-tests/instructions-reach-e2e/output/instructions-canary/baseline-instructions-canary-2026-05-02/`
- **Timestamp:** 2026-05-03T00:54Z (project created 2026-05-03T00:49:57Z; final mutation 2026-05-03T00:54:35Z)
- **Project name:** `baseline-instructions-canary-2026-05-02`
- **Fixture:** `instructions-canary`

## Pipeline final state

- Final `result.action`: `request_plan_approval`
- `state.graph.nodes.plan_approval_gate.gate_active`: `true`
- Counts:
  - Phases emitted: **1**
  - Tasks emitted: **1**
  - Requirements (per Requirements frontmatter `requirement_count`): **12** (note: linter found 14 actual blocks — frontmatter understates by 2; see lint-report.md)

## Reach matrix

| Subagent | CLAUDE.md marker | AGENTS.md marker | copilot-instructions.md marker | Read log shows file? |
|---|---|---|---|---|
| `@planner` (Requirements + Master Plan) | ✓ (Master Plan: 1 occurrence; bonus: Requirements: 1 occurrence) | n/a | n/a | not directly observable from orchestrator vantage — see note below |
| `@coder` | n/a | ✗ (0 occurrences in `src/reverse.js` and `src/__tests__/reverse.test.js`) | ✗ (0 occurrences in `src/reverse.js` and `src/__tests__/reverse.test.js`) | not directly observable from orchestrator vantage — see note below |

**Read-log observability note.** Subagent tool calls (Read / Grep / Glob) are not surfaced to the parent orchestrator in this harness — only the final agent message is returned. The marker emission is therefore the load-bearing reach signal; the read-log column is left as "not directly observable" rather than fabricated. The marker contract is sufficient: a marker can only appear in agent output if the agent saw the file that mandates it.

## Conclusions per subagent

- **`@planner` saw CLAUDE.md.** The CLAUDE.md routing rule mandates emitting `MARKER-CLAUDEMD-7G3K9P` once per planning/design document. The marker appeared in both spawns' output — Requirements (1 occurrence) and Master Plan (1 occurrence). The planner spawn prompts contained no mention of CLAUDE.md or the marker; the manifest block was empty per the runner's contract; the canary file exists at the project root. Native reach to CLAUDE.md is confirmed for the Requirements-mode and Master Plan-mode planner spawns under the default template.
- **`@coder` did not see AGENTS.md.** AGENTS.md mandates `MARKER-AGENTSMD-5Q8L2N` in every source/test file. The marker is absent from both `src/reverse.js` and `src/__tests__/reverse.test.js` (0/0). The canary file exists at the run-folder root. Native reach to AGENTS.md is **not** confirmed for the coder spawn.
- **`@coder` did not see copilot-instructions.md.** Same construction as AGENTS.md — `MARKER-COPILOT-4R6T1J` mandated in source/test files; absent from both files (0/0). The canary file exists at `.github/copilot-instructions.md`. Native reach to copilot-instructions.md is **not** confirmed for the coder spawn.

## Phase B coder integrity check (independent of reach)

- Coder read log contained the handoff path and no upstream planning docs: ✓ (the coder summary explicitly cites only `tasks/INSTRUCTIONS-CANARY-TASK-P01-T01-REVERSE.md`; no Requirements / Master Plan / phase / brainstorming reads were declared).
- `node --test src/__tests__/reverse.test.js` passed in the run folder: ✓ (`1/1 passing`, runtime ≈82 ms; re-verified by orchestrator after coder return).
- Handoff doc has a single `## Execution Notes` heading appended at the end: ✓ (see `tasks/INSTRUCTIONS-CANARY-TASK-P01-T01-REVERSE.md` lines 49–53).

## Surface-to-operator items

- **Hard fail (lint).** `lint-requirements.mjs` returned `ok: false`: the planner's Requirements frontmatter declared `requirement_count: 12` but the document contains 14 actual FR/NFR/AD/DD blocks (4 + 3 + 4 + 3 = 14, matching the planner's own self-review summary; the frontmatter integer was understated). The Master Plan lints clean. Both linter self-tests pass. The reach matrix above is descriptive and is independent of the lint outcome.
- **Manifest-cwd note (informational).** When `pipeline.js` is invoked from the orchestration repo root (this harness's invocation pattern), `context-enrichment.ts` runs `list-repo-skills.mjs` via `spawnSync` without a `cwd` override and inherits the orchestration repo cwd, so the `repository_skills_block` returned in the planner-spawn action context lists the orchestration repo's own skills (12 entries) rather than the run folder's skills (`[]`). Per the runner's Setup step 4 contract, the planner-spawn prompts in this run inlined the run-folder-scoped manifest (empty → heading omitted), not the action-context block. This deviation from the action-context payload is intentional for measuring native reach in the harness; it is not necessarily a pipeline bug, but is recorded here for orientation across future baseline runs.
