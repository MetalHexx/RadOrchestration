---
project: "SCRIPT-SIMPLIFY-AGENTS"
author: "brainstormer-agent"
created: "2026-03-10T00:00:00Z"
---

# SCRIPT-SIMPLIFY-AGENTS — Brainstorming

## Problem Space

The orchestration system's Tactical Planner agent violates the single responsibility principle. It currently owns both **planning work** (decomposing phases into tasks, writing handoffs, generating reports) and **state management** (mutating `state.json`, running triage, enforcing transitions). The state-management half is mechanical — an LLM re-deriving which JSON fields to change based on prose instructions — and produces incorrect mutations (premature completions, skipped steps, wrong field values). Meanwhile, the Orchestrator is too passive: it delegates all state control to the Tactical Planner, then tries to verify the result by re-reading state and re-running the resolver. This indirection causes skipped steps and inconsistent pipeline progression.

## Validated Ideas

### Idea 1: Unified Event-Driven Pipeline Script

**Description**: Replace the multi-script Orchestrator loop (`next-action.js` → spawn agent → spawn Tactical Planner for state update → `next-action.js` again) with a single `pipeline.js` script. The Orchestrator signals a completion event (e.g., `task_completed`, `code_review_completed`) with context (e.g., report path), and the script handles the entire mechanical chain internally: apply the state mutation, validate the transition, run triage if triggered, resolve the next action, and return a single JSON result telling the Orchestrator what to do next.

**Rationale**: Collapses multiple script calls and agent spawns into one deterministic call per cycle. The Orchestrator never needs to know about mutations, triage, or state transitions — it just signals events and follows instructions. This eliminates the class of bugs where the LLM-based Tactical Planner mutates state incorrectly, and removes intermediate actions (`update_state_from_task`, `triage_task`, `advance_task`, etc.) that the Orchestrator currently has to coordinate.

**Key considerations**:
- The script must be internally well-structured to avoid becoming a monolithic mess — pipeline engine, mutations module, state I/O module, all composed cleanly
- Existing modules (resolver, triage engine, state validator, constants) are reused as-is — they're already pure functions
- The `start` event (cold start, no prior event) replaces the standalone `next-action.js` for initial resolution
- Init (project scaffolding) can fold into the script as a special case when no `state.json` exists

### Idea 2: Strip State Management from the Tactical Planner

**Description**: Remove all state mutation responsibilities (Mode 2: Update State) and triage invocation from the Tactical Planner agent. The Planner becomes a pure planning agent with three focused modes: create phase plans (from Master Plan + Architecture + Design + prior reports/reviews), create task handoffs (from Phase Plan + Architecture + Design + prior reports/reviews), and generate phase reports (from task reports + code reviews). It reads `state.json` for context (current phase/task, triage outcomes already written) but never writes it.

**Rationale**: The Tactical Planner's judgment work — reading planning documents and synthesizing them into actionable plans — is exactly what an LLM excels at. The state mutation work — setting JSON fields to specific values in specific orders — is exactly what an LLM fails at. Separating these restores single responsibility: the Planner plans, the script manages state. The Planner also no longer needs to run triage before planning; it reads the triage outcome from state (already written by the pipeline script) and plans accordingly.

**Key considerations**:
- The Planner still reads `review_action` / `phase_review_action` from `state.json` to know whether to produce a normal handoff, corrective handoff, or halt — but it doesn't derive these values itself
- Mode 1 (project initialization) also moves to a script since it's purely mechanical (create directories, scaffold JSON template)
- The Planner's agent definition simplifies significantly — the `execute` tool may no longer be needed since it doesn't call scripts anymore

### Idea 3: Orchestrator as Thin Event-Driven Controller

**Description**: Rewrite the Orchestrator agent to follow a minimal loop: (1) call `pipeline.js` with an event and context, (2) parse the JSON result, (3) if the action requires an agent spawn → spawn it → signal completion event → go to 1, (4) if the action is a human gate → ask human → signal gate event → go to 1, (5) if terminal → done. The Orchestrator's action table shrinks from ~35 actions to ~18 (only actions requiring external work: agent spawns, human gates, display).

**Rationale**: The Orchestrator's current definition has a massive action→agent mapping table with many entries that are purely mechanical state operations. With the pipeline script handling those internally, the Orchestrator only sees actions that require it to interact with the outside world (agents and humans). This makes the agent definition shorter, less error-prone, and more resilient to context compaction — since routing is state-driven via the script, the Orchestrator can "recover" from compaction by just calling the script again.

