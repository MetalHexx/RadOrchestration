---
project: "VALIDATOR"
phase: 3
title: "Polish & Hardening"
status: "active"
total_tasks: 5
author: "tactical-planner-agent"
created: "2026-03-08T18:00:00Z"
---

# Phase 3: Polish & Hardening

## Phase Goal

Resolve all review issues from Phases 1 and 2, harden edge-case resilience, complete remaining CLI features (NO_COLOR, non-TTY, --verbose/--quiet modes, --help), and validate the tool end-to-end on the live workspace with zero false positives and sub-2-second performance.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../VALIDATOR-MASTER-PLAN.md) | Phase 3 scope and exit criteria |
| [Architecture](../VALIDATOR-ARCHITECTURE.md) | Module map, DiscoveryContext contract, utility contracts, cross-cutting concerns (--category silent prerequisite loading) |
| [Design](../VALIDATOR-DESIGN.md) | --help mockup, NO_COLOR/non-TTY behavior, --verbose detail blocks, --quiet mode, category display names |
| [Phase 2 Report](../reports/VALIDATOR-PHASE-02-REPORT.md) | Carry-forward: `prompt` fence type in frontmatter.js, skill description length warnings |
| [Phase 2 Review](../reports/VALIDATOR-PHASE-02-REVIEW.md) | Cross-task issues: shared tool constants extraction, duplicate template link check removal, category display names in reporter |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Review Fixes | — | `code` | 5 | [Link](../tasks/VALIDATOR-TASK-P03-T01-REVIEW-FIXES.md) |
| T2 | Anomaly Detection & Category Filter | T1 | `code` | 3 | [Link](../tasks/VALIDATOR-TASK-P03-T02-ANOMALY-CATEGORY.md) |
| T3 | Edge Case Hardening | T1 | `code` | 6 | [Link](../tasks/VALIDATOR-TASK-P03-T03-EDGE-CASES.md) |
| T4 | CLI Feature Completion | T1 | `code` | 3 | [Link](../tasks/VALIDATOR-TASK-P03-T04-CLI-FEATURES.md) |
| T5 | End-to-End Validation | T2, T3, T4 | `test`, `code` | 2 | [Link](../tasks/VALIDATOR-TASK-P03-T05-E2E-VALIDATION.md) |

## Execution Order

