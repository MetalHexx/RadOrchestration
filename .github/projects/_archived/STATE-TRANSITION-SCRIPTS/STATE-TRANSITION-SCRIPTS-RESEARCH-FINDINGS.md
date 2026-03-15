---
project: "STATE-TRANSITION-SCRIPTS"
author: "research-agent"
created: "2026-03-08T00:00:00Z"
---

# STATE-TRANSITION-SCRIPTS — Research Findings

## Research Scope

Investigated the orchestration system's execution-phase logic — routing, triage, and state management — to gather the full technical context for three deterministic JavaScript CLI scripts (Next-Action Resolver, Triage Executor, State Transition Validator). Also catalogued all agents/skills that would need prose updates to call these scripts and documented existing code patterns the scripts must follow.

---

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|---|---|---|
| Orchestrator agent | `.github/agents/orchestrator.agent.md` | Contains the full routing decision tree that Script 1 (Next-Action Resolver) must encode |
| Tactical Planner agent | `.github/agents/tactical-planner.agent.md` | Mode 3 + Mode 4 triage logic that Script 2 (Triage Executor) replaces; state write patterns that Script 3 (Validator) enforces |
| Triage Report skill | `.github/skills/triage-report/SKILL.md` | Authoritative 11-row task-level and 5-row phase-level decision tables |
| State JSON schema | `plan/schemas/state-json-schema.md` | Full field reference, transition rules, 10 validation invariants |
| orchestration.yml | `.github/orchestration.yml` | Limits, severity classification, human gate defaults — config the scripts consume |
| Coder agent | `.github/agents/coder.agent.md` | Downstream consumer; reads only Task Handoff; no changes needed |
| Reviewer agent | `.github/agents/reviewer.agent.md` | Produces verdicts in frontmatter (`approved` / `changes_requested` / `rejected`); no changes needed |
| Validate-orchestration CLI | `.github/skills/validate-orchestration/scripts/validate-orchestration.js` | Existing CLI pattern: shebang, `parseArgs()`, sequential check modules, exit-code convention |
| fs-helpers utility | `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` | Reusable `readFile()`, `exists()` wrappers — scripts can import directly |
| yaml-parser utility | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | Custom YAML parser — scripts can import for reading `orchestration.yml` |
| frontmatter utility | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` | Extracts frontmatter from `.md` files — Script 2 needs this to read review verdicts |
| constants utility | `.github/skills/validate-orchestration/scripts/lib/utils/constants.js` | Pattern for shared enums/constants |
| State management instructions | `.github/instructions/state-management.instructions.md` | Invariants the Tactical Planner must follow — Script 3 must enforce these |
| Project docs instructions | `.github/instructions/project-docs.instructions.md` | File ownership rules, naming conventions |
| Create Phase Plan skill | `.github/skills/create-phase-plan/SKILL.md` | Phase planning workflow — references triage in its inputs |
| Create Task Handoff skill | `.github/skills/create-task-handoff/SKILL.md` | Task handoff workflow — post-triage handoff creation |
| Generate Phase Report skill | `.github/skills/generate-phase-report/SKILL.md` | Phase Report creation — feeds into phase-level triage |

### Existing Patterns

- **Module style**: All existing JS uses `'use strict'` + CommonJS (`require`/`module.exports`). No ESM, no transpilation, no bundler.
- **Zero external dependencies**: The validate-orchestration tool uses only Node.js built-ins (`fs`, `path`, `os`, `assert`). No npm packages.
- **CLI entry-point pattern**: Shebang `#!/usr/bin/env node`, `parseArgs(process.argv.slice(2))`, `main()` async function, `if (require.main === module)` guard, `process.exit(code)`.
- **Lib structure**: `scripts/lib/checks/` for domain logic modules, `scripts/lib/utils/` for shared utilities, `scripts/lib/reporter.js` for output formatting.
- **Check result contract**: Each check module returns `Array<{ category, name, status, message, detail? }>` where `status` is `'pass' | 'fail' | 'warn'`.
- **Error handling**: Functions never throw — they return null/empty/fail-result. All try/catch wraps return safe defaults.
- **JSDoc**: Functions have JSDoc `@param` and `@returns` annotations.
- **Test framework**: Two patterns coexist:
  1. **`node:test` built-in** (newer): Used in `agents.test.js`, `config.test.js` — `describe`/`it`/`beforeEach` from `require('node:test')`, `require('node:assert')`. Supports mock via require-cache replacement.
  2. **Manual test harness** (older): Used in `frontmatter.test.js`, `fs-helpers.test.js`, `structure.test.js`, `yaml-parser.test.js`, `reporter.test.js` — custom `test()` function, manual `passed`/`failed` counters, `process.exit(1)` on failure.
