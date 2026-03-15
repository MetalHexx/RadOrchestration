---
project: "VALIDATOR"
phase: 3
task: 5
title: "End-to-End Validation"
status: "pending"
skills_required: ["test", "code"]
skills_optional: ["run-tests"]
estimated_files: 3
---

# End-to-End Validation

## Objective

Validate the complete `validate-orchestration.js` tool end-to-end: run every CLI mode against the live workspace, verify zero false positives, confirm cross-platform path handling, assert sub-2-second performance, run all tests, and fix any issues discovered.

## Context

The validator tool is complete — Phases 1–2 built all 7 check modules and core infrastructure; Phase 3 T1–T4 resolved review issues, added anomaly detection, hardened edge cases, and completed CLI features. This final task performs a full integration validation to confirm everything works together. The entry point is `validate-orchestration.js` at the workspace root. There are 11 test suites under `tests/`. The tool accepts `--no-color`, `--verbose`, `--quiet`, `--help`, and `--category <name>` flags.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `validate-orchestration.js` | Only if path separator issues or bugs found |
| MODIFY | `lib/checks/*.js` | Only if hardcoded path separators or false positives found |
| MODIFY | `lib/utils/*.js` | Only if path separator issues found |
| MODIFY | `tests/*.test.js` | Only if test gaps discovered |

## Implementation Steps

1. **Run `node validate-orchestration.js`** on the live workspace. Verify exit code is `0` and there are zero failures (0 failed) in the summary bar. Warnings are acceptable. If any false-positive failures appear, diagnose and fix the check module producing them.

2. **Run `node validate-orchestration.js --no-color`**. Capture stdout and verify no ANSI escape sequences (`\x1b[`, `\033[`) appear anywhere in the output. If ANSI codes leak through, fix the reporter or entry point color-stripping logic.

3. **Run `node validate-orchestration.js --verbose`**. Verify that detail blocks (`Expected:` / `Found:` lines) appear for pass, warn, and fail results — not just failures. Confirm each check category section is present.

4. **Run `node validate-orchestration.js --quiet`**. Verify output contains only the final summary bar (a single line starting with `PASS` or `FAIL` followed by counts). No category headers, no individual check lines, no banner.

5. **Run `node validate-orchestration.js --help`**. Verify help output includes: usage line, description, flags list (--help, --no-color, --verbose, --quiet, --category), examples. Confirm it exits with code 0.

6. **Run `node validate-orchestration.js --category agents`**. Verify that only the "Agents" category results appear in the output. No results from structure, skills, config, instructions, prompts, or cross-references should be printed.

7. **Run `node validate-orchestration.js --category cross-references`**. Verify cross-reference results appear. Since cross-refs depend on context populated by earlier checks, this confirms prerequisite modules ran silently. Verify no prerequisite category results leak into the output.

8. **Verify cross-platform path handling** across all check modules:
   - Grep all files in `lib/checks/` and `lib/utils/` for hardcoded path separators.
   - Pattern to search: forward slash used in `path` operations (e.g., string concatenation with `'/'` for file paths instead of `path.join()`). Specifically look for patterns like `` `${dir}/${file}` `` or `+ '/' +` or `+ '\\' +` used to construct file paths.
   - `path.join()` or `path.resolve()` must be used for all file path construction.
   - Template strings building paths for *display/reporting purposes only* (e.g., in CheckResult messages) are acceptable — only file-system operations must use `path.join()`.
   - If any hardcoded separators are used for filesystem operations, replace them with `path.join()` / `path.resolve()`.

9. **Measure performance**: Run `node validate-orchestration.js` and time it. The full validation run must complete in under 2 seconds. If it exceeds 2 seconds, profile and optimize (e.g., reduce redundant file reads, parallelize independent checks). Note: slight overages (2.0–2.5s) should be documented but are not blockers.

