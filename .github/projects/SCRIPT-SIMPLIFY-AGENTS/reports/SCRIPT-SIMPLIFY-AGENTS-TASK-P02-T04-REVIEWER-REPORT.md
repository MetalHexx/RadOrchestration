---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 4
title: "Reviewer Agent + review-task Skill Rename"
status: "complete"
files_changed: 4
tests_written: 0
tests_passing: 321
build_status: "pass"
---

# Task Report: Reviewer Agent + review-task Skill Rename

## Summary

Updated the Reviewer agent definition to reference `review-task` instead of `review-code` and removed outdated sole-writer/`STATUS.md` language. Renamed `.github/skills/review-code/` to `.github/skills/review-task/` with updated frontmatter metadata. The `templates/CODE-REVIEW.md` template content was preserved unchanged.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/agents/reviewer.agent.md` | 3 lines changed | Replaced `review-code` → `review-task` in Mode 1 step 9 and Skills section; replaced sole-writer/STATUS.md language with pipeline script language |
| CREATED | `.github/skills/review-task/SKILL.md` | 59 | Copied from `review-code/SKILL.md` with updated name, description, heading, and opening paragraph |
| CREATED | `.github/skills/review-task/templates/CODE-REVIEW.md` | 46 | Copied unchanged from `review-code/templates/CODE-REVIEW.md` |
| DELETED | `.github/skills/review-code/` | — | Entire directory removed (SKILL.md and templates/CODE-REVIEW.md) |

## Tests

| Test | File | Status |
|------|------|--------|
| constants tests (29) | `.github/orchestration/scripts/tests/constants.test.js` | ✅ Pass |
| resolver tests | `.github/orchestration/scripts/tests/resolver.test.js` | ✅ Pass |
| state-validator tests | `.github/orchestration/scripts/tests/state-validator.test.js` | ✅ Pass |
| triage-engine tests | `.github/orchestration/scripts/tests/triage-engine.test.js` | ✅ Pass |
| mutations tests | `.github/orchestration/scripts/tests/mutations.test.js` | ✅ Pass |
| pipeline-engine tests | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | ✅ Pass |
| pipeline tests | `.github/orchestration/scripts/tests/pipeline.test.js` | ✅ Pass |
| state-io tests | `.github/orchestration/scripts/tests/state-io.test.js` | ✅ Pass |

**Test summary**: 321/321 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `.github/skills/review-task/` directory exists with `SKILL.md` and `templates/CODE-REVIEW.md` | ✅ Met |
| 2 | `.github/skills/review-code/` directory does not exist (fully deleted) | ✅ Met |
| 3 | `review-task/SKILL.md` frontmatter has `name: review-task` and updated description | ✅ Met |
| 4 | `review-task/SKILL.md` heading is `# Review Task` | ✅ Met |
| 5 | `review-task/templates/CODE-REVIEW.md` content is identical to the original template | ✅ Met |
| 6 | `reviewer.agent.md` references `review-task` (not `review-code`) in Mode 1 step 9 and Skills section | ✅ Met |
| 7 | `reviewer.agent.md` has zero occurrences of `review-code` | ✅ Met |
| 8 | `reviewer.agent.md` has zero occurrences of `STATUS.md` | ✅ Met |
| 9 | `reviewer.agent.md` has zero occurrences of "only the Tactical Planner" sole-writer language | ✅ Met |
| 10 | `reviewer.agent.md` "What you do NOT do" section says state mutations flow through the pipeline script | ✅ Met |
| 11 | Reviewer agent frontmatter is unchanged (same tools, description, agents) | ✅ Met |
| 12 | All existing test suites pass (0 regressions) | ✅ Met |
| 13 | Build check passes (no syntax errors, all files parse correctly) | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass — no syntax errors in modified files
- **Type check**: N/A — Markdown/agent definition files only