- **Test invocation**: Tests run with `node tests/<file>.test.js` directly — no test runner binary.
- **Naming**: Test files mirror source module names: `agents.test.js` tests `checks/agents.js`.

### Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | v14+ (minimum per validate-orchestration SKILL.md) | No npm, no build step |
| Test framework | `node:test` built-in + manual harness | Node.js 18+ for `node:test` | Two patterns coexist; newer files use `node:test` |
| Assertion | `node:assert` / `assert` | Built-in | `assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok` |
| Config format | YAML | Custom parser | `yaml-parser.js` — no `js-yaml` dependency |
| State format | JSON | Native `JSON.parse`/`JSON.stringify` | `state.json` is the primary input |
| Agent format | Markdown with YAML frontmatter | Custom parser | `frontmatter.js` extracts frontmatter |

---

## Key Findings

### 1. Orchestrator Routing Decision Tree (Script 1 Input)

The Orchestrator's full routing algorithm is in `.github/agents/orchestrator.agent.md` § "Decision Logic" Steps 0–2f. The Next-Action Resolver must encode this as a pure function: `(state.json) → NextAction`.

#### Complete NextAction Vocabulary

The resolver must emit exactly one of these actions:

| Action | Context | Meaning |
|---|---|---|
| `init_project` | No `state.json` exists | Spawn Tactical Planner to initialize project |
| `display_halted` | `pipeline.current_tier == "halted"` | Show STATUS.md + blockers to human |
| `spawn_research` | Planning: `research.status != "complete"` | Spawn Research Agent |
| `spawn_prd` | Planning: `prd.status != "complete"` | Spawn Product Manager |
| `spawn_design` | Planning: `design.status != "complete"` | Spawn UX Designer |
| `spawn_architecture` | Planning: `architecture.status != "complete"` | Spawn Architect |
| `spawn_master_plan` | Planning: `master_plan.status != "complete"` | Spawn Architect for Master Plan |
| `request_plan_approval` | Planning: all steps complete, `human_approved == false` | Human gate: approve Master Plan |
| `transition_to_execution` | Planning: all steps complete, `human_approved == true` | Spawn Tactical Planner to set tier = execution |
| `create_phase_plan` | Execution: `phase.status == "not_started"` | Spawn Tactical Planner Mode 3 |
| `create_task_handoff` | Execution: `task.status == "not_started"` AND no handoff doc | Spawn Tactical Planner Mode 4 |
| `execute_task` | Execution: `task.status == "not_started"` AND handoff doc exists | Spawn Coder |
| `update_state_from_task` | Execution: Coder finished (task report produced) | Spawn Tactical Planner Mode 2 |
| `create_corrective_handoff` | Execution: `task.status == "failed"` AND retries < max AND severity minor | Spawn Tactical Planner corrective handoff |
| `halt_task_failed` | Execution: `task.status == "failed"` AND (retries >= max OR severity critical) | Spawn Tactical Planner to halt |
| `spawn_code_reviewer` | Execution: `task.status == "complete"` AND no review doc | Spawn Reviewer Mode 1 |
| `update_state_from_review` | Execution: Reviewer finished (review doc produced) | Spawn Tactical Planner Mode 2 (records review_doc) |
| `triage_task` | Execution: `task.review_doc != null AND task.review_verdict == null` | Spawn Tactical Planner Mode 4 (triage only) |
| `halt_triage_invariant` | Execution: triage re-spawn failed (triage_attempts > 1) | Halt pipeline |
| `retry_from_review` | Execution: `task.review_verdict == "changes_requested"` | Corrective handoff retry cycle |
| `halt_from_review` | Execution: `task.review_verdict == "rejected"` | Halt pipeline |
| `advance_task` | Execution: `task.review_verdict == "approved"` or task complete with no review | Advance to next task |
| `gate_task` | Execution: `human_gate_mode == "task"` | Show task results, wait for human |
| `generate_phase_report` | Execution: all tasks in phase complete | Spawn Tactical Planner Mode 5 |
| `spawn_phase_reviewer` | Execution: phase report generated, no phase review | Spawn Reviewer Mode 2 |
| `update_state_from_phase_review` | Execution: Phase Reviewer finished | Spawn Tactical Planner Mode 2 (records phase_review) |
| `triage_phase` | Execution: `phase.phase_review != null AND phase.phase_review_verdict == null` | Spawn Tactical Planner Mode 3 (triage only) |
| `halt_phase_triage_invariant` | Execution: phase triage re-spawn failed | Halt pipeline |
| `gate_phase` | Execution: `human_gate_mode == "phase"` | Show phase results, wait for human |
| `advance_phase` | Execution: phase complete, advance to next | Increment `current_phase` |
| `transition_to_review` | Execution: all phases complete | Set tier = review |
| `spawn_final_reviewer` | Review tier: `final_review.status != "complete"` | Spawn Reviewer Mode 3 |
| `request_final_approval` | Review: final review complete, `human_approved == false` | Human gate: approve project |
| `transition_to_complete` | Review: `human_approved == true` | Set tier = complete |
| `display_complete` | `pipeline.current_tier == "complete"` | Show completion summary |