10. **Run all tests**: Execute `node --test tests/*.test.js`. All tests across all 11 suites must pass. If any test fails, diagnose and fix the failing test or the underlying module.

11. **Fix any issues found** in steps 1–10. After fixes, re-run the affected validation step to confirm the fix resolves the issue. Then re-run the full test suite to confirm no regressions.

## Contracts & Interfaces

### CheckResult object (produced by all check modules)

```javascript
/**
 * @typedef {Object} CheckResult
 * @property {'pass'|'fail'|'warn'} status
 * @property {string} category - one of: 'structure', 'agents', 'skills', 'config', 'instructions', 'prompts', 'cross-references'
 * @property {string} check - short check name (e.g., "agent-has-description")
 * @property {string} message - human-readable description
 * @property {string} [expected] - expected value (shown in --verbose)
 * @property {string} [found] - actual value found (shown in --verbose)
 */
```

### CLI parseArgs return

```javascript
/**
 * @returns {{ help: boolean, noColor: boolean, verbose: boolean, quiet: boolean, category: string|null }}
 */
```

### Valid categories

```javascript
const CATEGORIES = ['structure', 'agents', 'skills', 'config', 'instructions', 'prompts', 'cross-references'];
```

### report() function signature

```javascript
/**
 * @param {CheckResult[]} results
 * @param {{ noColor?: boolean, verbose?: boolean, quiet?: boolean }} options
 */
function report(results, options) { ... }
```

## Styles & Design Tokens

Not applicable — this is a validation/testing task, not a UI task.

## Test Requirements

- [ ] `node validate-orchestration.js` exits with code 0 and 0 failures on the live workspace
- [ ] `node validate-orchestration.js --no-color` output contains zero ANSI escape sequences
- [ ] `node validate-orchestration.js --verbose` output includes detail blocks for non-fail results
- [ ] `node validate-orchestration.js --quiet` output is a single summary line only
- [ ] `node validate-orchestration.js --help` prints help and exits with code 0
- [ ] `node validate-orchestration.js --category agents` shows only agents results
- [ ] `node validate-orchestration.js --category cross-references` shows only cross-ref results (prerequisites ran silently)
- [ ] No hardcoded `/` or `\\` path separators in filesystem operations within `lib/checks/` and `lib/utils/`
- [ ] Full validation run completes in < 2 seconds
- [ ] `node --test tests/*.test.js` — all 11 test suites pass, 0 failures

## Acceptance Criteria

- [ ] Full `node validate-orchestration.js` run produces 0 failures and exit code 0 on the live workspace
- [ ] `--no-color` output contains no ANSI escape codes (`\x1b[` / `\033[`)
- [ ] `--verbose` output includes `Expected:` / `Found:` detail blocks for pass and warn results
- [ ] `--quiet` output contains only the summary bar — no category headers, no individual checks
- [ ] `--help` prints usage information and exits with code 0
- [ ] `--category agents` output contains only agents category results
- [ ] `--category cross-references` output contains only cross-references results
- [ ] All file path construction in `lib/checks/` and `lib/utils/` uses `path.join()` or `path.resolve()` — no hardcoded separators for filesystem operations
- [ ] Full validation completes in under 2 seconds (soft target — document if exceeded)
- [ ] All test suites pass (`node --test tests/*.test.js` — 0 failures)
- [ ] Any issues found during validation are fixed and re-verified
- [ ] No regressions — all previously passing tests continue to pass

## Constraints

- Do NOT add new check logic or new validation rules — this task validates existing functionality only
- Do NOT modify the reporter output format — only fix bugs if output is incorrect
- Do NOT refactor module structure — only fix path separator issues if found
- Do NOT change the CLI argument interface — only fix bugs if behavior is incorrect
- Fixes must be minimal and targeted — address only the specific issue found, do not refactor surrounding code
- If performance exceeds 2 seconds but is under 2.5 seconds, document it in the task report as a note rather than blocking on it