**Key considerations**:
- The Orchestrator's tool access should be constrained to `read`, `search`, `agent`, and `execute` (for running orchestration scripts only — no arbitrary terminal commands)
- The `triage_attempts` runtime counter should move into the pipeline script as persisted state
- The Orchestrator remains "read-only" in the sense that it never writes files directly — it triggers state writes through the pipeline script via terminal execution

### Idea 4: Modular Script Architecture

**Description**: Structure the pipeline script as a composition of focused modules rather than a monolithic file. The entry point (`pipeline.js`) is trivial (~20 lines). The pipeline engine (`pipeline-engine.js`) is a linear recipe: load state → apply mutation → validate → write → triage if needed → resolve → return. Mutations live in a lookup table (`mutations.js`) with one small named function per event type. State I/O is isolated (`state-io.js`). Existing modules (resolver, triage engine, validator, constants) are unchanged and composed by the pipeline engine.

**Rationale**: The unified script concept risks becoming a complex monolith. This structure keeps each module focused and independently testable while the pipeline engine reads like plain English. A developer can find what `task_completed` does by looking up one 5-10 line function in `mutations.js`. Testing is clean: unit-test each mutation function, integration-test the pipeline engine with mocked I/O.

**Key considerations**:
- The `needsTriage(event, state)` helper determines whether triage runs after a mutation — keeps triage logic declarative rather than scattered through the pipeline
- `state-io.js` isolates all filesystem operations, making the pipeline engine testable with stubs
- The existing test suites for resolver, triage engine, and state validator continue to pass unchanged

### Idea 5: Project Initialization as Script

**Description**: Replace the Tactical Planner's Mode 1 (Initialize Project) with an `init-project.js` script (or fold it into `pipeline.js` as the `start` event handler when no `state.json` exists). The script creates the project directory, subdirectories (`phases/`, `tasks/`, `reports/`), and scaffolds `state.json` from a template populated with `orchestration.yml` limits.

**Rationale**: Project initialization is entirely mechanical — no judgment required. The current approach has an LLM creating JSON from scratch, which risks malformed initial state. A script guarantees the initial `state.json` always matches the schema exactly.

**Key considerations**:
- The Brainstormer should NOT call this script — it operates outside the pipeline and only creates the project folder + `BRAINSTORMING.md`. The init script runs when `@Orchestrator` starts the pipeline, leaving any existing `BRAINSTORMING.md` untouched.
- The script should read `orchestration.yml` for limits, gate defaults, and other configuration to populate the initial state

### Idea 6: Comprehensive Documentation Update

**Description**: Once the architectural changes are implemented, the README and all supporting documentation (`docs/`) will need comprehensive updates — possibly full rewrites — to reflect the new system. This includes the agent definitions, pipeline description, script interfaces, and any diagrams or workflow descriptions that reference the old Tactical Planner / Orchestrator split.

**Rationale**: The current documentation describes a system that will no longer exist after this project. Leaving it stale creates confusion for anyone trying to understand or extend the orchestration system — including the agents themselves, which read the docs. The planning agents should assess the documentation state at the time of planning and determine the appropriate scope and depth of updates needed.

**Key considerations**:
- The scope and content of updates should be determined at planning time based on the actual state of the docs — no need to prescribe specifics now
- Documentation updates should be a dedicated phase or task set, not an afterthought appended to implementation tasks
- Both the user-facing docs (`docs/`, `README.md`) and the system-facing docs (agent definitions, instruction files, skill files) are in scope

### Idea 7: Eliminate the Triage Skill

**Description**: Delete the `triage-report` skill entirely. Its current content — decision tables, state write contracts, write ordering rules, and error handling — becomes structurally incompatible with the pipeline script architecture (Ideas 1 and 2). Rather than rewriting it to document what the script does, fold the Planner-relevant guidance (how to react to triage outcomes) into the planning skills that actually use it: `create-task-handoff` and `create-phase-plan`.

**Rationale**: The triage skill today is three things: (1) decision tables the script now owns, (2) state write contracts the script now owns, and (3) context-aware planning guidance ("if `review_action` is `corrective_task_issued`, create a corrective handoff"). Only #3 has value post-refactor, and it's not a skill — it's a paragraph of context inside the planning skills. Keeping a triage skill that documents script behavior creates dual authority: the script is canonical, the prose is a stale shadow that an LLM might follow instead. The cleanest fix is elimination.