> **Note**: `triage_attempts` is a runtime-local counter in the Orchestrator — it is NOT persisted to state.json. It resets per-task and per-phase transition. If triage invariant is still violated after one re-spawn, the pipeline halts — no infinite loop (NFR-07).

#### Routing Priority (Execution Tier)

Within the execution tier, the Orchestrator follows this evaluation order:

1. Check if all phases complete → `transition_to_review`
2. Check phase status (`not_started` → `create_phase_plan`)
3. Find first incomplete task in current phase
4. Route by task status: `not_started` → `failed` → `complete`
5. Within `complete`: check review_doc → check triage invariant → route by verdict
6. After all tasks: phase report → phase review → phase triage → gate → advance

### 2. Triage Decision Tables (Script 2 Input)

Both tables are in `.github/skills/triage-report/SKILL.md`. Reproduced here with all conditions for Script 2 encoding.

#### Task-Level Decision Table (11 Rows)

| Row | task.report_status | task.has_deviations | task.review_doc | review.verdict | → review_verdict | → review_action | Planner Action |
|---|---|---|---|---|---|---|---|
| 1 | `complete` | No | `null` | *(n/a)* | *(skip)* | *(skip)* | Next handoff; carry recommendations |
| 2 | `complete` | No | non-null | `approved` | `"approved"` | `"advanced"` | Next handoff normally |
| 3 | `complete` | Yes (minor) | non-null | `approved` | `"approved"` | `"advanced"` | Next handoff; surface minor deviations |
| 4 | `complete` | Yes (architectural) | non-null | `approved` | `"approved"` | `"advanced"` | Next handoff; carry-forward architectural deviation |
| 5 | `complete` | Any | non-null | `changes_requested` | `"changes_requested"` | `"corrective_task_issued"` | Corrective handoff |
| 6 | `complete` | Any | non-null | `rejected` | `"rejected"` | `"halted"` | Halt pipeline |
| 7 | `partial` | — | `null` | *(n/a)* | *(skip)* | *(skip)* | Assess severity; corrective or halt |
| 8 | `partial` | — | non-null | `changes_requested` | `"changes_requested"` | `"corrective_task_issued"` | Corrective handoff (merge issues) |
| 9 | `partial` | — | non-null | `rejected` | `"rejected"` | `"halted"` | Halt pipeline |
| 10 | `failed` | — | Any or `null` | Any or `null` | *(record if review doc exists)* | *(conditional)* | If `retries < max AND severity == "minor"` → `"corrective_task_issued"`; else → `"halted"` |
| 11 | `failed` | — | Any or `null` (critical) | Any or `null` | *(record if review doc exists)* | `"halted"` | Halt immediately (critical severity) |

