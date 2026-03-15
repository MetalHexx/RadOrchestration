---
project: "VALIDATOR"
status: "draft"
author: "architect-agent"
created: "2026-03-07T18:00:00Z"
---

# VALIDATOR — Master Plan

## Executive Summary

VALIDATOR is a zero-dependency Node.js CLI tool that comprehensively validates the `.github/` orchestration file ecosystem — agents, skills, instructions, prompts, configuration, and all cross-references between them. It replaces the existing 725-line monolithic `validate-orchestration.js` with a modular 12-file architecture organized into 7 validation categories, using a shared discovery context to enable cross-reference checks without redundant file reads. The tool outputs ANSI-colored, category-grouped terminal results with a final pass/fail summary bar, supports `--no-color`, `--verbose`, `--quiet`, and `--category` flags, and exits with code 0 (pass) or 1 (fail) for CI integration. The implementation uses only Node.js built-in modules (`fs`, `path`, `process`) and targets completion in 3 phases: core infrastructure, validation checks, and polish/hardening.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Idea Draft | [VALIDATOR-IDEA-DRAFT.md](.github/projects/VALIDATOR/VALIDATOR-IDEA-DRAFT.md) | ✅ Complete |
| Research Findings | [VALIDATOR-RESEARCH-FINDINGS.md](.github/projects/VALIDATOR/VALIDATOR-RESEARCH-FINDINGS.md) | ✅ Complete |
| PRD | [VALIDATOR-PRD.md](.github/projects/VALIDATOR/VALIDATOR-PRD.md) | ✅ Complete |
| Design | [VALIDATOR-DESIGN.md](.github/projects/VALIDATOR/VALIDATOR-DESIGN.md) | ✅ Complete |
| Architecture | [VALIDATOR-ARCHITECTURE.md](.github/projects/VALIDATOR/VALIDATOR-ARCHITECTURE.md) | ✅ Complete |

## Key Requirements (from PRD)

Curated P0 functional requirements and critical non-functional requirements that drive phasing and implementation decisions.

### Functional (P0)

- **FR-1**: Agent file validation — verify required frontmatter fields (`name`, `description`, `tools`, `agents`) are present and non-empty in all `.agent.md` files
- **FR-2**: Agent tool validation — verify every `tools` array entry is a recognized toolset or valid namespaced tool; flag deprecated tool names as warnings
- **FR-3**: Agent-agents consistency — if `agents[]` is non-empty, `agent` must be in `tools`; non-Orchestrator agents must have `agents: []`
- **FR-5**: Skill directory structure — verify directory exists, contains `SKILL.md`, and has `templates/` subdirectory (except `run-tests`)
- **FR-9/FR-10**: Configuration validation — verify all required fields present AND validate enum values, type constraints, positive integer limits, and `version` equals `"1.0"`
- **FR-16**: File structure validation — verify `.github/` required directories and files exist
- **FR-17**: ANSI color output — green pass, red fail, yellow warning, bold section headers
- **FR-19**: Exit codes — 0 for all pass (warnings acceptable), 1 for any failure
- **FR-20/FR-21**: Grouped output with per-category headers and a final summary bar

### Non-Functional (Critical)

- **NFR-2**: Zero external npm dependencies — only Node.js built-in modules (`fs`, `path`, `process`)
- **NFR-5**: Modular codebase — clearly separated validation categories for maintainability and extensibility
- **NFR-7**: Actionable error messages — each failure identifies the specific file, field, expected value, and actual value
- **NFR-8**: No crashes on malformed input — report issues and continue checking remaining files

## Key Technical Decisions (from Architecture)

1. **Modular check-runner architecture**: 7 category-specific check modules in `lib/checks/`, each exporting a single async function with the signature `(basePath, context) → CheckResult[]`. Decouples validation logic from reporting and CLI concerns.

2. **Shared `DiscoveryContext` object**: A mutable context passed through the check pipeline in order. Each module populates its section (e.g., `checkAgents` fills `context.agents`); the `cross-refs` module reads from all sections. Eliminates redundant file reads and enables cross-reference validation.

3. **Two-tier YAML parsing**: `frontmatter.js` handles the simple key-value/list subset in markdown frontmatter blocks (regex line-by-line). `yaml-parser.js` handles the richer nested structure of `orchestration.yml` (indentation-aware line-by-line). Neither supports anchors, aliases, or flow style — these aren't used in the orchestration system.

