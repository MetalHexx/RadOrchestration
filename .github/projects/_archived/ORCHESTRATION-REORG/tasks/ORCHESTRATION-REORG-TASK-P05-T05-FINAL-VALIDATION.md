---
project: "ORCHESTRATION-REORG"
phase: 5
task: 5
title: "Final Validation Gate"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 0
---

# Final Validation Gate

## Objective

Run a comprehensive validation suite confirming the repository matches the post-reorg target structure, all tests pass, all orchestration checks pass, deleted directories are gone, archive/assets are present, frozen artifacts are intact, and zero stale path references remain. This is the FINAL gate for the entire ORCHESTRATION-REORG project — no files are created or modified.

## Context

The repository reorganization is complete: scripts migrated to `.github/orchestration/scripts/`, tests to `.github/orchestration/scripts/tests/`, schema to `.github/orchestration/schemas/`, all cross-references updated, docs updated, archive created, assets created, and the four original directories (`src/`, `tests/`, `plan/`, `bin/`) deleted. This task validates everything works end-to-end with zero regressions.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| — | — | No files created or modified — this is a read-only validation gate |

## Implementation Steps

### Step 1: Run Full Test Suite

Run the complete test suite and verify all tests pass:

```powershell
node --test .github/orchestration/scripts/tests/*.test.js
```

**Expected**: 307 or more tests pass, 0 failures, 0 cancelled.

Parse the output — look for the summary line: `# tests {N}`, `# pass {N}`, `# fail 0`. Confirm `pass >= 307` and `fail == 0`.

### Step 2: Run validate-orchestration

Run the orchestration ecosystem validator:

```powershell
node .github/orchestration/scripts/validate-orchestration.js
```

**Expected**: 71 or more checks pass, 0 errors.

Parse the output — look for the summary line showing total checks and errors. Confirm `errors == 0`.

### Step 3: Directory Existence Checks — Must Exist

Verify each of the following paths EXISTS:

```powershell
# Each must return True
Test-Path "archive/"
Test-Path "archive/schemas/"
Test-Path "assets/"
Test-Path "assets/dashboard-screenshot.png"
Test-Path ".github/orchestration/scripts/"
Test-Path ".github/orchestration/scripts/tests/"
Test-Path "docs/"
```

Additionally verify archive/schemas/ has exactly 14 files:

```powershell
(Get-ChildItem "archive/schemas/" -File).Count
# Expected: 14
```

### Step 4: Directory Existence Checks — Must NOT Exist

Verify each of the following paths does NOT exist:

```powershell
# Each must return False
Test-Path "src/"
Test-Path "tests/"
Test-Path "plan/"
Test-Path "bin/"
```

### Step 5: Root Directory Structure Verification

List the immediate children of the workspace root and verify it contains exactly these expected entries (plus optional `.gitignore`, `.git/`):

```powershell
Get-ChildItem -Force | Select-Object Name
```

