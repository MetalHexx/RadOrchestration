---
project: "VALIDATOR"
phase: 2
task: 4
title: "Instruction & Prompt Checks"
status: "complete"
files_changed: 4
tests_written: 28
tests_passing: 28
build_status: "pass"
---

# Task Report: Instruction & Prompt Checks

## Summary

Created `lib/checks/instructions.js` and `lib/checks/prompts.js` — two validation check modules that discover and validate `.instructions.md` and `.prompt.md` files respectively. Created matching test suites with 28 total tests, all passing. All existing tests (70 from Phase 1 + Phase 2 T1–T3) continue to pass (98 total).

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `lib/checks/instructions.js` | 104 | Instruction file validation check module |
| CREATED | `lib/checks/prompts.js` | 161 | Prompt file validation check module with tool validation |
| CREATED | `tests/instructions.test.js` | 195 | 11 test cases using node:test with mocked dependencies |
| CREATED | `tests/prompts.test.js` | 268 | 17 test cases using node:test with mocked dependencies |

## Tests

| Test | File | Status |
|------|------|--------|
| exports an async function | `tests/instructions.test.js` | ✅ Pass |
| empty directory — returns empty array | `tests/instructions.test.js` | ✅ Pass |
| valid instruction file with applyTo — pass result | `tests/instructions.test.js` | ✅ Pass |
| missing applyTo field — fail result | `tests/instructions.test.js` | ✅ Pass |
| empty applyTo field — fail result | `tests/instructions.test.js` | ✅ Pass |
| whitespace-only applyTo field — fail result | `tests/instructions.test.js` | ✅ Pass |
| no frontmatter (returns null) — fail result | `tests/instructions.test.js` | ✅ Pass |
| unreadable file (readFile returns null) — fail result | `tests/instructions.test.js` | ✅ Pass |
| multiple instruction files — all validated | `tests/instructions.test.js` | ✅ Pass |
| unexpected thrown error — returns fail (no crash) | `tests/instructions.test.js` | ✅ Pass |
| all results have category "instructions" | `tests/instructions.test.js` | ✅ Pass |
| exports an async function | `tests/prompts.test.js` | ✅ Pass |
| empty directory — returns empty array | `tests/prompts.test.js` | ✅ Pass |
| valid prompt with description and tools — pass | `tests/prompts.test.js` | ✅ Pass |
| missing description field — fail result | `tests/prompts.test.js` | ✅ Pass |
| empty description field — fail result | `tests/prompts.test.js` | ✅ Pass |
| valid prompt without tools — pass (optional) | `tests/prompts.test.js` | ✅ Pass |
| invalid tool name — fail with detail | `tests/prompts.test.js` | ✅ Pass |
| multiple invalid tools — multiple fails | `tests/prompts.test.js` | ✅ Pass |
| valid toolset names — pass | `tests/prompts.test.js` | ✅ Pass |
| valid namespaced tools — pass | `tests/prompts.test.js` | ✅ Pass |
| no frontmatter — fail result | `tests/prompts.test.js` | ✅ Pass |
| unreadable file — fail result | `tests/prompts.test.js` | ✅ Pass |
| multiple prompt files — all validated | `tests/prompts.test.js` | ✅ Pass |
| unexpected thrown error — returns fail (no crash) | `tests/prompts.test.js` | ✅ Pass |
| tools field is a string — treated as array | `tests/prompts.test.js` | ✅ Pass |
| tools field is not an array or string — fail | `tests/prompts.test.js` | ✅ Pass |
| all results have category "prompts" | `tests/prompts.test.js` | ✅ Pass |

**Test summary**: 28/28 passing (98/98 total across all suites)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `lib/checks/instructions.js` exists and exports async `checkInstructions(basePath, context)` | ✅ Met |
| 2 | `lib/checks/prompts.js` exists and exports async `checkPrompts(basePath, context)` | ✅ Met |
| 3 | Instructions module discovers all `.instructions.md` files in `.github/instructions/` | ✅ Met |
| 4 | Instructions module validates `applyTo` field presence and non-emptiness (FR-8) | ✅ Met |
| 5 | Instructions module populates `context.instructions` with `InstructionInfo` objects | ✅ Met |
| 6 | Prompts module discovers all `.prompt.md` files in `.github/prompts/` | ✅ Met |
| 7 | Prompts module validates `description` field presence (FR-15) | ✅ Met |
| 8 | Prompts module validates `tools` array entries against `VALID_TOOLSETS` and `VALID_NAMESPACED_TOOLS` (FR-15) | ✅ Met |
| 9 | Prompts module populates `context.prompts` with `PromptInfo` objects | ✅ Met |
| 10 | Both modules return `CheckResult[]` with correct `category` values | ✅ Met |
| 11 | Both modules handle empty directories gracefully (return `[]`, no error) | ✅ Met |
| 12 | Both modules handle unreadable/malformed files gracefully (emit `fail`, no crash) | ✅ Met |
| 13 | `tests/instructions.test.js` passes with all test cases | ✅ Met |
| 14 | `tests/prompts.test.js` passes with all test cases | ✅ Met |
| 15 | All existing tests (Phase 1 + Phase 2 T1–T3) still pass | ✅ Met |
| 16 | No lint errors | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass — `node validate-orchestration.js` runs successfully
- **Lint**: ✅ Pass — no errors in any of the 4 new files
- **Type check**: N/A — plain JavaScript project

## Implementation Notes

The `frontmatter.js` module's fenced block regex currently matches `chatagent`, `instructions`, and `skill` but not `prompt`. This means real `.prompt.md` files using ` ```prompt ` fenced format won't have frontmatter extracted by the existing module. The check modules correctly handle this case (null frontmatter → fail result). This is a pre-existing limitation of the frontmatter module, not introduced by this task. A future task may need to add `prompt` to the fenced regex pattern.

## Recommendations for Next Task

- The `frontmatter.js` fenced block regex should be updated to include `prompt` as a valid fence type to support real `.prompt.md` files in the workspace.