**Row 10 complexity**: Cross-document lookup: `state.json → limits.max_retries_per_task` AND `task.retries` AND `task.severity`. This is the one row with branching logic rather than a direct mapping.

**Row 11 override**: Critical severity always halts regardless of retry budget.

#### Phase-Level Decision Table (5 Rows)

| Row | phase_review.verdict | Exit Criteria | → phase_review_verdict | → phase_review_action | Planner Action |
|---|---|---|---|---|---|
| 1 | `null` (no review yet) | — | *(skip)* | *(skip)* | Skip triage; plan from Phase Report only |
| 2 | `approved` | All met | `"approved"` | `"advanced"` | Plan next phase normally |
| 3 | `approved` | Some unmet | `"approved"` | `"advanced"` | Plan next phase; carry-forward unmet criteria |
| 4 | `changes_requested` | — | `"changes_requested"` | `"corrective_tasks_issued"` | Corrective tasks for integration issues |
| 5 | `rejected` | — | `"rejected"` | `"halted"` | Halt pipeline |

**Note**: Phase-level action uses `"corrective_tasks_issued"` (plural) vs. task-level `"corrective_task_issued"` (singular). These are intentionally different — do NOT normalize.

#### Triage Read Sequences

**Task-Level (Mode 4):**
1. ALWAYS: read Task Report at `state.json → task.report_doc`
2. ONLY IF `task.review_doc != null`: read Code Review at `state.json → task.review_doc`

**Phase-Level (Mode 3):**
1. ALWAYS (skip if first phase): read Phase Report at `state.json → phase.phase_report`
2. ONLY IF `phase.phase_review != null`: read Phase Review at `state.json → phase.phase_review`

#### Triage State Write Contract

- `review_verdict`: Verbatim from review frontmatter `verdict` field. Enum: `"approved"` | `"changes_requested"` | `"rejected"` | `null`
- `review_action`: Resolved from decision table. Enum: `"advanced"` | `"corrective_task_issued"` | `"halted"` | `null`
- `phase_review_verdict`: Same source, same enum
- `phase_review_action`: Enum: `"advanced"` | `"corrective_tasks_issued"` | `"halted"` | `null`
- **Write ordering**: verdict/action MUST be written BEFORE `handoff_doc` or Phase Plan entry
- **Immutability**: Once written, verdict/action fields for a task/phase MUST NOT be overwritten by triage of a different task/phase
- **Verbatim transcription**: No case normalization, no mapping, no invention. Invalid verdict → error → halt.

#### Triage Error Conditions

| Condition | Action |
|---|---|
| Review document not found at stored path | Write error to `errors.active_blockers`, halt, leave verdict/action as `null` |
| Invalid verdict value in frontmatter | Write error to `errors.active_blockers`, halt, leave verdict/action as `null` |

### 3. State.json Invariants (Script 3 Input)

All invariants from `plan/schemas/state-json-schema.md` § "Validation Rules" and `.github/instructions/state-management.instructions.md`:

| # | Invariant | Source |
|---|---|---|
| V1 | `current_phase` must be valid index into `phases[]` (0-based) or 0 if no phases | state-json-schema §Validation Rules #1 |
| V2 | Each phase's `current_task` must be valid index into that phase's `tasks[]` | state-json-schema §Validation Rules #2 |
| V3 | `retries` must never exceed `limits.max_retries_per_task` | state-json-schema §Validation Rules #3 |
| V4 | `phases.length` must never exceed `limits.max_phases` | state-json-schema §Validation Rules #4 |
| V5 | Each phase's `tasks.length` must never exceed `limits.max_tasks_per_phase` | state-json-schema §Validation Rules #5 |
| V6 | Only one task across entire project may have `status: "in_progress"` at a time | state-json-schema §Validation Rules #6 |
| V7 | `planning.human_approved` must be `true` before `current_tier` can become `"execution"` | state-json-schema §Validation Rules #7 |
| V8 | Task triage invariant: `task.review_doc != null AND task.review_verdict == null` → triage was skipped (detected by Orchestrator) | state-json-schema §Validation Rules #8 |
| V9 | Phase triage invariant: `phase.phase_review != null AND phase.phase_review_verdict == null` → phase triage was skipped (detected by Orchestrator) | state-json-schema §Validation Rules #9 |
| V10 | Null treatment: absent fields treated as `null`; `null != null` evaluates to `false` → no false triggers on legacy state | state-json-schema §Validation Rules #10 |
| V11 | Retry counts never decrease — they only go up | state-management instructions |
| V12 | Tasks never skip states: `not_started → in_progress → complete \| failed` | state-management instructions |
| V13 | Always update `project.updated` timestamp on every write | state-management instructions |
| V14 | Triage write ordering: verdict/action BEFORE `handoff_doc` when `review_doc` is non-null | triage-report SKILL §Write Ordering |
| V15 | Triage immutability: verdict/action for task N must not be overwritten by triage of task M | triage-report SKILL §Immutability |