**Required root entries**: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md`

**Allowed optional entries**: `.git/`, `.gitignore`

**Disallowed entries**: `src/`, `tests/`, `plan/`, `bin/` (or any other unexpected directory)

### Step 6: Frozen Artifact Integrity Check

Verify that no files under `.github/projects/` (excluding THIS project's own `state.json` and `STATUS.md`) were modified during Phase 5. Run:

```powershell
# List all files under .github/projects/ excluding ORCHESTRATION-REORG state/status
Get-ChildItem ".github/projects/" -Recurse -File | Where-Object {
  $_.FullName -notmatch "ORCHESTRATION-REORG[\\/](state\.json|ORCHESTRATION-REORG-STATUS\.md)$"
} | ForEach-Object {
  # Check git status for modifications
  git diff --name-only -- $_.FullName
}
```

If git is not available, verify by listing the `.github/projects/` directory tree and spot-checking that no project files outside the ORCHESTRATION-REORG folder were created or modified in this session.

**Expected**: Zero modifications to frozen project artifacts.

### Step 7: Stale Path Reference Grep

Search for stale references to the deleted `src/` and `tests/` directories in active files (agents, instructions, skills, docs, README). These patterns must return ZERO matches:

**Pattern A** — stale `src/` script references:

```powershell
Select-String -Path ".github/agents/*.md",".github/instructions/*.md",".github/skills/*/SKILL.md","docs/*.md","README.md" -Pattern "\bsrc/(next-action|triage|validate-state|lib/)" -CaseSensitive | Select-Object -First 20
```

**Pattern B** — stale `tests/` test file references:

```powershell
Select-String -Path ".github/agents/*.md",".github/instructions/*.md",".github/skills/*/SKILL.md","docs/*.md","README.md" -Pattern "\btests/.*\.test\.js" -CaseSensitive | Select-Object -First 20
```

**Expected**: Both searches return 0 matches.

Note: Files inside `.github/projects/` (frozen artifacts) and `archive/` (historical) are EXCLUDED from this check — stale paths in those files are expected since they are historical records.

### Step 8: Compile Results & Create Task Report

Compile all results into a task report covering:
- Test suite results (pass count, fail count)
- validate-orchestration results (check count, error count)
- Directory existence check results (7 exist, 4 not exist)
- Root directory structure verification result
- Frozen artifact integrity result
- Stale path grep results (match counts for both patterns)
- Overall verdict (PASS / FAIL)

## Contracts & Interfaces

No contracts apply — this is a validation-only task with zero code changes.

## Styles & Design Tokens

Not applicable — no UI work.

## Test Requirements

- [ ] Full test suite passes: `node --test .github/orchestration/scripts/tests/*.test.js` — 307+ pass, 0 fail
- [ ] Orchestration validator passes: `node .github/orchestration/scripts/validate-orchestration.js` — 71+ checks, 0 errors
- [ ] `archive/` exists
- [ ] `archive/schemas/` exists and contains exactly 14 files
- [ ] `assets/` exists
- [ ] `assets/dashboard-screenshot.png` exists
- [ ] `.github/orchestration/scripts/` exists
- [ ] `.github/orchestration/scripts/tests/` exists
- [ ] `docs/` exists
- [ ] `src/` does NOT exist
- [ ] `tests/` does NOT exist
- [ ] `plan/` does NOT exist
- [ ] `bin/` does NOT exist
- [ ] Root directory contains: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md`
- [ ] No unexpected directories at root level
- [ ] Frozen artifact boundary intact (zero modifications to `.github/projects/` excluding this project's state/status)
- [ ] Pattern `\bsrc/(next-action|triage|validate-state|lib/)` returns 0 matches in active files
- [ ] Pattern `\btests/.*\.test\.js` returns 0 matches in active files

## Acceptance Criteria

- [ ] All tests pass (307/307+, 0 failures)
- [ ] validate-orchestration reports zero errors (71/71+ checks)
- [ ] All 7 directory existence checks pass (archive/, archive/schemas/, assets/, assets/dashboard-screenshot.png, .github/orchestration/scripts/, .github/orchestration/scripts/tests/, docs/)
- [ ] All 4 directory absence checks pass (src/, tests/, plan/, bin/ do NOT exist)
- [ ] Root directory matches target structure: `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, `README.md` (plus optional `.git/`, `.gitignore`)
- [ ] Frozen artifact boundary intact — zero modifications to `.github/projects/` files (excluding ORCHESTRATION-REORG state.json and STATUS.md)
- [ ] Zero stale path references: `\bsrc/(next-action|triage|validate-state|lib/)` returns 0 matches in active files
- [ ] Zero stale path references: `\btests/.*\.test\.js` returns 0 matches in active files

## Constraints

- Do NOT create or modify any files — this is a read-only validation gate
- Do NOT modify files under `.github/projects/` (frozen artifact boundary)
- Do NOT count matches in `archive/` or `.github/projects/` when checking for stale paths — those are historical/frozen records
- Do NOT skip any validation step — all 7 steps must execute and all must pass for the gate to pass
- If ANY check fails, report the task as FAILED with details of which check(s) failed
