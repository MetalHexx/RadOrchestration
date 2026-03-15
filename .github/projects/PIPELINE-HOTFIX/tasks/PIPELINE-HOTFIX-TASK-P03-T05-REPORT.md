---
project: "PIPELINE-HOTFIX"
phase: 3
task: 5
title: "Master Plan Skill Instructions — Document total_phases"
status: "complete"
files_changed: 1
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Master Plan Skill Instructions — Document total_phases

## Summary

Updated `.github/skills/create-master-plan/SKILL.md` to document `total_phases` as a required frontmatter field. Added a Frontmatter Requirements section with a field table and dedicated `total_phases` subsection, updated Workflow step 7 to reference frontmatter consistency, and added a Key Rules entry for `total_phases`.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/skills/create-master-plan/SKILL.md` | +20 | Added Frontmatter Requirements section, updated Workflow step 7, added Key Rules entry |

## Tests

No tests applicable — this is a documentation-only task. Validated acceptance criteria programmatically:

| Test | File | Status |
|------|------|--------|
| YAML frontmatter intact (name, description unchanged) | `.github/skills/create-master-plan/SKILL.md` | ✅ Pass |
| Frontmatter Requirements section documents total_phases | `.github/skills/create-master-plan/SKILL.md` | ✅ Pass |
| Workflow step 7 references total_phases | `.github/skills/create-master-plan/SKILL.md` | ✅ Pass |
| Key Rules section includes total_phases rule | `.github/skills/create-master-plan/SKILL.md` | ✅ Pass |
| Pipeline reads on plan_approved documented | `.github/skills/create-master-plan/SKILL.md` | ✅ Pass |
| Hard error on missing/invalid documented | `.github/skills/create-master-plan/SKILL.md` | ✅ Pass |

**Test summary**: 6/6 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | SKILL.md contains a Frontmatter Requirements section listing `total_phases` as a required field | ✅ Met |
| 2 | `total_phases` is described as a required positive integer that must match the number of phases in the Phase Outline | ✅ Met |
| 3 | Documentation states the pipeline engine reads `total_phases` on `plan_approved` to initialize the execution phases array | ✅ Met |
| 4 | Documentation states that a missing or invalid `total_phases` value produces a hard error | ✅ Met |
| 5 | Workflow section references `total_phases` in the phase outline step | ✅ Met |
| 6 | Key Rules section includes a `total_phases` rule | ✅ Met |
| 7 | No references to prior behavior, migration steps, or "before/after" language | ✅ Met |
| 8 | The file's own YAML frontmatter (`name`, `description`) is unchanged | ✅ Met |
| 9 | No other files are modified | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (documentation-only change, no build required)
- **Lint**: ✅ Pass (valid Markdown with intact YAML frontmatter)