```
T1 (Review Fixes — foundation for all other tasks)
 ├→ T2 (Anomaly Detection & Category Filter — depends on T1 constants)
 ├→ T3 (Edge Case Hardening — depends on T1 frontmatter fix)  ← parallel-ready with T2, T4
 └→ T4 (CLI Feature Completion — depends on T1 reporter fixes) ← parallel-ready with T2, T3
T5 (End-to-End Validation — depends on T2, T3, T4)
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5

*Note: T2, T3, and T4 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Task Details

### T1 — Review Fixes

**Objective**: Resolve all Phase 1+2 review issues and carry-forward items before proceeding with new features.

**Scope**:
- Extract `VALID_TOOLSETS`, `VALID_NAMESPACED_TOOLS`, and `DEPRECATED_TOOLS` from `agents.js` and `prompts.js` into a shared `lib/utils/constants.js` module. Update both check modules to import from the shared module. (Phase 2 Review cross-task issue #1)
- Remove duplicate template link validation from `cross-refs.js` — keep the inline check in `skills.js` and remove `checkSkillTemplateLinks()` from `cross-refs.js`. Update tests accordingly. (Phase 2 Review cross-task issue #3)
- Add `prompt` as a valid fence type in the fenced block regex in `lib/utils/frontmatter.js`. Add test coverage for prompt-fenced frontmatter. (Phase 2 Report carry-forward item)
- Verify category display names in `reporter.js` or the entry point match the Design specification exactly (e.g., "File Structure", "Agents", "Skills", "Configuration", "Instructions", "Prompts", "Cross-References"). (Phase 2 Review recommendation)

**Files**: `lib/utils/constants.js` (CREATE), `lib/checks/agents.js` (MODIFY), `lib/checks/prompts.js` (MODIFY), `lib/checks/cross-refs.js` (MODIFY), `lib/utils/frontmatter.js` (MODIFY), `tests/constants.test.js` (CREATE — optional), `tests/cross-refs.test.js` (MODIFY), `tests/frontmatter.test.js` (MODIFY)

### T2 — Anomaly Detection & Category Filter

**Objective**: Implement the `create-skill` bare file warning (FR-22) and verify the `--category` filter with silent prerequisite loading works correctly.

**Scope**:
- In `skills.js`, detect and warn if a skill directory contains a bare `SKILL.md`-like file at the `.github/skills/` root level (outside a skill subdirectory) — specifically `create-skill` anomaly. (FR-22)
- Verify that `--category cross-references` runs all prerequisite checks silently (structure, agents, skills, config, instructions, prompts) but only reports cross-reference results. Confirm prerequisite check results are suppressed from output. (Architecture cross-cutting concern)
- Add test coverage for both the anomaly detection and the category filter prerequisite behavior.

**Files**: `lib/checks/skills.js` (MODIFY), `tests/skills.test.js` (MODIFY), `validate-orchestration.js` (MODIFY — if category filter needs adjustment)

### T3 — Edge Case Hardening

**Objective**: Ensure graceful degradation on malformed, missing, and empty files across all modules with robust error messages (NFR-8).

**Scope**:
- Verify all utility functions (`readFile`, `extractFrontmatter`, `parseYaml`) return `null` on failure (not throw).
- Verify all check modules wrap logic in try/catch and emit `fail`/`warn` CheckResults for malformed inputs.
- Test with: empty `.agent.md` files, missing `orchestration.yml`, corrupt/unparseable YAML, empty SKILL.md, zero-byte instruction files, directories where files are expected, files where directories are expected.
- Ensure every failure message identifies: specific file path, field name, expected value, actual value (NFR-7).
- Add edge-case tests across check modules for malformed/missing/empty scenarios.

**Files**: `lib/utils/fs-helpers.js` (MODIFY — if gaps found), `lib/utils/frontmatter.js` (MODIFY — if gaps found), `lib/utils/yaml-parser.js` (MODIFY — if gaps found), `lib/checks/agents.js` (MODIFY — if gaps found), `lib/checks/skills.js` (MODIFY — if gaps found), `lib/checks/config.js` (MODIFY — if gaps found), `tests/` (MODIFY — multiple test files for edge cases)

### T4 — CLI Feature Completion

**Objective**: Verify and complete all CLI interface features: `--help` output matching Design, `NO_COLOR` env var, non-TTY auto-detection, `--verbose` detail blocks, `--quiet` mode.

**Scope**:
- Verify `--help` output matches the Design help mockup exactly. Fix any deviations. (Design help output)
- Implement/verify `NO_COLOR` environment variable support: when `NO_COLOR` is set (to any non-empty value), ANSI codes are suppressed — equivalent to `--no-color`. (Design accessibility, no-color.org convention)
- Implement/verify non-TTY auto-detection: when `process.stdout.isTTY` is falsy, ANSI codes are automatically suppressed. (NFR-9)
- Verify `--verbose` shows detail blocks for pass/warn checks (not just fail). (Design states)
- Verify `--quiet` overrides `--verbose` and prints only the final summary bar. (Design quiet mockup)
- Add/update tests for all CLI modes.

**Files**: `validate-orchestration.js` (MODIFY), `lib/reporter.js` (MODIFY — if NO_COLOR/non-TTY not yet handled), `tests/reporter.test.js` (MODIFY)

### T5 — End-to-End Validation

**Objective**: Run a full validation against the live workspace, verify cross-platform path handling, confirm sub-2-second performance, and assert zero false positives.

**Scope**:
- Execute full `node validate-orchestration.js` against the live `.github/` workspace. Confirm exit code 0 and zero false positives.
- Verify all path operations use `path.join()` — no hardcoded `/` or `\\` separators in file operations (NFR-3, NFR-4).
- Measure execution time; confirm < 2 seconds (NFR-1).
- Verify total pass/fail/warn counts in the summary bar are accurate (FR-21).
- Verify exit code is 1 when failures are present (introduce a deliberate break, confirm exit code 1, revert).
- Document final check count, test count, and any remaining warnings.

**Files**: `validate-orchestration.js` (MODIFY — if path issues found), test/validation scripts (CREATE — optional E2E test)

## Phase Exit Criteria

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
- [ ] Phase 1+2 review issues resolved (shared constants, duplicate template check, frontmatter prompt fence)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] All tests pass (Phase 1 + Phase 2 + Phase 3 test suites)

## Known Risks for This Phase

- **Edge-case testing scope creep**: Edge-case hardening (T3) could expand indefinitely. Scope is bounded to the specific scenarios listed (empty files, missing files, corrupt YAML, zero-byte files). Do not add new check logic — only verify existing checks degrade gracefully.
- **Non-TTY detection in test environments**: `process.stdout.isTTY` may behave differently across test runners. Mock the property in tests rather than relying on actual TTY state.
- **Performance measurement variance**: Execution time varies by machine load. Use < 2 seconds as a soft target; if slightly exceeded, note in the report but do not fail.
