---
project: "ORCHESTRATION-REORG"
author: "brainstormer-agent"
created: "2026-03-10T00:00:00Z"
---

# ORCHESTRATION-REORG — Brainstorming

## Problem Space

The repository has grown organically through multiple projects and its structure no longer tells a coherent story. Runtime scripts live in `src/` but import utilities buried inside `.github/skills/validate-orchestration/scripts/`. Tests sit at the root but cover code from two unrelated trees. Historical design documents in `plan/schemas/` are mostly relics whose content was promoted into skills long ago — yet one file (`state-json-schema.md`) is still a canonical contract actively consumed by tasks and tests. The `bin/` folder is empty, and `.github/orchestration/` is an empty placeholder that was never populated. And the UI dashboard — a significant feature — isn't mentioned in the README or documented anywhere. A new user pulling this repo would struggle to understand what to copy, what's historical, and how the pieces relate.

## Validated Ideas

### Idea 1: Move scripts into `.github/orchestration/scripts/`

**Description**: Relocate `src/` contents (3 CLI scripts + `lib/` with 4 modules) into `.github/orchestration/scripts/`. The existing empty `.github/orchestration/` folder becomes the home for all orchestration runtime artifacts — scripts, schemas, and tests. Delete the now-empty root `src/` folder. This makes the entire orchestration system live under `.github/` — a single-folder distribution story.

**Rationale**: The README already tells users to "copy `.github/` and `src/`". Merging the scripts into `.github/` reduces that to one folder. The scripts are tightly coupled to the orchestration system anyway — `src/next-action.js` imports from `.github/skills/validate-orchestration/scripts/lib/utils/`. Putting them under `.github/orchestration/scripts/` makes the dependency direction shorter and more natural. Using `.github/orchestration/` as the container (rather than a hyphenated `orchestration-scripts` folder) is more generalized — it can hold scripts, schemas, and tests without the folder name being misleading.

**Key considerations**:
- All `require()` paths in the 3 CLIs and 4 lib modules must be updated to reflect the new location relative to `.github/skills/validate-orchestration/scripts/`
- Agent prompt files and skill SKILL.md files that reference `src/` paths need updating
- The `validate-orchestration` skill's checks may reference `src/` paths for structure validation
- README quick start instructions ("Copy `.github/` and `src/`") must be rewritten

### Idea 2: Bundle tests inside `.github/orchestration/tests/`

**Description**: Move the `tests/` folder into `.github/orchestration/tests/` so the scripts and their tests ship as one unit. Delete the now-empty root `tests/` folder.

**Rationale**: Tests are split across two code trees — some test `src/` modules, others test `.github/skills/validate-orchestration/scripts/` modules. Since we're consolidating scripts under `.github/orchestration/scripts/`, the tests should follow. This keeps the distribution self-contained: copy `.github/` and you get code, tests, and AI artifacts all together.

**Key considerations**:
- All `require()` paths in test files must be updated (they currently use relative `../src/` and `../.github/` paths)
- Test runner configuration (if any) needs to point to the new location
- The `validate-orchestration` skill has its own scripts — some tests exercise those directly. Verify those paths still resolve
- Consider whether some tests are really "validation skill tests" vs. "orchestration script tests" — they may belong in different folders

### Idea 3: Promote `state-json-schema.md` into `.github/orchestration/schemas/`

**Description**: Move `plan/schemas/state-json-schema.md` to `.github/orchestration/schemas/state-json-schema.md`. This is the only file in `plan/schemas/` that's still an active canonical contract — the other 14 are relics.

**Rationale**: The state schema is actively consumed: task handoffs reference it, integration tests read it, the state-validator module enforces its rules. It belongs alongside the runtime code that depends on it, not in a folder of historical design docs.

**Key considerations**:
- Task handoff templates and coding task references to `plan/schemas/state-json-schema.md` need updating
- The `validate-orchestration` skill checks may reference this path
- Integration-style tests that `readFile` the schema need updated paths

### Idea 4: Archive historical design artifacts

**Description**: Rename `plan/` to `archive/` (or create `archive/` and move contents). The folder would contain:
- `ORCHESTRATION-MASTER-PLAN.md` — the original system design document
- `orchestration-human-draft.md` — the original human draft
- `schemas/` — the 12 relic template files, plus `orchestration-yml-schema.md` and `cross-agent-dependency-map.md`

**Rationale**: The `plan/` folder name suggests active planning, but its contents are completed Phase 1 design artifacts. The master plan confirms the templates were "extracted from `plan/schemas/*-template.md` design docs by stripping the schema design notes." Renaming to `archive/` signals clearly that these are historical records, not active configuration.