**Key considerations**:
- `create-task-handoff` gains a "Prior Context" section: read `review_action` from `state.json` → if `corrective_task_issued`, read the code review at `review_doc` path → extract the Issues table → inline those issues as the corrective handoff's primary objective
- `create-phase-plan` gains a similar section: read `phase_review_action` from `state.json` → if `corrective_tasks_issued`, read the phase review at `phase_review` path → extract Cross-Task Issues → create corrective tasks targeting those issues
- The Planner no longer interprets decision tables or derives triage outcomes — it reads a computed field and adjusts its planning output
- The `triage.js` script (or its logic folded into the pipeline engine) remains the single source of truth for triage decisions
- The triage skill directory (`skills/triage-report/`) is deleted, not rewritten
- A review of remaining skills surfaced additional indirection concerns (self-assessment in task reports, multi-path test runner discovery, open-ended review criteria) — these are quality improvements deferred to a future skill hardening pass, not addressed in this project

### Idea 8: Eliminate `state-json-schema.md` and `state-management.instructions.md`

**Description**: Delete both prose documents that shadow what the code already defines. `state-json-schema.md` restates the field types, enums, validation rules, and state transitions that `constants.js`, `state-validator.js`, and (post-refactor) the pipeline engine already define in code. `state-management.instructions.md` guards LLM behavior for state writes that no LLM will perform after the refactor — the pipeline script handles all state I/O, validation, and transitions mechanically.

**Rationale**: Same principle as Idea 7 (triage skill elimination). Both documents create dual authority — a prose version and a code version of the same contract. The code is canonical, tested, and enforced at runtime. The prose is incomplete (the schema documents 10 validation rules; the validator implements 15), will become stale post-refactor (the sole writer changes, STATUS.md is eliminated, the pre-write workflow is internalized), and risks being followed by an LLM instead of the code. The instruction file's `applyTo` pattern (`**/state.json,**/*STATUS.md`) targets files that no agent directly writes post-refactor, so the instruction either never fires or gives wrong guidance.

**Key considerations**:
- `state-json-schema.md` content is fully covered by: `constants.js` (JSDoc types, frozen enums), `state-validator.js` (invariants V1–V15), and the new pipeline engine (state transitions, resolver logic)
- `state-management.instructions.md` has six sections; all become wrong or redundant: the sole writer changes (Tactical Planner → pipeline script), the invariants are in code, STATUS.md is eliminated, the pre-write validation workflow is internalized by the pipeline engine, severity and tier definitions live in `orchestration.yml` and `constants.js`
- Any agent that reads `state.json` for context (e.g., the Planner reading `review_action` to decide what kind of handoff to create) doesn't need write-guard instructions — it's read-only
- The `schemas/` directory under `.github/orchestration/` becomes empty after this deletion — it can be removed

## Scope Boundaries

### In Scope
- Unified event-driven pipeline script (`pipeline.js`) with modular internal architecture
- Removing state mutation and triage from the Tactical Planner agent
- Rewriting the Orchestrator agent to use the event-driven loop
- Project initialization as a script
- Pipeline script reads task report frontmatter directly (status, deviations, severity) — the Orchestrator just signals `task_completed` with the report path
- Adding `triage_attempts` as a persisted field in `state.json` (survives context compaction)
- Fully replacing standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) — no thin wrappers, no backward compatibility
- Updating the Tactical Planner agent definition to be a pure planning agent
- Reducing the Orchestrator's action vocabulary to external-only actions (~18)
- Preserving all existing pure logic modules (resolver, triage engine, state validator, constants)
- Comprehensive test suite for the new pipeline engine and mutations module
- Eliminating `state-json-schema.md` and `state-management.instructions.md` — both are prose shadows of code contracts that become wrong or redundant post-refactor
- Removing the `.github/orchestration/schemas/` directory (empty after schema deletion)
- Eliminating the `triage-report` skill and folding context-aware planning guidance into `create-task-handoff` and `create-phase-plan` skills
- Renaming the `review-code` skill to `review-task` to reflect its actual scope (task-level verification, not just code quality)
- Comprehensive updates (or rewrites) of `README.md` and all supporting `docs/` documentation to reflect the new architecture
- Updates to system-facing docs: agent definitions, instruction files, and skill files affected by the changes