4. **Reporter owns all presentation**: The `lib/reporter.js` module exclusively controls ANSI escape sequences, marker strings, box-drawing characters, and verbosity behavior. No other module writes to stdout or embeds ANSI codes. Token maps resolve to empty strings when `--no-color` is active.

5. **Graceful degradation over exceptions**: Utility functions return `null` on failure rather than throwing. Check modules wrap logic in try/catch and emit `fail`/`warn` CheckResults. The entry point has a top-level catch for truly unexpected errors.

6. **Silent prerequisite loading for `--category` filter**: When `--category cross-references` is selected alone, all prerequisite checks run silently (populating context) but only cross-reference results are reported. Ensures correctness without requiring users to understand dependency order.

7. **CommonJS module format**: All files use `require()` / `module.exports`, consistent with the existing codebase and enabling standalone execution without bundling or transpilation.

## Key Design Constraints (from Design)

1. **Three-region output layout**: Header (tool name + version) → Category blocks (header, check lines, category summary, footer) → Final summary bar. All output follows this rigid structure for predictability and screen-reader compatibility.

2. **Dual marker systems**: Color mode uses Unicode markers (`✓`/`✗`/`⚠`) with ANSI colors. No-color mode uses bracketed ASCII markers (`[PASS]`/`[FAIL]`/`[WARN]`) with ASCII box-drawing fallbacks (`---` instead of `┌─`, `===` instead of `═══`).

3. **Failure details always shown**: `CheckDetail` blocks (Expected/Found) are always displayed for failed checks in all verbosity modes. For pass/warn checks, details are shown only in `--verbose` mode.

4. **Non-TTY auto-detection**: When `process.stdout.isTTY` is falsy (piped or redirected output), ANSI codes are automatically suppressed — equivalent to `--no-color`. Also respects the `NO_COLOR` environment variable per the no-color.org convention.

5. **Category ordering is dependency order**: Structure → Agents → Skills → Configuration → Instructions → Prompts → Cross-References. Early failures explain later failures (e.g., missing file explains why frontmatter parse failed).

6. **`--quiet` overrides `--verbose`**: If both flags are provided, only the final summary bar is printed. `--no-color` is independent of verbosity settings.

## Phase Outline

### Phase 1: Core Infrastructure

**Goal**: Establish the foundation — CLI entry point, all utility modules, the reporter, the discovery context, and one simple check module (structure) to validate the end-to-end pipeline works.

**Scope**:
- CLI entry point with argument parsing (`validate-orchestration.js`) — refs: FR-19, FR-17, Design CLI interface
- `--help` output — ref: Design help mockup
- Reporter module (`lib/reporter.js`) with ANSI color tokens, no-color fallback markers, box-drawing/ASCII separators, header rendering, category block rendering, final summary bar, verbose/quiet/default modes — refs: FR-17, FR-20, FR-21, Design tokens, Design layout
- File system helpers (`lib/utils/fs-helpers.js`) — `exists`, `isDirectory`, `listFiles`, `listDirs`, `readFile` — refs: Architecture utility contracts
- Frontmatter extractor (`lib/utils/frontmatter.js`) — `---` delimited and fenced code block formats — refs: Architecture utility contracts
- YAML parser (`lib/utils/yaml-parser.js`) — scalars, lists, nested objects, quoted strings — refs: Architecture utility contracts
- Discovery context builder — create and wire the `DiscoveryContext` object — ref: Architecture DiscoveryContext interface
- File structure checks (`lib/checks/structure.js`) — verify `.github/`, `agents/`, `skills/`, `instructions/`, `prompts/`, `orchestration.yml`, `copilot-instructions.md` exist — ref: FR-16
- Check orchestration loop in entry point — run checks in category order, collect results, invoke reporter, set exit code

**Exit Criteria**:
- [ ] Running `node validate-orchestration.js` produces a colored report with File Structure category checks
- [ ] `--no-color` flag produces plain-text output with `[PASS]`/`[FAIL]`/`[WARN]` markers and ASCII separators
- [ ] `--verbose` flag shows detail blocks for all check results
- [ ] `--quiet` flag shows only the final summary bar
- [ ] `--help` flag prints usage information and exits with code 0
- [ ] Exit code is 0 when all structure checks pass, 1 when any fail
- [ ] Reporter renders header, category block, and final summary bar correctly in all modes

