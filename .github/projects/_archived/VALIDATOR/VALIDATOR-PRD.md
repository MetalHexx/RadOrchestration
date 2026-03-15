---
project: "VALIDATOR"
status: "draft"
author: "product-manager-agent"
created: "2026-03-07T12:00:00Z"
---

# VALIDATOR — Product Requirements

## Problem Statement

The orchestration system relies on a web of interlinked files — 8 agent definitions, 14 skills, 2 instruction files, 1 prompt file, a YAML configuration, and multiple cross-references between them — all of which must conform to strict naming, structural, and semantic conventions. Manual verification of these conventions is error-prone, slow, and scales poorly as the system grows. An existing 725-line validator script covers basic structural checks but has significant gaps: it lacks YAML value validation for configuration, ignores prompt files entirely, misses cross-reference integrity checks (e.g., skill template link resolution), and uses emoji-only output that renders inconsistently across terminals. Developers need a reliable, comprehensive, fast CLI tool that catches convention violations immediately after changes, before they cascade into agent failures at runtime.

## Goals

- **Comprehensive validation**: Cover all orchestration file types — agents, skills, instructions, prompts, configuration, and all cross-references between them — with zero known validation gaps
- **Developer-friendly output**: Provide clear, color-coded terminal output (ANSI colors) grouped by category, with a summary of pass/fail/warning counts so developers can quickly locate issues
- **Fast execution**: Complete a full validation pass of a typical orchestration workspace in under 2 seconds
- **Minimal dependencies**: Run with zero or near-zero external npm dependencies, leveraging Node.js built-in modules
- **Easy to run**: Execute with a single command from the workspace root (e.g., `node validate-orchestration.js`) with sensible defaults and no required configuration
- **CI-ready**: Return appropriate exit codes (0 = pass, 1 = fail) and support non-color output for pipeline integration

## Non-Goals