**Key considerations**:
- `ORCHESTRATION-MASTER-PLAN.md` still has value as the "how this system was designed" record — it should remain accessible
- References to `plan/schemas/` in the master plan itself are self-referential and fine to leave as-is (they're historical)
- References to `plan/schemas/state-json-schema.md` in project task handoffs and reports are historical records of completed work — those paths can stay as-is in those documents
- `orchestration-yml-schema.md` and `cross-agent-dependency-map.md` go to `archive/schemas/` — they can be promoted to `docs/` later if needed

### Idea 5: Delete `bin/`

**Description**: Remove the empty `bin/` folder. The `.github/orchestration/` folder is retained and repurposed as the orchestration runtime container (scripts, schemas, tests).

**Rationale**: `bin/` was presumably intended for CLI entry points that never materialized. It serves no purpose and adds noise. `.github/orchestration/` by contrast becomes a meaningful, populated folder as part of this reorg.

**Key considerations**:
- Verify nothing references `bin/` before deletion
- Git doesn't track empty folders natively — it may only exist locally via `.gitkeep` or similar

### Idea 6: Update README with UI showcase

**Description**: Add a screenshot of the monitoring dashboard near the top of the README (below the mermaid diagram or in a new "Dashboard" section). Add a brief description of the UI. Save the screenshot as `assets/dashboard.png`.

**Rationale**: The UI is a significant, polished feature — the screenshot shows a project sidebar, planning pipeline, execution progress with phase/task drill-down, document links, and real-time status. It's invisible to anyone reading the README today. First impressions matter for adoption.

**Key considerations**:
- Screenshot should be committed to the repo in `assets/` (not an external link) so it works offline and in forks
- Keep the README description brief — link to a dedicated docs page for details
- The screenshot image path needs to work on GitHub and locally

### Idea 7: Create `docs/dashboard.md` for the UI

**Description**: Create a new documentation page explaining the monitoring dashboard — what it does, how to start it, what it shows, and how it connects to the orchestration system (SSE, file watching, etc.).

**Rationale**: The UI has its own Next.js app, API routes, SSE hooks, config viewer, document viewer, sidebar, and theme system. This deserves its own docs page, consistent with the existing docs pattern (agents.md, pipeline.md, skills.md, etc.).

**Key considerations**:
- Should cover: purpose, prerequisites (Node.js, npm), how to start (`npm run dev` from `ui/`), feature overview, architecture at a high level
- The UI reads from `.github/projects/` and `.github/orchestration.yml` — document this dependency
- SSE for real-time updates should be explained
- The UI is read-only — emphasize this (it monitors, it doesn't modify)

### Idea 8: Update all cross-references and imports

**Description**: Systematically update every file that references the old paths:
- `src/` → `.github/orchestration/scripts/`
- `tests/` → `.github/orchestration/tests/`
- `plan/schemas/state-json-schema.md` → `.github/orchestration/schemas/state-json-schema.md`
- `plan/` → `archive/` (for non-schema references)
- Remove references to `bin/`

This includes: agent `.md` files, skill `SKILL.md` files, instruction files, `copilot-instructions.md`, `orchestration.yml`, test `require()` paths, script `require()` paths, `README.md`, `docs/*.md`, and the `validate-orchestration` skill's structure checks.

**Rationale**: The system is document-driven with many cross-references. A half-done path migration would break the pipeline, confuse agents, and fail validation.

**Key considerations**:
- This is the riskiest part of the reorg — a comprehensive grep for old paths is essential
- The `validate-orchestration` tool should be run after all changes to verify nothing is broken
- The structure check in the validation skill likely hardcodes expected paths — it will need updating
- Historical references in completed project artifacts (task reports, phase reports) should NOT be updated — they're historical records of what happened at the time

## Scope Boundaries

### In Scope
- Moving `src/` to `.github/orchestration/scripts/`
- Moving `tests/` to `.github/orchestration/tests/`
- Promoting `state-json-schema.md` to `.github/orchestration/schemas/`
- Archiving `plan/` to `archive/`
- Deleting `bin/`
- Adding UI screenshot to README
- Creating `docs/dashboard.md`
- Updating README with UI section and revised quick start
- Updating all cross-references, imports, and path references
- Updating `docs/*.md` pages to reflect new paths
- Running validation to verify nothing is broken

### Out of Scope
- Refactoring the scripts themselves (just moving, not rewriting)
- Changing the `.github/` Copilot convention structure (agents, skills, instructions, prompts stay where they are)
- Restructuring the UI folder
- Modifying project artifacts in `.github/projects/` (historical records stay as-is)
- Changing `orchestration.yml` project paths or pipeline configuration
- Extracting shared utilities out of validate-orchestration (that's a separate concern)

## Key Constraints

- **Copilot conventions are fixed**: `.github/agents/`, `.github/skills/`, `.github/instructions/`, `.github/prompts/` must remain at their current paths — Copilot expects them there
- **Zero runtime dependencies**: The scripts use Node.js built-ins only — the move must preserve this
- **Validation must pass**: After the reorg, `validate-orchestration` must report no regressions
- **Historical artifacts are frozen**: Completed project tasks, reports, and reviews in `.github/projects/` should not have their internal path references updated — they document what happened at the time
- **Single-folder distribution**: After the reorg, copying `.github/` into a target project should give you the complete orchestration system (agents, skills, scripts, schemas, and configuration)
- **Self-referential execution — the system must stay intact during its own reorganization**: This project will be executed by the orchestration system itself. The pipeline reads agents, skills, scripts, and state from the current file structure. If early phases break those paths, the system can't continue executing later phases. Therefore, destructive moves (deleting `src/`, `tests/`, `plan/`) and path rewiring must be deferred to a **final cleanup phase** that runs after all new files are in place and validated. Earlier phases should copy/create files at the new locations, set up dual-path compatibility where needed, and leave the old structure functional until the very end.

## Resolved Questions

- **`orchestration-yml-schema.md` and `cross-agent-dependency-map.md`** → Archive for now. Can promote to `docs/` later if needed.
- **`docs/` location** → Stays at root. It's documentation *about* the system, not part of the system that gets copied. But docs content must be updated since files are moving.
- **Screenshot location** → `assets/dashboard.png`

## Open Questions

- (none at this time)

## Summary

Reorganize the repository into clear zones: `.github/` contains the complete orchestration system (AI artifacts + runtime under `.github/orchestration/`), `archive/` holds historical design documents, `docs/` has user-facing documentation, and `ui/` is the standalone monitoring dashboard. The `.github/orchestration/` folder acts as the generalized runtime container with `scripts/`, `schemas/`, and `tests/` subfolders. Update the README to showcase the UI with a screenshot, create dedicated dashboard documentation, and update all cross-references so the system validates cleanly. The end state is a repo where a new user can understand the structure at a glance and copy a single `.github/` folder to adopt the orchestration system.