**Phase Doc**: [phases/VALIDATOR-PHASE-01-CORE-INFRASTRUCTURE.md](.github/projects/VALIDATOR/phases/VALIDATOR-PHASE-01-CORE-INFRASTRUCTURE.md) *(created at execution time)*

---

### Phase 2: Validation Checks

**Goal**: Implement all remaining check modules — the core validation logic that covers every orchestration file type and cross-reference path.

**Scope**:
- Agent validation (`lib/checks/agents.js`) — required frontmatter fields, tools array validation against valid toolsets/namespaced tools, deprecated tool detection, agents array consistency (agent tool requirement, non-Orchestrator agents must have empty agents), Orchestrator subagent reference validation, populate `context.agents` — refs: FR-1, FR-2, FR-3, FR-4
- Skill validation (`lib/checks/skills.js`) — directory existence, SKILL.md presence, frontmatter `name`/`description` fields, name-folder match, `templates/` subdirectory presence (except `run-tests`), description length warning (50–200 chars recommended), template link resolution (verify `./templates/X.md` links resolve), populate `context.skills` — refs: FR-5, FR-6, FR-7
- Configuration validation (`lib/checks/config.js`) — parse `orchestration.yml` with yaml-parser, verify all required sections/fields present, validate `version` equals `"1.0"`, validate enum fields (`projects.naming`, `errors.on_critical`, `errors.on_minor`, `git.strategy`, `human_gates.execution_mode`), validate `limits.*` are positive integers, check severity list overlap (`critical` ∩ `minor` = ∅), enforce human gate hard gates (`after_planning` and `after_final_review` must be `true`), populate `context.config` — refs: FR-9, FR-10, FR-11, FR-12
- Instruction validation (`lib/checks/instructions.js`) — frontmatter presence, `applyTo` field presence and non-empty, populate `context.instructions` — ref: FR-8
- Prompt validation (`lib/checks/prompts.js`) — `description` field presence, `tools` array validation against same valid toolset/tool list, populate `context.prompts` — ref: FR-15
- Cross-reference validation (`lib/checks/cross-refs.js`) — Orchestrator `agents[]` entries match real agent `name` fields, skill references in agent `## Skills` sections resolve to real skill directories, skill template links resolve to files on disk, `projects.base_path` in config points to an existing/creatable directory — refs: FR-4, FR-13, FR-14, FR-7

**Exit Criteria**:
- [ ] A full validation run covers all 7 categories (structure, agents, skills, config, instructions, prompts, cross-references)
- [ ] Every P0 and P1 functional requirement (FR-1 through FR-21) has at least one corresponding check
- [ ] All checks produce correct pass/fail/warn results against the live `.github/` directory
- [ ] Zero false positives on the current valid orchestration workspace
- [ ] Discovery context is fully populated — `context.agents`, `context.skills`, `context.config`, `context.instructions`, `context.prompts` all contain correct data
- [ ] Cross-reference checks correctly identify broken links when deliberately introduced

**Phase Doc**: [phases/VALIDATOR-PHASE-02-VALIDATION-CHECKS.md](.github/projects/VALIDATOR/phases/VALIDATOR-PHASE-02-VALIDATION-CHECKS.md) *(created at execution time)*

---

### Phase 3: Polish & Hardening

**Goal**: Handle edge cases, harden error resilience, implement remaining CLI features, ensure cross-platform correctness, and validate against all PRD requirements.

**Scope**:
- Anomaly detection — flag `create-skill` bare file with a warning — ref: FR-22
- `--category` filter with silent prerequisite loading — run prerequisite checks to populate context but only report filtered category results — ref: Architecture cross-cutting concerns
- Non-TTY auto-detection — suppress ANSI codes when `process.stdout.isTTY` is falsy — ref: NFR-9
- `NO_COLOR` environment variable support — equivalent to `--no-color` flag — ref: Design accessibility
- `--verbose` detail blocks for pass/warn checks — confirm detail context propagates correctly — ref: Design states
- `--quiet` mode — confirm only final summary bar prints — ref: Design quiet mockup
- `--help` output — confirm matches the Design help mockup exactly — ref: Design help output
- Graceful degradation on malformed input — missing files, empty files, corrupt/unparseable frontmatter, YAML parse failures all produce `fail`/`warn` results instead of crashes — ref: NFR-8
- Summary statistics — verify total pass/fail/warn counts are accurate across all modes — ref: FR-21
- Cross-platform path handling — confirm `path.join()` is used exclusively, no hardcoded separators — ref: NFR-3, NFR-4
- Performance validation — confirm full run completes in under 2 seconds — ref: NFR-1
- End-to-end validation against the live `.github/` workspace — confirm zero false positives on a valid workspace