- **Auto-fixing errors**: The validator reports problems but does not modify any files
- **Graphical user interface**: Output is terminal-only; no web UI, Electron app, or VS Code extension
- **Watch mode**: No file-watching or auto-re-run on changes — the tool runs once and exits
- **Project-level validation**: Validating `state.json`, `STATUS.md`, or project document naming conventions (e.g., `MYAPP-PRD.md`) is out of scope for the initial release
- **Full YAML library dependency**: The tool should not require a full third-party YAML parsing library; a purpose-built parser or extended regex approach is acceptable
- **JSON output mode**: Structured JSON output for programmatic consumption is deferred to a future iteration

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Developer modifying orchestration files | Run a single CLI command to validate all `.github/` orchestration files | I catch convention violations immediately before they cause agent failures at runtime | P0 |
| 2 | Developer adding a new agent | See validation errors specific to agent frontmatter (missing fields, invalid tools, deprecated tool names) | I can fix the agent definition before using it | P0 |
| 3 | Developer creating a new skill | Verify that the skill directory has the required structure (SKILL.md, templates/) and correct frontmatter | I know the skill will be discovered correctly by agents | P0 |
| 4 | Developer editing orchestration.yml | Get validation of config values (enums, types, constraints) — not just field presence | I catch invalid configuration values that would silently cause incorrect behavior | P0 |
| 5 | Developer debugging a cross-reference error | See which agent references a non-existent skill, or which skill links to a missing template | I can identify and fix broken links between orchestration files | P0 |
| 6 | CI pipeline operator | Integrate the validator as a CI check that fails the build on any validation error | Convention violations are caught automatically on every commit or PR | P1 |
| 7 | Developer running the validator in a non-color terminal or piped output | Use a `--no-color` flag to suppress ANSI escape codes | Output is clean and parseable in CI logs and piped contexts | P1 |
| 8 | Developer reviewing validation results | See results grouped by category (agents, skills, config, cross-refs) with a final summary | I can quickly assess the overall health of the orchestration system and focus on problem areas | P0 |
| 9 | Developer working on Windows, macOS, or Linux | Have the validator work identically on all three platforms | I don't encounter platform-specific validation issues | P1 |
| 10 | Developer adding a new prompt file | Have prompt file frontmatter validated (description, tools array) | I know the prompt is correctly defined before testing it | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | **Agent file validation**: Validate all `.agent.md` files in `.github/agents/` — check that required frontmatter fields (`name`, `description`, `tools`, `agents`) are present and non-empty | P0 | Research found 8 agent files with a well-defined frontmatter schema |
| FR-2 | **Agent tool validation**: Verify that every entry in an agent's `tools` array is a recognized toolset name or valid namespaced tool identifier; flag deprecated tool names with a warning | P0 | Valid toolsets: `read`, `search`, `edit`, `execute`, `web`, `todo`, `agent`, `vscode`. Deprecated names are listed in research findings |
| FR-3 | **Agent-agents consistency**: If an agent's `agents` array is non-empty, verify that `agent` is in its `tools` array; verify that non-Orchestrator agents have `agents: []` | P0 | Enforces the sole-orchestrator-delegates convention |
| FR-4 | **Agent subagent reference validation**: Verify that every name in the Orchestrator's `agents` array matches the `name` field of an actual agent file | P0 | — |
| FR-5 | **Skill directory structure validation**: For each expected skill, verify the directory exists, contains `SKILL.md`, and contains a `templates/` subdirectory (except `run-tests`, which has no templates by design) | P0 | Research found 14 skill items; `create-skill` is a bare file anomaly |
| FR-6 | **Skill frontmatter validation**: Verify each `SKILL.md` has `name` and `description` fields; verify `name` matches the containing folder name; warn if `description` is outside the 50–200 character recommended range | P0 | — |
| FR-7 | **Skill template link validation**: Verify that template links in SKILL.md bodies (e.g., `./templates/PRD.md`) resolve to actual files on disk | P1 | Research identified this as a gap in the existing validator |
| FR-8 | **Instruction file validation**: Validate all `.instructions.md` files — check that frontmatter exists and contains a non-empty `applyTo` glob pattern | P0 | 2 instruction files currently; warn if `applyTo` is missing since that causes global scope loading |
| FR-9 | **Configuration validation — field presence**: Verify that `orchestration.yml` contains all required sections and fields as defined in the config schema | P0 | Research found the existing validator checks presence but not values |
| FR-10 | **Configuration validation — value constraints**: Validate enum fields (`projects.naming`, `errors.on_critical`, `errors.on_minor`, `git.strategy`, `human_gates.execution_mode`) against their allowed values; validate that `limits.*` fields are positive integers; validate `version` equals `"1.0"` | P0 | This is the highest-impact gap in the existing validator |
| FR-11 | **Configuration validation — severity overlap**: Verify that `errors.severity.critical` and `errors.severity.minor` lists contain no overlapping entries | P1 | Documented as a schema rule; not currently checked |
| FR-12 | **Configuration validation — human gates hard gates**: Verify that `human_gates.after_planning` and `human_gates.after_final_review` are `true` | P1 | These are mandatory hard gates per the system design |
| FR-13 | **Cross-reference validation — agents to skills**: Verify that every skill name referenced in an agent's `## Skills` section corresponds to an actual skill directory | P0 | Existing validator already does this; must be preserved |
| FR-14 | **Cross-reference validation — config paths**: Verify that `projects.base_path` in `orchestration.yml` points to a directory that exists or can be created | P1 | — |
| FR-15 | **Prompt file validation**: Validate `.prompt.md` files in `.github/prompts/` — check for `description` field presence; if `tools` array is present, validate entries against the same valid toolset/tool list used for agents | P1 | Research found the existing validator does not check prompt files at all |
| FR-16 | **File structure validation**: Verify that the required `.github/` directory structure exists — `agents/`, `skills/`, `instructions/`, `prompts/`, `orchestration.yml`, `copilot-instructions.md` | P0 | Baseline structural check; existing validator already does this |
| FR-17 | **ANSI color output**: Use ANSI color escape codes for terminal output — green for pass, red for fail, yellow for warning; use bold for section headers | P0 | Replaces emoji-only approach for better terminal compatibility |
| FR-18 | **`--no-color` flag**: Support a `--no-color` CLI flag that suppresses all ANSI escape codes, falling back to plain-text markers | P1 | Critical for CI and piped output |
| FR-19 | **Exit codes**: Exit with code 0 when all checks pass (warnings are acceptable); exit with code 1 when any check fails | P0 | — |
| FR-20 | **Grouped output**: Group validation results by category (e.g., File Structure, Agents, Skills, Configuration, Instructions, Prompts, Cross-References) with a clear section header for each | P0 | — |
| FR-21 | **Summary report**: After all checks, print a summary line showing total counts: checks passed, checks failed, warnings issued | P0 | — |
| FR-22 | **Anomaly detection**: Flag known anomalies (e.g., `create-skill` is a bare file instead of a directory) with an appropriate warning | P2 | Low-priority but discovered in research |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Performance | A full validation run must complete in under 2 seconds on a typical developer workstation for the current orchestration workspace (~30 files) |
| NFR-2 | Dependencies | The tool must have zero external npm dependencies. Only Node.js built-in modules (`fs`, `path`, `process`) may be used |
| NFR-3 | Compatibility | The tool must run correctly on Windows, macOS, and Linux with Node.js 18+ |
| NFR-4 | Compatibility | Path handling must use platform-appropriate separators (via `path.join()` or equivalent) throughout |
| NFR-5 | Maintainability | The codebase must be organized into clearly separated validation categories (e.g., one module or section per check group) to support future extension |
| NFR-6 | Usability | The tool must be runnable from the workspace root with a single command and no prior setup (no `npm install`, no configuration file) |
| NFR-7 | Usability | Error messages must be actionable — each failure should identify the specific file, field, and what was expected vs. what was found |
| NFR-8 | Reliability | The validator must not crash on malformed input (missing files, empty files, corrupt frontmatter); it should report the issue and continue checking remaining files |
| NFR-9 | Portability | ANSI color output must degrade gracefully when output is piped or redirected (auto-detect non-TTY and suppress colors, or respect `--no-color`) |

