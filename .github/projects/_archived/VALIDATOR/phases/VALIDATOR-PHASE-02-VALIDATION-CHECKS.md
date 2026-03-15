---
project: "VALIDATOR"
phase: 2
title: "Validation Checks"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-08T02:00:00Z"
---

# Phase 2: Validation Checks

## Phase Goal

Implement all remaining check modules — agents, skills, config, instructions, prompts, and cross-references — so that a full validation run covers every orchestration file type, populates the shared DiscoveryContext, and produces correct pass/fail/warn results against the live `.github/` directory.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../VALIDATOR-MASTER-PLAN.md) | Phase 2 scope, exit criteria, FR mapping |
| [Architecture](../VALIDATOR-ARCHITECTURE.md) | Check module contracts (`CheckFunction`, `CheckResult`, `CheckDetail`), `DiscoveryContext` interfaces (`AgentInfo`, `SkillInfo`, `InstructionInfo`, `PromptInfo`), constants (`VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, `DEPRECATED_TOOLS`), internal dependency graph, utility contracts |
| [Design](../VALIDATOR-DESIGN.md) | Category ordering (structure → agents → skills → config → instructions → prompts → cross-references), verbosity behavior for detail blocks, category names |
| [Phase 1 Report](../reports/VALIDATOR-PHASE-01-REPORT.md) | Carry-forward: frontmatter.js and yaml-parser.js built but not yet consumed; CHECK_MODULES registry has null placeholders for 6 categories; DiscoveryContext created empty — Phase 2 must populate it |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Agent Checks | — | `create-task-handoff` | 2 | *(created at execution time)* |
| T2 | Skill Checks | — | `create-task-handoff` | 2 | *(created at execution time)* |
| T3 | Config Checks | — | `create-task-handoff` | 2 | *(created at execution time)* |
| T4 | Instruction & Prompt Checks | — | `create-task-handoff` | 4 | *(created at execution time)* |
| T5 | Cross-Reference Checks | T1, T2, T3, T4 | `create-task-handoff` | 2 | *(created at execution time)* |
| T6 | Integration — Wire All Check Modules | T1, T2, T3, T4, T5 | `create-task-handoff` | 1 | *(created at execution time)* |

### T1: Agent Checks

**Module**: `lib/checks/agents.js` + `tests/agents.test.js`  
**Requirements**: FR-1 (required frontmatter fields), FR-2 (tools array validation), FR-3 (agents array consistency), FR-4 (Orchestrator subagent reference validation)  
**Context population**: Populates `context.agents` — a `Map<string, AgentInfo>` keyed by filename  
**Utilities consumed**: `lib/utils/fs-helpers.js` (`listFiles`, `readFile`), `lib/utils/frontmatter.js` (`extractFrontmatter`)  
**Key logic**:
- Scan `.github/agents/` for `*.agent.md` files
- For each agent file: extract frontmatter, validate required fields (`name`, `description`, `tools`, `agents`)
- Validate each `tools[]` entry against `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS`; flag `DEPRECATED_TOOLS` as warnings
- Validate agents array consistency: if `agents[]` is non-empty, `agent` must be in `tools[]`; non-Orchestrator agents must have `agents: []`
- Parse body for `## Skills` section to extract `referencedSkills` (for cross-ref use later)
- Build `AgentInfo` objects and populate `context.agents`

**Acceptance criteria**:
- All `.agent.md` files in the workspace are discovered and validated
- Missing/empty required frontmatter fields produce `fail` results
- Invalid tool names produce `fail`; deprecated tools produce `warn`
- Agents array rules are enforced per FR-3
- `context.agents` is populated with correct `AgentInfo` entries
- Malformed/unparseable agent files produce `fail` results (no crash)
- Tests cover: valid agent, missing fields, invalid tool, deprecated tool, agents consistency, malformed file

---

### T2: Skill Checks

**Module**: `lib/checks/skills.js` + `tests/skills.test.js`  
**Requirements**: FR-5 (directory structure), FR-6 (SKILL.md frontmatter), FR-7 (templates subdirectory and link resolution)  
**Context population**: Populates `context.skills` — a `Map<string, SkillInfo>` keyed by folder name  
**Utilities consumed**: `lib/utils/fs-helpers.js` (`listDirs`, `exists`, `isDirectory`, `readFile`), `lib/utils/frontmatter.js` (`extractFrontmatter`)  
**Key logic**:
- Scan `.github/skills/` for subdirectories
- For each skill directory: verify `SKILL.md` exists, extract frontmatter, validate `name` and `description` fields
- Verify `name` field matches folder name
- Warn if description length outside 50–200 char recommended range
- Verify `templates/` subdirectory exists (except for `run-tests` skill)
- Parse SKILL.md body for template links (`./templates/X.md`), verify each resolves to a real file
- Build `SkillInfo` objects and populate `context.skills`

**Acceptance criteria**:
- All skill directories are discovered and validated
- Missing `SKILL.md` produces `fail`
- Missing/empty `name` or `description` frontmatter produces `fail`
- Name-folder mismatch produces `fail`
- Description length outside range produces `warn`
- Missing `templates/` subdirectory produces `fail` (except `run-tests`)
- Broken template links produce `fail`
- `context.skills` is populated with correct `SkillInfo` entries
- Tests cover: valid skill, missing SKILL.md, frontmatter issues, name mismatch, templates checks, run-tests exemption

---

### T3: Config Checks

**Module**: `lib/checks/config.js` + `tests/config.test.js`  
**Requirements**: FR-9 (required fields), FR-10 (enum/type validation), FR-11 (severity overlap), FR-12 (human gate enforcement)  
**Context population**: Populates `context.config` — parsed `orchestration.yml` content as a nested object  
**Utilities consumed**: `lib/utils/fs-helpers.js` (`readFile`), `lib/utils/yaml-parser.js` (`parseYaml`)  
**Key logic**:
- Read `.github/orchestration.yml`, parse with `parseYaml`
- Verify all required top-level sections: `version`, `projects`, `limits`, `errors`, `human_gates`, `git`
- Validate `version` equals `"1.0"`
- Validate enum fields:
  - `projects.naming` ∈ `{screaming-case, kebab-case}`
  - `errors.on_critical` ∈ `{halt, warn}`
  - `errors.on_minor` ∈ `{retry, warn, ignore}`
  - `git.strategy` ∈ `{single_branch, branch_per_phase}`
  - `human_gates.execution_mode` ∈ `{ask, autonomous}`
- Validate `limits.*` fields are positive integers (`max_phases`, `max_tasks_per_phase`, `max_retries_per_task`, `max_consecutive_rejections`)
- Check severity list overlap: `errors.critical` ∩ `errors.minor` must be empty
- Enforce human gate hard gates: `human_gates.after_planning` and `human_gates.after_final_review` must be `true`
- Populate `context.config` with parsed object

**Acceptance criteria**:
- `orchestration.yml` is parsed and all required sections validated
- Missing sections/fields produce `fail`
- Wrong `version` value produces `fail`
- Invalid enum values produce `fail` with expected values listed in detail
- Non-positive-integer limits produce `fail`
- Severity overlap produces `fail`
- Hard gate violations produce `fail`
- `context.config` is populated with correct parsed object
- Parse failure produces `fail` (no crash)
- Tests cover: valid config, missing sections, invalid enums, bad limits, severity overlap, gate violations, parse failure

---

### T4: Instruction & Prompt Checks

**Modules**: `lib/checks/instructions.js` + `lib/checks/prompts.js` + `tests/instructions.test.js` + `tests/prompts.test.js`  
**Requirements**: FR-8 (instruction validation), FR-15 (prompt validation)  
**Context population**: Populates `context.instructions` (array of `InstructionInfo`) and `context.prompts` (array of `PromptInfo`)  
**Utilities consumed**: `lib/utils/fs-helpers.js` (`listFiles`, `readFile`), `lib/utils/frontmatter.js` (`extractFrontmatter`)  

**Instructions logic** (`lib/checks/instructions.js`):
- Scan `.github/instructions/` for `*.instructions.md` files
- For each file: extract frontmatter, validate `applyTo` field is present and non-empty
- Build `InstructionInfo` objects and populate `context.instructions`

**Prompts logic** (`lib/checks/prompts.js`):
- Scan `.github/prompts/` for `*.prompt.md` files
- For each file: extract frontmatter, validate `description` field is present
- If `tools` array is present in frontmatter, validate each entry against `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS`
- Build `PromptInfo` objects and populate `context.prompts`

**Acceptance criteria**:
- All instruction files are discovered and validated; missing `applyTo` produces `fail`
- All prompt files are discovered and validated; missing `description` produces `fail`
- Invalid tool names in prompt `tools` arrays produce `fail`
- `context.instructions` and `context.prompts` are correctly populated
- Empty directories produce zero results (no error)
- Malformed files produce `fail` (no crash)
- Tests cover both modules: valid files, missing fields, invalid tools, malformed files, empty dirs

---

### T5: Cross-Reference Checks

**Module**: `lib/checks/cross-refs.js` + `tests/cross-refs.test.js`  
**Requirements**: FR-4 (Orchestrator agents[] → real agent names), FR-13 (agent → skill references resolve), FR-14 (skill → template links resolve), FR-7 (template link file existence)  
**Context reads**: `context.agents`, `context.skills`, `context.config` — all must be populated by T1–T4  
**Utilities consumed**: `lib/utils/fs-helpers.js` (`exists`)  

**Key logic**:
- **Orchestrator agent references**: Find the Orchestrator agent in `context.agents`; validate every entry in its `agents[]` array matches a `name` field from another agent in `context.agents`
- **Agent → skill references**: For each agent's `referencedSkills` array, verify the skill name exists as a key in `context.skills`
- **Skill → template link resolution**: For each skill's `templateLinks` array, verify the linked file exists on disk (resolve relative to the skill's directory)
- **Config path validation**: If `context.config` has `projects.base_path`, verify it points to an existing or creatable directory