**Exit Criteria**:
- [ ] All PRD requirements (FR-1 through FR-22, NFR-1 through NFR-9) are met
- [ ] Tool handles edge cases gracefully — missing files, empty files, corrupt frontmatter all produce informative failures without crashing
- [ ] `--no-color` and `NO_COLOR` environment variable both suppress ANSI codes correctly
- [ ] Non-TTY output auto-suppresses ANSI codes
- [ ] `--category <name>` filters output to a single category while silently running prerequisites
- [ ] `--verbose` and `--quiet` modes produce correct output
- [ ] `--help` output matches the Design specification
- [ ] Full validation run completes in under 2 seconds on the current workspace
- [ ] Tool runs correctly on Windows (cross-platform path handling confirmed)
- [ ] Exit code 0 on valid workspace, exit code 1 when failures are present

**Phase Doc**: [phases/VALIDATOR-PHASE-03-POLISH-HARDENING.md](.github/projects/VALIDATOR/phases/VALIDATOR-PHASE-03-POLISH-HARDENING.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml — this project uses 3)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Max consecutive review rejections**: 3
- **Git strategy**: `single_branch` with prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: `after_planning: true` (hard gate — master plan must be approved before execution), `execution_mode: ask`, `after_final_review: true` (hard gate)
- **Error handling**: Critical errors (`build_failure`, `security_vulnerability`, `architectural_violation`, `data_loss_risk`) halt the pipeline. Minor errors (`test_failure`, `lint_error`, `review_suggestion`, `missing_test_coverage`, `style_violation`) trigger auto-retry.

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|------------|-------|
| 1 | Custom YAML parsing fails on edge cases in `orchestration.yml` (nested objects, multi-line strings, anchors) | High — config validation produces false positives or misses real errors | Define exact YAML subset to support; structure parser to return `null` on failure with a `fail` CheckResult rather than crashing; test against the live `orchestration.yml` | Coder + Reviewer |
| 2 | Hardcoded expectations (valid tool names, required frontmatter fields) become stale as Copilot's agent schema evolves | Medium — false positives on valid new fields or missed newly-required fields | Centralize all schema expectations in clearly labeled constant declarations at the top of each check module; document the update process in code comments | Architect + Coder |
| 3 | ANSI color codes render incorrectly in certain terminals or CI environments | Low — visual issue only; validation logic unaffected | Support `--no-color` flag, `NO_COLOR` env var, and non-TTY auto-detection; use only standard SGR sequences (no 256-color or truecolor) | Coder |
| 4 | Cross-platform path differences cause validation failures on Windows vs. Unix | Medium — tool unreliable on one platform | Use `path.join()` and `path.sep` exclusively; never hardcode `/` or `\\` in file operations; test on Windows during Phase 3 | Coder + Reviewer |
| 5 | Adding new agents, skills, or prompts requires validator updates to expected inventories | Medium — new files silently ignored or flagged as unexpected | Use dynamic discovery (scan directories) rather than hardcoded expected lists; validate whatever is found rather than checking against a fixed inventory | Architect + Coder |

## Success Criteria

From the PRD success metrics — the project is complete when all of the following are met:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Validation coverage | 100% of defined orchestration file types (agents, skills, instructions, prompts, config) have at least one check | Audit check list against file type inventory from research findings |
| Execution time | < 2 seconds for a full run on the current workspace | `time node validate-orchestration.js` |
| False positive rate | 0 false positives on the current valid workspace | Run validator against the live `.github/` directory; all checks must pass or produce only legitimate warnings |
| Cross-reference coverage | All documented cross-reference paths (agent→skill, skill→template, config→path) are validated | Compare validator's cross-reference checks against the cross-agent dependency map |
| Exit code reliability | Exit code 1 if and only if at least one check fails | Test with both clean and deliberately broken configurations |
| CI integration | Validator runs as a CI step with no setup beyond Node.js availability | Execute in a fresh environment with `node` available; confirm correct exit code behavior |