#### Allowed State Transitions

**Task status**: `not_started` → `in_progress` → `complete` | `failed` | `halted`
**Phase status**: `not_started` → `in_progress` → `complete` | `failed` | `halted`
**Pipeline tier**: `planning` → `execution` → `review` → `complete` (can go to `halted` from any tier)
**Planning step status**: `not_started` → `in_progress` → `complete` | `failed` | `skipped` (design only)

#### Allowed Field Enums

| Field | Allowed Values |
|---|---|
| `pipeline.current_tier` | `planning`, `execution`, `review`, `complete`, `halted` |
| `pipeline.human_gate_mode` | `ask`, `phase`, `task`, `autonomous` |
| `planning.status` | `not_started`, `in_progress`, `complete` |
| `planning.steps.*.status` | `not_started`, `in_progress`, `complete`, `failed`, `skipped` (design only) |
| `execution.phases[].status` | `not_started`, `in_progress`, `complete`, `failed`, `halted` |
| `execution.phases[].tasks[].status` | `not_started`, `in_progress`, `complete`, `failed`, `halted` |
| `task.severity` | `minor`, `critical`, `null` |
| `task.review_verdict` | `approved`, `changes_requested`, `rejected`, `null` |
| `task.review_action` | `advanced`, `corrective_task_issued`, `halted`, `null` |
| `phase.phase_review_verdict` | `approved`, `changes_requested`, `rejected`, `null` |
| `phase.phase_review_action` | `advanced`, `corrective_tasks_issued`, `halted`, `null` |
| `final_review.status` | `not_started`, `in_progress`, `complete`, `failed` |

### 4. Agents and Skills Needing Prose Updates

This project specifically requires prose updates to these agents/skills so they call the scripts instead of re-deriving logic:

| File | What Changes | Why |
|---|---|---|
| `.github/agents/orchestrator.agent.md` | Replace prose decision tree (Steps 2a–2f) with "call next-action resolver script, read output, pattern-match on action" | Script 1 replaces the Orchestrator's inline routing algorithm |
| `.github/agents/tactical-planner.agent.md` | **Mode 3** (§ step 7): replace "Execute `triage-report` skill (phase-level)" with "call triage executor script". **Mode 4** (§ step 6): replace "Execute `triage-report` skill (task-level)" with "call triage executor script". **Mode 2**: add "call state transition validator before writing state.json" | Script 2 replaces triage logic; Script 3 validates writes |
| `.github/skills/triage-report/SKILL.md` | Add a section noting that the decision tables are now authoritatively executed by the triage executor script; the markdown remains as documentation but is no longer the primary execution path | Script 2 is now the authority |
| `.github/instructions/state-management.instructions.md` | Add instruction to call state transition validator before any `state.json` write | Script 3 is now the enforcement mechanism |

**No changes needed to these agents** (the user confirmed Coder and Reviewer are out of scope):

| File | Reason |
|---|---|
| `.github/agents/coder.agent.md` | Reads only Task Handoff; no routing or triage logic |
| `.github/agents/reviewer.agent.md` | Produces verdicts in frontmatter; no routing or triage logic |
| `.github/agents/research.agent.md` | Planning-only agent |
| `.github/agents/product-manager.agent.md` | Planning-only agent |
| `.github/agents/ux-designer.agent.md` | Planning-only agent |
| `.github/agents/architect.agent.md` | Planning-only agent |
| `.github/agents/brainstormer.agent.md` | Standalone, outside pipeline |