**Acceptance criteria**:
- Broken Orchestrator → agent references produce `fail`
- Broken agent → skill references produce `fail`
- Broken skill → template links produce `fail`
- Invalid config `base_path` produces `warn`
- All valid references produce `pass`
- Empty context sections are handled gracefully (no crash)
- Tests cover: valid cross-refs, broken Orchestrator ref, broken skill ref, broken template link, empty context

---

### T6: Integration — Wire All Check Modules

**Module**: Modify `validate-orchestration.js`  
**Dependencies**: T1, T2, T3, T4, T5 (all check modules must exist)  
**Key logic**:
- Replace all `null` entries in `CHECK_MODULES` with `require()` calls to the actual check modules
- Run `node validate-orchestration.js` end-to-end against the live `.github/` workspace
- Verify all 7 categories appear in output
- Verify zero false positives on the current valid workspace
- Verify DiscoveryContext is fully populated after a run

**Acceptance criteria**:
- `CHECK_MODULES` registry has no null entries — all 7 categories are wired
- Full run produces output for all 7 categories
- Exit code is 0 on the current valid workspace (zero false positives)
- `--category <name>` works for all 7 category names
- `--verbose`, `--quiet`, `--no-color` all work with the full check suite

## Execution Order

```
T1 (Agent Checks)  ──┐
T2 (Skill Checks)  ──┤
T3 (Config Checks) ──┤ ← T1–T4 are parallel-ready (no mutual dependencies)
T4 (Instr+Prompt)  ──┘
                      │
                      ▼
T5 (Cross-Ref Checks) ← depends on T1, T2, T3, T4 (reads populated context)
                      │
                      ▼
T6 (Integration)      ← depends on T1, T2, T3, T4, T5 (wires all modules)
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6

*Note: T1, T2, T3, T4 are parallel-ready (no mutual dependencies on each other) but will execute sequentially in v1. T5 must run after T1–T4. T6 must run last.*

## Phase Exit Criteria

- [ ] A full validation run covers all 7 categories (structure, agents, skills, config, instructions, prompts, cross-references)
- [ ] Every P0 and P1 functional requirement (FR-1 through FR-15) has at least one corresponding check
- [ ] All checks produce correct pass/fail/warn results against the live `.github/` directory
- [ ] Zero false positives on the current valid orchestration workspace
- [ ] DiscoveryContext is fully populated — `context.agents`, `context.skills`, `context.config`, `context.instructions`, `context.prompts` all contain correct data
- [ ] Cross-reference checks correctly identify broken links when deliberately introduced
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] All tests pass (Phase 1 + Phase 2 test suites)

## Known Risks for This Phase

- **YAML parsing edge cases in orchestration.yml**: The custom yaml-parser built in Phase 1 handles the standard subset. If `orchestration.yml` uses unsupported YAML features (anchors, flow style), `parseYaml` returns null and config checks emit a fail. Mitigation: test against the live `orchestration.yml` in T3.
- **Frontmatter format variations**: Agent and skill files use different frontmatter delimiters (standard `---` vs fenced code blocks). The frontmatter extractor handles both, but edge cases in field parsing (multi-line values, list fields) could cause false positives. Mitigation: test each check module against actual workspace files.
- **Hardcoded valid tool/toolset lists**: `VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, and `DEPRECATED_TOOLS` constants are frozen at a point in time. New tools added to Copilot won't be recognized. Mitigation: centralize constants at the top of `agents.js` with clear "update here" comments (per Architecture risk mitigation).
- **Cross-reference depends on correct context population**: T5 can only be as good as T1–T4's context population. If an earlier module populates context incorrectly, cross-ref checks will produce false positives/negatives. Mitigation: each module (T1–T4) has acceptance criteria for context population correctness; T5 has tests with mock context.
