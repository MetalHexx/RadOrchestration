---
project: "ORCHESTRATION-REORG"
phase: 5
task: 1
title: "Fix Carry-Forward Items"
status: "pending"
skills_required: ["file-editing"]
skills_optional: []
estimated_files: 2
---

# Fix Carry-Forward Items

## Objective

Fix the 4 stale `tests/` path references in `.github/skills/validate-orchestration/README.md` and create the missing `.github/skills/triage-report/templates/` directory so that validate-orchestration passes 71/71 with zero failures.

## Context

During Phase 4, Code Review P04-T06 identified 4 stale `tests/` path references in the validate-orchestration README that still point to the old workspace-root `tests/` directory (now migrated to `.github/orchestration/scripts/tests/`). Separately, the validate-orchestration tool has a pre-existing 1-failure result (70/71) because `.github/skills/triage-report/templates/` does not exist — the skills checker expects every skill with template links to have a `templates/` subdirectory. Both issues must be resolved before the Phase 5 final validation gate.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/validate-orchestration/README.md` | Fix 4 stale `tests/` path references |
| CREATE | `.github/skills/triage-report/templates/.gitkeep` | Create the missing `templates/` directory with a `.gitkeep` placeholder |

## Implementation Steps

1. Open `.github/skills/validate-orchestration/README.md`.

2. In the **Project Layout** code block (around line 155), replace:
   ```
   tests/                           ← test suite (workspace root)
       agents.test.js
       config.test.js
       cross-refs.test.js
       frontmatter.test.js
       ...
   ```
   with:
   ```
   .github/orchestration/scripts/tests/   ← test suite
       agents.test.js
       config.test.js
       cross-refs.test.js
       frontmatter.test.js
       ...
   ```

3. In the **Running the Tests** section (around line 171), replace:
   ```bash
   node tests/agents.test.js
   node tests/skills.test.js
   ```
   with:
   ```bash
   node .github/orchestration/scripts/tests/agents.test.js
   node .github/orchestration/scripts/tests/skills.test.js
   ```

4. In the same section (around line 176), replace:
   ```powershell
   $files = Get-ChildItem tests/*.test.js | ForEach-Object { $_.FullName }
   ```
   with:
   ```powershell
   $files = Get-ChildItem .github/orchestration/scripts/tests/*.test.js | ForEach-Object { $_.FullName }
   ```

5. Create the directory `.github/skills/triage-report/templates/` by creating a `.gitkeep` file inside it:
   - File path: `.github/skills/triage-report/templates/.gitkeep`
   - File content: empty (0 bytes)

6. Verify the fixes:
   - Run: `Select-String -Path ".github/skills/validate-orchestration/README.md" -Pattern "(?<!\.)tests/"` — expect **zero** matches (no bare `tests/` references remain).
   - Run: `Test-Path ".github/skills/triage-report/templates/"` — expect `True`.
   - Run: `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` — expect 71/71 passed, 0 failures.

## Contracts & Interfaces

*Not applicable — this task modifies documentation and creates a directory; no code contracts.*

## Styles & Design Tokens

*Not applicable — no UI work.*

## Test Requirements

- [ ] `Select-String -Path ".github/skills/validate-orchestration/README.md" -Pattern "(?<!\.)tests/"` returns zero matches
- [ ] `Test-Path ".github/skills/triage-report/templates/"` returns `True`
- [ ] `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` reports 71/71 passed, 0 failures
- [ ] `node --test .github/orchestration/scripts/tests/*.test.js` still passes 307/307 (no regression)

## Acceptance Criteria

- [ ] `.github/skills/validate-orchestration/README.md` contains zero bare `tests/` path references (all 4 occurrences updated to `.github/orchestration/scripts/tests/`)
- [ ] `.github/skills/triage-report/templates/` directory exists
- [ ] validate-orchestration passes 71/71 with 0 failures
- [ ] Full test suite passes (307/307, 0 failures)
- [ ] No files outside the two targets were modified

## Constraints

- Do NOT modify any files under `.github/projects/` (frozen artifact boundary)
- Do NOT modify any source code — this is documentation and directory-only work
- Do NOT change the structure or content of `.github/skills/triage-report/SKILL.md`
- Do NOT add any files to `.github/skills/triage-report/templates/` beyond `.gitkeep`