### 5. Existing Code Patterns the Scripts Must Follow

#### CLI Conventions

The existing `validate-orchestration.js` establishes the CLI pattern:

```javascript
#!/usr/bin/env node
'use strict';

function parseArgs(argv) { /* ... */ }

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // ... core logic ...
  process.exit(exitCode);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  });
}

module.exports = { parseArgs, /* exported for testing */ };
```

Key conventions:
- Shebang line: `#!/usr/bin/env node`
- `'use strict'` at top of every file
- CommonJS: `require()` / `module.exports`
- `parseArgs()` exported for testability
- `if (require.main === module)` guard for CLI entry
- Exit codes: `0` = success, `1` = error/failure
- Async `main()` with `.catch()` safety net
- No external dependencies

#### Output Convention

Scripts should output JSON to stdout for machine readability. The Orchestrator/Planner parses the output:

```json
{ "action": "create_task_handoff", "phase": 2, "task": 3 }
```

For the validator, a pass/fail with structured errors:

```json
{ "valid": true }
{ "valid": false, "errors": ["V6: Multiple tasks in_progress", "V3: retries exceed max"] }
```

#### Module Structure Pattern

```
scripts/
├── <script-name>.js         # CLI entry point
└── lib/
    ├── <domain-module>.js    # Core logic (exported for testing)
    └── utils/
        ├── fs-helpers.js     # File system wrappers (reusable)
        ├── frontmatter.js    # Frontmatter parser (reusable)
        ├── yaml-parser.js    # YAML parser (reusable)
        └── constants.js      # Shared enums/constants
```

#### Test Patterns

Two patterns exist; the newer `node:test` approach is preferred:

```javascript
'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock setup via require.cache replacement
// ...

describe('moduleName', () => {
  beforeEach(() => { /* reset mocks */ });

  it('descriptive test name', async () => {
    // Arrange
    // Act
    const result = await functionUnderTest(input);
    // Assert
    assert.strictEqual(result.field, expectedValue);
  });
});
```

Test files live in `tests/` at the project root and mirror source module names.

#### Reusable Utilities

The scripts can directly import from the validate-orchestration utils:

