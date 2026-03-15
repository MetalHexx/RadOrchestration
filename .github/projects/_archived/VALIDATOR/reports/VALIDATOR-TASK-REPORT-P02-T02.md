---
project: "VALIDATOR"
phase: 2
task: 2
title: "Skill Checks"
status: "complete"
files_changed: 2
tests_written: 18
tests_passing: 18
build_status: "pass"
---

# Task Report: Skill Checks

## Summary

Created `lib/checks/skills.js` — the skill validation check module that scans `.github/skills/` for skill directories, validates SKILL.md presence/frontmatter, checks name-folder consistency, description length, templates/ subdirectory (with run-tests exemption), and template link resolution. Created `tests/skills.test.js` with 18 tests covering all validation paths. All tests pass, module loads cleanly, no lint errors.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `lib/checks/skills.js` | 200 | Skill validation check module |
| CREATED | `tests/skills.test.js` | 293 | Test suite with 18 tests using node:test |

## Tests

| Test | File | Status |
|------|------|--------|
| exports an async function | `tests/skills.test.js` | ✅ Pass |
| no skills directory — returns empty results, context.skills is empty Map | `tests/skills.test.js` | ✅ Pass |
| valid skill — 1 pass result, context.skills populated with correct SkillInfo | `tests/skills.test.js` | ✅ Pass |
| missing SKILL.md — 1 fail result | `tests/skills.test.js` | ✅ Pass |
| null frontmatter (no frontmatter block) — 1 fail result | `tests/skills.test.js` | ✅ Pass |
| missing name field — 1 fail result | `tests/skills.test.js` | ✅ Pass |
| missing description field — 1 fail result | `tests/skills.test.js` | ✅ Pass |
| name-folder mismatch — 1 fail result with detail showing expected vs found | `tests/skills.test.js` | ✅ Pass |
| description too short (< 50 chars) — 1 warn result | `tests/skills.test.js` | ✅ Pass |
| description too long (> 200 chars) — 1 warn result | `tests/skills.test.js` | ✅ Pass |
| description in range (50-200 chars) — no warn | `tests/skills.test.js` | ✅ Pass |
| missing templates/ for non-exempt skill — 1 fail result | `tests/skills.test.js` | ✅ Pass |
| missing templates/ for run-tests (exempt) — no fail result | `tests/skills.test.js` | ✅ Pass |
| template link resolves to existing file — no fail | `tests/skills.test.js` | ✅ Pass |
| template link resolves to non-existing file — 1 fail result | `tests/skills.test.js` | ✅ Pass |
| multiple skills — results for each, context.skills has all entries | `tests/skills.test.js` | ✅ Pass |
| all results have category "skills" | `tests/skills.test.js` | ✅ Pass |
| function never throws — wraps errors in try/catch, returns fail result | `tests/skills.test.js` | ✅ Pass |

**Test summary**: 18/18 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `lib/checks/skills.js` exists and exports an async function matching CheckFunction signature | ✅ Met |
| 2 | All skill directories in `.github/skills/` are discovered via `listDirs` | ✅ Met |
| 3 | Missing `SKILL.md` produces `fail` result | ✅ Met |
| 4 | Missing/empty `name` or `description` frontmatter fields produce `fail` results | ✅ Met |
| 5 | Name-folder mismatch produces `fail` with `expected`/`found` in detail | ✅ Met |
| 6 | Description length outside 50–200 char range produces `warn` | ✅ Met |
| 7 | Missing `templates/` subdirectory produces `fail` (except for skills in TEMPLATES_EXEMPT) | ✅ Met |
| 8 | `run-tests` skill is correctly exempted from templates check | ✅ Met |
| 9 | Broken template links produce `fail` | ✅ Met |
| 10 | `context.skills` is populated as `Map<string, SkillInfo>` with correct entries | ✅ Met |
| 11 | Malformed/unparseable SKILL.md files produce `fail` results (no crash) | ✅ Met |
| 12 | All tests pass (`node --test tests/skills.test.js`) | ✅ Met |
| 13 | No lint errors | ✅ Met |
| 14 | Module requires cleanly (`node -e "require('./lib/checks/skills')"`) | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: N/A (plain JavaScript, no TypeScript)