## Assumptions

- The orchestration workspace follows the directory structure documented in `.github/copilot-instructions.md` and the research findings
- Node.js 18 or later is available on the developer's system
- The validator runs from the workspace root directory where `.github/` is a direct child
- The existing `validate-orchestration.js` may serve as implementation reference but the new tool is a full replacement, not a patch
- The set of valid toolset names and deprecated tool names is stable and can be defined as a static list within the validator
- The YAML subset used in frontmatter blocks is simple enough to parse without a full YAML library

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Custom YAML parsing may fail on edge cases in `orchestration.yml` (nested objects, multi-line strings, anchors) | High — config validation would produce false positives or miss real errors | Define the exact YAML subset that must be supported; add targeted tests for known config patterns; structure the parser to fail gracefully and report unparseable content as a warning |
| 2 | Hardcoded expectations (e.g., valid tool names, required frontmatter fields) become stale as Copilot's agent schema evolves | Medium — validator would produce false positives on valid new fields or miss newly required fields | Centralize all schema expectations in clearly labeled constant declarations so updates are localized; document the update process |
| 3 | ANSI color codes may render incorrectly in certain terminals or CI environments | Low — visual issue only; validation logic is unaffected | Support `--no-color` flag; auto-detect non-TTY output and suppress colors |
| 4 | Cross-platform path differences cause validation failures on Windows vs. Unix | Medium — tool would be unreliable on one platform | Use `path.join()` and `path.sep` consistently; avoid hardcoded `/` separators in file operations |
| 5 | Adding new agents, skills, or prompts requires validator updates to expected inventories | Medium — new files would be silently ignored or flagged as unexpected | Prefer dynamic discovery (scan directories) over hardcoded expected lists where possible |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Validation coverage | 100% of defined orchestration file types (agents, skills, instructions, prompts, config) have at least one check | Audit the check list against the file type inventory from research findings |
| Execution time | < 2 seconds for a full run on the current workspace | Time the CLI execution with `time node validate-orchestration.js` |
| False positive rate | 0 false positives on the current valid workspace | Run the validator against the current `.github/` directory; all checks must pass or produce only legitimate warnings |
| Cross-reference coverage | All documented cross-reference paths (agent→skill, skill→template, config→path) are validated | Compare the validator's cross-reference checks against the cross-agent dependency map |
| Exit code reliability | Exit code 1 is returned if and only if at least one check fails | Test with both clean and deliberately broken configurations |
| CI integration | Validator can run as a CI step with no additional setup beyond Node.js availability | Execute in a fresh CI environment (e.g., GitHub Actions with `node` available) and confirm correct exit code behavior |
| Developer adoption | Developers on the project run the validator after making orchestration changes | Survey or observe usage within the first 2 weeks of availability |