| Utility | Path | Relevant Exports |
|---|---|---|
| `fs-helpers` | `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` | `readFile(path)`, `exists(path)` |
| `frontmatter` | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` | `extractFrontmatter(content)` — returns `{ frontmatter, body }` |
| `yaml-parser` | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | `parseYaml(yamlString)` — returns parsed object |

### 6. Configuration the Scripts Need

From `.github/orchestration.yml`:

| Config Key | Used By | Purpose |
|---|---|---|
| `limits.max_phases` | Script 3 (Validator) | V4: phase count ceiling |
| `limits.max_tasks_per_phase` | Script 3 (Validator) | V5: task count ceiling |
| `limits.max_retries_per_task` | Script 2 (Triage) + Script 3 (Validator) | Row 10 retry budget check; V3 retry ceiling |
| `errors.severity.critical` | Script 2 (Triage) | Row 10/11: severity classification for failed tasks |
| `errors.severity.minor` | Script 2 (Triage) | Row 10: minor severity enables retry |
| `human_gates.execution_mode` | Script 1 (Resolver) | Determines gate actions in NextAction |
| `projects.base_path` | Script 1 (Resolver) | Locates project state files |

**Note from brainstorming**: The brainstorming doc suggests scripts should read limits from `state.json → limits` (which are copied from `orchestration.yml` at project init) rather than reading `orchestration.yml` directly. This keeps the interface clean: Script 2 and Script 3 only need `state.json` as input.

Script 1 (Resolver) may need `orchestration.yml` for `human_gates.execution_mode` and `projects.base_path`, which are NOT stored in `state.json`.

---

## External Research

| Source | Key Finding |
|---|---|
| Node.js `node:test` docs | `node:test` is stable from Node.js 20+; experimental in 18. The existing codebase already uses it in `agents.test.js` and `config.test.js`. |
| JSON stdout convention | CLI tools outputting JSON to stdout is standard for machine consumption; `console.log(JSON.stringify(result))` is the pattern. Errors go to stderr. |
| Process exit codes | `0` = success, `1` = validation failure / error. The validate-orchestration tool already uses this convention. |

---

## Constraints Discovered

- **No `src/` directory content exists**: The `src/` folder is empty. The only existing JavaScript lives under `.github/skills/validate-orchestration/scripts/`. The new scripts should likely follow the same placement pattern: `.github/skills/<skill-name>/scripts/` — or potentially a new top-level `src/` structure if the project wants to centralize scripts outside of skills.
- **No `package.json` exists**: No npm configuration, no `node_modules`. All code is zero-dependency Node.js. New scripts must not introduce npm dependencies.
- **No `bin/` content exists**: The `bin/` folder is empty. Could be used as the script entry-point location if desired.
- **Limits are duplicated**: `orchestration.yml` limits are copied into `state.json → limits` at project init. Scripts should prefer reading from `state.json` for simplicity (one input file).
- **`triage_attempts` is runtime-local**: This counter exists only in the Orchestrator's runtime context — not in `state.json`. Script 1 cannot track this; the Orchestrator must still manage it or it must be explicitly decided where this counter lives.
- **Two test patterns coexist**: Newer test files use `node:test` (`describe`/`it`), older ones use manual harness. New test files should use `node:test` for consistency with the newer pattern.
- **Fenced code block frontmatter**: Review documents use fenced code blocks (e.g., ` ```chatagent `) around frontmatter. The `extractFrontmatter()` utility already handles this — Script 2 should use it directly.
- **Severity classification is in config, not state**: The `errors.severity.critical` and `errors.severity.minor` arrays are in `orchestration.yml` but NOT replicated in `state.json`. For Row 10/11 triage decisions, the script would need to either: (a) also read `orchestration.yml`, or (b) have the severity lists added to `state.json → limits`. The brainstorming doc's preference is to keep `state.json` as the single input — this may require a schema extension.
- **Task severity field vs. config severity lists**: `state.json → task.severity` stores `"minor"` or `"critical"` for a specific failed task. The severity classification lists in `orchestration.yml` are for classifying error types. Script 2 only needs `task.severity` from `state.json` — the classification has already happened by the time triage runs. This resolves the single-input constraint cleanly.

---

## Recommendations

- **Script placement**: Consider placing scripts under `src/` (currently empty) or under a new `.github/skills/state-transition-scripts/scripts/` skill directory, consistent with the validate-orchestration pattern. The skill-based placement keeps scripts co-located with their documentation.
- **Shared utilities**: Import `fs-helpers.js`, `frontmatter.js`, and `yaml-parser.js` from the existing validate-orchestration `lib/utils/` path. Do not duplicate them.
- **Single input for Script 2 and 3**: `state.json` alone should be sufficient. `task.severity` already stores the classified severity, so the triage script does not need `orchestration.yml` for Row 10/11. Script 1 may need `orchestration.yml` for `human_gates.execution_mode`.
- **JSON stdout output**: All three scripts should output structured JSON to stdout (machine-readable). Errors and diagnostics to stderr. This allows agents to `JSON.parse()` the output.
- **Test approach**: Use `node:test` (`describe`/`it`) for all new test files. Mock file system via require-cache replacement pattern established in `agents.test.js`.
- **Export core logic**: Each script should export its core logic function (not just CLI `main()`), enabling direct `require()` in tests without subprocess spawning.
- **`triage_attempts` tracking**: The Orchestrator agent prose must still track this counter locally. Script 1 can output `"triage_task"` or `"triage_phase"` as actions; the Orchestrator increments its local counter and halts if > 1. This counter should NOT move to `state.json`.
- **Enum constants file**: Create a shared `constants.js` with all enums (tier values, status values, verdict values, action values, severity values) to ensure consistency between the three scripts and their tests.
- **Prose update scope**: Four files need prose updates (Orchestrator, Tactical Planner, triage-report skill, state-management instructions). Planning-only agents and the Coder/Reviewer are unaffected.