### Out of Scope
- Changes to the Coder, Reviewer, Research, Product Manager, UX Designer, Architect, or Brainstormer agents
- Changes to planning document formats (PRD, Design, Architecture, Master Plan templates)
- Changes to report/review document formats (task reports, code reviews, phase reports, phase reviews)
- Changes to the `state.json` schema beyond the `triage_attempts` addition — existing fields remain the same, only who writes them changes
- Recreating the eliminated documents in a different form — the code IS the schema and the instruction
- Broader skill hardening (task report self-assessment validation, test runner determinism, review verification protocols) — deferred to a future skill-focused project
- CI/CD integration or GitHub Actions
- npm dependencies — continue using Node.js built-ins only
- Git automation
- Dashboard/UI changes

## Key Constraints

- Zero external npm dependencies — Node.js built-ins only, consistent with existing codebase
- Existing test suites for resolver, triage engine, and state validator must continue to pass
- The `state.json` schema is unchanged except for one addition (`triage_attempts`) — this is a refactor of who writes it and how, not what it contains
- Scripts must run on Node.js 18+ (existing requirement)
- The Orchestrator must remain "read-only" in the sense of never directly writing files — state writes happen through the pipeline script via terminal execution
- The Tactical Planner must retain the `edit` tool for writing planning documents (phase plans, task handoffs, phase reports) but should lose all state mutation prose
- The pipeline script must be deterministic — same event + same state always produces the same result

## Resolved Questions

- **`triage_attempts` → persisted in `state.json`**. Move from a runtime-local counter in the Orchestrator to a field in `state.json` managed by the pipeline script. This survives context compaction and makes triage retry logic fully deterministic within the script.
- **`STATUS.md` → eliminated**. With the UI dashboard reading `state.json` directly, `STATUS.md` is redundant. It added complexity (generation, validation, sync) for no incremental value. The Orchestrator can read `state.json` for status, and humans use the dashboard. Removing it simplifies the pipeline script, init script, and Tactical Planner responsibilities.
- **Task report reading → script handles it**. The pipeline script reads the task report frontmatter directly (status, deviations, severity) when handling `task_completed`. The Orchestrator just passes the report path as event context. This keeps the Orchestrator thin and avoids duplicating parsing logic.
- **`state-json-schema.md` → eliminated**. The schema is a prose restatement of what `constants.js` (types/enums), `state-validator.js` (invariants), and the pipeline engine (transitions) already define in code. The code is canonical — it's tested, enforced at runtime, and already more complete than the prose (15 invariants vs. 10 documented). Keeping the prose creates dual authority where an LLM might follow the stale markdown instead of the code.
- **`state-management.instructions.md` → eliminated**. Every section becomes wrong or redundant post-refactor: the sole writer changes from Tactical Planner to pipeline script, the invariants are in `state-validator.js`, STATUS.md is eliminated, the pre-write validation workflow is internalized, and the severity/tier definitions live in `orchestration.yml` and `constants.js`. The instruction's `applyTo` pattern targets files no agent writes directly, so it either never fires or gives wrong guidance.
- **Standalone scripts → fully replaced**. No thin wrappers, no backward compatibility. `next-action.js`, `triage.js`, and `validate-state.js` are replaced by the unified pipeline script. This is a new system — keeping dead entry points adds confusion, not value.
- **`review-code` → `review-task`**. The skill reviews a task's complete output — code, tests, acceptance criteria, contract conformance — against the task handoff. "Review code" frames it as a narrow code quality check, which leads the Reviewer to under-scope. Renaming to `review-task` aligns the skill name with its actual purpose: verifying that a task was completed correctly. This includes renaming the skill directory, updating the skill's frontmatter, and updating any agent definitions or cross-references that point to it.

## Summary

This project refactors the orchestration system's control flow by introducing a unified event-driven pipeline script that handles all state mutations, triage, validation, next-action resolution, and task report parsing in a single deterministic call. The Tactical Planner is stripped to a pure planning agent (phase plans, task handoffs, phase reports) and the Orchestrator becomes a thin controller that signals events and spawns agents. Standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) are fully replaced. Three prose shadow documents (`state-json-schema.md`, `state-management.instructions.md`, and the `triage-report` skill) are eliminated — their content is already defined more completely in code. `STATUS.md` is removed; the UI dashboard provides human-readable status. `triage_attempts` is persisted in `state.json` for compaction resilience. The result is a clear separation: scripts own mechanical state transitions, agents own judgment-requiring work, and code is the single source of truth — no parallel prose to fall out of sync. The project concludes with a comprehensive documentation overhaul.
